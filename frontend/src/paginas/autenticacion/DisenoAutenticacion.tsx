import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LogoSgricn } from '../../componentes/navegacion/BarraLateral';

/** Diseño de las pantallas públicas. Inicio de sesión y registro usan un panel lateral inspirado en la dinámica del CodePen de referencia. */
export function DisenoAutenticacion({ titulo, descripcion, children }: { titulo: string; descripcion: string; children: ReactNode }) {
  const ubicacion = useLocation();
  const esRegistro = ubicacion.pathname === '/registro';
  const esInicioSesion = ubicacion.pathname === '/iniciar-sesion';
  const esRecuperacion = ubicacion.pathname === '/recuperar-contrasena';
  const usarPanel = esRegistro || esInicioSesion || esRecuperacion;

  if (!usarPanel) {
    return (
      <div className="pagina_autenticacion">
        <section className="autenticacion_marca" aria-label="SGRICN">
          <div className="fila">
            <span className="lateral_logo">
              <LogoSgricn />
            </span>
            <span className="lateral_nombre">
              <strong>S.G.R.I.C.N</strong>
              <span>Sistema de Gestión de Recursos e Información para Catástrofes Naturales</span>
            </span>
          </div>
          <div>
            <p>Emergencias, zonas afectadas, población, recursos y donaciones en un solo centro de mando.</p>
          </div>
          
        </section>
        <main className="autenticacion_formulario" id="contenido">
          <div className="tarjeta pila">
            <div>
              <h2 style={{ fontSize: '1.5rem' }}>{titulo}</h2>
              <p className="texto_suave" style={{ marginTop: 6 }}>{descripcion}</p>
            </div>
            {children}
          </div>
        </main>
      </div>
    );
  }

  return (
    <main className={`autenticacion_neu autenticacion_neu--${esRegistro ? 'registro' : esRecuperacion ? 'recuperacion' : 'inicio'}`} id="contenido">
      <section className="autenticacion_neu_marca" aria-label="SGRICN">
        <div className="autenticacion_neu_logo">
          <LogoSgricn />
          <div>
            <strong>S.G.R.I.C.N</strong>
            <span>Sistema de Gestión de Recursos e Información para Catástrofes Naturales</span>
          </div>
        </div>
        <p>Emergencias, zonas afectadas, población y donaciones en un solo lugar.</p>
      </section>

      <section className="autenticacion_neu_panel" aria-label={esRegistro ? 'Crear cuenta' : esRecuperacion ? 'Recuperar contraseña' : 'Iniciar sesión'}>
        <div className="autenticacion_neu_formulario">
          <div className="autenticacion_neu_encabezado">
            <h1>{titulo}</h1>
            <p>{descripcion}</p>
          </div>
          {children}
        </div>

        <aside className="autenticacion_neu_switch">
          <div className="autenticacion_neu_circulo autenticacion_neu_circulo--uno" aria-hidden="true" />
          <div className="autenticacion_neu_circulo autenticacion_neu_circulo--dos" aria-hidden="true" />
          <div className="autenticacion_neu_switch_contenido">
            <div className={esRegistro || esRecuperacion ? 'autenticacion_neu_switch_texto autenticacion_neu_switch_texto--oculto' : 'autenticacion_neu_switch_texto'}>
              <h2>Bienvenido de nuevo</h2>
              <p>¿Ya tienes una cuenta? Ingresa con tus datos para continuar.</p>
              <Link to="/iniciar-sesion" className="autenticacion_neu_boton">Iniciar sesión</Link>
            </div>
            <div className={esRegistro ? 'autenticacion_neu_switch_texto' : 'autenticacion_neu_switch_texto autenticacion_neu_switch_texto--oculto'}>
              <h2>Hola</h2>
              <p>Si todavía no tienes una cuenta, puedes crearla en unos pasos.</p>
              <Link to="/registro" className="autenticacion_neu_boton">Crear cuenta</Link>
            </div>
            <div className={esRecuperacion ? 'autenticacion_neu_switch_texto' : 'autenticacion_neu_switch_texto autenticacion_neu_switch_texto--oculto'}>
              <h2>Recupera tu acceso</h2>
              <p>Solicita un enlace para restablecer tu contraseña de forma segura.</p>
              <Link to="/iniciar-sesion" className="autenticacion_neu_boton">Volver a iniciar sesión</Link>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
