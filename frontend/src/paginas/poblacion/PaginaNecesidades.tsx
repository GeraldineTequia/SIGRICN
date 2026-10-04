import { ArrowUpDown, Plus, Save, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { ESQUEMA_NECESIDAD } from '@dominio/validacion/esquemas';
import { CamposFormulario, ResumenErrores } from '../../componentes/formularios/CamposFormulario';
import { BotonEnProceso } from '../../componentes/formularios/DialogoConfirmacion';
import type { DefinicionCampo } from '../../componentes/formularios/tipos_formulario';
import { EncabezadoPagina, useTituloPagina } from '../../componentes/navegacion/DisenoPrincipal';
import { BarraFiltros } from '../../componentes/tablas/Filtros';
import { Paginacion } from '../../componentes/tablas/TablaDatos';
import { BarraProgreso, Cargando, ErrorCarga, EstadoVacio, UltimaActualizacion } from '../../componentes/tarjetas/Estados';
import { Insignia } from '../../componentes/tarjetas/Insignia';
import { TarjetaIndicador } from '../../componentes/tarjetas/TarjetaIndicador';
import { useSesion } from '../../contextos/ContextoSesion';
import { useConsulta } from '../../hooks/useConsulta';
import { useFormularioEntidad } from '../../hooks/useFormularioEntidad';
import { useParametrosUrl } from '../../hooks/useParametrosUrl';
import { servicio_necesidades } from '../../servicios/servicios';
import type { RegistroBase } from '../../tipos/api';
import { formatear_numero, obtener_etiqueta } from '../../utilidades/formato';
import { tono_de } from '../../utilidades/tonos';
import { CAMPO_EMERGENCIA, CAMPO_FAMILIA, CAMPO_PERSONA, OPCIONES, campo_zona } from '../campos_comunes';

const CAMPOS_NECESIDAD: DefinicionCampo[] = [
  { ...CAMPO_EMERGENCIA, ancho: 'completo' },
  { nombre: 'ambito', etiqueta: 'Necesidad de', tipo: 'opciones', requerido: true, opciones: OPCIONES.ambitos, ancho: 'completo' },
  { ...campo_zona(true), visible_si: (datos) => datos.ambito === 'zona', ancho: 'completo' },
  { ...CAMPO_FAMILIA, requerido: true, visible_si: (datos) => datos.ambito === 'familia', ancho: 'completo' },
  { ...CAMPO_PERSONA, requerido: true, visible_si: (datos) => datos.ambito === 'persona', ancho: 'completo' },
  { nombre: 'tipo', etiqueta: 'Tipo', tipo: 'seleccion', requerido: true, opciones: OPCIONES.tipos_necesidad },
  { nombre: 'prioridad', etiqueta: 'Prioridad', tipo: 'seleccion', requerido: true, opciones: OPCIONES.prioridades },
  { nombre: 'descripcion', etiqueta: 'Descripción', tipo: 'area', requerido: true, ancho: 'completo' },
  { nombre: 'cantidad_requerida', etiqueta: 'Cantidad requerida', tipo: 'entero', requerido: true, minimo: 1 },
  { nombre: 'cantidad_recibida', etiqueta: 'Cantidad recibida', tipo: 'entero', minimo: 0 },
  { nombre: 'unidad', etiqueta: 'Unidad', tipo: 'texto' },
  { nombre: 'responsable', etiqueta: 'Responsable', tipo: 'texto' },
  { nombre: 'estado', etiqueta: 'Estado', tipo: 'opciones', requerido: true, opciones: OPCIONES.estados_necesidad, ancho: 'completo' },
];

function PanelNecesidad({ seleccionada, al_terminar }: { seleccionada: RegistroBase | null; al_terminar: () => void }) {
  const formulario = useFormularioEntidad<RegistroBase>({
    campos: CAMPOS_NECESIDAD,
    esquema_creacion: ESQUEMA_NECESIDAD,
    esquema_edicion: ESQUEMA_NECESIDAD,
    servicio: servicio_necesidades,
    registro: seleccionada,
    valores_iniciales: { ambito: 'zona', estado: 'pendiente', prioridad: 'media', cantidad_recibida: 0 },
    entidades: ['necesidades', 'alertas'],
  });
  return (
    <form
      className="tarjeta pila"
      noValidate
      onSubmit={async (evento) => {
        evento.preventDefault();
        if (await formulario.enviar()) al_terminar();
      }}
      aria-labelledby="titulo-panel-necesidad"
    >
      <h2 id="titulo-panel-necesidad">{seleccionada ? 'Actualizar necesidad' : 'Registrar necesidad'}</h2>
      {seleccionada && (
        <p className="texto_suave">
          Necesidad seleccionada: <strong style={{ display: 'inline' }}>{String(seleccionada.tipo)} · {obtener_etiqueta(String(seleccionada.ambito ?? 'zona'))} · {obtener_etiqueta(String(seleccionada.prioridad))}</strong>
        </p>
      )}
      <ResumenErrores errores={formulario.errores} campos={CAMPOS_NECESIDAD} />
      <CamposFormulario campos={CAMPOS_NECESIDAD} datos={formulario.datos} errores={formulario.errores} al_cambiar={formulario.cambiar} es_edicion={formulario.es_edicion} />
      <BotonEnProceso type="submit" en_proceso={formulario.en_proceso} className="boton boton_primario boton_grande">
        {!formulario.en_proceso && <Save size={20} aria-hidden="true" />} Registrar / actualizar
      </BotonEnProceso>
      {seleccionada && (
        <button type="button" className="boton" onClick={al_terminar}>
          Cancelar edición
        </button>
      )}
      <UltimaActualizacion fecha={seleccionada?.actualizado_en ?? new Date()} />
      <p className="ayuda_campo fila" style={{ gap: 6 }}>
        <ShieldCheck size={15} aria-hidden="true" /> Visible para todos los roles; sólo funcionario y administrador registran o actualizan.
      </p>
    </form>
  );
}

/** Necesidades prioritarias (RF16) agrupadas por urgencia y estado de atención. */
export function PaginaNecesidades() {
  useTituloPagina('Necesidades prioritarias', 'Gestión de crisis');
  const { puede } = useSesion();
  const [valores, establecer] = useParametrosUrl();
  const [seleccionada, establecer_seleccionada] = useState<RegistroBase | null>(null);
  const [clave_formulario, establecer_clave] = useState(0);
  const lista = useConsulta((automatica) => servicio_necesidades.listar({ limite: 10, orden: '-creado_en', ...valores }, automatica), [JSON.stringify(valores)], ['necesidades']);
  const conteos = useConsulta(
    async (automatica) => {
      const base = { catastrofe_id: valores.catastrofe_id, limite: 1 };
      const [criticas, altas, medias, atendidas] = await Promise.all([
        servicio_necesidades.listar({ ...base, prioridad: 'critica', estado: 'pendiente' }, automatica),
        servicio_necesidades.listar({ ...base, prioridad: 'alta', estado: 'pendiente' }, automatica),
        servicio_necesidades.listar({ ...base, prioridad: 'media', estado: 'pendiente' }, automatica),
        servicio_necesidades.listar({ ...base, estado: 'atendida' }, automatica),
      ]);
      return { criticas: criticas.paginacion.total, altas: altas.paginacion.total, medias: medias.paginacion.total, atendidas: atendidas.paginacion.total };
    },
    [valores.catastrofe_id],
    ['necesidades'],
  );
  const terminar = () => {
    establecer_seleccionada(null);
    establecer_clave((valor) => valor + 1);
  };
  return (
    <>
      <EncabezadoPagina
        titulo="Necesidades prioritarias"
        descripcion="Persona, familia o zona · agrupadas por urgencia y estado de atención."
        migas={[{ texto: 'Gestión de crisis' }, { texto: 'Zonas Afect. / Población', ruta: '/zonas' }, { texto: 'Necesidades prioritarias' }]}
        etiquetas={<Insignia tono="primario" texto="B · Operación · RF10 – RF16" sin_icono />}
        acciones={
          puede('crear_registros_operativos') && (
            <button type="button" className="boton boton_primario" onClick={terminar}>
              <Plus size={18} aria-hidden="true" /> Registrar necesidad
            </button>
          )
        }
      />
      <div className="rejilla_indicadores">
        <TarjetaIndicador titulo="Críticas pendientes" valor={conteos.datos?.criticas ?? '—'} tono_valor="peligro" enlace="/necesidades?prioridad=critica&estado=pendiente" etiqueta_accion="filtrar" />
        <TarjetaIndicador titulo="Altas pendientes" valor={conteos.datos?.altas ?? '—'} tono_valor="advertencia" enlace="/necesidades?prioridad=alta&estado=pendiente" etiqueta_accion="filtrar" />
        <TarjetaIndicador titulo="Medias pendientes" valor={conteos.datos?.medias ?? '—'} tono_valor="primario" enlace="/necesidades?prioridad=media&estado=pendiente" etiqueta_accion="filtrar" />
        <TarjetaIndicador titulo="Atendidas" valor={conteos.datos?.atendidas ?? '—'} tono_valor="primario" enlace="/necesidades?estado=atendida" etiqueta_accion="filtrar" />
      </div>
      <div className="dos_columnas">
        <section className="tarjeta pila" aria-labelledby="titulo-lista-necesidades">
          <div className="tarjeta_encabezado" style={{ marginBottom: 0 }}>
            <h2 id="titulo-lista-necesidades">Lista de necesidades</h2>
            <button type="button" className="boton boton_pequeno" onClick={() => establecer({ ...valores, orden: valores.orden === 'prioridad' ? '-prioridad' : 'prioridad' }, false)}>
              <ArrowUpDown size={15} aria-hidden="true" /> Ordenar por prioridad
            </button>
          </div>
          <BarraFiltros
            valores={valores}
            al_cambiar={establecer}
            texto_busqueda="Buscar necesidad o responsable…"
            filtros={[
              { nombre: 'prioridad', etiqueta: 'Prioridad', tipo: 'seleccion', opciones: OPCIONES.prioridades },
              { nombre: 'estado', etiqueta: 'Estado', tipo: 'seleccion', opciones: OPCIONES.estados_necesidad },
              { nombre: 'ambito', etiqueta: 'Ámbito', tipo: 'seleccion', opciones: OPCIONES.ambitos },
              { nombre: 'tipo', etiqueta: 'Tipo', tipo: 'seleccion', opciones: OPCIONES.tipos_necesidad },
            ]}
          />
          {lista.error ? (
            <ErrorCarga mensaje={lista.error} codigo={lista.codigo_error} al_reintentar={lista.recargar} />
          ) : !lista.datos ? (
            <Cargando />
          ) : lista.datos.elementos.length === 0 ? (
            <EstadoVacio centrado texto="No hay necesidades con los filtros seleccionados." />
          ) : (
            <ul className="lista_tarjetas">
              {lista.datos.elementos.map((necesidad) => {
                const tono = tono_de(necesidad.prioridad);
                const contenido = (
                  <>
                    <Insignia valor={String(necesidad.prioridad)} tono={necesidad.prioridad === 'critica' ? 'solido_peligro' : necesidad.prioridad === 'alta' ? 'solido_advertencia' : undefined} texto={obtener_etiqueta(String(necesidad.prioridad)).toUpperCase()} />
                    <span className="cuerpo">
                      <strong>{String(necesidad.tipo)}</strong>
                      <small>
                        {obtener_etiqueta(String(necesidad.ambito ?? 'zona'))} · {formatear_numero(necesidad.cantidad_requerida)} {String(necesidad.unidad ?? '')} · Resp: {String(necesidad.responsable ?? '—')}
                      </small>
                      <BarraProgreso etiqueta="Cubierto" valor={Number(necesidad.porcentaje_cubierto ?? 0)} />
                    </span>
                    <Insignia valor={String(necesidad.estado)} />
                  </>
                );
                return (
                  <li key={necesidad.id}>
                    {puede('editar_registros_operativos') ? (
                      <button type="button" className="tarjeta_lista" data-tono={tono === 'neutro' ? 'primario' : tono} data-seleccionada={seleccionada?.id === necesidad.id} onClick={() => establecer_seleccionada(necesidad)} aria-label={`Editar necesidad ${String(necesidad.tipo)}`}>
                        {contenido}
                      </button>
                    ) : (
                      <div className="tarjeta_lista" data-tono={tono === 'neutro' ? 'primario' : tono}>
                        {contenido}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <Paginacion paginacion={lista.datos?.paginacion ?? null} al_cambiar={(pagina) => establecer({ ...valores, pagina: String(pagina) }, false)} />
          <p className="texto_suave texto_pequeno">Categoría · Cantidad · Prioridad · Estado · Responsable</p>
        </section>
        <aside className="panel_control">
          {puede('editar_registros_operativos') ? (
            <PanelNecesidad key={`${seleccionada?.id ?? 'nueva'}-${clave_formulario}`} seleccionada={seleccionada} al_terminar={terminar} />
          ) : (
            <div className="tarjeta pila">
              <h2>Consulta</h2>
              <p>Tu rol permite consultar las necesidades. Para registrar o actualizar, comunícate con un funcionario.</p>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
