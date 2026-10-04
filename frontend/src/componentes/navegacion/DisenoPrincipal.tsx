import { Clock } from 'lucide-react';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import type { Permiso } from '@dominio/reglas/permisos';
import { useSesion } from '../../contextos/ContextoSesion';
import { leer_preferencia, guardar_preferencia } from '../../utilidades/almacenamiento_local';
import { Modal } from '../formularios/Modal';
import { Cargando, ErrorCarga } from '../tarjetas/Estados';
import { BarraLateral } from './BarraLateral';
import { BarraSuperior } from './BarraSuperior';

interface TituloPagina {
  titulo: string;
  seccion?: string;
}

const ContextoTitulo = createContext<(titulo: TituloPagina) => void>(() => undefined);

/** Cada página declara su título: se muestra en la barra superior y en la pestaña del navegador. */
export function useTituloPagina(titulo: string, seccion?: string, activo = true): void {
  const establecer = useContext(ContextoTitulo);
  useEffect(() => {
    if (!activo) return;
    establecer({ titulo, seccion });
    document.title = `${titulo} · SGRICN`;
  }, [titulo, seccion, establecer, activo]);
}

function AvisoInactividad() {
  const { segundos_para_cierre, continuar_sesion, cerrar_sesion, inactividad_minutos } = useSesion();
  return (
    <Modal
      abierto={segundos_para_cierre !== null}
      titulo="Tu sesión está por cerrarse"
      al_cerrar={continuar_sesion}
      pie={
        <>
          <button type="button" className="boton" onClick={() => void cerrar_sesion()}>
            Cerrar sesión
          </button>
          <button type="button" className="boton boton_primario" onClick={continuar_sesion}>
            Seguir conectado
          </button>
        </>
      }
    >
      <div className="aviso" data-tono="advertencia" role="alert">
        <Clock size={20} aria-hidden="true" />
        <p>
          Por seguridad, la sesión se cierra tras {inactividad_minutos} minutos sin actividad. Se cerrará en <strong>{segundos_para_cierre ?? 0} segundos</strong>.
        </p>
      </div>
    </Modal>
  );
}

/** Estructura de las páginas autenticadas (mockup): barra lateral + barra superior + contenido. */
export function DisenoPrincipal() {
  const { usuario, cargando } = useSesion();
  const ubicacion = useLocation();
  const [titulo, establecer_titulo] = useState<TituloPagina>({ titulo: 'Centro de mando' });
  const [colapsada, establecer_colapsada] = useState<boolean>(() => leer_preferencia('lateral_colapsada', false));
  const [menu_movil, establecer_menu_movil] = useState(false);

  useEffect(() => establecer_menu_movil(false), [ubicacion.pathname]);

  if (cargando) return <Cargando texto="Verificando la sesión…" />;
  if (!usuario) return <Navigate to="/iniciar-sesion" replace state={{ desde: `${ubicacion.pathname}${ubicacion.search}` }} />;

  return (
    <ContextoTitulo.Provider value={establecer_titulo}>
      <a href="#contenido" className="saltar_contenido">
        Saltar al contenido
      </a>
      <div className="estructura" data-lateral={colapsada ? 'colapsada' : 'expandida'} data-movil={menu_movil ? 'abierta' : 'cerrada'}>
        <BarraLateral
          colapsada={colapsada}
          al_colapsar={() =>
            establecer_colapsada((actual) => {
              guardar_preferencia('lateral_colapsada', !actual);
              return !actual;
            })
          }
          al_navegar={() => establecer_menu_movil(false)}
        />
        <button type="button" className="fondo_lateral_movil" aria-label="Cerrar menú" onClick={() => establecer_menu_movil(false)} tabIndex={menu_movil ? 0 : -1} />
        <div className="principal">
          <BarraSuperior titulo={titulo.titulo} seccion={titulo.seccion} al_abrir_menu={() => establecer_menu_movil(true)} />
          <main id="contenido" className="contenido" tabIndex={-1}>
            <Outlet />
          </main>
        </div>
      </div>
      <AvisoInactividad />
    </ContextoTitulo.Provider>
  );
}

/** Protege rutas por permiso. Ocultar la ruta NO reemplaza la autorización del backend. */
export function RequierePermiso({ permiso, children }: { permiso: Permiso; children: ReactNode }) {
  const { puede } = useSesion();
  if (!puede(permiso)) {
    return (
      <div className="tarjeta">
        <ErrorCarga mensaje="No tienes permisos para esta sección." codigo={403} />
        <p style={{ marginTop: 12 }}>
          <Link to="/">Volver al dashboard</Link>
        </p>
      </div>
    );
  }
  return <>{children}</>;
}

interface PropiedadesEncabezado {
  titulo: string;
  descripcion?: string;
  migas?: { texto: string; ruta?: string }[];
  etiquetas?: ReactNode;
  acciones?: ReactNode;
}

export function EncabezadoPagina({ titulo, descripcion, migas, etiquetas, acciones }: PropiedadesEncabezado) {
  return (
    <>
      {migas && migas.length > 0 && (
        <nav aria-label="Ruta de navegación">
          <ol className="migas">
            {migas.map((miga, indice) => (
              <li key={`${miga.texto}-${indice}`} className="fila" style={{ gap: 6 }}>
                {indice > 0 && <span aria-hidden="true">›</span>}
                {miga.ruta && indice < migas.length - 1 ? <Link to={miga.ruta}>{miga.texto}</Link> : <span aria-current={indice === migas.length - 1 ? 'page' : undefined}>{miga.texto}</span>}
              </li>
            ))}
          </ol>
        </nav>
      )}
      {etiquetas && <div className="fila" style={{ marginBottom: 10 }}>{etiquetas}</div>}
      <div className="encabezado_pagina">
        <div>
          <h1>{titulo}</h1>
          {descripcion && <p>{descripcion}</p>}
        </div>
        {acciones && <div className="acciones_encabezado">{acciones}</div>}
      </div>
    </>
  );
}
