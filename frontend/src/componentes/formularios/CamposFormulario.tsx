import type { Ubicacion } from '../../tipos/api';
import { es_visible } from '../../validadores/validar_formulario';
import { SelectorUbicacion } from '../mapas/SelectorUbicacion';
import { AvisoEnLinea } from '../tarjetas/Estados';
import { Campo } from './Campo';
import type { DefinicionCampo } from './tipos_formulario';

interface PropiedadesCampos {
  campos: DefinicionCampo[];
  datos: Record<string, unknown>;
  errores: Record<string, string>;
  al_cambiar: (nombre: string, valor: unknown) => void;
  es_edicion: boolean;
}

/** Rejilla de campos de dos columnas del mockup. Los campos ocultos (p. ej. magnitud) no se muestran ni se envían. */
export function CamposFormulario({ campos, datos, errores, al_cambiar, es_edicion }: PropiedadesCampos) {
  return (
    <div className="formulario_rejilla">
      {campos
        .filter((campo) => es_visible(campo, datos) && !(es_edicion && campo.solo_creacion))
        .map((campo) =>
          campo.tipo === 'ubicacion' ? (
            <SelectorUbicacion
              key={campo.nombre}
              partes={{ pais: datos.pais, departamento: datos.departamento, municipio: datos.municipio, barrio: datos.barrio, direccion: datos[campo.campo_direccion ?? 'direccion'] }}
              valor={datos[campo.nombre] as Ubicacion | null}
              al_cambiar={(ubicacion) => al_cambiar(campo.nombre, ubicacion)}
              error={errores[campo.nombre]}
            />
          ) : (
            <Campo key={campo.nombre} definicion={campo} valor={datos[campo.nombre]} error={errores[campo.nombre]} datos={datos} al_cambiar={al_cambiar} />
          ),
        )}
    </div>
  );
}

/** Resumen de errores del "Panel de control" (mockup), enlazado a cada campo. */
export function ResumenErrores({ errores, campos }: { errores: Record<string, string>; campos: DefinicionCampo[] }) {
  const lista = Object.entries(errores);
  if (lista.length === 0) return null;
  return (
    <AvisoEnLinea tono="peligro" titulo="Errores de validación" rol="alert">
      <ul>
        {lista.map(([campo, mensaje]) => (
          <li key={campo}>
            <strong style={{ display: 'inline' }}>{campos.find((definicion) => definicion.nombre === campo)?.etiqueta ?? (campo === 'general' ? 'General' : campo)}:</strong> {mensaje}
          </li>
        ))}
      </ul>
    </AvisoEnLinea>
  );
}
