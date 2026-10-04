import type { FiltroTablero, IndicadoresTablero, SerieMensual } from '../../dominio/contratos/estadisticas';
import type { CondicionCampo, IRepositorioEntidad, Registro } from '../../dominio/contratos/repositorio';
import type { CoincidenciaGeocodificacion, IGeocodificador } from '../../dominio/contratos/servicios_externos';
import { ErrorAplicacion, ErrorSinPermiso, ErrorValidacion } from '../../dominio/errores';
import { interpretar_estado_atencion } from '../../dominio/estados/estados_atencion_zona';
import { interpretar_estado_almacenado } from '../../dominio/estados/EstadosEmergencia';
import { tiene_permiso } from '../../dominio/reglas/permisos';
import { validar_datos } from '../../dominio/validacion/validador';
import type { ContextoSolicitud, ParametrosConsulta } from '../dto/contexto';
import type { RepositoriosAplicacion } from '../dto/repositorios';
import type { CacheConsultas } from './CacheConsultas';

function texto_parametro(parametros: ParametrosConsulta, nombre: string): string | undefined {
  const valor = parametros[nombre];
  return typeof valor === 'string' && valor.trim() !== '' ? valor.trim().slice(0, 120) : undefined;
}

function exigir_consulta(contexto: ContextoSolicitud): void {
  if (!tiene_permiso(contexto.usuario.rol, 'consultar_mapa_y_dashboard')) throw new ErrorSinPermiso();
}

/** Dashboard (sección 16): indicadores calculados en MongoDB, con filtros permitidos. */
export class ServicioTablero {
  private readonly _repositorios: RepositoriosAplicacion;
  private readonly _cache: CacheConsultas;

  constructor(repositorios: RepositoriosAplicacion, cache: CacheConsultas) {
    this._repositorios = repositorios;
    this._cache = cache;
  }

  leer_filtro(parametros: ParametrosConsulta): FiltroTablero {
    const filtro: FiltroTablero = {
      departamento: texto_parametro(parametros, 'departamento'),
      municipio: texto_parametro(parametros, 'municipio'),
      tipo: texto_parametro(parametros, 'tipo'),
      nivel_emergencia: texto_parametro(parametros, 'nivel_emergencia'),
      estado: texto_parametro(parametros, 'estado'),
      desde: texto_parametro(parametros, 'desde'),
      hasta: texto_parametro(parametros, 'hasta'),
    };
    for (const campo of ['desde', 'hasta'] as const) {
      if (filtro[campo] && Number.isNaN(new Date(String(filtro[campo])).getTime())) {
        throw new ErrorValidacion({ [campo]: 'La fecha del filtro no es válida.' });
      }
    }
    if (filtro.hasta && /^\d{4}-\d{2}-\d{2}$/.test(filtro.hasta)) filtro.hasta = `${filtro.hasta}T23:59:59.999Z`;
    return filtro;
  }

  async indicadores(parametros: ParametrosConsulta, contexto: ContextoSolicitud): Promise<IndicadoresTablero & { generado_en: string }> {
    exigir_consulta(contexto);
    const filtro = this.leer_filtro(parametros);
    // Los indicadores son agregados (sin datos personales) e iguales para todos los roles: se comparten en caché.
    return this._cache.obtener(`tablero:${JSON.stringify(filtro)}`, async () => ({
      ...(await this._repositorios.estadisticas.obtener_indicadores(filtro)),
      generado_en: new Date().toISOString(),
    }));
  }

  async serie_mensual(parametros: ParametrosConsulta, contexto: ContextoSolicitud): Promise<SerieMensual> {
    exigir_consulta(contexto);
    const anio = Number(texto_parametro(parametros, 'anio') ?? new Date().getUTCFullYear());
    if (!Number.isInteger(anio) || anio < 1990 || anio > 2200) throw new ErrorValidacion({ anio: 'El año no es válido.' });
    const filtro = this.leer_filtro(parametros);
    return this._cache.obtener(`serie:${anio}:${JSON.stringify(filtro)}`, () => this._repositorios.estadisticas.obtener_serie_mensual(anio, filtro));
  }
}

export interface ElementoMapa {
  capa: 'emergencias' | 'zonas' | 'centros';
  id: string;
  titulo: string;
  direccion: string;
  departamento: string;
  municipio: string;
  estado: string;
  nivel: string | null;
  estado_ubicacion: string;
  precision: string | null;
  /** Coordenadas internas, sólo para dibujar; nunca se muestran ni se piden al usuario. */
  punto: { latitud: number; longitud: number } | null;
  detalle: Record<string, unknown>;
  geometria: unknown;
}

const LIMITE_POR_CAPA = 2000;

/** Mapa general (RF11): emergencias, zonas y centros reales, con filtros sincronizados. */
export class ServicioMapa {
  private readonly _repositorios: RepositoriosAplicacion;
  private readonly _cache: CacheConsultas;

  constructor(repositorios: RepositoriosAplicacion, cache: CacheConsultas) {
    this._repositorios = repositorios;
    this._cache = cache;
  }

  async consultar(parametros: ParametrosConsulta, contexto: ContextoSolicitud): Promise<{ elementos: ElementoMapa[]; pendientes_ubicacion: number }> {
    exigir_consulta(contexto);
    const claves = ['capas', 'departamento', 'municipio', 'nivel', 'estado', 'catastrofe_id'].map((nombre) => texto_parametro(parametros, nombre) ?? '');
    return this._cache.obtener(`mapa:${claves.join('|')}`, () => this._calcular(parametros));
  }

  private async _calcular(parametros: ParametrosConsulta): Promise<{ elementos: ElementoMapa[]; pendientes_ubicacion: number }> {
    const capas_solicitadas = (texto_parametro(parametros, 'capas') ?? 'emergencias,zonas,centros').split(',');
    const capas = ['emergencias', 'zonas', 'centros'].filter((capa) => capas_solicitadas.includes(capa));
    const departamento = texto_parametro(parametros, 'departamento');
    const municipio = texto_parametro(parametros, 'municipio');
    const nivel = texto_parametro(parametros, 'nivel');
    const estado = texto_parametro(parametros, 'estado');
    const catastrofe_id = texto_parametro(parametros, 'catastrofe_id');
    const comunes: CondicionCampo[] = [];
    if (departamento) comunes.push({ campo: 'departamento', operador: 'igual', valor: departamento });
    if (municipio) comunes.push({ campo: 'municipio', operador: 'igual', valor: municipio });

    const elementos: ElementoMapa[] = [];
    if (capas.includes('emergencias')) {
      const condiciones = [...comunes];
      if (nivel) condiciones.push({ campo: 'nivel_emergencia', operador: 'igual', valor: nivel });
      if (estado) condiciones.push({ campo: 'estado', operador: 'igual', valor: estado });
      const emergencias = await this._repositorios.emergencias.listar_todos(condiciones, LIMITE_POR_CAPA);
      elementos.push(
        ...emergencias
          .filter((emergencia) => !catastrofe_id || emergencia.id === catastrofe_id)
          .map((emergencia) => this._elemento('emergencias', emergencia, {
            titulo: String(emergencia.titulo ?? ''),
            direccion: String(emergencia.direccion_referencia ?? ''),
            estado: interpretar_estado_almacenado(emergencia.estado) ?? String(emergencia.estado ?? ''),
            nivel: String(emergencia.nivel_emergencia ?? ''),
            detalle: { tipo: emergencia.tipo, magnitud: emergencia.magnitud, fecha_inicio: emergencia.fecha_inicio },
          })),
      );
    }
    if (capas.includes('zonas')) {
      const condiciones = [...comunes];
      if (nivel) condiciones.push({ campo: 'nivel_afectacion', operador: 'igual', valor: nivel });
      if (catastrofe_id) condiciones.push({ campo: 'catastrofe_id', operador: 'igual', valor: catastrofe_id });
      const zonas = (await this._repositorios.zonas.listar_todos(condiciones, LIMITE_POR_CAPA)).filter(
        (zona) => !estado || zona.estado === estado || interpretar_estado_atencion(zona.estado_atencion) === estado,
      );
      const necesidades = zonas.length
        ? await this._repositorios.necesidades.listar_todos(
            [
              { campo: 'zona_id', operador: 'en', valor: zonas.map((zona) => zona.id) },
              { campo: 'estado', operador: 'en', valor: ['pendiente', 'en_proceso'] },
            ],
            5000,
          )
        : [];
      elementos.push(
        ...zonas.map((zona) =>
          this._elemento('zonas', zona, {
            titulo: `${zona.barrio || zona.direccion} · ${zona.municipio}`,
            direccion: String(zona.direccion ?? ''),
            estado: interpretar_estado_atencion(zona.estado_atencion),
            nivel: String(zona.nivel_afectacion ?? ''),
            detalle: {
              porcentaje_afectacion: zona.porcentaje_afectacion,
              prioridad: zona.prioridad,
              catastrofe_id: zona.catastrofe_id,
              necesidades_pendientes: necesidades
                .filter((necesidad) => necesidad.zona_id === zona.id)
                .map((necesidad) => `${necesidad.tipo} (${necesidad.prioridad})`)
                .slice(0, 5),
            },
            geometria: zona.geometria_validada === true ? zona.geometria : null,
          }),
        ),
      );
    }
    if (capas.includes('centros') && !nivel && !catastrofe_id) {
      const condiciones = [...comunes];
      if (estado) condiciones.push({ campo: 'estado', operador: 'igual', valor: estado });
      const centros = await this._repositorios.centros.listar_todos(condiciones, LIMITE_POR_CAPA);
      elementos.push(
        ...centros.map((centro) =>
          this._elemento('centros', centro, {
            titulo: String(centro.nombre ?? ''),
            direccion: String(centro.direccion ?? ''),
            estado: String(centro.estado ?? ''),
            nivel: null,
            detalle: { horario: centro.horario, tipos_donacion: centro.tipos_donacion, telefono: centro.telefono },
          }),
        ),
      );
    }
    return { elementos, pendientes_ubicacion: elementos.filter((elemento) => elemento.estado_ubicacion !== 'confirmada').length };
  }

  private _elemento(
    capa: ElementoMapa['capa'],
    registro: Registro,
    datos: { titulo: string; direccion: string; estado: string; nivel: string | null; detalle: Record<string, unknown>; geometria?: unknown },
  ): ElementoMapa {
    const ubicacion = (registro.ubicacion ?? {}) as { estado?: string; punto?: ElementoMapa['punto']; precision?: string | null };
    const estado_ubicacion = ubicacion.estado ?? 'sin_ubicacion';
    return {
      capa,
      id: registro.id,
      titulo: datos.titulo,
      direccion: datos.direccion,
      departamento: String(registro.departamento ?? ''),
      municipio: String(registro.municipio ?? ''),
      estado: datos.estado,
      nivel: datos.nivel,
      estado_ubicacion,
      precision: ubicacion.precision ?? null,
      // Sólo las ubicaciones confirmadas se dibujan; las pendientes se listan sin marcador.
      punto: estado_ubicacion === 'confirmada' ? (ubicacion.punto ?? null) : null,
      detalle: datos.detalle,
      geometria: datos.geometria ?? null,
    };
  }
}

/** Búsqueda global de la barra superior y catálogos con valores reales de la base. */
export class ServicioBusqueda {
  private readonly _repositorios: RepositoriosAplicacion;

  constructor(repositorios: RepositoriosAplicacion) {
    this._repositorios = repositorios;
  }

  async buscar(parametros: ParametrosConsulta, contexto: ContextoSolicitud): Promise<{ tipo: string; id: string; titulo: string; subtitulo: string }[]> {
    exigir_consulta(contexto);
    const texto = texto_parametro(parametros, 'q');
    if (!texto || texto.length < 2) return [];
    const buscar_en = async (repositorio: IRepositorioEntidad, campos: string[]) =>
      (await repositorio.listar({ condiciones: [], busqueda: { texto, campos }, pagina: 1, limite: 5 })).elementos;
    const [emergencias, zonas, recursos, centros] = await Promise.all([
      buscar_en(this._repositorios.emergencias, ['titulo', 'municipio', 'tipo']),
      buscar_en(this._repositorios.zonas, ['direccion', 'barrio', 'municipio']),
      buscar_en(this._repositorios.recursos, ['descripcion', 'tipo', 'ubicacion_almacen']),
      buscar_en(this._repositorios.centros, ['nombre', 'municipio']),
    ]);
    return [
      ...emergencias.map((registro) => ({ tipo: 'emergencias', id: registro.id, titulo: String(registro.titulo), subtitulo: `${registro.tipo} · ${registro.municipio}` })),
      ...zonas.map((registro) => ({ tipo: 'zonas', id: registro.id, titulo: String(registro.barrio || registro.direccion), subtitulo: `Zona · ${registro.municipio}` })),
      ...recursos.map((registro) => ({ tipo: 'recursos', id: registro.id, titulo: String(registro.descripcion), subtitulo: `Recurso · ${registro.ubicacion_almacen}` })),
      ...centros.map((registro) => ({ tipo: 'centros', id: registro.id, titulo: String(registro.nombre), subtitulo: `Centro · ${registro.municipio}` })),
    ];
  }

  /** Departamentos y municipios realmente registrados (no se inventan listas). */
  async ubicaciones(contexto: ContextoSolicitud): Promise<{ departamentos: string[]; municipios: { departamento: string; municipio: string }[] }> {
    exigir_consulta(contexto);
    const repositorios = [this._repositorios.emergencias, this._repositorios.zonas, this._repositorios.centros];
    const pares = new Map<string, { departamento: string; municipio: string }>();
    for (const repositorio of repositorios) {
      const registros = await repositorio.listar_todos([], 5000);
      for (const registro of registros) {
        const departamento = String(registro.departamento ?? '').trim();
        const municipio = String(registro.municipio ?? '').trim();
        if (departamento && municipio) pares.set(`${departamento}|${municipio}`, { departamento, municipio });
      }
    }
    const municipios = [...pares.values()].sort((primero, segundo) => primero.municipio.localeCompare(segundo.municipio, 'es'));
    const departamentos = [...new Set(municipios.map((par) => par.departamento))].sort((primero, segundo) => primero.localeCompare(segundo, 'es'));
    return { departamentos, municipios };
  }
}

const ESQUEMA_GEOCODIFICACION = {
  pais: { tipo: 'texto', etiqueta: 'País', requerido: true, max_longitud: 80 },
  departamento: { tipo: 'texto', etiqueta: 'Departamento', requerido: true, max_longitud: 80 },
  municipio: { tipo: 'texto', etiqueta: 'Municipio', requerido: true, max_longitud: 80 },
  barrio: { tipo: 'texto', etiqueta: 'Barrio', max_longitud: 120 },
  direccion: { tipo: 'texto', etiqueta: 'Dirección', requerido: true, min_longitud: 3, max_longitud: 200 },
} as const;

export const MENSAJE_FALLO_GEOCODIFICACION =
  'El servicio de geocodificación no está disponible en este momento. Puedes señalar el lugar en el mapa o guardar el registro como pendiente de ubicación.';

/** Geocodificación (sección 14): sólo funcionario y administrador registran ubicaciones. */
export class ServicioGeocodificacion {
  private readonly _geocodificador: IGeocodificador;

  constructor(geocodificador: IGeocodificador) {
    this._geocodificador = geocodificador;
  }

  async buscar(parametros: ParametrosConsulta, contexto: ContextoSolicitud): Promise<CoincidenciaGeocodificacion[]> {
    if (!tiene_permiso(contexto.usuario.rol, 'editar_registros_operativos')) throw new ErrorSinPermiso();
    const validacion = validar_datos(parametros, ESQUEMA_GEOCODIFICACION);
    if (!validacion.es_valido) throw new ErrorValidacion(validacion.errores);
    try {
      return await this._geocodificador.buscar({
        pais: String(validacion.datos.pais),
        departamento: String(validacion.datos.departamento),
        municipio: String(validacion.datos.municipio),
        barrio: validacion.datos.barrio ? String(validacion.datos.barrio) : undefined,
        direccion: String(validacion.datos.direccion),
      });
    } catch {
      // Mensaje único sin importar el proveedor: indica cómo continuar sin inventar una ubicación.
      throw new ErrorAplicacion('SERVICIO_EXTERNO', MENSAJE_FALLO_GEOCODIFICACION);
    }
  }

  async inversa(parametros: ParametrosConsulta, contexto: ContextoSolicitud): Promise<{ direccion_aproximada: string | null }> {
    if (!tiene_permiso(contexto.usuario.rol, 'editar_registros_operativos')) throw new ErrorSinPermiso();
    const latitud = Number(parametros.latitud);
    const longitud = Number(parametros.longitud);
    if (!Number.isFinite(latitud) || !Number.isFinite(longitud) || Math.abs(latitud) > 90 || Math.abs(longitud) > 180) {
      throw new ErrorValidacion({ punto: 'El punto seleccionado no es válido.' });
    }
    return { direccion_aproximada: await this._geocodificador.buscar_inversa(latitud, longitud) };
  }
}
