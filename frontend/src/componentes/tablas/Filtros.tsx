import { X } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { useConsulta } from '../../hooks/useConsulta';
import { servicio_catalogos } from '../../servicios/servicios';
import type { OpcionCampo } from '../formularios/tipos_formulario';

export interface DefinicionFiltro {
  nombre: string;
  etiqueta: string;
  tipo: 'seleccion' | 'fecha' | 'departamento' | 'municipio';
  opciones?: readonly OpcionCampo[];
}

interface PropiedadesFiltros {
  filtros: DefinicionFiltro[];
  valores: Record<string, string>;
  al_cambiar: (valores: Record<string, string>) => void;
  con_busqueda?: boolean;
  texto_busqueda?: string;
  extra?: React.ReactNode;
}

/**
 * Barra "Filtrar por:" del mockup. Los departamentos y municipios se cargan de los datos reales.
 * La búsqueda espera a que el usuario deje de escribir (no consulta en cada pulsación).
 */
export function BarraFiltros({ filtros, valores, al_cambiar, con_busqueda = true, texto_busqueda = 'Buscar…', extra }: PropiedadesFiltros) {
  const id = useId();
  const [busqueda, establecer_busqueda] = useState(valores.busqueda ?? '');
  const necesita_ubicaciones = filtros.some((filtro) => filtro.tipo === 'departamento' || filtro.tipo === 'municipio');
  const ubicaciones = useConsulta(() => (necesita_ubicaciones ? servicio_catalogos.ubicaciones() : Promise.resolve(null)), [necesita_ubicaciones]);

  useEffect(() => {
    if ((valores.busqueda ?? '') === busqueda) return undefined;
    const temporizador = window.setTimeout(() => al_cambiar({ ...valores, busqueda }), 400);
    return () => window.clearTimeout(temporizador);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busqueda]);

  const cambiar = (nombre: string, valor: string) => {
    const nuevos = { ...valores, [nombre]: valor };
    if (nombre === 'departamento') nuevos.municipio = '';
    al_cambiar(nuevos);
  };
  const activos = Object.entries(valores).filter(([clave, valor]) => valor && clave !== 'orden').length;

  const opciones_de = (filtro: DefinicionFiltro): readonly OpcionCampo[] => {
    if (filtro.tipo === 'departamento') return (ubicaciones.datos?.departamentos ?? []).map((valor) => ({ valor, etiqueta: valor }));
    if (filtro.tipo === 'municipio') {
      return (ubicaciones.datos?.municipios ?? [])
        .filter((par) => !valores.departamento || par.departamento === valores.departamento)
        .map((par) => ({ valor: par.municipio, etiqueta: par.municipio }));
    }
    return filtro.opciones ?? [];
  };

  return (
    <div className="barra_filtros" role="search" aria-label="Filtros">
      <strong>Filtrar por:</strong>
      {con_busqueda && (
        <div className="filtro">
          <label htmlFor={`${id}-busqueda`} className="solo_lectores">
            Buscar
          </label>
          <input id={`${id}-busqueda`} type="search" placeholder={texto_busqueda} value={busqueda} data-activo={Boolean(busqueda)} onChange={(evento) => establecer_busqueda(evento.target.value)} />
        </div>
      )}
      {filtros.map((filtro) => (
        <div className="filtro" key={filtro.nombre}>
          <label htmlFor={`${id}-${filtro.nombre}`} className="solo_lectores">
            {filtro.etiqueta}
          </label>
          {filtro.tipo === 'fecha' ? (
            <input
              id={`${id}-${filtro.nombre}`}
              type="date"
              title={filtro.etiqueta}
              aria-label={filtro.etiqueta}
              value={valores[filtro.nombre] ?? ''}
              data-activo={Boolean(valores[filtro.nombre])}
              onChange={(evento) => cambiar(filtro.nombre, evento.target.value)}
            />
          ) : (
            <select id={`${id}-${filtro.nombre}`} value={valores[filtro.nombre] ?? ''} data-activo={Boolean(valores[filtro.nombre])} onChange={(evento) => cambiar(filtro.nombre, evento.target.value)}>
              <option value="">{filtro.etiqueta}</option>
              {opciones_de(filtro).map((opcion) => (
                <option key={opcion.valor} value={opcion.valor}>
                  {opcion.etiqueta}
                </option>
              ))}
            </select>
          )}
        </div>
      ))}
      {activos > 0 && (
        <button
          type="button"
          className="boton boton_pequeno"
          onClick={() => {
            establecer_busqueda('');
            al_cambiar(valores.orden ? { orden: valores.orden } : {});
          }}
        >
          <X size={15} aria-hidden="true" /> Limpiar ({activos})
        </button>
      )}
      {extra}
    </div>
  );
}
