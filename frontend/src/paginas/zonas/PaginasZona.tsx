import { Activity, AlertCircle, MapPin, Navigation, Pencil, Save } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ESQUEMA_ZONA } from '@dominio/validacion/esquemas';
import { BotonEnProceso } from '../../componentes/formularios/DialogoConfirmacion';
import { PaginaFormulario } from '../../componentes/formularios/PaginaFormulario';
import { MapaGeneral } from '../../componentes/mapas/MapaGeneral';
import { EncabezadoPagina, RequierePermiso, useTituloPagina } from '../../componentes/navegacion/DisenoPrincipal';
import { AvisoEnLinea, BarraProgreso, Cargando, ErrorCarga, EstadoVacio, UltimaActualizacion } from '../../componentes/tarjetas/Estados';
import { Insignia } from '../../componentes/tarjetas/Insignia';
import { useSesion } from '../../contextos/ContextoSesion';
import { useConsulta } from '../../hooks/useConsulta';
import { useOperacion } from '../../hooks/useOperacion';
import { servicio_emergencias, servicio_mapa, servicio_necesidades, servicio_poblacion, servicio_zonas } from '../../servicios/servicios';
import type { Zona } from '../../tipos/api';
import { formatear_fecha, formatear_numero, obtener_etiqueta } from '../../utilidades/formato';
import { CAMPOS_ZONA } from './definicion_zonas';

export function PaginaFormularioZona() {
  const { identificador } = useParams();
  useTituloPagina(identificador ? 'Editar zona afectada' : 'Registrar zona afectada', 'Gestión de crisis');
  const consulta = useConsulta(() => (identificador ? servicio_zonas.obtener(identificador) : Promise.resolve(null)), [identificador]);
  const parametros = new URLSearchParams(window.location.search);
  if (identificador && consulta.error) return <ErrorCarga mensaje={consulta.error} codigo={consulta.codigo_error} />;
  if (identificador && !consulta.datos) return <Cargando />;
  return (
    <RequierePermiso permiso={identificador ? 'editar_registros_operativos' : 'crear_registros_operativos'}>
      <PaginaFormulario<Zona>
        titulo={identificador ? 'Editar zona afectada' : 'Registrar zona afectada'}
        descripcion="Ubicación por dirección, emergencia asociada, daños, nivel y porcentaje de afectación."
        migas={[{ texto: 'B · Operación' }, { texto: 'Zonas afectadas', ruta: '/zonas' }, { texto: identificador ? 'Editar' : 'Registrar' }]}
        campos={CAMPOS_ZONA}
        esquema_creacion={ESQUEMA_ZONA}
        esquema_edicion={ESQUEMA_ZONA}
        servicio={servicio_zonas}
        registro={consulta.datos}
        valores_iniciales={{ pais: 'Colombia', estado: 'activa', prioridad: 'media', catastrofe_id: parametros.get('catastrofe_id') ?? '' }}
        entidades={['zonas']}
        ruta_destino={(guardada) => `/zonas/${guardada.id}`}
        ruta_cancelar={identificador ? `/zonas/${identificador}` : '/zonas'}
        prefijo_identificador="ZN"
        clave_borrador="zona_nueva"
      />
    </RequierePermiso>
  );
}

/** Detalle de zona (mockup "Zona afectada · Bellavista"): datos, prioridad sugerida y estado de atención. */
export function PaginaDetalleZona() {
  const { identificador = '' } = useParams();
  const { puede } = useSesion();
  const { ejecutar, en_proceso } = useOperacion();
  const [destino, establecer_destino] = useState<string | null>(null);
  useTituloPagina('Zonas Afectadas', 'Gestión de crisis');
  const zona = useConsulta(() => servicio_zonas.obtener(identificador), [identificador], ['zonas']);
  const complemento = useConsulta(
    async (automatica) => {
      if (!zona.datos) return null;
      const [emergencia, poblacion, necesidades, sugerencia, historial, mapa] = await Promise.all([
        servicio_emergencias.obtener(zona.datos.catastrofe_id).catch(() => null),
        servicio_poblacion.listar({ zona_id: identificador }, automatica),
        servicio_necesidades.listar({ zona_id: identificador, limite: 50 }, automatica),
        servicio_zonas.prioridad_sugerida(identificador),
        servicio_zonas.historial(identificador),
        servicio_mapa.consultar({ catastrofe_id: zona.datos.catastrofe_id, capas: 'zonas' }, automatica),
      ]);
      return { emergencia, poblacion: poblacion.elementos[0] ?? null, necesidades: necesidades.elementos, sugerencia, historial, mapa };
    },
    [identificador, zona.datos?.actualizado_en],
    ['zonas', 'poblacion', 'necesidades'],
  );
  if (zona.error) return <ErrorCarga mensaje={zona.error} codigo={zona.codigo_error} al_reintentar={zona.recargar} />;
  if (!zona.datos) return <Cargando />;
  const datos = zona.datos;
  const pendientes = (complemento.datos?.necesidades ?? []).filter((necesidad) => necesidad.estado !== 'atendida');
  const guardar = async () => {
    if (!destino) return;
    const resultado = await ejecutar(() => servicio_zonas.cambiar_atencion(datos.id, destino), { entidades: ['zonas'], mensaje_exito: (respuesta) => respuesta.mensaje });
    if (resultado) establecer_destino(null);
  };
  return (
    <>
      <EncabezadoPagina
        titulo={`Zona afectada · ${datos.barrio || datos.direccion}`}
        descripcion="Registro, clasificación, detalle y permisos."
        migas={[{ texto: 'B · Operación' }, { texto: 'Zonas afectadas', ruta: '/zonas' }, { texto: datos.barrio || datos.direccion }]}
      />
      <div className="dos_columnas">
        <section className="tarjeta pila" aria-labelledby="titulo-detalle-zona">
          <div className="tarjeta_encabezado" style={{ marginBottom: 0 }}>
            <h2 id="titulo-detalle-zona">Detalle de la zona</h2>
            <Insignia valor={datos.prioridad ?? 'media'} prefijo="Prioridad" />
          </div>
          <ul className="lista_tarjetas" style={{ gap: 8 }}>
            <li className="fila">
              <MapPin size={18} aria-hidden="true" /> {datos.pais} · {datos.departamento} · {datos.municipio}
              {datos.barrio ? ` · ${datos.barrio}` : ''}
            </li>
            <li className="fila">
              <Navigation size={18} aria-hidden="true" /> {datos.direccion} · Emergencia:{' '}
              {complemento.datos?.emergencia ? <Link to={`/emergencias/${datos.catastrofe_id}`}>{complemento.datos.emergencia.titulo}</Link> : 'cargando…'}
            </li>
            <li className="fila">
              <Activity size={18} aria-hidden="true" />
              <strong style={{ color: 'var(--color_titulo)' }}>
                Afectación {datos.porcentaje_afectacion}% · Nivel {obtener_etiqueta(datos.nivel_afectacion)} · Población {formatear_numero(complemento.datos?.poblacion?.personas_afectadas ?? 0)}
              </strong>
            </li>
            <li className="fila">
              <AlertCircle size={18} aria-hidden="true" /> Necesidades pendientes: {pendientes.length ? pendientes.map((necesidad) => `${necesidad.tipo} (${obtener_etiqueta(String(necesidad.prioridad))})`).join(', ') : 'ninguna'}
            </li>
          </ul>
          {datos.danos && <p>Daños: {datos.danos}</p>}
          {datos.descripcion && <p className="texto_suave">{datos.descripcion}</p>}
          <BarraProgreso etiqueta="Nivel de afectación" valor={datos.porcentaje_afectacion} tono={datos.porcentaje_afectacion >= 70 ? 'peligro' : datos.porcentaje_afectacion >= 40 ? 'advertencia' : undefined} />
          <Insignia valor={datos.estado_atencion} texto={`${obtener_etiqueta(datos.estado_atencion)} · Prioridad ${obtener_etiqueta(datos.prioridad ?? '')}`} />
          {complemento.datos?.sugerencia && (
            <AvisoEnLinea tono="primario" titulo={`Prioridad sugerida: ${obtener_etiqueta(complemento.datos.sugerencia.prioridad)}`}>
              <p>Criterio de apoyo del proyecto (no oficial): {complemento.datos.sugerencia.motivos.join(' ')}</p>
            </AvisoEnLinea>
          )}
          {datos.ubicacion.estado !== 'confirmada' ? (
            <AvisoEnLinea tono="advertencia" titulo="Pendiente de georreferenciación">
              <p>La zona no tiene una ubicación confirmada. Se mantiene en los listados y no se dibuja en el mapa.</p>
            </AvisoEnLinea>
          ) : (
            complemento.datos && <MapaGeneral elementos={complemento.datos.mapa.elementos} seleccionado={datos.id} ajuste_vista={1} tamano="mediano" />
          )}
          <h3>Historial de atención</h3>
          {(complemento.datos?.historial ?? []).length === 0 ? (
            <EstadoVacio texto="Sin cambios de atención registrados." />
          ) : (
            <ul className="lista_tarjetas">
              {complemento.datos?.historial.map((cambio) => (
                <li key={cambio.id} className="tarjeta_lista">
                  <div className="cuerpo">
                    <strong>
                      {obtener_etiqueta(cambio.estado_anterior)} → {obtener_etiqueta(cambio.estado_nuevo)}
                    </strong>
                    <small>
                      {cambio.usuario_nombre} · {formatear_fecha(cambio.fecha, true)}
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
            <span className="texto_suave">Cambiar estado de la zona:</span>
            <div className="opciones_chip" role="radiogroup" aria-label="Estado de atención">
              {['sin_atender', 'en_atencion', 'atendida_parcialmente', 'atendida_completamente'].map((estado) => {
                const permitido = datos.transiciones_atencion.includes(estado);
                const actual = datos.estado_atencion === estado;
                return (
                  <button
                    key={estado}
                    type="button"
                    role="radio"
                    className="chip"
                    aria-checked={actual || destino === estado}
                    disabled={!puede('cambiar_estados') || (!permitido && !actual)}
                    onClick={() => !actual && establecer_destino(estado)}
                    title={!permitido && !actual ? 'Transición no permitida desde el estado actual' : undefined}
                  >
                    {obtener_etiqueta(estado)}
                  </button>
                );
              })}
            </div>
            <p className="texto_suave texto_pequeno">Solo personal autorizado puede cambiar el estado de la zona afectada. Las opciones desactivadas no son transiciones válidas desde el estado actual.</p>
            {puede('cambiar_estados') && (
              <BotonEnProceso type="button" en_proceso={en_proceso} className="boton boton_primario boton_grande" disabled={!destino} onClick={guardar}>
                {!en_proceso && <Save size={20} aria-hidden="true" />} Guardar zona
              </BotonEnProceso>
            )}
            {puede('editar_registros_operativos') && (
              <Link to={`/zonas/${datos.id}/editar`} className="boton">
                <Pencil size={18} aria-hidden="true" /> Editar datos
              </Link>
            )}
            <UltimaActualizacion fecha={datos.actualizado_en} />
          </div>
        </aside>
      </div>
    </>
  );
}
