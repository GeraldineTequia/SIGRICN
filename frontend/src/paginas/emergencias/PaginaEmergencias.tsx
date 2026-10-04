import { Link } from 'react-router-dom';
import { interpretar_estado_almacenado } from '@dominio/estados/EstadosEmergencia';
import { ModuloCrud } from '../../componentes/tablas/ModuloCrud';
import { Insignia } from '../../componentes/tarjetas/Insignia';
import { TarjetaIndicador } from '../../componentes/tarjetas/TarjetaIndicador';
import { useConsulta } from '../../hooks/useConsulta';
import { useParametrosUrl } from '../../hooks/useParametrosUrl';
import { servicio_emergencias, servicio_tablero } from '../../servicios/servicios';
import type { Emergencia } from '../../tipos/api';
import { formatear_fecha, identificador_corto, obtener_etiqueta } from '../../utilidades/formato';
import { OPCIONES } from '../campos_comunes';

function ResumenEmergencias() {
  const [valores] = useParametrosUrl();
  const filtros = { departamento: valores.departamento, municipio: valores.municipio, tipo: valores.tipo, desde: valores.desde, hasta: valores.hasta };
  const consulta = useConsulta((automatica) => servicio_tablero.indicadores(filtros, automatica), [JSON.stringify(filtros)], ['emergencias']);
  const por_estado: Record<string, number> = {};
  for (const conteo of consulta.datos?.emergencias.por_estado ?? []) {
    const estado = interpretar_estado_almacenado(conteo.clave) ?? 'otro';
    por_estado[estado] = (por_estado[estado] ?? 0) + conteo.cantidad;
  }
  const criticas = consulta.datos?.emergencias.criticas_abiertas ?? 0;
  return (
    <div className="rejilla_indicadores">
      <TarjetaIndicador titulo="Total activas" valor={(por_estado.activa ?? 0) + (por_estado.en_atencion ?? 0)} enlace="/emergencias?estado=activa" etiqueta_accion="filtrar activas" />
      <TarjetaIndicador titulo="Críticas" valor={criticas} tono_valor="peligro" enlace="/emergencias?nivel_emergencia=critico" etiqueta_accion="filtrar críticas" />
      <TarjetaIndicador titulo="En atención" valor={por_estado.en_atencion ?? 0} tono_valor="advertencia" enlace="/emergencias?estado=en_atencion" etiqueta_accion="filtrar en atención" />
      <TarjetaIndicador titulo="Controladas / finalizadas" valor={(por_estado.controlada ?? 0) + (por_estado.finalizada ?? 0)} tono_valor="primario" enlace="/emergencias?estado=finalizada" etiqueta_accion="filtrar finalizadas" />
      <TarjetaIndicador titulo={`${consulta.datos?.emergencias.total ?? 0} resultados`} valor={<span style={{ fontSize: '0.95rem', fontWeight: 500 }}>Orden: {valores.orden?.includes('titulo') ? 'título' : 'más reciente'}</span>} />
    </div>
  );
}

/** Listado de emergencias (RF6) con búsqueda, filtros, orden y paginación. */
export function PaginaEmergencias() {
  return (
    <ModuloCrud<Emergencia>
      titulo="Emergencias"
      descripcion="Búsqueda, filtros, orden y consulta."
      seccion="Gestión de crisis"
      servicio={servicio_emergencias}
      entidades={['emergencias']}
      encabezado_extra={<ResumenEmergencias />}
      texto_busqueda="Buscar por título, municipio o fuente…"
      orden_inicial="-fecha_inicio"
      ruta_nuevo="/emergencias/nueva"
      ruta_detalle={(fila) => `/emergencias/${fila.id}`}
      ruta_edicion={(fila) => `/emergencias/${fila.id}/editar`}
      texto_boton_nuevo="Registrar emergencia"
      mensaje_eliminar={(fila) => `Se eliminará la emergencia «${fila.titulo}». Si tiene zonas, población, necesidades, donaciones o recursos asociados, el sistema bloqueará la eliminación para proteger la integridad.`}
      filtros={[
        { nombre: 'tipo', etiqueta: 'Tipo', tipo: 'seleccion', opciones: OPCIONES.tipos_emergencia },
        { nombre: 'nivel_emergencia', etiqueta: 'Gravedad', tipo: 'seleccion', opciones: OPCIONES.niveles },
        { nombre: 'estado', etiqueta: 'Estado', tipo: 'seleccion', opciones: OPCIONES.estados_emergencia },
        { nombre: 'departamento', etiqueta: 'Departamento', tipo: 'departamento' },
        { nombre: 'municipio', etiqueta: 'Municipio', tipo: 'municipio' },
        { nombre: 'desde', etiqueta: 'Desde', tipo: 'fecha' },
        { nombre: 'hasta', etiqueta: 'Hasta', tipo: 'fecha' },
      ]}
      exportacion={{
        nombre: 'emergencias.csv',
        columnas: [
          { titulo: 'Título', valor: (fila) => fila.titulo },
          { titulo: 'Tipo', valor: (fila) => fila.tipo },
          { titulo: 'Nivel', valor: (fila) => obtener_etiqueta(String(fila.nivel_emergencia)) },
          { titulo: 'Estado', valor: (fila) => obtener_etiqueta(String(fila.estado)) },
          { titulo: 'Municipio', valor: (fila) => fila.municipio },
          { titulo: 'Departamento', valor: (fila) => fila.departamento },
          { titulo: 'Inicio', valor: (fila) => formatear_fecha(fila.fecha_inicio, true) },
        ],
      }}
      columnas={[
        { clave: 'id', titulo: 'ID', render: (fila) => <Link className="identificador" to={`/emergencias/${fila.id}`}>{identificador_corto(fila.id, 'EM')}</Link> },
        {
          clave: 'descripcion',
          titulo: 'Descripción',
          orden: 'titulo',
          render: (fila) => (
            <>
              <span className="principal_celda">{fila.titulo}</span>
              <span className="secundario_celda">
                {fila.tipo}
                {typeof fila.magnitud === 'number' ? ` · M ${fila.magnitud.toFixed(1)}` : ''} · Inicio: {formatear_fecha(fila.fecha_inicio, true)}
              </span>
              {fila.pendiente_validacion && <Insignia tono="advertencia" texto="Magnitud pendiente de validación" />}
            </>
          ),
        },
        { clave: 'ubicacion', titulo: 'Ubicación', orden: 'municipio', render: (fila) => <>{fila.municipio}<span className="secundario_celda">{fila.departamento}{fila.ubicacion.estado !== 'confirmada' ? ' · Pendiente de ubicación' : ''}</span></> },
        { clave: 'nivel', titulo: 'Gravedad', orden: 'nivel_emergencia', render: (fila) => <Insignia valor={fila.nivel_emergencia} /> },
        {
          clave: 'estado',
          titulo: 'Estado',
          orden: 'estado',
          render: (fila) => <Insignia valor={fila.estado_ciclo ?? fila.estado} texto={obtener_etiqueta(fila.estado_ciclo ?? fila.estado)} />,
        },
      ]}
    />
  );
}
