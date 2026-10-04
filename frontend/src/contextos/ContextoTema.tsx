import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { guardar_preferencia, leer_preferencia } from '../utilidades/almacenamiento_local';

type Tema = 'claro' | 'oscuro';

interface ValorTema {
  tema: Tema;
  alternar_tema: () => void;
  establecer_tema: (tema: Tema) => void;
  movimiento_reducido: boolean;
  establecer_movimiento_reducido: (activo: boolean) => void;
}

const ContextoTema = createContext<ValorTema | null>(null);

function tema_inicial(): Tema {
  const guardado = leer_preferencia<Tema | null>('tema', null);
  if (guardado) return guardado;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro';
}

/** Modo claro/oscuro (RNF13) y preferencia de movimiento reducido, guardados en el navegador. */
export function ProveedorTema({ children }: { children: ReactNode }) {
  const [tema, establecer_tema_estado] = useState<Tema>(tema_inicial);
  const [movimiento_reducido, establecer_movimiento] = useState<boolean>(() => leer_preferencia('movimiento_reducido', false));

  useEffect(() => {
    document.documentElement.dataset.tema = tema;
    guardar_preferencia('tema', tema);
  }, [tema]);

  useEffect(() => {
    if (movimiento_reducido) document.documentElement.dataset.movimiento = 'reducido';
    else delete document.documentElement.dataset.movimiento;
    guardar_preferencia('movimiento_reducido', movimiento_reducido);
  }, [movimiento_reducido]);

  const alternar_tema = useCallback(() => establecer_tema_estado((actual) => (actual === 'claro' ? 'oscuro' : 'claro')), []);
  const valor = useMemo(
    () => ({ tema, alternar_tema, establecer_tema: establecer_tema_estado, movimiento_reducido, establecer_movimiento_reducido: establecer_movimiento }),
    [tema, alternar_tema, movimiento_reducido],
  );
  return <ContextoTema.Provider value={valor}>{children}</ContextoTema.Provider>;
}

export function useTema(): ValorTema {
  const valor = useContext(ContextoTema);
  if (!valor) throw new Error('useTema debe usarse dentro de ProveedorTema');
  return valor;
}
