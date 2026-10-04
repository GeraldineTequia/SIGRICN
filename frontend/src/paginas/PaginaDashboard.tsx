import { AlertOctagon, CircleCheck, Droplets, Heart, Home, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { interpretar_estado_almacenado } from '@dominio/estados/EstadosEmergencia';
import { EncabezadoPagina, useTituloPagina } from '../componentes/navegacion/DisenoPrincipal';
import { BarraFiltros } from '../componentes/tablas/Filtros';
import { BarraProgreso, Cargando, ErrorCarga, EstadoVacio, UltimaActualizacion } from '../componentes/tarjetas/Estados';
import { GraficoEmergencias } from '../componentes/tarjetas/GraficoEmergencias';
import { Insignia } from '../componentes/tarjetas/Insignia';
import { TarjetaIndicador } from '../componentes/tarjetas/TarjetaIndicador';
import { useConsulta } from '../hooks/useConsulta';
import { useParametrosUrl } from '../hooks/useParametrosUrl';
import { servicio_tablero } from '../servicios/servicios';
import type { ConteoAgrupado } from '../tipos/api';
import { formatear_moneda, formatear_numero } from '../utilidades/formato';
import { OPCIONES } from './campos_comunes';

const ENTIDADES_TABLERO = ['emergencias', 'zonas', 'poblacion', 'necesidades', 'recursos', 'asignaciones', 'donaciones', 'fondos', 'centros', 'recursos_humanos'];

/** Agrupa estados heredados con su equivalente del ciclo (p. ej. "en_proceso" cuenta como "en_atencion"). */
function contar_por_ciclo(conteos: ConteoAgrupado[]): Record<string, number> {
  const resultado: Record<string, number> = {};
  for (const conteo of conteos) {
    const estado = interpretar_estado_almacenado(conteo.clave) ?? 'otro';
    resultado[estado] = (resultado[estado] ?? 0) + conteo.cantidad;
  }
  return resultado;
}

/** Dashboard "Centro de mando" (mockup): todos los indicadores se calculan en MongoDB. */
export function PaginaDashboard() {
  useTituloPagina('Centro de mando');
  const [filtros, establecer_filtros] = useParametrosUrl();
  const anio = filtros.anio ?? String(new Date().getFullYear());
  const parametros = { ...filtros };
  delete parametros.anio;
  const indicadores = useConsulta((automatica) => servicio_tablero.indicadores(parametros, automatica), [JSON.stringify(parametros)], ENTIDADES_TABLERO);
  const serie = useConsulta((automatica) => servicio_tablero.serie_mensual({ ...parametros, anio }, automatica), [JSON.stringify(parametros), anio], ['emergencias']);

  const datos = indicadores.datos;
  const por_ciclo = contar_por_ciclo(datos?.emergencias.por_estado ?? []);
  const total = datos?.emergencias.total ?? 0;
  const completas = (por_ciclo.controlada ?? 0) + (por_ciclo.finalizada ?? 0);
  const parciales = por_ciclo.en_atencion ?? 0;
  const sin_atender = por_ciclo.activa ?? 0;
  const porcentaje_atencion = total > 0 ? Math.round((completas / total) * 100) : 0;
  const donaciones_registradas = (datos?.donaciones ?? []).reduce((suma, grupo) => suma + Number(grupo.cantidad ?? 0), 0);
  const valor_donaciones = (datos?.donaciones ?? []).reduce((suma, grupo) => suma + Number(grupo.valor_total ?? 0), 0);
  const donaciones_confirmadas = (datos?.donaciones ?? []).filter((grupo) => grupo.clave.endsWith('|confirmada')).reduce((suma, grupo) => suma + Number(grupo.cantidad ?? 0), 0);
  const anios = Array.from({ length: 6 }, (_, indice) => String(new Date().getFullYear() - indice));

  return (
    <>
      <EncabezadoPagina titulo="Centro de mando" descripcion="Panorama operativo nacional en tiempo casi real." />
      <BarraFiltros
        con_busqueda={false}
        valores={filtros}
        al_cambiar={establecer_filtros}
        filtros={[
          { nombre: 'departamento', etiqueta: 'Departamento', tipo: 'departamento' },
          { nombre: 'municipio', etiqueta: 'Municipio', tipo: 'municipio' },
          { nombre: 'tipo', etiqueta: 'Tipo', tipo: 'seleccion', opciones: OPCIONES.tipos_emergencia },
          { nombre: 'nivel_emergencia', etiqueta: 'Gravedad', tipo: 'seleccion', opciones: OPCIONES.niveles },
          { nombre: 'estado', etiqueta: 'Estado', tipo: 'seleccion', opciones: OPCIONES.estados_emergencia },
          { nombre: 'desde', etiqueta: 'Desde', tipo: 'fecha' },
          { nombre: 'hasta', etiqueta: 'Hasta', tipo: 'fecha' },
        ]}
      />
      {indicadores.error ? (
        <ErrorCarga mensaje={indicadores.error} codigo={indicadores.codigo_error} al_reintentar={indicadores.recargar} />
      ) : !datos ? (
        <Cargando texto="Calculando indicadores…" />
      ) : (
        <>
          <div className="rejilla_indicadores">
            <TarjetaIndicador
              titulo="Emergencias"
              valor={formatear_numero(total)}
              icono={<AlertOctagon size={20} />}
              tono="peligro"
              detalle={`${datos.zonas.criticas} zonas críticas · ${datos.emergencias.criticas_abiertas} casos críticos abiertos`}
              enlace="/emergencias"
              etiqueta_accion="ver emergencias"
            />
            <TarjetaIndicador
              titulo="Personas afectadas"
              valor={formatear_numero(datos.poblacion.personas_afectadas)}
              icono={<Users size={20} />}
              tono="advertencia"
              detalle={`${formatear_numero(datos.poblacion.familias_afectadas)} familias · ${datos.poblacion.registros_considerados} zonas con censo`}
              enlace="/zonas?pestana=poblacion"
              etiqueta_accion="ver población"
            />
            <TarjetaIndicador
              titulo="Donaciones"
              valor={formatear_moneda(valor_donaciones, true)}
              icono={<Heart size={20} />}
              tono="primario"
              detalle={`${formatear_numero(donaciones_registradas)} registradas · ${formatear_numero(donaciones_confirmadas)} confirmadas`}
              enlace="/fondos"
              etiqueta_accion="ver donaciones"
            />
            <TarjetaIndicador
              titulo="Atención"
              valor={`${porcentaje_atencion}%`}
              icono={<CircleCheck size={20} />}
              detalle={`${completas} completas · ${parciales} parciales`}
              enlace="/emergencias?estado=en_atencion"
              etiqueta_accion="ver emergencias en atención"
            />
          </div>

          <div className="dos_columnas">
            <section className="tarjeta" aria-labelledby="titulo-grafico">
              <div className="tarjeta_encabezado">
                <h2 id="titulo-grafico">Gráfico de emergencias</h2>
                <label className="fila texto_pequeno">
                  Año
                  <select className="control" style={{ minHeight: 38, width: 'auto' }} value={anio} onChange={(evento) => establecer_filtros({ ...filtros, anio: evento.target.value })}>
                    {anios.map((opcion) => (
                      <option key={opcion} value={opcion}>
                        {opcion}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {serie.error ? (
                <ErrorCarga mensaje={serie.error} al_reintentar={serie.recargar} />
              ) : !serie.datos ? (
                <Cargando />
              ) : serie.datos.series.length === 0 ? (
                <EstadoVacio centrado texto={`No hay emergencias registradas en ${anio} con los filtros seleccionados.`} />
              ) : (
                <GraficoEmergencias serie={serie.datos} />
              )}
              <p className="texto_suave" style={{ marginTop: 12 }}>
                {completas} emergencias controladas o finalizadas · {datos.emergencias.criticas_abiertas} críticas abiertas · {datos.zonas.sin_atender} zonas sin atender
              </p>
            </section>

            <aside className="panel_control">
              <section className="tarjeta pila" aria-labelledby="titulo-estado">
                <h2 id="titulo-estado">Estado y acciones</h2>
                <BarraProgreso etiqueta="Progreso de atención" valor={porcentaje_atencion} />
                <ul className="lista_resumen" style={{ gap: 4 }}>
                  <li style={{ background: 'transparent', padding: '2px 0' }}>
                    <Insignia valor="atendida" texto={`${completas} completas`} />
                    <Insignia valor="en_proceso" texto={`${parciales} parciales`} />
                  </li>
                  <li style={{ background: 'transparent', padding: '2px 0', justifyContent: 'flex-start' }}>
                    <Insignia tono="peligro" texto={`${sin_atender} sin atender`} />
                  </li>
                </ul>
                <div>
                  <h3 style={{ marginBottom: 8 }}>Necesidades críticas</h3>
                  {datos.necesidades.criticas_pendientes.length === 0 ? (
                    <EstadoVacio texto="No hay necesidades críticas o altas pendientes." />
                  ) : (
                    <ul className="lista_resumen">
                      {datos.necesidades.criticas_pendientes.map((necesidad) => (
                        <li key={necesidad.id}>
                          <span className="fila" style={{ gap: 8 }}>
                            {necesidad.tipo.includes('Agua') ? <Droplets size={16} aria-hidden="true" /> : <Home size={16} aria-hidden="true" />}
                            {necesidad.tipo}
                          </span>
                          <Insignia valor={necesidad.prioridad} prefijo="Prioridad" />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <Link to="/necesidades?prioridad=critica&estado=pendiente" className="boton boton_primario boton_grande">
                  Abrir prioridad
                </Link>
                <UltimaActualizacion fecha={datos.generado_en} />
              </section>
            </aside>
          </div>

        </>
      )}
    </>
  );
}
