import type { ErrorRequestHandler, RequestHandler } from 'express';
import { MulterError } from 'multer';
import { ocultar_secretos } from '../../configuracion/entorno';
import { ErrorAplicacion, type CodigoError } from '../../dominio/errores';

const ESTADOS_HTTP: Record<CodigoError, number> = {
  VALIDACION: 400,
  NO_AUTENTICADO: 401,
  SESION_EXPIRADA: 401,
  SIN_PERMISO: 403,
  CSRF_INVALIDO: 403,
  NO_ENCONTRADO: 404,
  CONFLICTO: 409,
  TRANSICION_INVALIDA: 409,
  DEMASIADAS_SOLICITUDES: 429,
  SERVICIO_EXTERNO: 502,
  INTERNO: 500,
};

/**
 * Manejo centralizado de errores (RNF7): mensajes en español, comprensibles y sin detalles
 * internos ni secretos. Los errores inesperados se registran en el servidor (sin credenciales)
 * y el cliente sólo recibe un mensaje genérico.
 */
export const manejador_errores: ErrorRequestHandler = (error, _solicitud, respuesta, _siguiente) => {
  if (error instanceof ErrorAplicacion) {
    respuesta.status(ESTADOS_HTTP[error.codigo]).json({ exito: false, codigo: error.codigo, mensaje: error.message, errores: error.detalles });
    return;
  }
  if (error instanceof MulterError) {
    const mensaje = error.code === 'LIMIT_FILE_SIZE' ? 'La evidencia supera el tamaño máximo permitido.' : 'El archivo enviado no es válido.';
    respuesta.status(400).json({ exito: false, codigo: 'VALIDACION', mensaje, errores: { evidencia: mensaje } });
    return;
  }
  const tipo = (error as { type?: string }).type;
  if (tipo === 'entity.parse.failed') {
    respuesta.status(400).json({ exito: false, codigo: 'VALIDACION', mensaje: 'El cuerpo de la solicitud no es un JSON válido.' });
    return;
  }
  if (tipo === 'entity.too.large') {
    respuesta.status(413).json({ exito: false, codigo: 'VALIDACION', mensaje: 'La solicitud es demasiado grande.' });
    return;
  }
  const detalle = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  console.error('[error]', ocultar_secretos(detalle));
  respuesta.status(500).json({ exito: false, codigo: 'INTERNO', mensaje: 'Ocurrió un error inesperado. Intenta de nuevo en unos minutos.' });
};

export const ruta_no_encontrada: RequestHandler = (_solicitud, respuesta) => {
  respuesta.status(404).json({ exito: false, codigo: 'NO_ENCONTRADO', mensaje: 'El recurso solicitado no existe.' });
};
