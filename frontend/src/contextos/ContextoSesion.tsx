import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { tiene_permiso, type Permiso } from '@dominio/reglas/permisos';
import { al_expirar_sesion } from '../servicios/cliente_api';
import { servicio_autenticacion } from '../servicios/servicios';
import type { Usuario } from '../tipos/api';
import { useAvisos } from './ContextoAvisos';

interface ValorSesion {
  usuario: Usuario | null;
  cargando: boolean;
  inactividad_minutos: number;
  segundos_para_cierre: number | null;
  iniciar_sesion: (correo: string, password: string) => Promise<void>;
  cerrar_sesion: (motivo?: string) => Promise<void>;
  continuar_sesion: () => void;
  /** Sólo oculta acciones; la autorización real la decide el backend. */
  puede: (permiso: Permiso) => boolean;
}

const ContextoSesion = createContext<ValorSesion | null>(null);
const EVENTOS_ACTIVIDAD = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
const AVISO_PREVIO_MS = 60_000;
const INTERVALO_LATIDO_ACTIVIDAD_MS = 60_000;

/**
 * Sesión del usuario y cierre por inactividad (RNF12) coordinado con el servidor:
 * - La interfaz cuenta la actividad real (teclado, clic, táctil). Las consultas automáticas no la renuevan.
 * - Si el usuario trabaja sin generar solicitudes (escribe un formulario largo), se informa la actividad
 *   al servidor como máximo una vez por minuto.
 * - 60 segundos antes del límite se muestra un aviso para continuar; al vencer se cierra la sesión.
 * - El servidor aplica el mismo límite: aunque la pestaña esté cerrada, la sesión expira.
 */
export function ProveedorSesion({ children }: { children: ReactNode }) {
  const { mostrar_aviso } = useAvisos();
  const [usuario, establecer_usuario] = useState<Usuario | null>(null);
  const [cargando, establecer_cargando] = useState(true);
  const [inactividad_minutos, establecer_inactividad] = useState(5);
  const [segundos_para_cierre, establecer_segundos] = useState<number | null>(null);
  const ultima_actividad = useRef(Date.now());
  const ultimo_latido = useRef(Date.now());

  useEffect(() => {
    servicio_autenticacion
      .consultar_sesion()
      .then((datos) => {
        establecer_usuario(datos.usuario);
        establecer_inactividad(datos.inactividad_minutos);
      })
      .catch(() => establecer_usuario(null))
      .finally(() => establecer_cargando(false));
  }, []);

  const terminar_localmente = useCallback(
    (mensaje: string) => {
      establecer_usuario((actual) => {
        if (actual) mostrar_aviso({ tipo: 'advertencia', titulo: 'Sesión finalizada', mensaje, persistente: true });
        return null;
      });
      establecer_segundos(null);
    },
    [mostrar_aviso],
  );

  // El cliente HTTP avisa cuando el servidor responde 401 (sesión expirada o cuenta desactivada).
  useEffect(
    () =>
      al_expirar_sesion((codigo) =>
        terminar_localmente(
          codigo === 'SESION_EXPIRADA' ? 'Tu sesión se cerró por inactividad. Inicia sesión de nuevo.' : 'Tu sesión ya no es válida. Inicia sesión de nuevo.',
        ),
      ),
    [terminar_localmente],
  );

  const cerrar_sesion = useCallback(
    async (motivo?: string) => {
      try {
        await servicio_autenticacion.cerrar_sesion();
      } catch {
        // Aunque el servidor no responda, se limpia la sesión local.
      }
      establecer_usuario(null);
      establecer_segundos(null);
      mostrar_aviso({ tipo: motivo ? 'advertencia' : 'informacion', titulo: motivo ?? 'Sesión cerrada correctamente.', persistente: Boolean(motivo) });
    },
    [mostrar_aviso],
  );

  const continuar_sesion = useCallback(() => {
    ultima_actividad.current = Date.now();
    ultimo_latido.current = Date.now();
    establecer_segundos(null);
    servicio_autenticacion.registrar_actividad().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!usuario) return undefined;
    ultima_actividad.current = Date.now();
    const registrar = () => {
      ultima_actividad.current = Date.now();
    };
    for (const evento of EVENTOS_ACTIVIDAD) window.addEventListener(evento, registrar, { passive: true });
    const limite_ms = inactividad_minutos * 60_000;
    const intervalo = window.setInterval(() => {
      const inactivo_ms = Date.now() - ultima_actividad.current;
      if (inactivo_ms >= limite_ms) {
        window.clearInterval(intervalo);
        void cerrar_sesion(`Tu sesión se cerró tras ${inactividad_minutos} minutos de inactividad.`);
        return;
      }
      if (inactivo_ms >= limite_ms - AVISO_PREVIO_MS) {
        establecer_segundos(Math.ceil((limite_ms - inactivo_ms) / 1000));
        return;
      }
      establecer_segundos(null);
      // Hubo actividad desde el último latido: se informa al servidor (máximo una vez por minuto).
      if (ultima_actividad.current > ultimo_latido.current && Date.now() - ultimo_latido.current >= INTERVALO_LATIDO_ACTIVIDAD_MS) {
        ultimo_latido.current = Date.now();
        servicio_autenticacion.registrar_actividad().catch(() => undefined);
      }
    }, 1000);
    return () => {
      window.clearInterval(intervalo);
      for (const evento of EVENTOS_ACTIVIDAD) window.removeEventListener(evento, registrar);
    };
  }, [usuario, inactividad_minutos, cerrar_sesion]);

  const iniciar_sesion = useCallback(
    async (correo: string, password: string) => {
      const { datos, mensaje } = await servicio_autenticacion.iniciar_sesion(correo, password);
      ultimo_latido.current = Date.now();
      establecer_usuario(datos.usuario);
      establecer_inactividad(datos.inactividad_minutos);
      mostrar_aviso({ tipo: 'exito', titulo: mensaje });
    },
    [mostrar_aviso],
  );

  const puede = useCallback((permiso: Permiso) => tiene_permiso(usuario?.rol, permiso), [usuario]);

  const valor = useMemo(
    () => ({ usuario, cargando, inactividad_minutos, segundos_para_cierre, iniciar_sesion, cerrar_sesion, continuar_sesion, puede }),
    [usuario, cargando, inactividad_minutos, segundos_para_cierre, iniciar_sesion, cerrar_sesion, continuar_sesion, puede],
  );
  return <ContextoSesion.Provider value={valor}>{children}</ContextoSesion.Provider>;
}

export function useSesion(): ValorSesion {
  const valor = useContext(ContextoSesion);
  if (!valor) throw new Error('useSesion debe usarse dentro de ProveedorSesion');
  return valor;
}

export function useUsuarioActual(): Usuario {
  const { usuario } = useSesion();
  if (!usuario) throw new Error('Se requiere una sesión activa');
  return usuario;
}
