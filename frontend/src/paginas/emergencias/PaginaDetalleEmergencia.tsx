import { Download, Pencil, Share2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BotonEnProceso } from '../../componentes/formularios/DialogoConfirmacion';
import { Modal } from '../../componentes/formularios/Modal';
import { MapaGeneral } from '../../componentes/mapas/MapaGeneral';
import { EncabezadoPagina, useTituloPagina } from '../../componentes/navegacion/DisenoPrincipal';
import { AvisoEnLinea, Cargando, ErrorCarga, EstadoVacio, UltimaActualizacion } from '../../componentes/tarjetas/Estados';
import { Insignia } from '../../componentes/tarjetas/Insignia';
import { useAvisos } from '../../contextos/ContextoAvisos';
import { useSesion } from '../../contextos/ContextoSesion';
import { useConsulta } from '../../hooks/useConsulta';
import { useOperacion } from '../../hooks/useOperacion';
import { servicio_emergencias, servicio_mapa, servicio_necesidades, servicio_poblacion, servicio_reportes_pdf, servicio_zonas } from '../../servicios/servicios';
import { descargar_archivo, formatear_fecha, formatear_numero, identificador_corto, obtener_etiqueta } from '../../utilidades/formato';

const ENTIDADES = ['emergencias', 'zonas', 'poblacion', 'necesidades'];

/** Detalle de emergencia (mockup "EM-2048 · Inundación río Atrato"): resumen, mapa, ciclo de estados e historial. */
export function PaginaDetalleEmergencia() {
  const { identificador = '' } = useParams();
  const { puede } = useSesion();
  const { mostrar_aviso } = useAvisos();
  const { ejecutar, en_proceso } = useOperacion();
  const [transicion, establecer_transicion] = useState<string | null>(null);
  const [observacion, establecer_observacion] = useState('');
  const [exportando, establecer_exportando] = useState(false);

  const emergencia = useConsulta(() => servicio_emergencias.obtener(identificador), [identificador], ['emergencias']);
  const resumen = useConsulta(
    async (automatica) => {
      const filtro = { catastrofe_id: identificador, limite: 100 };
      const [zonas, poblacion, necesidades, mapa, historial] = await Promise.all([
        servicio_zonas.listar(filtro, automatica),
        servicio_poblacion.listar(filtro, automatica),
        servicio_necesidades.listar({ ...filtro, estado: 'pendiente' }, automatica),
        servicio_mapa.consultar({ catastrofe_id: identificador, capas: 'emergencias,zonas' }, automatica),
        servicio_emergencias.historial(identificador),
      ]);
      return { zonas, poblacion, necesidades, mapa, historial };
    },
    [identificador],
    ENTIDADES,
  );
  useTituloPagina('Emergencias', 'Gestión de crisis');

  if (emergencia.error) return <ErrorCarga mensaje={emergencia.error} codigo={emergencia.codigo_error} al_reintentar={emergencia.recargar} />;
  if (!emergencia.datos) return <Cargando />;
  const datos = emergencia.datos;
  const codigo = identificador_corto(datos.id, 'EM');
  const personas = (resumen.datos?.poblacion.elementos ?? []).reduce((suma, registro) => suma + Number(registro.personas_afectadas ?? 0), 0);
  const familias = (resumen.datos?.poblacion.elementos ?? []).reduce((suma, registro) => suma + Number(registro.familias_afectadas ?? 0), 0);
  const tipos_necesidad = [...new Set((resumen.datos?.necesidades.elementos ?? []).map((necesidad) => String(necesidad.tipo)))];

  const confirmar_transicion = async () => {
    if (!transicion) return;
    const resultado = await ejecutar(() => servicio_emergencias.cambiar_estado(datos.id, transicion, observacion || undefined), {
      entidades: ['emergencias', 'alertas'],
      mensaje_exito: (respuesta) => respuesta.mensaje,
      titulo_error: 'Advertencia · Transición no permitida',
    });
    if (resultado) {
      establecer_transicion(null);
      establecer_observacion('');
    }
  };

  const exportar = async () => {
    establecer_exportando(true);
    try {
      const archivo = await servicio_reportes_pdf.generar({ categorias: 'emergencias,zonas,poblacion,necesidades,donaciones', catastrofe_id: datos.id });
      descargar_archivo(archivo.contenido, `${codigo}_${archivo.nombre}`);
      mostrar_aviso({ tipo: 'exito', titulo: 'Reporte PDF generado', mensaje: `${archivo.filas ?? 0} registros incluidos.` });
    } catch (causa) {
      mostrar_aviso({ tipo: 'error', titulo: 'No se pudo generar el PDF', mensaje: causa instanceof Error ? causa.message : undefined });
    } finally {
      establecer_exportando(false);
    }
  };

  const compartir = async () => {
    const enlace = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: `${codigo} · ${datos.titulo}`, url: enlace });
      else {
        await navigator.clipboard.writeText(enlace);
        mostrar_aviso({ tipo: 'exito', titulo: 'Enlace copiado', mensaje: 'Sólo podrán abrirlo personas con una cuenta autorizada.' });
      }
    } catch {
      mostrar_aviso({ tipo: 'informacion', titulo: 'Copia el enlace desde la barra de direcciones.' });
    }
  };

  return (
    <>
      <EncabezadoPagina titulo={`${codigo} · ${datos.titulo}`} descripcion="Resumen integral, clasificación y actividad." migas={[{ texto: 'Emergencias', ruta: '/emergencias' }, { texto: codigo }]} />
      <div className="dos_columnas">
        <section className="tarjeta pila" aria-label="Resumen de la emergencia">
          <div className="fila">
            <Insignia valor={datos.estado_ciclo ?? datos.estado} texto={`${obtener_etiqueta(datos.estado_ciclo ?? datos.estado)} · ${obtener_etiqueta(datos.nivel_emergencia)}`} tono={datos.nivel_emergencia === 'critico' ? 'peligro' : undefined} />
            <Insignia tono="primario" texto={datos.departamento} sin_icono />
            <Insignia tono="neutro" texto={datos.tipo} sin_icono />
            {typeof datos.magnitud === 'number' && <Insignia tono="neutro" texto={`Magnitud ${datos.magnitud.toFixed(1)}`} sin_icono />}
          </div>
          {datos.pendiente_validacion && (
            <AvisoEnLinea tono="advertencia" titulo="Pendiente de validación">
              <p>Este terremoto no tiene una magnitud válida registrada. No se inventa el valor: un funcionario debe completarlo al editar la emergencia.</p>
            </AvisoEnLinea>
          )}
          {datos.es_estado_heredado && (
            <AvisoEnLinea tono="primario" titulo="Estado heredado">
              <p>
                El estado guardado es «{datos.estado}», equivalente a «{obtener_etiqueta(datos.estado_ciclo)}» en el ciclo de atención. No se migró automáticamente.
              </p>
            </AvisoEnLinea>
          )}
          <h2 style={{ fontSize: '1.2rem' }}>
            {resumen.datos?.zonas.paginacion.total ?? 0} zonas · {formatear_numero(personas)} personas · {formatear_numero(familias)} familias
          </h2>
          <p>{datos.descripcion}</p>
          <p className="texto_suave">
            Necesidades: {tipos_necesidad.length ? tipos_necesidad.join(', ') : 'sin pendientes'}
          </p>
          <p className="texto_suave texto_pequeno">
            {datos.direccion_referencia ? `${datos.direccion_referencia}, ` : ''}
            {datos.barrio ? `${datos.barrio}, ` : ''}
            {datos.municipio}, {datos.departamento}, {datos.pais} · Inicio {formatear_fecha(datos.fecha_inicio, true)}
            {datos.fecha_fin ? ` · Fin ${formatear_fecha(datos.fecha_fin, true)}` : ''} · Fuente: {datos.fuente_informacion}
          </p>
          <h3>Actividad reciente y mapa de ubicación</h3>
          {datos.ubicacion.estado !== 'confirmada' && (
            <AvisoEnLinea tono="advertencia" titulo="Pendiente de georreferenciación">
              <p>{datos.ubicacion.estado === 'pendiente' ? 'La ubicación anterior quedó pendiente porque la dirección cambió. Edita la emergencia para confirmar el lugar.' : 'Esta emergencia aún no tiene una ubicación confirmada en el mapa.'}</p>
            </AvisoEnLinea>
          )}
          {resumen.datos ? <MapaGeneral elementos={resumen.datos.mapa.elementos} ajuste_vista={1} tamano="mediano" /> : <Cargando texto="Cargando mapa…" />}
          <Insignia tono="advertencia" texto={`${obtener_etiqueta(datos.estado_ciclo ?? datos.estado)} · Datos en tiempo real`} />
          <h3>Historial de estados</h3>
          {(resumen.datos?.historial ?? []).length === 0 ? (
            <EstadoVacio texto="Sin cambios de estado registrados." />
          ) : (
            <ul className="lista_tarjetas">
              {resumen.datos?.historial.map((cambio) => (
                <li key={cambio.id} className="tarjeta_lista">
                  <div className="cuerpo">
                    <strong>
                      {obtener_etiqueta(cambio.estado_anterior)} → {obtener_etiqueta(cambio.estado_nuevo)}
                    </strong>
                    <small>
                      {cambio.usuario_nombre} · {formatear_fecha(cambio.fecha, true)}
                      {cambio.observacion ? ` · ${cambio.observacion}` : ''}
                    </small>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="panel_control">
          <div className="tarjeta pila">
            <h2>Panel de control</h2>
            <ul className="lista_resumen">
              <li>
                Zonas asociadas <strong>{resumen.datos?.zonas.paginacion.total ?? '—'}</strong>
              </li>
              <li>
                Población <strong>{formatear_numero(personas)}</strong>
              </li>

            </ul>
            <p className="texto_suave">
              <Link to={`/necesidades?catastrofe_id=${datos.id}`}>Necesidades</Link> ·{' '}
              <Link to={`/zonas?catastrofe_id=${datos.id}`}>Zonas</Link>
            </p>
            {puede('cambiar_estados') && (
              <div className="pila" style={{ gap: 8 }}>
                <span className="etiqueta_campo">Cambiar estado (ciclo de atención)</span>
                {datos.transiciones_permitidas.length === 0 ? (
                  <AvisoEnLinea tono="primario">
                    <p>{datos.es_estado_desconocido ? 'Estado no reconocido: requiere revisión antes de cambiarlo.' : 'La emergencia está finalizada. Es el estado final del ciclo.'}</p>
                  </AvisoEnLinea>
                ) : (
                  <div className="opciones_chip">
                    {datos.transiciones_permitidas.map((destino) => (
                      <button key={destino} type="button" className="chip" onClick={() => establecer_transicion(destino)}>
                        Pasar a: {obtener_etiqueta(destino)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {puede('editar_registros_operativos') && (
              <Link to={`/emergencias/${datos.id}/editar`} className="boton boton_primario boton_grande">
                <Pencil size={20} aria-hidden="true" /> Editar emergencia
              </Link>
            )}
            <div className="grupo_botones" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
              <BotonEnProceso type="button" en_proceso={exportando} className="boton" onClick={exportar}>
                {!exportando && <Download size={18} aria-hidden="true" />} Exportar PDF
              </BotonEnProceso>
              <button type="button" className="boton" onClick={compartir}>
                <Share2 size={18} aria-hidden="true" /> Compartir
              </button>
            </div>
            <UltimaActualizacion fecha={datos.actualizado_en} />
          </div>
        </aside>
      </div>

      <Modal
        abierto={transicion !== null}
        titulo={`Cambiar estado a «${obtener_etiqueta(transicion)}»`}
        descripcion="El cambio queda registrado con tu nombre, la fecha, el estado anterior y el nuevo."
        al_cerrar={() => establecer_transicion(null)}
        pie={
          <>
            <button type="button" className="boton" onClick={() => establecer_transicion(null)}>
              Cancelar
            </button>
            <BotonEnProceso type="button" en_proceso={en_proceso} onClick={confirmar_transicion}>
              Confirmar cambio
            </BotonEnProceso>
          </>
        }
      >
        <div className="pila">
          {transicion === 'finalizada' && (
            <AvisoEnLinea tono="advertencia">
              <p>Al finalizar se registrará la fecha de fin y ya no se podrán hacer más transiciones.</p>
            </AvisoEnLinea>
          )}
          <div className="campo">
            <label htmlFor="observacion-transicion">Observación (opcional)</label>
            <textarea id="observacion-transicion" className="control" maxLength={500} value={observacion} onChange={(evento) => establecer_observacion(evento.target.value)} />
          </div>
        </div>
      </Modal>
    </>
  );
}
