import type { PipelineStage } from 'mongoose';
import type {
  ConteoAgrupado,
  FiltroTablero,
  IndicadoresTablero,
  IRepositorioEstadisticas,
  SerieMensual,
} from '../../../dominio/contratos/estadisticas';
import { CATEGORIAS_SOLAPABLES } from '../../../dominio/reglas/poblacion';
import { identificador_a_texto } from '../identificadores';
import {
  ModeloCentroDonacion,
  ModeloDonacion,
  ModeloEmergencia,
  ModeloFondo,
  ModeloNecesidad,
  ModeloPoblacion,
  ModeloRecurso,
  ModeloRecursoHumano,
  ModeloZona,
} from '../modelos/modelos';

type Documento = Record<string, unknown>;

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const CAMPOS_CATEGORIA: Record<string, string> = {
  personas_discapacidad: 'personasDiscapacidad',
  personas_heridas: 'personasHeridas',
  personas_fallecidas: 'personasFallecidas',
  personas_desaparecidas: 'personasDesaparecidas',
  personas_evacuadas: 'personasEvacuadas',
  personas_albergadas: 'personasAlbergadas',
  personas_pendientes_atencion: 'personasPendientesAtencion',
};

/** Convierte una fecha guardada como texto o Date a Date dentro de la agregación (sin modificar la base). */
const comoFecha = (campo: string) => ({ $convert: { input: `$${campo}`, to: 'date', onError: null, onNull: null } });

function escapar(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Indicadores calculados con agregaciones de MongoDB (sin cifras fijas).
 *
 * Regla para no duplicar personas: en Poblacion_afectada puede haber varios cortes para la misma
 * pareja (emergencia, zona). Sólo se toma el registro MÁS RECIENTE de cada pareja y se suma
 * personasAfectadas. Las categorías que pueden solaparse (heridas, evacuadas, con discapacidad, ...)
 * se informan por separado y NUNCA se suman entre sí ni al total.
 */
export class RepositorioEstadisticas implements IRepositorioEstadisticas {
  private _filtro_emergencias(filtro: FiltroTablero): Documento {
    const condiciones: Documento[] = [];
    const exacto = (valor: string) => new RegExp(`^${escapar(valor)}$`, 'i');
    if (filtro.departamento) condiciones.push({ departamento: exacto(filtro.departamento) });
    if (filtro.municipio) condiciones.push({ municipio: exacto(filtro.municipio) });
    if (filtro.tipo) condiciones.push({ tipo: filtro.tipo });
    if (filtro.nivel_emergencia) condiciones.push({ nivelEmergencia: filtro.nivel_emergencia });
    if (filtro.estado) condiciones.push({ estado: filtro.estado });
    if (filtro.desde || filtro.hasta) {
      const rango: Documento = {};
      if (filtro.desde) rango.$gte = new Date(filtro.desde);
      if (filtro.hasta) rango.$lte = new Date(filtro.hasta);
      condiciones.push({ $expr: { $and: Object.entries(rango).map(([operador, valor]) => ({ [operador]: [comoFecha('fechaInicio'), valor] })) } });
    }
    return condiciones.length > 0 ? { $and: condiciones } : {};
  }

  private _hay_filtro(filtro: FiltroTablero): boolean {
    return Object.values(filtro).some((valor) => valor !== undefined && valor !== '');
  }

  private async _contar_por(modelo: typeof ModeloEmergencia, coincidencia: Documento, campo: string, suma?: string): Promise<ConteoAgrupado[]> {
    const grupo: Documento = { _id: `$${campo}`, cantidad: { $sum: 1 } };
    if (suma) grupo.valor_total = { $sum: { $ifNull: [`$${suma}`, 0] } };
    const resultados = await modelo.aggregate<{ _id: unknown; cantidad: number; valor_total?: number }>([
      { $match: coincidencia },
      { $group: grupo },
      { $sort: { cantidad: -1 } },
    ] as PipelineStage[]);
    return resultados.map((resultado) => ({
      clave: resultado._id === null || resultado._id === undefined ? 'sin_dato' : String(resultado._id),
      cantidad: resultado.cantidad,
      ...(suma ? { valor_total: resultado.valor_total ?? 0 } : {}),
    }));
  }

  async obtener_indicadores(filtro: FiltroTablero): Promise<IndicadoresTablero> {
    const filtro_emergencias = this._filtro_emergencias(filtro);
    let relacion: Documento = {};
    if (this._hay_filtro(filtro)) {
      const identificadores = (await ModeloEmergencia.find(filtro_emergencias, { _id: 1 }).lean<Documento[]>()).map((documento) => documento._id);
      // Las referencias heredadas pueden estar guardadas como ObjectId o como texto.
      const posibles = identificadores.flatMap((identificador) => [identificador, identificador_a_texto(identificador)]);

      if (posibles.length > 0) {
        relacion = { catastrofeId: { $in: posibles } };
      } else {
        // Algunas bases heredadas conservan la relación con una clave textual de catástrofe
        // aunque no exista una emergencia con ese _id. Recuperamos esa clave desde las zonas
        // que coinciden con la ubicación solicitada, sin modificar ningún dato almacenado.
        const filtro_zonas: Documento = {};
        if (filtro.departamento) filtro_zonas.departamento = new RegExp(`^${escapar(filtro.departamento)}$`, 'i');
        if (filtro.municipio) filtro_zonas.municipio = new RegExp(`^${escapar(filtro.municipio)}$`, 'i');
        const zonas = await ModeloZona.find(filtro_zonas, { catastrofeId: 1 }).lean<Documento[]>();
        const catastrofes_zonas = zonas
          .map((zona) => zona.catastrofeId)
          .filter((valor) => valor !== undefined && valor !== null)
          .flatMap((valor) => [valor, identificador_a_texto(valor)]);
        if (catastrofes_zonas.length > 0) relacion = { catastrofeId: { $in: catastrofes_zonas } };
      }
    }
    const filtro_ubicacion_recursos: Documento = {};
    if (filtro.departamento) filtro_ubicacion_recursos.departamento = new RegExp(`^${escapar(filtro.departamento)}$`, 'i');
    if (filtro.municipio) filtro_ubicacion_recursos.municipio = new RegExp(`^${escapar(filtro.municipio)}$`, 'i');

    const [
      total_emergencias,
      por_estado,
      por_nivel,
      criticas_abiertas,
      total_zonas,
      zonas_sin_atender,
      zonas_criticas,
      por_estado_atencion,
      poblacion,
      necesidades_pendientes,
      necesidades_criticas,
      recursos,
      recursos_humanos,
      centros_activos,
      donaciones,
      fondos,
    ] = await Promise.all([
      ModeloEmergencia.countDocuments(filtro_emergencias),
      this._contar_por(ModeloEmergencia, filtro_emergencias, 'estado'),
      this._contar_por(ModeloEmergencia, filtro_emergencias, 'nivelEmergencia'),
      ModeloEmergencia.countDocuments({ $and: [filtro_emergencias, { nivelEmergencia: 'critico', estado: { $nin: ['finalizada', 'cerrada'] } }] }),
      ModeloZona.countDocuments(relacion),
      ModeloZona.countDocuments({ $and: [relacion, { $or: [{ estadoAtencion: { $exists: false } }, { estadoAtencion: null }, { estadoAtencion: 'sin_atender' }] }] }),
      ModeloZona.countDocuments({ $and: [relacion, { nivelAfectacion: 'critico' }] }),
      this._contar_por(ModeloZona, relacion, 'estadoAtencion'),
      this._agregar_poblacion(relacion),
      ModeloNecesidad.countDocuments({ $and: [relacion, { estado: { $in: ['pendiente', 'en_proceso'] } }] }),
      ModeloNecesidad.find({ $and: [relacion, { estado: { $in: ['pendiente', 'en_proceso'] }, prioridad: { $in: ['critica', 'alta'] } }] })
        .sort({ prioridad: 1, _id: -1 })
        .limit(5)
        .lean<Documento[]>(),
      ModeloRecurso.aggregate<Documento>([
        { $match: filtro_ubicacion_recursos },
        {
          $group: {
            _id: null,
            disponibles: { $sum: { $ifNull: ['$cantidadDisponible', 0] } },
            asignadas: { $sum: { $ifNull: ['$cantidadAsignada', 0] } },
            entregadas: { $sum: { $ifNull: ['$cantidadEntregada', 0] } },
            agotados: { $sum: { $cond: [{ $lte: [{ $ifNull: ['$cantidadDisponible', 0] }, 0] }, 1, 0] } },
            insuficientes: {
              $sum: {
                $cond: [
                  { $and: [{ $gt: ['$cantidadDisponible', 0] }, { $lt: ['$cantidadDisponible', { $ifNull: ['$cantidadMinima', 0] }] }] },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]),
      this._contar_por(ModeloRecursoHumano, {}, 'disponibilidad'),
      ModeloCentroDonacion.countDocuments({ estado: 'activo' }),
      ModeloDonacion.aggregate<{ _id: { tipo: string; estado: string }; cantidad: number; valor_total: number }>([
        { $match: relacion },
        { $group: { _id: { tipo: '$tipo', estado: '$estado' }, cantidad: { $sum: 1 }, valor_total: { $sum: { $ifNull: ['$valor', 0] } } } },
        { $sort: { '_id.tipo': 1 } },
      ]),
      ModeloFondo.aggregate<Documento>([
        { $match: { $and: [relacion, { estado: { $ne: 'anulado' } }] } },
        {
          $group: {
            _id: null,
            asignado: { $sum: '$montoAsignado' },
            comprometido: { $sum: '$montoComprometido' },
            gastado: { $sum: '$montoGastado' },
            disponible: { $sum: '$montoDisponible' },
          },
        },
      ]),
    ]);

    const recursos_totales = recursos[0] ?? {};
    const fondos_totales = fondos[0] ?? {};
    return {
      emergencias: { total: total_emergencias, por_estado, por_nivel, criticas_abiertas },
      zonas: { total: total_zonas, sin_atender: zonas_sin_atender, criticas: zonas_criticas, por_estado_atencion },
      poblacion,
      necesidades: {
        pendientes: necesidades_pendientes,
        criticas_pendientes: necesidades_criticas.map((necesidad) => ({
          id: identificador_a_texto(necesidad._id) ?? '',
          tipo: String(necesidad.tipo ?? ''),
          prioridad: String(necesidad.prioridad ?? ''),
          descripcion: String(necesidad.descripcion ?? ''),
        })),
      },
      recursos: {
        unidades_disponibles: Number(recursos_totales.disponibles ?? 0),
        unidades_asignadas: Number(recursos_totales.asignadas ?? 0),
        unidades_entregadas: Number(recursos_totales.entregadas ?? 0),
        insuficientes: Number(recursos_totales.insuficientes ?? 0),
        agotados: Number(recursos_totales.agotados ?? 0),
      },
      recursos_humanos,
      centros_activos,
      donaciones: donaciones.map((grupo) => ({
        clave: `${grupo._id.tipo ?? 'sin_tipo'}|${grupo._id.estado ?? 'sin_estado'}`,
        cantidad: grupo.cantidad,
        valor_total: grupo.valor_total,
      })),
      fondos: {
        asignado: Number(fondos_totales.asignado ?? 0),
        comprometido: Number(fondos_totales.comprometido ?? 0),
        gastado: Number(fondos_totales.gastado ?? 0),
        disponible: Number(fondos_totales.disponible ?? 0),
      },
    };
  }

  private async _agregar_poblacion(relacion: Documento): Promise<IndicadoresTablero['poblacion']> {
    const sumas_categorias = Object.fromEntries(
      CATEGORIAS_SOLAPABLES.map((categoria) => [categoria, { $sum: { $ifNull: [`$ultimo.${CAMPOS_CATEGORIA[categoria]}`, 0] } }]),
    );
    const [resultado] = await ModeloPoblacion.aggregate<Documento>([
      { $match: relacion },
      { $sort: { updatedAt: -1, _id: -1 } },
      // Un único registro (el más reciente) por pareja emergencia–zona.
      { $group: { _id: { catastrofe: '$catastrofeId', zona: '$zonaId' }, ultimo: { $first: '$$ROOT' } } },
      {
        $group: {
          _id: null,
          personas_afectadas: { $sum: { $ifNull: ['$ultimo.personasAfectadas', 0] } },
          familias_afectadas: { $sum: { $ifNull: ['$ultimo.familiasAfectadas', 0] } },
          registros_considerados: { $sum: 1 },
          ...sumas_categorias,
        },
      },
    ]);
    const categorias = Object.fromEntries(CATEGORIAS_SOLAPABLES.map((categoria) => [categoria, Number(resultado?.[categoria] ?? 0)]));
    return {
      personas_afectadas: Number(resultado?.personas_afectadas ?? 0),
      familias_afectadas: Number(resultado?.familias_afectadas ?? 0),
      registros_considerados: Number(resultado?.registros_considerados ?? 0),
      categorias,
    };
  }

  async obtener_serie_mensual(anio: number, filtro: FiltroTablero): Promise<SerieMensual> {
    const inicio = new Date(Date.UTC(anio, 0, 1));
    const fin = new Date(Date.UTC(anio + 1, 0, 1));
    const resultados = await ModeloEmergencia.aggregate<{ _id: { tipo: string; mes: number }; cantidad: number }>([
      { $match: this._filtro_emergencias({ ...filtro, desde: undefined, hasta: undefined }) },
      { $addFields: { fecha_calculada: comoFecha('fechaInicio') } },
      { $match: { fecha_calculada: { $gte: inicio, $lt: fin } } },
      { $group: { _id: { tipo: '$tipo', mes: { $month: '$fecha_calculada' } }, cantidad: { $sum: 1 } } },
    ]);
    const por_tipo = new Map<string, number[]>();
    for (const resultado of resultados) {
      const tipo = resultado._id.tipo ?? 'Sin tipo';
      if (!por_tipo.has(tipo)) por_tipo.set(tipo, new Array(12).fill(0));
      (por_tipo.get(tipo) as number[])[resultado._id.mes - 1] = resultado.cantidad;
    }
    return { anio, meses: MESES, series: [...por_tipo.entries()].map(([tipo, valores]) => ({ tipo, valores })) };
  }
}
