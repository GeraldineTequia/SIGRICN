import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface PropiedadesModal {
  titulo: string;
  descripcion?: string;
  abierto: boolean;
  al_cerrar: () => void;
  children: ReactNode;
  pie?: ReactNode;
  tamano?: 'normal' | 'grande';
  clase?: string;
}

const SELECTOR_ENFOCABLES = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Diálogo modal accesible: role="dialog", foco inicial dentro del modal, foco atrapado con Tab,
 * cierre con Escape y devolución del foco al elemento que lo abrió.
 */
export function Modal({ titulo, descripcion, abierto, al_cerrar, children, pie, tamano = 'normal', clase }: PropiedadesModal) {
  const contenedor = useRef<HTMLDivElement>(null);
  const id_titulo = useId();
  const id_descripcion = useId();

  useEffect(() => {
    if (!abierto) return undefined;
    const enfocado_antes = document.activeElement as HTMLElement | null;
    const enfocables = () => [...(contenedor.current?.querySelectorAll<HTMLElement>(SELECTOR_ENFOCABLES) ?? [])];
    window.setTimeout(() => (enfocables()[1] ?? enfocables()[0])?.focus(), 0);
    const al_presionar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') {
        evento.stopPropagation();
        al_cerrar();
        return;
      }
      if (evento.key !== 'Tab') return;
      const lista = enfocables();
      if (lista.length === 0) return;
      const primero = lista[0];
      const ultimo = lista[lista.length - 1];
      if (evento.shiftKey && document.activeElement === primero) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primero.focus();
      }
    };
    document.addEventListener('keydown', al_presionar);
    const desbordamiento = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', al_presionar);
      document.body.style.overflow = desbordamiento;
      enfocado_antes?.focus?.();
    };
  }, [abierto, al_cerrar]);

  if (!abierto) return null;
  return createPortal(
    <div className="fondo_modal" onMouseDown={(evento) => evento.target === evento.currentTarget && al_cerrar()}>
      <div ref={contenedor} className={`modal${clase ? ` ${clase}` : ''}`} data-tamano={tamano} role="dialog" aria-modal="true" aria-labelledby={id_titulo} aria-describedby={descripcion ? id_descripcion : undefined}>
        <div className="modal_encabezado">
          <div>
            <h2 id={id_titulo}>{titulo}</h2>
            {descripcion && (
              <p id={id_descripcion} className="texto_suave" style={{ marginTop: 6 }}>
                {descripcion}
              </p>
            )}
          </div>
          <button type="button" className="cerrar_aviso" onClick={al_cerrar} aria-label="Cerrar">
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        {children}
        {pie && <div className="modal_pie">{pie}</div>}
      </div>
    </div>,
    document.body,
  );
}
