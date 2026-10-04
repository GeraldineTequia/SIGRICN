import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { PilaAvisos } from '../componentes/alertas/PilaAvisos';

export type TipoAviso = 'exito' | 'informacion' | 'advertencia' | 'error';

export interface Aviso {
  id: number;
  tipo: TipoAviso;
  titulo: string;
  mensaje?: string;
  /** Los errores importantes permanecen visibles hasta que el usuario los cierra. */
  persistente: boolean;
}

interface ValorAvisos {
  avisos: Aviso[];
  mostrar_aviso: (aviso: Omit<Aviso, 'id' | 'persistente'> & { persistente?: boolean }) => void;
  cerrar_aviso: (id: number) => void;
}

const ContextoAvisos = createContext<ValorAvisos | null>(null);

/** Tiempos generosos para leer (WCAG 2.2.1): avisos no críticos se cierran solos. */
const DURACION_MS: Record<TipoAviso, number> = { exito: 6000, informacion: 7000, advertencia: 10000, error: 0 };
const MAXIMO_VISIBLES = 4;

/**
 * Avisos de interfaz (sección 15). Adaptación a React del comportamiento de
 * codepen.io/codysechelski/pen/dYVwjb: éxito, información, advertencia y error con icono,
 * título, mensaje y cierre accesible. Cerrar un aviso visual NO elimina alertas persistentes.
 */
export function ProveedorAvisos({ children }: { children: ReactNode }) {
  const [avisos, establecer_avisos] = useState<Aviso[]>([]);
  const siguiente_id = useRef(1);
  const temporizadores = useRef(new Map<number, number>());

  const cerrar_aviso = useCallback((id: number) => {
    establecer_avisos((actuales) => actuales.filter((aviso) => aviso.id !== id));
    const temporizador = temporizadores.current.get(id);
    if (temporizador) window.clearTimeout(temporizador);
    temporizadores.current.delete(id);
  }, []);

  const mostrar_aviso = useCallback<ValorAvisos['mostrar_aviso']>(
    (nuevo) => {
      const id = siguiente_id.current++;
      const persistente = nuevo.persistente ?? nuevo.tipo === 'error';
      establecer_avisos((actuales) => {
        // Evita repetir el mismo aviso si llega varias veces seguidas.
        const sin_duplicado = actuales.filter((aviso) => !(aviso.titulo === nuevo.titulo && aviso.mensaje === nuevo.mensaje));
        return [...sin_duplicado, { ...nuevo, id, persistente }].slice(-MAXIMO_VISIBLES);
      });
      if (!persistente) temporizadores.current.set(id, window.setTimeout(() => cerrar_aviso(id), DURACION_MS[nuevo.tipo] || 7000));
    },
    [cerrar_aviso],
  );

  const valor = useMemo(() => ({ avisos, mostrar_aviso, cerrar_aviso }), [avisos, mostrar_aviso, cerrar_aviso]);
  return (
    <ContextoAvisos.Provider value={valor}>
      {children}
      <PilaAvisos avisos={avisos} al_cerrar={cerrar_aviso} />
    </ContextoAvisos.Provider>
  );
}

export function useAvisos(): ValorAvisos {
  const valor = useContext(ContextoAvisos);
  if (!valor) throw new Error('useAvisos debe usarse dentro de ProveedorAvisos');
  return valor;
}
