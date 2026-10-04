import { AlertTriangle, Loader2 } from 'lucide-react';
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Modal } from './Modal';

interface OpcionesConfirmacion {
  titulo: string;
  mensaje: ReactNode;
  texto_confirmar?: string;
  es_destructiva?: boolean;
}

type FuncionConfirmar = (opciones: OpcionesConfirmacion) => Promise<boolean>;

const ContextoConfirmacion = createContext<FuncionConfirmar | null>(null);

/**
 * Confirmación antes de operaciones irreversibles (eliminar, anular, cambiar estados).
 * Uso: const confirmar = useConfirmacion(); if (await confirmar({...})) { ... }
 */
export function ProveedorConfirmacion({ children }: { children: ReactNode }) {
  const [opciones, establecer_opciones] = useState<OpcionesConfirmacion | null>(null);
  const resolver = useRef<((respuesta: boolean) => void) | null>(null);

  const confirmar = useCallback<FuncionConfirmar>((nuevas) => {
    establecer_opciones(nuevas);
    return new Promise<boolean>((resolver_promesa) => {
      resolver.current = resolver_promesa;
    });
  }, []);

  const responder = useCallback((respuesta: boolean) => {
    resolver.current?.(respuesta);
    resolver.current = null;
    establecer_opciones(null);
  }, []);

  return (
    <ContextoConfirmacion.Provider value={confirmar}>
      {children}
      <Modal
        abierto={opciones !== null}
        titulo={opciones?.titulo ?? ''}
        al_cerrar={() => responder(false)}
        pie={
          <>
            <button type="button" className="boton" onClick={() => responder(false)}>
              Cancelar
            </button>
            <button type="button" className={`boton ${opciones?.es_destructiva ? 'boton_peligro' : 'boton_primario'}`} onClick={() => responder(true)}>
              {opciones?.texto_confirmar ?? 'Confirmar'}
            </button>
          </>
        }
      >
        <div className="aviso" data-tono={opciones?.es_destructiva ? 'peligro' : 'advertencia'}>
          <AlertTriangle size={20} aria-hidden="true" />
          <div>{opciones?.mensaje}</div>
        </div>
      </Modal>
    </ContextoConfirmacion.Provider>
  );
}

export function useConfirmacion(): FuncionConfirmar {
  const valor = useContext(ContextoConfirmacion);
  if (!valor) throw new Error('useConfirmacion debe usarse dentro de ProveedorConfirmacion');
  return valor;
}

export function BotonEnProceso({ en_proceso, children, className = 'boton boton_primario', ...resto }: { en_proceso: boolean; children: ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...resto} className={className} disabled={en_proceso || resto.disabled} aria-busy={en_proceso}>
      {en_proceso && <Loader2 className="giro" size={18} aria-hidden="true" />}
      {children}
    </button>
  );
}
