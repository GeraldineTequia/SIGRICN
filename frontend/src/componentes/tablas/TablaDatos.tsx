import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Paginacion as DatosPaginacion } from '../../tipos/api';
import { Cargando, EstadoVacio } from '../tarjetas/Estados';

export interface ColumnaTabla<T> {
  clave: string;
  titulo: string;
  render: (fila: T) => ReactNode;
  /** Campo de la API por el que se puede ordenar. */
  orden?: string;
  alineacion?: 'derecha';
}

interface PropiedadesTabla<T> {
  columnas: ColumnaTabla<T>[];
  filas: T[];
  cargando?: boolean;
  texto_vacio?: string;
  orden?: string;
  al_ordenar?: (orden: string) => void;
  descripcion: string;
  clave_fila?: (fila: T) => string;
}

/**
 * Tabla accesible: encabezados con scope, orden con botones (aria-sort) y, en celulares,
 * cada fila se presenta como tarjeta con la etiqueta de cada dato.
 */
export function TablaDatos<T extends { id: string }>({ columnas, filas, cargando, texto_vacio = 'No encontramos resultados; ajusta los filtros.', orden, al_ordenar, descripcion, clave_fila }: PropiedadesTabla<T>) {
  const orden_actual = orden?.replace(/^-/, '');
  const descendente = orden?.startsWith('-');
  return (
    <div className="contenedor_tabla">
      <table className="tabla tabla_responsiva">
        <caption className="solo_lectores">{descripcion}</caption>
        <thead>
          <tr>
            {columnas.map((columna) => {
              const activa = columna.orden && columna.orden === orden_actual;
              return (
                <th
                  key={columna.clave}
                  scope="col"
                  className={columna.alineacion === 'derecha' ? 'numero' : undefined}
                  aria-sort={activa ? (descendente ? 'descending' : 'ascending') : undefined}
                >
                  {columna.orden && al_ordenar ? (
                    <button type="button" onClick={() => al_ordenar(activa && !descendente ? `-${columna.orden}` : columna.orden!)}>
                      {columna.titulo}
                      {activa ? descendente ? <ArrowDown size={14} aria-hidden="true" /> : <ArrowUp size={14} aria-hidden="true" /> : <ArrowUpDown size={14} aria-hidden="true" />}
                    </button>
                  ) : (
                    columna.titulo
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {cargando && filas.length === 0 ? (
            <tr>
              <td colSpan={columnas.length}>
                <Cargando />
              </td>
            </tr>
          ) : filas.length === 0 ? (
            <tr>
              <td colSpan={columnas.length}>
                <EstadoVacio texto={texto_vacio} />
              </td>
            </tr>
          ) : (
            filas.map((fila) => (
              <tr key={clave_fila ? clave_fila(fila) : fila.id}>
                {columnas.map((columna) => (
                  <td key={columna.clave} data-etiqueta={columna.titulo} className={columna.alineacion === 'derecha' ? 'numero' : undefined}>
                    {columna.render(fila)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Paginacion({ paginacion, al_cambiar }: { paginacion: DatosPaginacion | null; al_cambiar: (pagina: number) => void }) {
  if (!paginacion || paginacion.total === 0) return null;
  const desde = (paginacion.pagina - 1) * paginacion.limite + 1;
  const hasta = Math.min(paginacion.total, paginacion.pagina * paginacion.limite);
  return (
    <nav className="paginacion" aria-label="Paginación">
      <span>
        Mostrando {desde}–{hasta} de {paginacion.total.toLocaleString('es-CO')}
      </span>
      <div className="grupo_botones">
        <button type="button" className="boton boton_pequeno" onClick={() => al_cambiar(paginacion.pagina - 1)} disabled={paginacion.pagina <= 1}>
          <ChevronLeft size={16} aria-hidden="true" /> Anterior
        </button>
        <span className="boton boton_pequeno" aria-current="page">
          Página {paginacion.pagina} de {paginacion.total_paginas}
        </span>
        <button type="button" className="boton boton_pequeno" onClick={() => al_cambiar(paginacion.pagina + 1)} disabled={paginacion.pagina >= paginacion.total_paginas}>
          Siguiente <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}
