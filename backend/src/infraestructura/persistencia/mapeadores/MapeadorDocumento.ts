import type { Registro } from '../../../dominio/contratos/repositorio';
import type { ICifrador } from '../../../dominio/contratos/servicios_externos';
import type { UbicacionDominio } from '../../../dominio/reglas/ubicacion';
import { identificador_a_texto, identificador_para_guardar } from '../identificadores';

/**
 * Definición explícita de mapeo entre la API (snake_case) y el documento MongoDB (nombres heredados).
 * Es la "capa de compatibilidad": los nombres antiguos se conservan en la base y nunca se renombran.
 */
export interface DefinicionMapeo {
  /** campo_api → campoEnBase */
  campos: Record<string, string>;
  /** Campos de la API que contienen identificadores de otros registros. */
  referencias?: string[];
  /** Campos de la API que son fechas (pueden estar guardadas como texto o Date). */
  fechas?: string[];
  /** campo_api → campoEnBase para datos sensibles cifrados. Los valores lista se guardan como JSON. */
  cifrados?: Record<string, string>;
  /** El registro tiene ubicación geográfica (campo "ubicacion"). */
  tiene_ubicacion?: boolean;
}

function fecha_a_texto(valor: unknown): string | null {
  if (valor === null || valor === undefined || valor === '') return null;
  const fecha = valor instanceof Date ? valor : new Date(String(valor));
  return Number.isNaN(fecha.getTime()) ? String(valor) : fecha.toISOString();
}

export class MapeadorDocumento {
  private readonly _definicion: DefinicionMapeo;
  private readonly _cifrador: ICifrador | null;
  private readonly _campos_inversos: Record<string, string>;

  constructor(definicion: DefinicionMapeo, cifrador: ICifrador | null = null) {
    this._definicion = definicion;
    this._cifrador = cifrador;
    this._campos_inversos = Object.fromEntries(Object.entries(definicion.campos).map(([api, base]) => [base, api]));
  }

  campo_base(campo_api: string): string {
    if (campo_api === 'id') return '_id';
    if (campo_api === 'creado_en') return 'createdAt';
    if (campo_api === 'actualizado_en') return 'updatedAt';
    const campo = this._definicion.campos[campo_api];
    if (!campo) throw new Error(`Campo sin mapeo: ${campo_api}`);
    return campo;
  }

  es_referencia(campo_api: string): boolean {
    return campo_api === 'id' || (this._definicion.referencias ?? []).includes(campo_api);
  }

  es_fecha(campo_api: string): boolean {
    return ['creado_en', 'actualizado_en'].includes(campo_api) || (this._definicion.fechas ?? []).includes(campo_api);
  }

  a_dominio(documento: Record<string, unknown>): Registro {
    const registro: Registro = { id: identificador_a_texto(documento._id) ?? '' };
    for (const [campo_api, campo_base] of Object.entries(this._definicion.campos)) {
      const valor = documento[campo_base];
      if (this.es_referencia(campo_api)) registro[campo_api] = identificador_a_texto(valor);
      else if (this.es_fecha(campo_api)) registro[campo_api] = fecha_a_texto(valor);
      else registro[campo_api] = valor === undefined ? null : valor;
    }
    for (const [campo_api, campo_base] of Object.entries(this._definicion.cifrados ?? {})) {
      registro[campo_api] = this._descifrar(documento[campo_base]);
    }
    if (this._definicion.tiene_ubicacion) registro.ubicacion = this._ubicacion_a_dominio(documento.ubicacion);
    registro.creado_en = fecha_a_texto(documento.createdAt);
    registro.actualizado_en = fecha_a_texto(documento.updatedAt);
    return registro;
  }

  a_documento(datos: Record<string, unknown>): Record<string, unknown> {
    const documento: Record<string, unknown> = {};
    for (const [campo_api, valor] of Object.entries(datos)) {
      if (campo_api === 'id' || campo_api === 'creado_en' || campo_api === 'actualizado_en') continue;
      if (campo_api === 'ubicacion' && this._definicion.tiene_ubicacion) {
        documento.ubicacion = this._ubicacion_a_documento(valor as UbicacionDominio | null);
        continue;
      }
      const campo_cifrado = this._definicion.cifrados?.[campo_api];
      if (campo_cifrado) {
        documento[campo_cifrado] = this._cifrar(valor);
        continue;
      }
      const campo_base = this._definicion.campos[campo_api];
      if (!campo_base) continue;
      documento[campo_base] = this.valor_para_guardar(campo_api, valor);
    }
    return documento;
  }

  valor_para_guardar(campo_api: string, valor: unknown): unknown {
    if (valor === null || valor === undefined) return null;
    if (this.es_referencia(campo_api)) return identificador_para_guardar(String(valor));
    if (this.es_fecha(campo_api)) return new Date(String(valor));
    return valor;
  }

  private _cifrar(valor: unknown): string | null {
    if (valor === null || valor === undefined || (Array.isArray(valor) && valor.length === 0) || valor === '') return null;
    if (!this._cifrador) throw new Error('Se requiere un cifrador para este mapeo.');
    return this._cifrador.cifrar(JSON.stringify(valor));
  }

  private _descifrar(valor: unknown): unknown {
    if (typeof valor !== 'string' || valor === '' || !this._cifrador) return null;
    try {
      return JSON.parse(this._cifrador.descifrar(valor));
    } catch {
      return null;
    }
  }

  private _ubicacion_a_dominio(valor: unknown): UbicacionDominio {
    const ubicacion = (valor ?? {}) as Record<string, unknown>;
    const punto = ubicacion.punto as { coordinates?: unknown[] } | null | undefined;
    const coordenadas = Array.isArray(punto?.coordinates) ? punto?.coordinates : null;
    const tiene_punto = coordenadas && Number.isFinite(Number(coordenadas[0])) && Number.isFinite(Number(coordenadas[1]));
    const estado = ['pendiente', 'confirmada'].includes(String(ubicacion.estado)) && tiene_punto ? ubicacion.estado : 'sin_ubicacion';
    return {
      estado: estado as UbicacionDominio['estado'],
      // GeoJSON guarda [longitud, latitud].
      punto: tiene_punto && coordenadas ? { latitud: Number(coordenadas[1]), longitud: Number(coordenadas[0]) } : null,
      direccion_consultada: (ubicacion.direccionConsultada as string) ?? null,
      direccion_encontrada: (ubicacion.direccionEncontrada as string) ?? null,
      origen: (ubicacion.origen as UbicacionDominio['origen']) ?? null,
      precision: (ubicacion.precision as UbicacionDominio['precision']) ?? null,
      confirmada_por: identificador_a_texto(ubicacion.confirmadaPor),
      confirmada_en: fecha_a_texto(ubicacion.confirmadaEn),
    };
  }

  private _ubicacion_a_documento(ubicacion: UbicacionDominio | null): Record<string, unknown> {
    if (!ubicacion || ubicacion.estado === 'sin_ubicacion' || !ubicacion.punto) return { estado: 'sin_ubicacion', punto: null };
    return {
      estado: ubicacion.estado,
      punto: { type: 'Point', coordinates: [ubicacion.punto.longitud, ubicacion.punto.latitud] },
      direccionConsultada: ubicacion.direccion_consultada,
      direccionEncontrada: ubicacion.direccion_encontrada,
      origen: ubicacion.origen,
      precision: ubicacion.precision,
      confirmadaPor: ubicacion.confirmada_por ? identificador_para_guardar(ubicacion.confirmada_por) : null,
      confirmadaEn: ubicacion.confirmada_en ? new Date(ubicacion.confirmada_en) : null,
    };
  }

  /** Campo de la API correspondiente a un campo de la base (para mensajes de error). */
  campo_api(campo_base: string): string | undefined {
    return this._campos_inversos[campo_base];
  }
}
