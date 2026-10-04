import crypto from 'node:crypto';
import type { Request, RequestHandler } from 'express';
import { ErrorAplicacion } from '../../dominio/errores';

const METODOS_SEGUROS = ['GET', 'HEAD', 'OPTIONS'];
export const CABECERA_CSRF = 'x-csrf-token';

/** Genera (o reutiliza) el token sincronizador guardado en la sesión del servidor. */
export function obtener_token_csrf(solicitud: Request): string {
  if (!solicitud.session.token_csrf) solicitud.session.token_csrf = crypto.randomBytes(32).toString('base64url');
  return solicitud.session.token_csrf;
}

/**
 * Protección CSRF con patrón de token sincronizador: toda solicitud que modifica datos debe
 * enviar en la cabecera X-CSRF-Token el valor guardado en la sesión. Un sitio externo no puede
 * leerlo (CORS + cookie SameSite=Lax), por lo que no puede falsificar la solicitud.
 */
export const proteger_csrf: RequestHandler = (solicitud, _respuesta, siguiente) => {
  if (METODOS_SEGUROS.includes(solicitud.method)) return siguiente();
  const esperado = solicitud.session?.token_csrf;
  const recibido = solicitud.get(CABECERA_CSRF);
  const es_valido =
    typeof esperado === 'string' &&
    typeof recibido === 'string' &&
    esperado.length === recibido.length &&
    crypto.timingSafeEqual(Buffer.from(esperado), Buffer.from(recibido));
  if (!es_valido) {
    return siguiente(new ErrorAplicacion('CSRF_INVALIDO', 'La solicitud no incluye un token de seguridad válido. Recarga la página e inténtalo de nuevo.'));
  }
  siguiente();
};
