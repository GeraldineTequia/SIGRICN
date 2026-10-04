import { Check, Info, Search, Settings, ShieldCheck, Users, X } from 'lucide-react';
import { useState } from 'react';
import { PERMISOS, puede_gestionar_cuenta, type Permiso } from '@dominio/reglas/permisos';
import { ROLES, type Rol } from '@dominio/reglas/catalogos';
import { useConfirmacion } from '../componentes/formularios/DialogoConfirmacion';
import { EncabezadoPagina, RequierePermiso, useTituloPagina } from '../componentes/navegacion/DisenoPrincipal';
import { Paginacion, TablaDatos } from '../componentes/tablas/TablaDatos';
import { AvisoEnLinea, ErrorCarga, UltimaActualizacion } from '../componentes/tarjetas/Estados';
import { Insignia } from '../componentes/tarjetas/Insignia';
import { useSesion } from '../contextos/ContextoSesion';
import { useConsulta } from '../hooks/useConsulta';
import { useOperacion } from '../hooks/useOperacion';
import { useParametrosUrl } from '../hooks/useParametrosUrl';
import { servicio_cuentas } from '../servicios/servicios';
import type { CuentaDirectorio } from '../tipos/api';
import { formatear_fecha, obtener_etiqueta } from '../utilidades/formato';

const NOMBRES_PERMISO: Record<Permiso, string> = {
  consultar_informacion_operativa: 'Consultar información operativa',
  consultar_mapa_y_dashboard: 'Consultar mapa y dashboard',
  exportar_informacion: 'Exportar información consultable',
  crear_registros_operativos: 'Crear registros operativos',
  editar_registros_operativos: 'Editar registros operativos',
  eliminar_registros_operativos: 'Eliminar registros operativos',
  cambiar_estados: 'Cambiar estados',
  gestionar_recursos_y_fondos: 'Gestionar recursos y fondos',
  registrar_donaciones: 'Registrar donaciones',
  gestionar_reportes_ciudadanos: 'Gestionar reportes ciudadanos',
  administrar_cuentas: 'Administrar cuentas, roles y estados',
  consultar_datos_restringidos: 'Datos personales restringidos',
};

/** Usuarios, roles y permisos (RF4): endpoints específicos, confirmación y auditoría. */
export function PaginaUsuarios() {
  useTituloPagina('Usuarios, roles y permisos', 'Administración');
  const { usuario } = useSesion();
  const confirmar = useConfirmacion();
  const { ejecutar } = useOperacion();
  const [valores, establecer] = useParametrosUrl();
  const [busqueda, establecer_busqueda] = useState(valores.busqueda ?? '');
  const [cambios, establecer_cambios] = useState<Record<string, Rol>>({});
  const cuentas = useConsulta((automatica) => servicio_cuentas.listar({ limite: 15, ...valores }, automatica), [JSON.stringify(valores)], ['usuarios']);
  const actor = usuario?.rol ?? 'usuario';

  const aplicar_cambios = async () => {
    const lista = Object.entries(cambios);
    if (lista.length === 0) return;
    const aceptado = await confirmar({
      titulo: 'Confirmar cambios de rol',
      mensaje: `Se actualizará el rol de ${lista.length} cuenta(s). Los permisos cambian de inmediato en sus sesiones activas y el cambio queda auditado.`,
    });
    if (!aceptado) return;
    for (const [id, rol] of lista) {
      await ejecutar(() => servicio_cuentas.cambiar_rol(id, rol), { entidades: ['usuarios'], mensaje_exito: (mensaje) => mensaje });
    }
    establecer_cambios({});
    cuentas.recargar();
  };

  const cambiar_estado = async (cuenta: CuentaDirectorio) => {
    const nuevo = cuenta.estado === 'activo' ? 'inactivo' : 'activo';
    const aceptado = await confirmar({
      titulo: nuevo === 'inactivo' ? 'Desactivar cuenta' : 'Activar cuenta',
      mensaje: nuevo === 'inactivo' ? `${cuenta.nombre} ${cuenta.apellido} perderá el acceso y sus sesiones abiertas se cerrarán de inmediato.` : `${cuenta.nombre} ${cuenta.apellido} podrá volver a iniciar sesión.`,
      texto_confirmar: nuevo === 'inactivo' ? 'Desactivar' : 'Activar',
      es_destructiva: nuevo === 'inactivo',
    });
    if (!aceptado) return;
    await ejecutar(() => servicio_cuentas.cambiar_estado(cuenta.id, nuevo), { entidades: ['usuarios'], mensaje_exito: (mensaje) => mensaje });
    cuentas.recargar();
  };

  return (
    <RequierePermiso permiso="administrar_cuentas">
      <EncabezadoPagina
        titulo="Usuarios, roles y permisos"
        descripcion="Matriz de acceso y confirmación · Solo visible para roles autorizados."
        migas={[{ texto: 'D · Comunicación, control y reportes' }, { texto: 'RF4' }]}
        etiquetas={<Insignia tono="advertencia" texto="Solo personal autorizado" />}
      />
      <div className="dos_columnas">
        <section className="tarjeta pila" aria-labelledby="titulo-directorio">
          <div className="tarjeta_encabezado" style={{ marginBottom: 0 }}>
            <h2 id="titulo-directorio">
              <Users size={20} aria-hidden="true" /> Directorio de usuarios
            </h2>
            <form
              className="filtro fila"
              role="search"
              onSubmit={(evento) => {
                evento.preventDefault();
                establecer({ ...valores, busqueda });
              }}
            >
              <label htmlFor="buscar-usuario" className="solo_lectores">
                Buscar usuario
              </label>
              <input id="buscar-usuario" type="search" placeholder="Buscar usuario · correo" value={busqueda} onChange={(evento) => establecer_busqueda(evento.target.value)} />
              <button type="submit" className="boton boton_pequeno" aria-label="Buscar">
                <Search size={15} aria-hidden="true" />
              </button>
            </form>
          </div>
          <div className="opciones_chip" role="group" aria-label="Filtrar por rol">
            {ROLES.map((rol) => (
              <button key={rol} type="button" className="chip" aria-pressed={valores.rol === rol} onClick={() => establecer({ ...valores, rol: valores.rol === rol ? '' : rol })}>
                {obtener_etiqueta(rol)}
              </button>
            ))}
            {['activo', 'inactivo'].map((estado) => (
              <button key={estado} type="button" className="chip" aria-pressed={valores.estado === estado} onClick={() => establecer({ ...valores, estado: valores.estado === estado ? '' : estado })}>
                {obtener_etiqueta(estado)}
              </button>
            ))}
          </div>
          {cuentas.error ? (
            <ErrorCarga mensaje={cuentas.error} codigo={cuentas.codigo_error} al_reintentar={cuentas.recargar} />
          ) : (
            <>
              <TablaDatos<CuentaDirectorio>
                descripcion="Cuentas registradas"
                cargando={cuentas.cargando}
                filas={cuentas.datos?.elementos ?? []}
                orden={valores.orden}
                al_ordenar={(orden) => establecer({ ...valores, orden }, false)}
                columnas={[
                  { clave: 'nombre', titulo: 'Nombre', orden: 'nombre', render: (cuenta) => <><span className="principal_celda">{cuenta.nombre} {cuenta.apellido}</span><span className="secundario_celda">{cuenta.correo}</span></> },
                  {
                    clave: 'rol',
                    titulo: 'Rol',
                    render: (cuenta) => {
                      const gestionable = cuenta.id !== usuario?.id && puede_gestionar_cuenta(actor, cuenta.rol);
                      return gestionable ? (
                        <select
                          className="control"
                          style={{ minHeight: 36 }}
                          aria-label={`Rol de ${cuenta.nombre} ${cuenta.apellido}`}
                          value={cambios[cuenta.id] ?? cuenta.rol}
                          onChange={(evento) => {
                            const rol = evento.target.value as Rol;
                            establecer_cambios((actuales) => {
                              const nuevos = { ...actuales };
                              if (rol === cuenta.rol) delete nuevos[cuenta.id];
                              else nuevos[cuenta.id] = rol;
                              return nuevos;
                            });
                          }}
                        >
                          {ROLES.filter((rol) => puede_gestionar_cuenta(actor, cuenta.rol, rol)).map((rol) => (
                            <option key={rol} value={rol}>
                              {obtener_etiqueta(rol)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <Insignia tono="neutro" texto={obtener_etiqueta(cuenta.rol)} sin_icono />
                      );
                    },
                  },
                  { clave: 'estado', titulo: 'Estado', render: (cuenta) => <Insignia valor={cuenta.estado} /> },
                  { clave: 'sesion', titulo: 'Última sesión', orden: 'ultima_sesion', render: (cuenta) => formatear_fecha(cuenta.ultima_sesion, true) },
                  {
                    clave: 'acciones',
                    titulo: 'Acciones',
                    render: (cuenta) =>
                      cuenta.id !== usuario?.id && puede_gestionar_cuenta(actor, cuenta.rol) ? (
                        <button type="button" className={`boton boton_pequeno ${cuenta.estado === 'activo' ? 'boton_texto_peligro' : ''}`} onClick={() => void cambiar_estado(cuenta)}>
                          {cuenta.estado === 'activo' ? 'Desactivar' : 'Activar'}
                        </button>
                      ) : (
                        <span className="texto_suave texto_pequeno">{cuenta.id === usuario?.id ? 'Tu cuenta' : 'Rol superior'}</span>
                      ),
                  },
                ]}
              />
              <Paginacion paginacion={cuentas.datos?.paginacion ?? null} al_cambiar={(pagina) => establecer({ ...valores, pagina: String(pagina) }, false)} />
            </>
          )}
          <details>
            <summary>Matriz de permisos: Operación · Fondos · Reportes · Usuarios</summary>
            <div className="contenedor_tabla">
              <table className="tabla">
                <caption className="solo_lectores">Matriz de permisos por rol</caption>
                <thead>
                  <tr>
                    <th scope="col">Acción</th>
                    {ROLES.map((rol) => (
                      <th key={rol} scope="col">
                        {obtener_etiqueta(rol)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(Object.keys(PERMISOS) as Permiso[]).filter((permiso) => permiso !== 'gestionar_reportes_ciudadanos').map((permiso) => (
                    <tr key={permiso}>
                      <th scope="row">{NOMBRES_PERMISO[permiso]}</th>
                      {ROLES.map((rol) => {
                        const permitido = (PERMISOS[permiso] as readonly string[]).includes(rol);
                        return (
                          <td key={rol}>
                            {permitido ? <Check size={16} aria-label="Sí" /> : <X size={16} aria-label="No" />}
                            <span className="solo_lectores">{permitido ? 'Sí' : 'No'}</span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </section>
        <aside className="panel_control">
          <div className="tarjeta pila">
            <h2 className="fila">
              <Settings size={20} aria-hidden="true" /> Panel de control
            </h2>
            <AvisoEnLinea tono="primario" icono={<Info size={20} />}>
              <p>No puedes asignar permisos superiores a tu rol ni gestionar cuentas de rango superior.</p>
              <p className="fila" style={{ gap: 6, marginTop: 6 }}>
                <ShieldCheck size={15} aria-hidden="true" /> Confirma los cambios antes de aplicar.
              </p>
            </AvisoEnLinea>
            {Object.keys(cambios).length > 0 && <Insignia tono="advertencia" texto={`${Object.keys(cambios).length} cambio(s) sin aplicar`} />}
            <button type="button" className="boton boton_primario boton_grande" disabled={Object.keys(cambios).length === 0} onClick={aplicar_cambios}>
              <Check size={20} aria-hidden="true" /> Confirmar cambios
            </button>
            <button type="button" className="boton boton_grande" disabled={Object.keys(cambios).length === 0} onClick={() => establecer_cambios({})}>
              <X size={20} aria-hidden="true" /> Cancelar
            </button>
            <UltimaActualizacion fecha={new Date()} />
          </div>
        </aside>
      </div>
    </RequierePermiso>
  );
}
