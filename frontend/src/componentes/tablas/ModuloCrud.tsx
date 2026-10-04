import { Download, Eye, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { EsquemaValidacion } from '@dominio/validacion/validador';
import { useSesion } from '../../contextos/ContextoSesion';
import { useConsulta } from '../../hooks/useConsulta';
import { useOperacion } from '../../hooks/useOperacion';
import { useParametrosUrl } from '../../hooks/useParametrosUrl';
import type { ServicioEntidad } from '../../servicios/servicio_entidad';
import type { RegistroBase } from '../../tipos/api';
import { exportar_csv } from '../../utilidades/formato';
import { useConfirmacion } from '../formularios/DialogoConfirmacion';
import { FormularioModal } from '../formularios/FormularioModal';
import { Modal } from '../formularios/Modal';
import type { DefinicionCampo } from '../formularios/tipos_formulario';
import { EncabezadoPagina, useTituloPagina } from '../navegacion/DisenoPrincipal';
import { ErrorCarga, UltimaActualizacion } from '../tarjetas/Estados';
import { BarraFiltros, type DefinicionFiltro } from './Filtros';
import { Paginacion, TablaDatos, type ColumnaTabla } from './TablaDatos';

export interface ConfiguracionFormularioModulo {
  campos: DefinicionCampo[];
  esquema_creacion: EsquemaValidacion;
  esquema_edicion: EsquemaValidacion;
  titulo_nuevo: string;
  titulo_edicion: string;
  texto_boton_nuevo: string;
  valores_iniciales?: Record<string, unknown>;
  reglas_extra?: (envio: Record<string, unknown>) => Record<string, string>;
  clase_modal?: string;
}

interface PropiedadesModulo<T extends RegistroBase> {
  titulo: string;
  descripcion: string;
  seccion?: string;
  migas?: { texto: string; ruta?: string }[];
  etiquetas?: ReactNode;
  servicio: ServicioEntidad<T>;
  entidades: string[];
  columnas: ColumnaTabla<T>[];
  filtros: DefinicionFiltro[];
  texto_busqueda?: string;
  formulario?: ConfiguracionFormularioModulo;
  /** Para módulos cuyo formulario es una página propia (ruta_nuevo). */
  texto_boton_nuevo?: string;
  ruta_nuevo?: string;
  ruta_edicion?: (fila: T) => string;
  ruta_detalle?: (fila: T) => string;
  detalle?: (fila: T) => ReactNode;
  acciones_extra?: (fila: T) => ReactNode;
  puede_editar_fila?: (fila: T) => boolean;
  permite_eliminar?: boolean;
  mensaje_eliminar?: (fila: T) => string;
  texto_eliminar?: string;
  encabezado_extra?: ReactNode;
  panel_lateral?: ReactNode;
  exportacion?: { nombre: string; columnas: { titulo: string; valor: (fila: Record<string, unknown>) => unknown }[] };
  orden_inicial?: string;
  parametros_fijos?: Record<string, string>;
  ocultar_encabezado?: boolean;
}

/**
 * Módulo de listado reutilizable: búsqueda, filtros, orden y paginación (en la URL),
 * tabla con acciones, formulario de registro/edición, detalle, eliminación con confirmación,
 * exportación y actualización automática cuando otro usuario modifica los datos.
 */
export function ModuloCrud<T extends RegistroBase>(propiedades: PropiedadesModulo<T>) {
  const { puede } = useSesion();
  const navegar = useNavigate();
  const confirmar = useConfirmacion();
  const { ejecutar } = useOperacion();
  const parametros_ruta = useParams();
  const [valores, establecer_valores] = useParametrosUrl();
  const [formulario_abierto, establecer_formulario] = useState<{ registro: T | null } | null>(null);
  const [detalle_local, establecer_detalle] = useState<T | null>(null);
  useTituloPagina(propiedades.titulo, propiedades.seccion, !propiedades.ocultar_encabezado);
  const puede_escribir = puede('editar_registros_operativos');
  const orden = valores.orden ?? propiedades.orden_inicial;
  const consulta = useConsulta(
    (automatica) => propiedades.servicio.listar({ limite: 10, ...valores, orden, ...propiedades.parametros_fijos }, automatica),
    [JSON.stringify(valores), JSON.stringify(propiedades.parametros_fijos)],
    propiedades.entidades,
  );

  const id_ruta = parametros_ruta.identificador;
  const detalle_ruta = useConsulta(() => (id_ruta && propiedades.detalle ? propiedades.servicio.obtener(id_ruta) : Promise.resolve(null)), [id_ruta], propiedades.entidades);
  const registro_detalle = detalle_local ?? (id_ruta ? detalle_ruta.datos : null);
  const cerrar_detalle = () => {
    establecer_detalle(null);
    // Al cerrar el detalle abierto por enlace (/modulo/:id) se vuelve al listado conservando los filtros.
    if (id_ruta) navegar(`${window.location.pathname.replace(/\/[^/]+$/, '')}${window.location.search}`);
  };

  const eliminar = async (fila: T) => {
    const aceptado = await confirmar({
      titulo: propiedades.texto_eliminar ?? 'Confirmar eliminación',
      mensaje: propiedades.mensaje_eliminar?.(fila) ?? 'Esta acción no se puede deshacer. ¿Deseas continuar?',
      texto_confirmar: propiedades.texto_eliminar ?? 'Eliminar',
      es_destructiva: true,
    });
    if (!aceptado) return;
    await ejecutar(() => propiedades.servicio.eliminar(fila.id), { entidades: propiedades.entidades, mensaje_exito: (mensaje) => mensaje });
  };

  const columnas: ColumnaTabla<T>[] = [
    ...propiedades.columnas,
    {
      clave: 'acciones',
      titulo: 'Acciones',
      render: (fila) => (
        <div className="grupo_botones">
          {propiedades.ruta_detalle ? (
            <Link to={propiedades.ruta_detalle(fila)} className="boton boton_pequeno boton_suave">
              <Eye size={15} aria-hidden="true" /> Ver detalle
            </Link>
          ) : propiedades.detalle ? (
            <button type="button" className="boton boton_pequeno boton_suave" onClick={() => establecer_detalle(fila)}>
              <Eye size={15} aria-hidden="true" /> Ver detalle
            </button>
          ) : null}
          {puede_escribir && (propiedades.puede_editar_fila?.(fila) ?? true) && (propiedades.formulario || propiedades.ruta_edicion) && (
            propiedades.ruta_edicion ? (
              <Link to={propiedades.ruta_edicion(fila)} className="boton boton_pequeno" aria-label={`Editar ${String(fila.titulo ?? fila.nombre ?? fila.id)}`}>
                <Pencil size={15} aria-hidden="true" /> Editar
              </Link>
            ) : (
              <button type="button" className="boton boton_pequeno" onClick={() => establecer_formulario({ registro: fila })}>
                <Pencil size={15} aria-hidden="true" /> Editar
              </button>
            )
          )}
          {propiedades.acciones_extra?.(fila)}
          {puede_escribir && propiedades.permite_eliminar !== false && (
            <button type="button" className="boton boton_pequeno boton_texto_peligro" onClick={() => void eliminar(fila)}>
              <Trash2 size={15} aria-hidden="true" /> {propiedades.texto_eliminar ?? 'Eliminar'}
            </button>
          )}
        </div>
      ),
    },
  ];

  const boton_nuevo =
    puede('crear_registros_operativos') && (propiedades.formulario || propiedades.ruta_nuevo) ? (
      propiedades.ruta_nuevo ? (
        <Link to={propiedades.ruta_nuevo} className="boton boton_primario">
          <Plus size={18} aria-hidden="true" /> {propiedades.texto_boton_nuevo ?? propiedades.formulario?.texto_boton_nuevo ?? 'Registrar'}
        </Link>
      ) : (
        <button type="button" className="boton boton_primario" onClick={() => establecer_formulario({ registro: null })}>
          <Plus size={18} aria-hidden="true" /> {propiedades.formulario?.texto_boton_nuevo}
        </button>
      )
    ) : null;

  const tabla = (
    <section className="tarjeta" aria-label={`Listado: ${propiedades.titulo}`}>
      <BarraFiltros filtros={propiedades.filtros} valores={valores} al_cambiar={(nuevos) => establecer_valores(nuevos)} texto_busqueda={propiedades.texto_busqueda} />
      {consulta.error ? (
        <ErrorCarga mensaje={consulta.error} codigo={consulta.codigo_error} al_reintentar={consulta.recargar} />
      ) : (
        <>
          <TablaDatos
            columnas={columnas}
            filas={consulta.datos?.elementos ?? []}
            cargando={consulta.cargando}
            orden={orden}
            al_ordenar={(nuevo) => establecer_valores({ ...valores, orden: nuevo }, false)}
            descripcion={propiedades.titulo}
          />
          <Paginacion paginacion={consulta.datos?.paginacion ?? null} al_cambiar={(pagina) => establecer_valores({ ...valores, pagina: String(pagina) }, false)} />
        </>
      )}
    </section>
  );

  return (
    <>
      {!propiedades.ocultar_encabezado && (
        <EncabezadoPagina
          titulo={propiedades.titulo}
          descripcion={propiedades.descripcion}
          migas={propiedades.migas}
          etiquetas={propiedades.etiquetas}
          acciones={
            <>
              {propiedades.exportacion && (
                <button
                  type="button"
                  className="boton"
                  disabled={!consulta.datos?.elementos.length}
                  onClick={() => exportar_csv(propiedades.exportacion!.nombre, propiedades.exportacion!.columnas, (consulta.datos?.elementos ?? []) as Record<string, unknown>[])}
                >
                  <Download size={18} aria-hidden="true" /> Exportar
                </button>
              )}
              {boton_nuevo}
            </>
          }
        />
      )}
      {propiedades.ocultar_encabezado && boton_nuevo && <div className="fila" style={{ justifyContent: 'flex-end', marginBottom: 14 }}>{boton_nuevo}</div>}
      {propiedades.encabezado_extra}
      {propiedades.panel_lateral ? (
        <div className="dos_columnas">
          {tabla}
          <aside className="panel_control">{propiedades.panel_lateral}</aside>
        </div>
      ) : (
        tabla
      )}
      {consulta.datos && <div style={{ marginTop: 12 }}><UltimaActualizacion fecha={new Date()} /></div>}
      {propiedades.formulario && formulario_abierto && (
        <FormularioModal<T>
          abierto
          titulo={formulario_abierto.registro ? propiedades.formulario.titulo_edicion : propiedades.formulario.titulo_nuevo}
          al_cerrar={() => establecer_formulario(null)}
          campos={propiedades.formulario.campos}
          esquema_creacion={propiedades.formulario.esquema_creacion}
          esquema_edicion={propiedades.formulario.esquema_edicion}
          servicio={propiedades.servicio}
          registro={formulario_abierto.registro}
          valores_iniciales={propiedades.formulario.valores_iniciales}
          entidades={propiedades.entidades}
          reglas_extra={propiedades.formulario.reglas_extra}
          clase_modal={propiedades.formulario.clase_modal}
        />
      )}
      {propiedades.detalle && registro_detalle && (
        <Modal abierto titulo="Detalle del registro" al_cerrar={cerrar_detalle} tamano="grande">
          {propiedades.detalle(registro_detalle)}
        </Modal>
      )}
    </>
  );
}

/** Lista de pares etiqueta–valor para los detalles. */
export function ListaDetalle({ elementos }: { elementos: { etiqueta: string; valor: ReactNode }[] }) {
  return (
    <dl className="metadatos" style={{ gap: 10 }}>
      {elementos.map((elemento) => (
        <div key={elemento.etiqueta}>
          <dt>{elemento.etiqueta}</dt>
          <dd>{elemento.valor ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}
