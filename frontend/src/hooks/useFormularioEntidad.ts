import { useCallback, useEffect, useState } from 'react';
import type { EsquemaValidacion } from '@dominio/validacion/validador';
import type { DefinicionCampo } from '../componentes/formularios/tipos_formulario';
import type { RegistroBase } from '../tipos/api';
import { borrar_preferencia, guardar_preferencia, leer_preferencia } from '../utilidades/almacenamiento_local';
import { calcular_completitud, preparar_envio, validar_formulario } from '../validadores/validar_formulario';
import { useOperacion } from './useOperacion';

interface ServicioFormulario<T extends RegistroBase> {
  crear: (datos: Record<string, unknown>) => Promise<{ registro: T; mensaje: string }>;
  reemplazar: (id: string, datos: Record<string, unknown>) => Promise<{ registro: T; mensaje: string }>;
}

interface OpcionesFormulario<T extends RegistroBase> {
  campos: DefinicionCampo[];
  esquema_creacion: EsquemaValidacion;
  esquema_edicion: EsquemaValidacion;
  servicio: ServicioFormulario<T>;
  registro?: T | null;
  valores_iniciales?: Record<string, unknown>;
  entidades: string[];
  reglas_extra?: (envio: Record<string, unknown>) => Record<string, string>;
  clave_borrador?: string;
}

/**
 * Estado y envío de formularios de entidades. Valida con el esquema del dominio antes de enviar,
 * muestra los errores del servidor junto a cada campo y confirma el éxito sólo tras la respuesta.
 */
export function useFormularioEntidad<T extends RegistroBase>(opciones: OpcionesFormulario<T>) {
  const { campos, registro, valores_iniciales, clave_borrador } = opciones;
  const es_edicion = Boolean(registro);
  const [datos, establecer_datos] = useState<Record<string, unknown>>(() => ({ ...(valores_iniciales ?? {}) }));
  const [errores_locales, establecer_errores_locales] = useState<Record<string, string>>({});
  const [borrador_guardado, establecer_borrador_guardado] = useState(false);
  const { ejecutar, en_proceso, errores_campos } = useOperacion();

  useEffect(() => {
    if (registro) {
      establecer_datos(Object.fromEntries(campos.map((campo) => [campo.nombre, registro[campo.nombre] ?? null])));
    } else if (clave_borrador) {
      const borrador = leer_preferencia<Record<string, unknown> | null>(`borrador:${clave_borrador}`, null);
      if (borrador) {
        establecer_datos({ ...(valores_iniciales ?? {}), ...borrador });
        establecer_borrador_guardado(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registro?.id]);

  const cambiar = useCallback((nombre: string, valor: unknown) => {
    establecer_datos((actuales) => ({ ...actuales, [nombre]: valor }));
    establecer_errores_locales((actuales) => {
      if (!actuales[nombre]) return actuales;
      const copia = { ...actuales };
      delete copia[nombre];
      return copia;
    });
    establecer_borrador_guardado(false);
  }, []);

  const guardar_borrador = useCallback(() => {
    if (!clave_borrador) return;
    // El borrador queda sólo en este navegador; no incluye la ubicación (debe confirmarse de nuevo).
    const sin_ubicacion = Object.fromEntries(Object.entries(datos).filter(([campo]) => campo !== 'ubicacion'));
    guardar_preferencia(`borrador:${clave_borrador}`, sin_ubicacion);
    establecer_borrador_guardado(true);
  }, [clave_borrador, datos]);

  const enviar = useCallback(async (): Promise<T | null> => {
    const envio = preparar_envio(datos, campos, es_edicion);
    const esquema = es_edicion ? opciones.esquema_edicion : opciones.esquema_creacion;
    const errores = validar_formulario(envio, esquema, campos, datos, opciones.reglas_extra);
    establecer_errores_locales(errores);
    if (Object.keys(errores).length > 0) return null;
    const resultado = await ejecutar(() => (registro ? opciones.servicio.reemplazar(registro.id, envio) : opciones.servicio.crear(envio)), {
      entidades: opciones.entidades,
      mensaje_exito: (respuesta) => respuesta.mensaje,
    });
    if (resultado && clave_borrador) borrar_preferencia(`borrador:${clave_borrador}`);
    return resultado?.registro ?? null;
  }, [datos, campos, es_edicion, opciones, registro, ejecutar, clave_borrador]);

  const errores = { ...errores_campos, ...errores_locales };
  return {
    datos,
    cambiar,
    errores,
    enviar,
    en_proceso,
    es_edicion,
    completitud: calcular_completitud(datos, campos),
    guardar_borrador,
    borrador_guardado,
  };
}
