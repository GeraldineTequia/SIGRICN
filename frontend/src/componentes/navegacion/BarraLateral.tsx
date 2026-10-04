import { ChevronDown, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useSesion } from '../../contextos/ContextoSesion';
import { leer_preferencia, guardar_preferencia } from '../../utilidades/almacenamiento_local';
import { obtener_etiqueta } from '../../utilidades/formato';
import { ELEMENTOS_PIE, GRUPOS_MENU } from './menu';

function ruta_activa(ruta: string, actual: string): boolean {
  return ruta === '/' ? actual === '/' : actual === ruta || actual.startsWith(`${ruta}/`);
}

export function LogoSgricn() {
  return (
    <svg width="40" height="40" viewBox="0 0 78 78"  href="Logo.png" aria-hidden="true">
      <image href="Logo.png" width="80" height="80"aria-hidden="true" />
    </svg>
  );
}

/**
 * Barra lateral desplegable (inspirada en codepen.io/azouaoui-med/pen/wpBadb):
 * grupos que se abren y cierran, modo colapsado sólo con iconos y menú deslizante en celulares.
 * Los grupos son botones con aria-expanded; los enlaces marcan la página actual con aria-current.
 */
export function BarraLateral({ colapsada, al_colapsar, al_navegar }: { colapsada: boolean; al_colapsar: () => void; al_navegar: () => void }) {
  const { usuario, puede } = useSesion();
  const ubicacion = useLocation();
  const [grupos_abiertos, establecer_grupos] = useState<Record<string, boolean>>(() => leer_preferencia('grupos_menu', {}));

  const alternar_grupo = (clave: string) => {
    establecer_grupos((actuales) => {
      const nuevos = { ...actuales, [clave]: actuales[clave] === false };
      guardar_preferencia('grupos_menu', nuevos);
      return nuevos;
    });
  };

  return (
    <aside className="lateral" aria-label="Navegación principal">
      <div className="lateral_marca">
        <span className="lateral_logo">
          <LogoSgricn />
        </span>
        <span className="lateral_nombre">
          <strong>S.G.R.I.C.N</strong>
          <span>Sistema de Gestión</span>
        </span>
        <button type="button" className="boton_colapsar" onClick={al_colapsar} aria-label={colapsada ? 'Expandir barra lateral' : 'Colapsar barra lateral'} aria-pressed={colapsada}>
          {colapsada ? <PanelLeftOpen size={20} aria-hidden="true" /> : <PanelLeftClose size={20} aria-hidden="true" />}
        </button>
      </div>
      {usuario && <span className="lateral_rol">Rol: {obtener_etiqueta(usuario.rol)}</span>}
      <nav className="lateral_navegacion">
        {GRUPOS_MENU.map((grupo) => {
          const elementos = grupo.elementos.filter((elemento) => !elemento.permiso || puede(elemento.permiso));
          if (elementos.length === 0) return null;
          const abierto = grupos_abiertos[grupo.clave] !== false;
          const activo = elementos.some((elemento) => ruta_activa(elemento.ruta, ubicacion.pathname));
          const IconoGrupo = grupo.icono;
          return (
            <div key={grupo.clave} className="grupo_menu" data-abierto={abierto} data-activo={activo}>
              <button
                type="button"
                className="grupo_menu_titulo"
                aria-expanded={abierto}
                aria-controls={`grupo-${grupo.clave}`}
                onClick={() => alternar_grupo(grupo.clave)}
                title={colapsada ? grupo.titulo : undefined}
              >
                <IconoGrupo size={18} aria-hidden="true" />
                <span>{grupo.titulo}</span>
                <ChevronDown size={16} className="flecha" aria-hidden="true" />
              </button>
              <div className="grupo_menu_items" id={`grupo-${grupo.clave}`}>
                <ul>
                  {elementos.map((elemento) => {
                    const Icono = elemento.icono;
                    return (
                      <li key={elemento.ruta}>
                        <NavLink
                          to={elemento.ruta}
                          end={elemento.ruta === '/'}
                          className="enlace_menu"
                          onClick={al_navegar}
                          tabIndex={abierto || colapsada ? 0 : -1}
                          title={colapsada ? elemento.texto : undefined}
                        >
                          <Icono size={19} aria-hidden="true" />
                          <span className="texto_menu">{elemento.texto}</span>
                        </NavLink>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          );
        })}
      </nav>
      <div className="lateral_pie">
        {ELEMENTOS_PIE.slice(0, 1).map((elemento) => {
          const Icono = elemento.icono;
          return (
            <NavLink key={elemento.ruta} to={elemento.ruta} className="enlace_menu" onClick={al_navegar} title={colapsada ? elemento.texto : undefined}>
              <Icono size={18} aria-hidden="true" />
              <span className="texto_menu">{elemento.texto}</span>
            </NavLink>
          );
        })}
      </div>
    </aside>
  );
}
