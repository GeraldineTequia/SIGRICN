import type { PointerEvent, ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface PropiedadesTarjetaIndicador {
  titulo: string;
  valor: ReactNode;
  icono?: ReactNode;
  detalle?: ReactNode;
  tono?: 'primario' | 'advertencia' | 'peligro';
  tono_valor?: 'primario' | 'advertencia' | 'peligro';
  /** Si se indica, la tarjeta es un enlace navegable con teclado. */
  enlace?: string;
  al_pulsar?: () => void;
  etiqueta_accion?: string;
}

/** Actualiza la posición del brillo radial (efecto "magic card"); es sólo decorativo. */
function seguir_puntero(evento: PointerEvent<HTMLElement>): void {
  const limites = evento.currentTarget.getBoundingClientRect();
  evento.currentTarget.style.setProperty('--x', `${evento.clientX - limites.left}px`);
  evento.currentTarget.style.setProperty('--y', `${evento.clientY - limites.top}px`);
}

/**
 * Tarjeta de indicador del dashboard y de los resúmenes (mockup: "EMERGENCIAS 12 · 8 zonas críticas").
 * Interacción inspirada en las referencias de tarjetas de CodePen, adaptada a React:
 * elevación al pasar/enfocar y brillo que sigue al puntero. Toda la información es visible sin cursor.
 */
export function TarjetaIndicador({ titulo, valor, icono, detalle, tono, tono_valor, enlace, al_pulsar, etiqueta_accion }: PropiedadesTarjetaIndicador) {
  const contenido = (
    <>
      <span className="tarjeta_indicador_titulo">
        {icono && (
          <span className="icono_indicador" data-tono={tono} aria-hidden="true">
            {icono}
          </span>
        )}
        {titulo}
      </span>
      <span className="valor_indicador" data-tono={tono_valor}>
        {valor}
      </span>
      {detalle && (
        <span className="detalle_indicador" data-tono={tono === 'peligro' ? 'peligro' : undefined}>
          {detalle}
        </span>
      )}
    </>
  );
  if (enlace) {
    return (
      <Link to={enlace} className="tarjeta_indicador" onPointerMove={seguir_puntero} aria-label={etiqueta_accion ? `${titulo}: ${etiqueta_accion}` : undefined}>
        {contenido}
      </Link>
    );
  }
  if (al_pulsar) {
    return (
      <button type="button" className="tarjeta_indicador" onPointerMove={seguir_puntero} onClick={al_pulsar} aria-label={etiqueta_accion}>
        {contenido}
      </button>
    );
  }
  return <div className="tarjeta_indicador">{contenido}</div>;
}
