import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { RespuestaListado } from '../../aplicacion/dto/contexto';
import { ErrorValidacion } from '../../dominio/errores';

/** Envuelve controladores asíncronos para que sus errores lleguen al manejador centralizado. */
export function asincrono(controlador: (solicitud: Request, respuesta: Response) => Promise<void>): RequestHandler {
  return (solicitud: Request, respuesta: Response, siguiente: NextFunction) => {
    controlador(solicitud, respuesta).catch(siguiente);
  };
}

const EXPRESION_IDENTIFICADOR = /^[A-Za-z0-9_-]{1,64}$/;

/** Valida el parámetro de ruta :identificador antes de usarlo en una consulta. */
export function leer_identificador(solicitud: Request, nombre = 'identificador'): string {
  const valor = solicitud.params[nombre];
  if (typeof valor !== 'string' || !EXPRESION_IDENTIFICADOR.test(valor)) {
    throw new ErrorValidacion({ [nombre]: 'El identificador no es válido.' }, 'El identificador no es válido.');
  }
  return valor;
}

/** Sólo se aceptan parámetros de consulta de texto simple (nunca objetos que puedan convertirse en operadores). */
export function leer_parametros(solicitud: Request): Record<string, string> {
  const parametros: Record<string, string> = {};
  for (const [clave, valor] of Object.entries(solicitud.query)) {
    if (typeof valor === 'string') parametros[clave] = valor;
  }
  return parametros;
}

export function responder(respuesta: Response, datos: unknown, estado = 200, mensaje?: string): void {
  respuesta.status(estado).json({ exito: true, datos, ...(mensaje ? { mensaje } : {}) });
}

export function responder_listado(respuesta: Response, listado: RespuestaListado): void {
  respuesta.json({
    exito: true,
    datos: listado.elementos,
    paginacion: { total: listado.total, pagina: listado.pagina, limite: listado.limite, total_paginas: listado.total_paginas },
  });
}
