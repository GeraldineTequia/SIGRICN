import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { servicio_alertas } from '../servicios/servicios';
import { useAvisos } from './ContextoAvisos';
import { useSesion } from './ContextoSesion';

type EstadoConexion = 'conectado' | 'reconectando' | 'desconectado';

interface ValorTiempoReal {
  estado_conexion: EstadoConexion;
  ultima_sincronizacion: Date | null;
  alertas_no_leidas: number;
  /** Versión por entidad: cambia cada vez que se publica un cambio de esa entidad. */
  versiones: Record<string, number>;
  notificar_cambio: (entidad: string) => void;
  actualizar_alertas: () => void;
}

const ContextoTiempoReal = createContext<ValorTiempoReal | null>(null);

interface EventoDatos {
  tipo: string;
  entidad: string;
  accion: string;
  identificador?: string;
}

/**
 * Actualización en tiempo real (RNF3) mediante Server-Sent Events:
 * el servidor avisa qué entidad cambió y las pantallas que la muestran vuelven a consultar la API.
 * Las consultas disparadas por eventos se marcan como automáticas (no cuentan como actividad).
 */
export function ProveedorTiempoReal({ children }: { children: ReactNode }) {
  const { usuario, cerrar_sesion } = useSesion();
  const { mostrar_aviso } = useAvisos();
  const [estado_conexion, establecer_estado] = useState<EstadoConexion>('desconectado');
  const [ultima_sincronizacion, establecer_ultima] = useState<Date | null>(null);
  const [alertas_no_leidas, establecer_no_leidas] = useState(0);
  const [versiones, establecer_versiones] = useState<Record<string, number>>({});
  const temporizador_alertas = useRef<number | null>(null);

  const notificar_cambio = useCallback((entidad: string) => {
    establecer_versiones((actuales) => ({ ...actuales, [entidad]: (actuales[entidad] ?? 0) + 1, '*': (actuales['*'] ?? 0) + 1 }));
    establecer_ultima(new Date());
  }, []);

  const actualizar_alertas = useCallback(() => {
    if (temporizador_alertas.current) window.clearTimeout(temporizador_alertas.current);
    // Agrupa ráfagas de eventos en una sola consulta.
    temporizador_alertas.current = window.setTimeout(() => {
      servicio_alertas
        .listar({ solo_no_leidas: 'true' }, true)
        .then((resultado) => establecer_no_leidas(resultado.no_leidas))
        .catch(() => undefined);
    }, 300);
  }, []);

  useEffect(() => {
    if (!usuario) {
      establecer_estado('desconectado');
      establecer_no_leidas(0);
      return undefined;
    }
    actualizar_alertas();
    const fuente = new EventSource('/api/eventos', { withCredentials: true });
    fuente.addEventListener('conectado', () => {
      establecer_estado('conectado');
      establecer_ultima(new Date());
    });
    fuente.addEventListener('datos_actualizados', (evento) => {
      const datos = JSON.parse((evento as MessageEvent<string>).data) as EventoDatos;
      notificar_cambio(datos.entidad);
    });
    fuente.addEventListener('nueva_alerta', () => {
      actualizar_alertas();
      notificar_cambio('alertas');
    });
    fuente.addEventListener('sesion_expirada', () => {
      fuente.close();
      void cerrar_sesion('Tu sesión se cerró por inactividad o por cambios en tu cuenta.');
    });
    fuente.onerror = () => establecer_estado(fuente.readyState === EventSource.CLOSED ? 'desconectado' : 'reconectando');
    return () => fuente.close();
  }, [usuario, notificar_cambio, actualizar_alertas, cerrar_sesion]);

  // Si se pierde la conexión por mucho tiempo, se informa una sola vez.
  useEffect(() => {
    if (estado_conexion !== 'reconectando') return undefined;
    const temporizador = window.setTimeout(
      () => mostrar_aviso({ tipo: 'advertencia', titulo: 'Sin sincronización en tiempo real', mensaje: 'Intentando reconectar. Los datos se actualizarán al recuperar la conexión.' }),
      8000,
    );
    return () => window.clearTimeout(temporizador);
  }, [estado_conexion, mostrar_aviso]);

  const valor = useMemo(
    () => ({ estado_conexion, ultima_sincronizacion, alertas_no_leidas, versiones, notificar_cambio, actualizar_alertas }),
    [estado_conexion, ultima_sincronizacion, alertas_no_leidas, versiones, notificar_cambio, actualizar_alertas],
  );
  return <ContextoTiempoReal.Provider value={valor}>{children}</ContextoTiempoReal.Provider>;
}

export function useTiempoReal(): ValorTiempoReal {
  const valor = useContext(ContextoTiempoReal);
  if (!valor) throw new Error('useTiempoReal debe usarse dentro de ProveedorTiempoReal');
  return valor;
}

/** Devuelve un número que cambia cuando cambia cualquiera de las entidades indicadas. */
export function useVersionEntidades(entidades: readonly string[]): number {
  const { versiones } = useTiempoReal();
  return entidades.reduce((suma, entidad) => suma + (versiones[entidad] ?? 0), 0);
}
