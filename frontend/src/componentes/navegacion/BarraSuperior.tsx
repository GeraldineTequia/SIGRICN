import { Bell, ChevronDown, LogOut, Menu, Moon, Settings, User } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSesion } from '../../contextos/ContextoSesion';
import { useTema } from '../../contextos/ContextoTema';
import { useTiempoReal } from '../../contextos/ContextoTiempoReal';
import { formatear_fecha, iniciales, obtener_etiqueta } from '../../utilidades/formato';
import { BuscadorGlobal } from './BuscadorGlobal';

function MenuUsuario() {
  const { usuario, cerrar_sesion } = useSesion();
  const { tema, alternar_tema } = useTema();
  const [abierto, establecer_abierto] = useState(false);
  const contenedor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return undefined;
    const al_hacer_clic = (evento: MouseEvent) => {
      if (!contenedor.current?.contains(evento.target as Node)) establecer_abierto(false);
    };
    const al_presionar = (evento: KeyboardEvent) => evento.key === 'Escape' && establecer_abierto(false);
    document.addEventListener('mousedown', al_hacer_clic);
    document.addEventListener('keydown', al_presionar);
    return () => {
      document.removeEventListener('mousedown', al_hacer_clic);
      document.removeEventListener('keydown', al_presionar);
    };
  }, [abierto]);

  if (!usuario) return null;
  return (
    <div className="menu_usuario" ref={contenedor}>
      <button type="button" className="tarjeta_usuario" aria-haspopup="menu" aria-expanded={abierto} onClick={() => establecer_abierto((actual) => !actual)}>
        <span className="avatar" aria-hidden="true">
          {iniciales(usuario.nombre, usuario.apellido)}
        </span>
        <span className="datos_usuario">
          <strong>
            {usuario.nombre} {usuario.apellido}
          </strong>
          <small>{obtener_etiqueta(usuario.rol)}</small>
        </span>
        <ChevronDown size={18} aria-hidden="true" />
      </button>
      {abierto && (
        <div className="menu_desplegable" role="menu" aria-label="Opciones de la cuenta">
          <Link to="/perfil" role="menuitem" onClick={() => establecer_abierto(false)}>
            <User size={18} aria-hidden="true" /> Mi perfil
          </Link>
          <Link to="/configuracion" role="menuitem" onClick={() => establecer_abierto(false)}>
            <Settings size={18} aria-hidden="true" /> Configuración
          </Link>
          <button type="button" role="menuitemcheckbox" aria-checked={tema === 'oscuro'} className="elemento_menu" onClick={alternar_tema}>
            <Moon size={18} aria-hidden="true" /> Modo oscuro
            <span className="interruptor" aria-hidden="true" data-activo={tema === 'oscuro'} style={{ marginLeft: 'auto' }} />
          </button>
          <hr />
          <button type="button" role="menuitem" className="peligro" onClick={() => void cerrar_sesion()}>
            <LogOut size={18} aria-hidden="true" /> Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}

/** Barra superior del mockup: título de la página, buscador, sincronización, campana y usuario. */
export function BarraSuperior({ titulo, seccion, al_abrir_menu }: { titulo: string; seccion?: string; al_abrir_menu: () => void }) {
  const { estado_conexion, ultima_sincronizacion, alertas_no_leidas } = useTiempoReal();
  const texto_estado = estado_conexion === 'conectado' ? 'Sincronizado' : estado_conexion === 'reconectando' ? 'Reconectando…' : 'Sin conexión';
  return (
    <header className="superior">
      <button type="button" className="boton_icono boton_menu_movil" onClick={al_abrir_menu} aria-label="Abrir menú de navegación">
        <Menu size={20} aria-hidden="true" />
      </button>
      <div className="superior_titulo">
        {seccion && <small>{seccion}</small>}
        <strong>{titulo}</strong>
      </div>
      <BuscadorGlobal />
      <span
        className="indicador_sincronizacion"
        data-estado={estado_conexion === 'conectado' ? 'conectado' : 'desconectado'}
        role="status"
        title={ultima_sincronizacion ? `Último cambio recibido: ${formatear_fecha(ultima_sincronizacion, true)}` : undefined}
      >
        <span className="texto_sincronizacion">{texto_estado}</span>
      </span>
      <Link to="/alertas" className="boton_icono" aria-label={`Alertas y notificaciones: ${alertas_no_leidas} sin leer`}>
        <Bell size={20} aria-hidden="true" />
        {alertas_no_leidas > 0 && (
          <span className="contador_notificaciones" aria-hidden="true">
            {alertas_no_leidas > 99 ? '99+' : alertas_no_leidas}
          </span>
        )}
      </Link>
      <MenuUsuario />
    </header>
  );
}
