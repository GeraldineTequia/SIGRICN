import type { Listado, RegistroBase } from '../tipos/api';
import { solicitar } from './cliente_api';

export type ParametrosListado = Record<string, string | number | undefined>;

/**
 * Acceso REST genérico a una entidad (listar, obtener, crear, reemplazar, actualizar parcialmente y eliminar).
 * Cada módulo crea su servicio con la ruta correspondiente; así no se repite el código HTTP.
 */
export function crear_servicio_entidad<T extends RegistroBase>(ruta: string) {
  return {
    ruta,
    async listar(parametros: ParametrosListado = {}, automatica = false): Promise<Listado<T>> {
      const respuesta = await solicitar<T[]>(ruta, { parametros, automatica });
      return {
        elementos: respuesta.datos,
        paginacion: respuesta.paginacion ?? { total: respuesta.datos.length, pagina: 1, limite: respuesta.datos.length, total_paginas: 1 },
      };
    },
    async obtener(id: string): Promise<T> {
      return (await solicitar<T>(`${ruta}/${encodeURIComponent(id)}`)).datos;
    },
    async crear(datos: Record<string, unknown>): Promise<{ registro: T; mensaje: string }> {
      const respuesta = await solicitar<T>(ruta, { metodo: 'POST', cuerpo: datos });
      return { registro: respuesta.datos, mensaje: respuesta.mensaje ?? 'Registro creado.' };
    },
    async reemplazar(id: string, datos: Record<string, unknown>): Promise<{ registro: T; mensaje: string }> {
      const respuesta = await solicitar<T>(`${ruta}/${encodeURIComponent(id)}`, { metodo: 'PUT', cuerpo: datos });
      return { registro: respuesta.datos, mensaje: respuesta.mensaje ?? 'Cambios guardados.' };
    },
    async actualizar(id: string, datos: Record<string, unknown>): Promise<{ registro: T; mensaje: string }> {
      const respuesta = await solicitar<T>(`${ruta}/${encodeURIComponent(id)}`, { metodo: 'PATCH', cuerpo: datos });
      return { registro: respuesta.datos, mensaje: respuesta.mensaje ?? 'Cambios guardados.' };
    },
    async eliminar(id: string): Promise<string> {
      return (await solicitar<null>(`${ruta}/${encodeURIComponent(id)}`, { metodo: 'DELETE' })).mensaje ?? 'Registro eliminado.';
    },
  };
}

export type ServicioEntidad<T extends RegistroBase> = ReturnType<typeof crear_servicio_entidad<T>>;
