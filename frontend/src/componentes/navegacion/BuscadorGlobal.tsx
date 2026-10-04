import { Search } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { servicio_catalogos } from '../../servicios/servicios';

interface Resultado {
  tipo: string;
  id: string;
  titulo: string;
  subtitulo: string;
}

const RUTAS: Record<string, string> = { emergencias: '/emergencias', zonas: '/zonas', centros: '/centros-donacion', fondos: '/fondos' };

/**
 * Buscador global de la barra superior. Atajo Ctrl+K / ⌘K; navegación con flechas y Enter.
 * Espera 350 ms después de la última pulsación antes de consultar (no consulta en cada tecla).
 */
export function BuscadorGlobal() {
  const id = useId();
  const navegar = useNavigate();
  const campo = useRef<HTMLInputElement>(null);
  const [texto, establecer_texto] = useState('');
  const [resultados, establecer_resultados] = useState<Resultado[] | null>(null);
  const [indice, establecer_indice] = useState(-1);
  const es_mac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform);

  useEffect(() => {
    const atajo = (evento: KeyboardEvent) => {
      if ((evento.ctrlKey || evento.metaKey) && evento.key.toLowerCase() === 'k') {
        evento.preventDefault();
        campo.current?.focus();
      }
    };
    window.addEventListener('keydown', atajo);
    return () => window.removeEventListener('keydown', atajo);
  }, []);

  useEffect(() => {
    if (texto.trim().length < 2) {
      establecer_resultados(null);
      return undefined;
    }
    const temporizador = window.setTimeout(() => {
      servicio_catalogos
        .buscar(texto.trim())
        .then((datos) => {
          establecer_resultados(datos);
          establecer_indice(-1);
        })
        .catch(() => establecer_resultados([]));
    }, 350);
    return () => window.clearTimeout(temporizador);
  }, [texto]);

  const cerrar = () => {
    establecer_resultados(null);
    establecer_texto('');
  };

  const al_presionar = (evento: React.KeyboardEvent<HTMLInputElement>) => {
    if (!resultados?.length) {
      if (evento.key === 'Escape') cerrar();
      return;
    }
    if (evento.key === 'ArrowDown') {
      evento.preventDefault();
      establecer_indice((actual) => Math.min(resultados.length - 1, actual + 1));
    } else if (evento.key === 'ArrowUp') {
      evento.preventDefault();
      establecer_indice((actual) => Math.max(0, actual - 1));
    } else if (evento.key === 'Enter' && indice >= 0) {
      evento.preventDefault();
      const elegido = resultados[indice];
      navegar(`${RUTAS[elegido.tipo]}/${elegido.id}`);
      cerrar();
    } else if (evento.key === 'Escape') {
      cerrar();
    }
  };

  return (
    <div className="buscador_global">
      <Search size={18} aria-hidden="true" />
      <label htmlFor={`${id}-campo`} className="solo_lectores">
        Buscar emergencia, zona, recurso o centro
      </label>
      <input
        ref={campo}
        id={`${id}-campo`}
        type="search"
        role="combobox"
        aria-expanded={Boolean(resultados)}
        aria-controls={`${id}-lista`}
        aria-activedescendant={indice >= 0 ? `${id}-opcion-${indice}` : undefined}
        aria-autocomplete="list"
        placeholder="Buscar emergencia, zona, persona o recurso…"
        value={texto}
        onChange={(evento) => establecer_texto(evento.target.value)}
        onKeyDown={al_presionar}
        onBlur={() => window.setTimeout(() => establecer_resultados(null), 200)}
      />
      <kbd className="atajo_teclado" aria-hidden="true">
        {es_mac ? '⌘K' : 'Ctrl K'}
      </kbd>
      {resultados && (
        <ul className="resultados_busqueda" id={`${id}-lista`} role="listbox" aria-label="Resultados de búsqueda">
          {resultados.length === 0 ? (
            <li>
              <span className="vacio">Sin resultados para «{texto}».</span>
            </li>
          ) : (
            resultados.map((resultado, posicion) => (
              <li key={`${resultado.tipo}-${resultado.id}`} role="option" id={`${id}-opcion-${posicion}`} aria-selected={posicion === indice}>
                <Link to={`${RUTAS[resultado.tipo]}/${resultado.id}`} onClick={cerrar} aria-selected={posicion === indice} tabIndex={-1}>
                  {resultado.titulo}
                  <small>{resultado.subtitulo}</small>
                </Link>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
