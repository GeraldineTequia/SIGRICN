import { BellRing, CheckCheck, Eye, RefreshCw, Send } from 'lucide-react';
import { Link } from 'react-router-dom';
import { EncabezadoPagina, useTituloPagina } from '../componentes/navegacion/DisenoPrincipal';
import { BarraProgreso, Cargando, ErrorCarga, EstadoVacio, UltimaActualizacion } from '../componentes/tarjetas/Estados';
import { Insignia } from '../componentes/tarjetas/Insignia';
import { TarjetaIndicador } from '../componentes/tarjetas/TarjetaIndicador';
import { useSesion } from '../contextos/ContextoSesion';
import { useTiempoReal } from '../contextos/ContextoTiempoReal';
import { useConsulta } from '../hooks/useConsulta';
import { useOperacion } from '../hooks/useOperacion';
import { useParametrosUrl } from '../hooks/useParametrosUrl';
import { servicio_alertas } from '../servicios/servicios';
import { formatear_fecha, obtener_etiqueta } from '../utilidades/formato';

const RUTAS: Record<string, string> = {
  emergencias: '/emergencias',
  zonas: '/zonas',
  necesidades: '/necesidades',
};

function hace(fecha: string): string {
  const minutos = Math.round((Date.now() - new Date(fecha).getTime()) / 60_000);
  if (minutos < 1) return 'hace un momento';
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.round(minutos / 60);
  return horas < 24 ? `hace ${horas} h` : formatear_fecha(fecha, true);
}

/** Centro de alertas y notificaciones (RF22, RF23): alertas persistentes, lectura y entrega por usuario. */
export function PaginaAlertas() {
  useTituloPagina('Centro de alertas y notificaciones', 'D · Comunicación, control y reportes');
  const { puede } = useSesion();
  const { actualizar_alertas } = useTiempoReal();
  const { ejecutar, en_proceso } = useOperacion();
  const [valores, establecer] = useParametrosUrl();
  const filtro = valores.filtro ?? 'pendientes';
  const alertas = useConsulta(
    (automatica) => servicio_alertas.listar({ ...(filtro === 'pendientes' ? { solo_no_leidas: 'true' } : {}), ...(['critica', 'alta'].includes(filtro) ? { severidad: filtro } : {}) }, automatica),
    [filtro],
    ['alertas'],
  );
  const todas = useConsulta((automatica) => servicio_alertas.listar({}, automatica), [], ['alertas']);
  const entrega = useConsulta(() => (puede('administrar_cuentas') ? servicio_alertas.resumen_entrega() : Promise.resolve(null)), [], ['alertas']);
  const elementos = (alertas.datos?.elementos ?? []).filter((alerta) => (filtro === 'leidas' ? alerta.leida : true));
  const lista_total = todas.datos?.elementos ?? [];
  const criticas_pendientes = lista_total.filter((alerta) => alerta.severidad === 'critica' && !alerta.leida).length;
  const leidas = lista_total.filter((alerta) => alerta.leida).length;

  const marcar = async (id: string) => {
    await ejecutar(() => servicio_alertas.marcar_leida(id), { entidades: ['alertas'] });
    actualizar_alertas();
  };
  const marcar_todas = async () => {
    await ejecutar(() => servicio_alertas.marcar_todas(), { entidades: ['alertas'], mensaje_exito: (mensaje) => mensaje });
    actualizar_alertas();
  };

  return (
    <>
      <EncabezadoPagina
        titulo="Centro de alertas y notificaciones"
        descripcion="Gestión en tiempo real · Severidad, lectura y entrega de notificaciones del sistema."
        migas={[{ texto: 'D · Comunicación, control y reportes' }, { texto: 'Alertas y notificaciones' }]}
      />
      <div className="rejilla_indicadores">
        <TarjetaIndicador titulo="Críticas pendientes" valor={criticas_pendientes} tono_valor="advertencia" al_pulsar={() => establecer({ filtro: 'critica' })} etiqueta_accion="Filtrar alertas críticas" />
        <TarjetaIndicador titulo="Sin leer" valor={todas.datos?.no_leidas ?? '—'} tono_valor="peligro" al_pulsar={() => establecer({ filtro: 'pendientes' })} etiqueta_accion="Filtrar pendientes" />
        <TarjetaIndicador titulo="Leídas" valor={leidas} tono_valor="primario" al_pulsar={() => establecer({ filtro: 'leidas' })} etiqueta_accion="Filtrar leídas" />
        <TarjetaIndicador titulo="Módulos activos" valor="RF22-23" tono_valor="primario" />
      </div>
      <div className="dos_columnas">
        <section className="tarjeta pila" aria-labelledby="titulo-alertas">
          <div className="tarjeta_encabezado" style={{ marginBottom: 0 }}>
            <h2 id="titulo-alertas">
              <BellRing size={20} aria-hidden="true" /> Alertas activas
            </h2>
            {criticas_pendientes > 0 && <Insignia tono="advertencia" texto={`Crítica · ${criticas_pendientes} pendientes`} />}
          </div>
          <div className="fila">
            <strong>Filtrar:</strong>
            {[
              ['pendientes', 'Pendientes'],
              ['leidas', 'Leídas'],
              ['todas', 'Todas'],
              ['critica', 'Crítica'],
              ['alta', 'Alta'],
            ].map(([clave, texto]) => (
              <button key={clave} type="button" className="chip" aria-pressed={filtro === clave} onClick={() => establecer({ filtro: clave })}>
                {texto}
              </button>
            ))}
          </div>
          {alertas.error ? (
            <ErrorCarga mensaje={alertas.error} al_reintentar={alertas.recargar} />
          ) : !alertas.datos ? (
            <Cargando />
          ) : elementos.length === 0 ? (
            <EstadoVacio centrado texto={filtro === 'pendientes' ? 'No tienes alertas pendientes por leer.' : 'No hay alertas para este filtro.'} />
          ) : (
            <ul className="lista_tarjetas">
              {elementos.map((alerta) => (
                <li key={alerta.id} className="tarjeta_lista alerta_item" data-severidad={alerta.severidad} data-leida={alerta.leida} data-tono={alerta.leida ? undefined : alerta.severidad === 'critica' || alerta.severidad === 'alta' ? 'advertencia' : undefined}>
                  <div className="cuerpo">
                    <strong>{alerta.titulo}</strong>
                    <small>
                      {obtener_etiqueta(alerta.severidad)} · {alerta.mensaje} · {hace(alerta.fecha)} · Responsable: {alerta.responsable}
                    </small>
                    {alerta.entidad_id && RUTAS[alerta.entidad] && (
                      <div>
                        <Link to={`${RUTAS[alerta.entidad]}/${alerta.entidad_id}`} className="texto_pequeno">
                          Ver registro relacionado
                        </Link>
                      </div>
                    )}
                  </div>
                  {alerta.leida ? (
                    <Insignia tono="neutro" texto="Leída" />
                  ) : (
                    <div className="pila" style={{ gap: 6, justifyItems: 'end' }}>
                      <Insignia tono={alerta.severidad === 'critica' ? 'solido_peligro' : alerta.severidad === 'alta' ? 'solido_advertencia' : 'primario'} texto={alerta.severidad === 'critica' ? 'NUEVA' : obtener_etiqueta(alerta.severidad).toUpperCase()} sin_icono />
                      <button type="button" className="boton boton_pequeno" onClick={() => void marcar(alerta.id)} aria-label={`Marcar como leída: ${alerta.titulo}`}>
                        <Eye size={14} aria-hidden="true" /> Leída
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
        <aside className="panel_control">
          <div className="tarjeta pila">
            <h2 className="fila">
              <Send size={20} aria-hidden="true" /> Estado de entrega
            </h2>
            <ul className="lista_resumen">
              <li>
                Destinatarios <strong>Tu rol y cuenta</strong>
              </li>
              <li>
                Entregadas a ti <strong>{lista_total.filter((alerta) => alerta.entregada_en).length}</strong>
              </li>
              <li>
                Pendientes de leer <strong>{todas.datos?.no_leidas ?? 0}</strong>
              </li>
            </ul>
            {entrega.datos && entrega.datos.lecturas_registradas > 0 && (
              <BarraProgreso etiqueta="Lectura global (todas las cuentas)" valor={entrega.datos.leidas} maximo={entrega.datos.lecturas_registradas} />
            )}
            <button type="button" className="boton boton_primario boton_grande" onClick={marcar_todas} disabled={en_proceso || (todas.datos?.no_leidas ?? 0) === 0}>
              <CheckCheck size={20} aria-hidden="true" /> Marcar como leídas
            </button>
            <button
              type="button"
              className="boton"
              onClick={() => {
                alertas.recargar();
                todas.recargar();
                actualizar_alertas();
              }}
            >
              <RefreshCw size={18} aria-hidden="true" /> Actualizar
            </button>
            <UltimaActualizacion fecha={new Date()} />
            <p className="ayuda_campo">Las alertas se conservan aunque cierres los avisos de la pantalla; si estabas desconectado, las verás al volver a iniciar sesión.</p>
          </div>
        </aside>
      </div>
    </>
  );
}
