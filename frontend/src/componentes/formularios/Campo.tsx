import { AlertCircle } from 'lucide-react';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { a_fecha_local, desde_fecha_local } from '../../utilidades/formato';
import type { RegistroBase } from '../../tipos/api';
import type { DefinicionCampo } from './tipos_formulario';

interface PropiedadesCampo {
  definicion: DefinicionCampo;
  valor: unknown;
  error?: string;
  datos: Record<string, unknown>;
  al_cambiar: (nombre: string, valor: unknown) => void;
  deshabilitado?: boolean;
}

/** Envoltorio accesible: etiqueta asociada, ayuda y error anunciado junto al campo. */
export function EnvoltorioCampo({ id, etiqueta, requerido, ayuda, error, ancho, children }: { id: string; etiqueta: string; requerido?: boolean; ayuda?: string; error?: string; ancho?: string; children: ReactNode }) {
  return (
    <div className="campo" data-ancho={ancho}>
      <label htmlFor={id}>
        {etiqueta}
        {requerido && (
          <span className="requerido" aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </label>
      {children}
      {ayuda && !error && (
        <span id={`${id}-ayuda`} className="ayuda_campo">
          {ayuda}
        </span>
      )}
      {error && (
        <span id={`${id}-error`} className="error_campo" role="alert">
          <AlertCircle size={15} aria-hidden="true" /> {error}
        </span>
      )}
    </div>
  );
}

/** Selector de un registro relacionado (emergencia, zona, recurso...) cargado desde la API. */
function SelectorReferencia({ id, definicion, valor, datos, al_cambiar, deshabilitado, descripcion }: { id: string; definicion: DefinicionCampo; valor: unknown; datos: Record<string, unknown>; al_cambiar: (valor: string) => void; deshabilitado?: boolean; descripcion?: string }) {
  const [opciones, establecer_opciones] = useState<RegistroBase[]>([]);
  const [cargando, establecer_cargando] = useState(true);
  const [error, establecer_error] = useState<string | null>(null);
  const referencia = definicion.referencia;
  const filtros = referencia?.filtros ? referencia.filtros(datos) : {};
  const clave_filtros = JSON.stringify(filtros);

  useEffect(() => {
    if (!referencia || filtros === null) {
      establecer_opciones([]);
      establecer_cargando(false);
      return;
    }
    let vigente = true;
    establecer_cargando(true);
    referencia
      .listar({ limite: 100, ...filtros })
      .then((resultado) => vigente && establecer_opciones(resultado.elementos))
      .catch(() => vigente && establecer_error('No se pudieron cargar las opciones.'))
      .finally(() => vigente && establecer_cargando(false));
    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave_filtros]);

  const sin_dependencia = filtros === null;
  return (
    <>
      <select
        id={id}
        className="control"
        value={String(valor ?? '')}
        onChange={(evento) => al_cambiar(evento.target.value)}
        disabled={deshabilitado || cargando || sin_dependencia}
        aria-describedby={descripcion}
        aria-invalid={Boolean(descripcion?.includes('error'))}
      >
        <option value="">{cargando ? 'Cargando…' : sin_dependencia ? 'Selecciona primero la emergencia' : 'Selecciona una opción'}</option>
        {opciones.map((opcion) => (
          <option key={opcion.id} value={opcion.id}>
            {referencia?.etiqueta(opcion)}
          </option>
        ))}
      </select>
      {error && <span className="error_campo">{error}</span>}
    </>
  );
}

/** Control de formulario según su definición declarativa. */
export function Campo({ definicion, valor, error, datos, al_cambiar, deshabilitado }: PropiedadesCampo) {
  const id = useId();
  const descripcion = error ? `${id}-error` : definicion.ayuda ? `${id}-ayuda` : undefined;
  const comunes = {
    id,
    className: 'control',
    disabled: deshabilitado,
    required: definicion.requerido,
    'aria-invalid': Boolean(error),
    'aria-describedby': descripcion,
  };
  const cambiar = (nuevo: unknown) => al_cambiar(definicion.nombre, nuevo);
  let control: ReactNode;
  switch (definicion.tipo) {
    case 'area':
      control = <textarea {...comunes} value={String(valor ?? '')} onChange={(evento) => cambiar(evento.target.value)} maxLength={2000} />;
      break;
    case 'numero':
    case 'entero':
      control = (
        <input
          {...comunes}
          type="number"
          inputMode={definicion.tipo === 'entero' ? 'numeric' : 'decimal'}
          step={definicion.paso ?? (definicion.tipo === 'entero' ? 1 : 0.1)}
          min={definicion.minimo}
          max={definicion.maximo}
          value={valor === null || valor === undefined ? '' : String(valor)}
          onChange={(evento) => cambiar(evento.target.value === '' ? null : evento.target.value)}
        />
      );
      break;
    case 'fecha':
      control = <input {...comunes} type="date" value={valor ? String(valor).slice(0, 10) : ''} onChange={(evento) => cambiar(evento.target.value ? `${evento.target.value}T12:00:00.000Z` : null)} />;
      break;
    case 'fecha_hora':
      control = <input {...comunes} type="datetime-local" value={a_fecha_local(valor)} onChange={(evento) => cambiar(desde_fecha_local(evento.target.value))} />;
      break;
    case 'seleccion':
      control = (
        <select {...comunes} value={String(valor ?? '')} onChange={(evento) => cambiar(evento.target.value || null)}>
          <option value="">Selecciona una opción</option>
          {(definicion.opciones ?? []).map((opcion) => (
            <option key={opcion.valor} value={opcion.valor}>
              {opcion.etiqueta}
            </option>
          ))}
        </select>
      );
      break;
    case 'opciones':
      // Botones tipo chip del mockup (Activo / Contenido / Cerrado): grupo de radio accesible.
      return (
        <div className="campo" data-ancho={definicion.ancho}>
          <span className="etiqueta_campo" id={`${id}-etiqueta`}>
            {definicion.etiqueta}
            {definicion.requerido && <span className="requerido"> *</span>}
          </span>
          <div className="opciones_chip" role="radiogroup" aria-labelledby={`${id}-etiqueta`}>
            {(definicion.opciones ?? []).map((opcion) => (
              <button key={opcion.valor} type="button" role="radio" className="chip" aria-checked={valor === opcion.valor} onClick={() => cambiar(opcion.valor)} disabled={deshabilitado}>
                {opcion.etiqueta}
              </button>
            ))}
          </div>
          {error && (
            <span className="error_campo" role="alert">
              <AlertCircle size={15} aria-hidden="true" /> {error}
            </span>
          )}
        </div>
      );
    case 'casillas': {
      const seleccionados = Array.isArray(valor) ? (valor as string[]) : [];
      return (
        <fieldset className="campo" data-ancho={definicion.ancho ?? 'completo'} style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="etiqueta_campo" style={{ marginBottom: 6 }}>
            {definicion.etiqueta}
          </legend>
          <div className="lista_casillas">
            {(definicion.opciones ?? []).map((opcion) => (
              <label key={opcion.valor} className="casilla">
                <input
                  type="checkbox"
                  checked={seleccionados.includes(opcion.valor)}
                  disabled={deshabilitado}
                  onChange={(evento) => cambiar(evento.target.checked ? [...seleccionados, opcion.valor] : seleccionados.filter((elemento) => elemento !== opcion.valor))}
                />
                {opcion.etiqueta}
              </label>
            ))}
          </div>
          {error && <span className="error_campo">{error}</span>}
        </fieldset>
      );
    }
    case 'referencia':
      control = <SelectorReferencia id={id} definicion={definicion} valor={valor} datos={datos} al_cambiar={cambiar} deshabilitado={deshabilitado} descripcion={descripcion} />;
      break;
    default:
      control = (
        <input
          {...comunes}
          type={definicion.tipo === 'correo' ? 'email' : definicion.tipo === 'telefono' ? 'tel' : 'text'}
          autoComplete={definicion.tipo === 'correo' ? 'email' : definicion.tipo === 'telefono' ? 'tel' : 'off'}
          value={String(valor ?? '')}
          onChange={(evento) => cambiar(evento.target.value)}
          maxLength={300}
        />
      );
  }
  return (
    <EnvoltorioCampo id={id} etiqueta={definicion.etiqueta} requerido={definicion.requerido} ayuda={definicion.ayuda} error={error} ancho={definicion.ancho}>
      {control}
    </EnvoltorioCampo>
  );
}
