import type { CondicionCampo, IRepositorioEntidad, Registro } from '../../dominio/contratos/repositorio';
import type { IGeneradorPdf, SeccionReportePdf } from '../../dominio/contratos/servicios_externos';
import { ErrorSinPermiso, ErrorValidacion } from '../../dominio/errores';
import { interpretar_estado_atencion } from '../../dominio/estados/estados_atencion_zona';
import { obtener_etiqueta } from '../../dominio/reglas/catalogos';
import { calcular_disponibilidad } from '../../dominio/reglas/recursos_y_fondos';
import { tiene_permiso } from '../../dominio/reglas/permisos';
import { CATEGORIAS_REPORTE_PDF, type CategoriaReportePdf } from '../../dominio/validacion/esquemas';
import { nombre_completo, type ContextoSolicitud, type ParametrosConsulta } from '../dto/contexto';
import type { RepositoriosAplicacion } from '../dto/repositorios';

/** Volumen máximo documentado por categoría (RNF15: generación en menos de 10 s con este volumen). */
export const FILAS_MAXIMAS_POR_CATEGORIA = 2000;

const fecha_corta = (valor: unknown) => (valor ? new Date(String(valor)).toLocaleDateString('es-CO', { timeZone: 'America/Bogota' }) : '—');
const numero = (valor: unknown) => (typeof valor === 'number' ? valor.toLocaleString('es-CO') : '—');
const moneda = (valor: unknown) => (typeof valor === 'number' ? `$${valor.toLocaleString('es-CO')}` : '—');
const texto = (valor: unknown) => (valor === null || valor === undefined || valor === '' ? '—' : String(valor));

/**
 * Reportes PDF (RF24) con datos reales y filtros. El contenido respeta los permisos:
 * el rol usuario no recibe datos de donantes ni registros individuales de personas
 * (las personas nunca forman parte de los reportes: sólo estadísticas agregadas).
 */
export class ServicioReportesPdf {
  private readonly _repositorios: RepositoriosAplicacion;
  private readonly _generador: IGeneradorPdf;

  constructor(repositorios: RepositoriosAplicacion, generador: IGeneradorPdf) {
    this._repositorios = repositorios;
    this._generador = generador;
  }

  async generar(parametros: ParametrosConsulta, contexto: ContextoSolicitud): Promise<{ contenido: Uint8Array; nombre_archivo: string; filas: number }> {
    if (!tiene_permiso(contexto.usuario.rol, 'exportar_informacion')) throw new ErrorSinPermiso();
    const solicitadas = String(parametros.categorias ?? '')
      .split(',')
      .map((categoria) => categoria.trim())
      .filter(Boolean);
    const categorias = solicitadas.filter((categoria): categoria is CategoriaReportePdf =>
      (CATEGORIAS_REPORTE_PDF as readonly string[]).includes(categoria),
    );
    if (categorias.length === 0) throw new ErrorValidacion({ categorias: 'Selecciona al menos una categoría para el reporte.' });

    const leer = (nombre: string) => (typeof parametros[nombre] === 'string' && String(parametros[nombre]).trim() !== '' ? String(parametros[nombre]).trim().slice(0, 120) : undefined);
    const filtros = {
      catastrofe_id: leer('catastrofe_id'),
      departamento: leer('departamento'),
      municipio: leer('municipio'),
      desde: leer('desde'),
      hasta: leer('hasta'),
    };
    for (const campo of ['desde', 'hasta'] as const) {
      if (filtros[campo] && Number.isNaN(new Date(String(filtros[campo])).getTime())) throw new ErrorValidacion({ [campo]: 'Fecha inválida.' });
    }
    const filtros_aplicados: string[] = [];
    let emergencia_filtrada: Registro | null = null;
    if (filtros.catastrofe_id) {
      emergencia_filtrada = await this._repositorios.emergencias.obtener(filtros.catastrofe_id);
      if (!emergencia_filtrada) throw new ErrorValidacion({ catastrofe_id: 'La emergencia seleccionada no existe.' });
      filtros_aplicados.push(`Emergencia: ${emergencia_filtrada.titulo}`);
    }
    if (filtros.departamento) filtros_aplicados.push(`Departamento: ${filtros.departamento}`);
    if (filtros.municipio) filtros_aplicados.push(`Municipio: ${filtros.municipio}`);
    if (filtros.desde) filtros_aplicados.push(`Desde: ${filtros.desde}`);
    if (filtros.hasta) filtros_aplicados.push(`Hasta: ${filtros.hasta}`);
    const puede_ver_restringidos = tiene_permiso(contexto.usuario.rol, 'consultar_datos_restringidos');

    const ubicacion: CondicionCampo[] = [];
    if (filtros.departamento) ubicacion.push({ campo: 'departamento', operador: 'igual', valor: filtros.departamento });
    if (filtros.municipio) ubicacion.push({ campo: 'municipio', operador: 'igual', valor: filtros.municipio });
    const por_emergencia: CondicionCampo[] = filtros.catastrofe_id ? [{ campo: 'catastrofe_id', operador: 'igual', valor: emergencia_filtrada?.id }] : [];
    const en_rango = (valor: unknown) => {
      if (!filtros.desde && !filtros.hasta) return true;
      const fecha = new Date(String(valor));
      if (Number.isNaN(fecha.getTime())) return false;
      if (filtros.desde && fecha < new Date(filtros.desde)) return false;
      if (filtros.hasta && fecha > new Date(/^\d{4}-\d{2}-\d{2}$/.test(filtros.hasta) ? `${filtros.hasta}T23:59:59.999Z` : filtros.hasta)) return false;
      return true;
    };
    const consultar = (repositorio: IRepositorioEntidad, condiciones: CondicionCampo[]) => repositorio.listar_todos(condiciones, FILAS_MAXIMAS_POR_CATEGORIA);

    const secciones: SeccionReportePdf[] = [];
    for (const categoria of categorias) {
      switch (categoria) {
        case 'emergencias': {
          const condiciones = [...ubicacion];
          const registros = (await consultar(this._repositorios.emergencias, condiciones))
            .filter((registro) => !emergencia_filtrada || registro.id === emergencia_filtrada.id)
            .filter((registro) => en_rango(registro.fecha_inicio));
          secciones.push({
            titulo: 'Emergencias',
            columnas: [
              { titulo: 'Título', ancho: 3 },
              { titulo: 'Tipo', ancho: 1.5 },
              { titulo: 'Nivel', ancho: 1 },
              { titulo: 'Estado', ancho: 1.2 },
              { titulo: 'Ubicación', ancho: 2.5 },
              { titulo: 'Inicio', ancho: 1.2 },
              { titulo: 'Magnitud', ancho: 1 },
            ],
            filas: registros.map((registro) => [
              texto(registro.titulo),
              texto(registro.tipo),
              obtener_etiqueta(String(registro.nivel_emergencia)),
              obtener_etiqueta(String(registro.estado)),
              `${texto(registro.municipio)}, ${texto(registro.departamento)}`,
              fecha_corta(registro.fecha_inicio),
              typeof registro.magnitud === 'number' ? registro.magnitud.toFixed(1) : '—',
            ]),
          });
          break;
        }
        case 'zonas': {
          const registros = await consultar(this._repositorios.zonas, [...ubicacion, ...por_emergencia]);
          secciones.push({
            titulo: 'Zonas afectadas',
            columnas: [
              { titulo: 'Dirección', ancho: 3 },
              { titulo: 'Municipio', ancho: 1.5 },
              { titulo: 'Afectación', ancho: 1.2 },
              { titulo: '%', ancho: 0.6 },
              { titulo: 'Prioridad', ancho: 1 },
              { titulo: 'Atención', ancho: 1.6 },
            ],
            filas: registros.map((registro) => [
              `${texto(registro.direccion)}${registro.barrio ? ` (${registro.barrio})` : ''}`,
              texto(registro.municipio),
              obtener_etiqueta(String(registro.nivel_afectacion)),
              numero(registro.porcentaje_afectacion),
              obtener_etiqueta(String(registro.prioridad ?? '')),
              obtener_etiqueta(interpretar_estado_atencion(registro.estado_atencion)),
            ]),
          });
          break;
        }
        case 'poblacion': {
          const registros = await consultar(this._repositorios.poblacion, por_emergencia);
          secciones.push({
            titulo: 'Población afectada (estadísticas agregadas)',
            nota: 'Las categorías (heridas, evacuadas, albergadas...) pueden solaparse y no se suman entre sí.',
            columnas: [
              { titulo: 'Zona', ancho: 1.4 },
              { titulo: 'Afectadas', ancho: 1 },
              { titulo: 'Familias', ancho: 1 },
              { titulo: 'Niños', ancho: 0.8 },
              { titulo: 'Adultos', ancho: 0.8 },
              { titulo: 'Mayores', ancho: 0.8 },
              { titulo: 'Heridas', ancho: 0.8 },
              { titulo: 'Evacuadas', ancho: 0.9 },
              { titulo: 'Albergadas', ancho: 0.9 },
            ],
            filas: registros.map((registro) => [
              texto(registro.zona_id),
              numero(registro.personas_afectadas),
              numero(registro.familias_afectadas),
              numero(registro.ninos),
              numero(registro.adultos),
              numero(registro.adultos_mayores),
              numero(registro.personas_heridas),
              numero(registro.personas_evacuadas),
              numero(registro.personas_albergadas),
            ]),
          });
          break;
        }
        case 'necesidades': {
          const registros = await consultar(this._repositorios.necesidades, por_emergencia);
          secciones.push({
            titulo: 'Necesidades',
            columnas: [
              { titulo: 'Tipo', ancho: 1.4 },
              { titulo: 'Descripción', ancho: 3 },
              { titulo: 'Ámbito', ancho: 0.9 },
              { titulo: 'Requerida', ancho: 1 },
              { titulo: 'Recibida', ancho: 1 },
              { titulo: 'Prioridad', ancho: 1 },
              { titulo: 'Estado', ancho: 1 },
            ],
            filas: registros.map((registro) => [
              texto(registro.tipo),
              texto(registro.descripcion),
              obtener_etiqueta(String(registro.ambito ?? 'zona')),
              numero(registro.cantidad_requerida),
              numero(registro.cantidad_recibida),
              obtener_etiqueta(String(registro.prioridad)),
              obtener_etiqueta(String(registro.estado)),
            ]),
          });
          break;
        }
        case 'recursos': {
          const registros = await consultar(this._repositorios.recursos, [...ubicacion, ...por_emergencia]);
          secciones.push({
            titulo: 'Recursos materiales',
            columnas: [
              { titulo: 'Recurso', ancho: 2.5 },
              { titulo: 'Bodega', ancho: 2 },
              { titulo: 'Entidad', ancho: 1.8 },
              { titulo: 'Disponible', ancho: 1 },
              { titulo: 'Asignado', ancho: 1 },
              { titulo: 'Entregado', ancho: 1 },
              { titulo: 'Disponibilidad', ancho: 1.2 },
            ],
            filas: registros.map((registro) => [
              `${texto(registro.descripcion)} (${texto(registro.unidad)})`,
              texto(registro.ubicacion_almacen),
              texto(registro.organizacion_responsable),
              numero(registro.cantidad_disponible),
              numero(registro.cantidad_asignada),
              numero(registro.cantidad_entregada),
              obtener_etiqueta(calcular_disponibilidad(Number(registro.cantidad_disponible ?? 0), registro.cantidad_minima as number | null)),
            ]),
          });
          break;
        }
        case 'asignaciones': {
          const registros = (await consultar(this._repositorios.asignaciones, [...por_emergencia, { campo: 'estado', operador: 'distinto', valor: 'procesando' }])).filter(
            (registro) => en_rango(registro.fecha),
          );
          secciones.push({
            titulo: 'Asignaciones y entregas',
            columnas: [
              { titulo: 'Fecha', ancho: 1 },
              { titulo: 'Recurso', ancho: 1.6 },
              { titulo: 'Cantidad', ancho: 0.9 },
              { titulo: 'Entregada', ancho: 0.9 },
              { titulo: 'Devuelta', ancho: 0.9 },
              { titulo: 'Responsable', ancho: 2 },
              { titulo: 'Estado', ancho: 1.3 },
            ],
            filas: registros.map((registro) => [
              fecha_corta(registro.fecha),
              texto(registro.recurso_id),
              numero(registro.cantidad),
              numero(registro.cantidad_entregada),
              numero(registro.cantidad_devuelta),
              texto(registro.responsable),
              obtener_etiqueta(String(registro.estado)),
            ]),
          });
          break;
        }
        case 'donaciones': {
          const registros = (await consultar(this._repositorios.donaciones, por_emergencia)).filter((registro) => en_rango(registro.fecha));
          const columnas = [
            { titulo: 'Fecha', ancho: 1 },
            { titulo: 'Tipo', ancho: 1.2 },
            { titulo: 'Método', ancho: 1.1 },
            { titulo: 'Valor (COP)', ancho: 1.3 },
            { titulo: 'Estado', ancho: 1.2 },
          ];
          if (puede_ver_restringidos) columnas.push({ titulo: 'Donante', ancho: 2 });
          secciones.push({
            titulo: 'Donaciones',
            nota: puede_ver_restringidos ? 'Registro administrativo; no representa procesamiento bancario.' : 'Datos de donantes omitidos según los permisos del rol.',
            columnas,
            filas: registros.map((registro) => {
              const fila = [fecha_corta(registro.fecha), texto(registro.tipo), texto(registro.metodo_pago), moneda(registro.valor), obtener_etiqueta(String(registro.estado))];
              if (puede_ver_restringidos) fila.push(texto(registro.donante_nombre));
              return fila;
            }),
          });
          break;
        }
        case 'fondos': {
          const registros = await consultar(this._repositorios.fondos, por_emergencia);
          secciones.push({
            titulo: 'Fondos financieros (COP)',
            nota: 'Saldo = asignado − comprometido − gastado.',
            columnas: [
              { titulo: 'Origen', ancho: 1.4 },
              { titulo: 'Entidad', ancho: 1.8 },
              { titulo: 'Concepto', ancho: 2.2 },
              { titulo: 'Asignado', ancho: 1.2 },
              { titulo: 'Comprometido', ancho: 1.2 },
              { titulo: 'Gastado', ancho: 1.2 },
              { titulo: 'Saldo', ancho: 1.2 },
            ],
            filas: registros.map((registro) => [
              texto(registro.origen),
              texto(registro.entidad),
              texto(registro.concepto),
              moneda(registro.monto_asignado),
              moneda(registro.monto_comprometido),
              moneda(registro.monto_gastado),
              moneda(registro.monto_disponible),
            ]),
          });
          break;
        }
        case 'centros': {
          const registros = await consultar(this._repositorios.centros, ubicacion);
          secciones.push({
            titulo: 'Centros de donación',
            columnas: [
              { titulo: 'Nombre', ancho: 2.2 },
              { titulo: 'Dirección', ancho: 2.5 },
              { titulo: 'Municipio', ancho: 1.3 },
              { titulo: 'Horario', ancho: 1.5 },
              { titulo: 'Tipos', ancho: 2 },
              { titulo: 'Estado', ancho: 0.9 },
            ],
            filas: registros.map((registro) => [
              texto(registro.nombre),
              texto(registro.direccion),
              texto(registro.municipio),
              texto(registro.horario),
              ((registro.tipos_donacion as string[] | null) ?? []).join(', ') || '—',
              obtener_etiqueta(String(registro.estado)),
            ]),
          });
          break;
        }
      }
    }
    const ahora = new Date();
    const contenido = await this._generador.generar({
      titulo: 'Reporte SGRICN',
      generado_por: `${nombre_completo(contexto)} (${obtener_etiqueta(contexto.usuario.rol)})`,
      fecha_generacion: ahora.toLocaleString('es-CO', { timeZone: 'America/Bogota' }),
      filtros_aplicados,
      secciones,
    });
    return {
      contenido,
      nombre_archivo: `reporte_sgricn_${ahora.toISOString().slice(0, 10)}.pdf`,
      filas: secciones.reduce((suma, seccion) => suma + seccion.filas.length, 0),
    };
  }
}
