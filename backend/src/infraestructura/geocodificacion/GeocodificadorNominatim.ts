import { ErrorAplicacion } from '../../dominio/errores';
import type {
  CoincidenciaGeocodificacion,
  IGeocodificador,
  ParametrosGeocodificacion,
} from '../../dominio/contratos/servicios_externos';
import { componer_direccion, normalizar_texto_comparacion } from '../../dominio/validacion/validador';

interface RespuestaNominatim {
  lat: string;
  lon: string;
  display_name: string;
  addresstype?: string;
  type?: string;
}

interface EntradaCache {
  vence: number;
  valor: unknown;
}

const DURACION_CACHE_MS = 24 * 60 * 60 * 1000;
const MAXIMO_ENTRADAS_CACHE = 1000;
const TIPOS_APROXIMADOS = ['suburb', 'neighbourhood', 'quarter', 'city', 'town', 'village', 'municipality', 'county', 'state'];

/**
 * Geocodificación con Nominatim (OpenStreetMap), respetando su política de uso:
 * - Una solicitud por segundo como máximo (cola con intervalo configurable).
 * - Identificación mediante User-Agent y correo de contacto.
 * - Caché de 24 horas para no repetir consultas idénticas.
 * El frontend sólo consulta cuando el funcionario pulsa "Buscar dirección" (nunca por pulsación).
 */
export class GeocodificadorNominatim implements IGeocodificador {
  private readonly _url_base: string;
  private readonly _correo_contacto: string;
  private readonly _intervalo_ms: number;
  private readonly _cache = new Map<string, EntradaCache>();
  private _ultima_solicitud = 0;
  private _cola: Promise<void> = Promise.resolve();

  constructor(url_base: string, correo_contacto: string, intervalo_ms: number) {
    this._url_base = url_base;
    this._correo_contacto = correo_contacto;
    this._intervalo_ms = intervalo_ms;
  }

  async buscar(parametros: ParametrosGeocodificacion): Promise<CoincidenciaGeocodificacion[]> {
    const direccion_completa = componer_direccion(parametros);
    const resultados = await this._consultar_busqueda(direccion_completa);
    let coincidencias = resultados.map((resultado) => this._convertir(resultado, 'direccion'));
    if (coincidencias.length === 0) {
      // Segundo intento sólo con barrio y municipio: el resultado se marca como APROXIMADO
      // y el funcionario debe confirmarlo o ajustarlo; nunca se presenta como exacto.
      const direccion_aproximada = componer_direccion({ ...parametros, direccion: '' });
      const aproximados = await this._consultar_busqueda(direccion_aproximada);
      coincidencias = aproximados.map((resultado) => this._convertir(resultado, 'aproximada'));
    }
    return coincidencias;
  }

  async buscar_inversa(latitud: number, longitud: number): Promise<string | null> {
    const clave = `inversa:${latitud.toFixed(5)},${longitud.toFixed(5)}`;
    const en_cache = this._leer_cache(clave);
    if (en_cache !== undefined) return en_cache as string | null;
    const parametros = new URLSearchParams({ lat: String(latitud), lon: String(longitud), format: 'jsonv2', zoom: '18' });
    if (this._correo_contacto) parametros.set('email', this._correo_contacto);
    const respuesta = (await this._solicitar(`/reverse?${parametros.toString()}`)) as { display_name?: string } | null;
    const direccion = respuesta?.display_name ?? null;
    this._guardar_cache(clave, direccion);
    return direccion;
  }

  private async _consultar_busqueda(direccion: string): Promise<RespuestaNominatim[]> {
    if (direccion.trim() === '') return [];
    const clave = `busqueda:${normalizar_texto_comparacion(direccion)}`;
    const en_cache = this._leer_cache(clave);
    if (en_cache !== undefined) return en_cache as RespuestaNominatim[];
    const parametros = new URLSearchParams({ q: direccion, format: 'jsonv2', limit: '5', addressdetails: '0' });
    if (this._correo_contacto) parametros.set('email', this._correo_contacto);
    const respuesta = await this._solicitar(`/search?${parametros.toString()}`);
    const resultados = Array.isArray(respuesta) ? (respuesta as RespuestaNominatim[]) : [];
    this._guardar_cache(clave, resultados);
    return resultados;
  }

  private _convertir(resultado: RespuestaNominatim, precision: 'direccion' | 'aproximada'): CoincidenciaGeocodificacion {
    const tipo_lugar = resultado.addresstype ?? resultado.type ?? 'lugar';
    return {
      direccion_encontrada: resultado.display_name,
      punto: { latitud: Number(resultado.lat), longitud: Number(resultado.lon) },
      precision: precision === 'direccion' && TIPOS_APROXIMADOS.includes(tipo_lugar) ? 'aproximada' : precision,
      tipo_lugar,
    };
  }

  /** Serializa las solicitudes para respetar el intervalo mínimo entre llamadas al proveedor. */
  private _solicitar(ruta: string): Promise<unknown> {
    const ejecucion = this._cola.then(async () => {
      const espera = this._ultima_solicitud + this._intervalo_ms - Date.now();
      if (espera > 0) await new Promise((resolver) => setTimeout(resolver, espera));
      this._ultima_solicitud = Date.now();
      try {
        const respuesta = await fetch(`${this._url_base}${ruta}`, {
          headers: {
            'User-Agent': `SGRICN/1.0 (gestion de emergencias${this._correo_contacto ? `; ${this._correo_contacto}` : ''})`,
            'Accept-Language': 'es',
          },
          signal: AbortSignal.timeout(8000),
        });
        if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
        return (await respuesta.json()) as unknown;
      } catch {
        throw new ErrorAplicacion(
          'SERVICIO_EXTERNO',
          'El servicio de geocodificación no está disponible en este momento. Puedes señalar el lugar en el mapa o guardar el registro como pendiente de ubicación.',
        );
      }
    });
    this._cola = ejecucion.then(
      () => undefined,
      () => undefined,
    );
    return ejecucion;
  }

  private _leer_cache(clave: string): unknown {
    const entrada = this._cache.get(clave);
    if (!entrada) return undefined;
    if (entrada.vence < Date.now()) {
      this._cache.delete(clave);
      return undefined;
    }
    return entrada.valor;
  }

  private _guardar_cache(clave: string, valor: unknown): void {
    if (this._cache.size >= MAXIMO_ENTRADAS_CACHE) {
      const clave_antigua = this._cache.keys().next().value;
      if (clave_antigua !== undefined) this._cache.delete(clave_antigua);
    }
    this._cache.set(clave, { vence: Date.now() + DURACION_CACHE_MS, valor });
  }
}
