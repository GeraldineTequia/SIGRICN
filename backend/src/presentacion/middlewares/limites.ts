import rateLimit, { ipKeyGenerator, type Options } from 'express-rate-limit';
import type { RequestHandler } from 'express';
import { ErrorAplicacion } from '../../dominio/errores';

function crear_limite(ventana_ms: number, maximo: number, mensaje: string, por_usuario = false): RequestHandler {
  const opciones: Partial<Options> = {
    windowMs: ventana_ms,
    limit: maximo,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_solicitud, _respuesta, siguiente) => siguiente(new ErrorAplicacion('DEMASIADAS_SOLICITUDES', mensaje)),
  };
  if (por_usuario) {
    opciones.keyGenerator = (solicitud) => solicitud.session?.usuario_id ?? ipKeyGenerator(solicitud.ip ?? 'desconocida');
  }
  return rateLimit(opciones);
}

/** Límites de solicitudes (inicio de sesión, recuperación, registro y geocodificación). */
export function crear_limites(es_prueba: boolean) {
  const factor = es_prueba ? 100 : 1;
  return {
    inicio_sesion: crear_limite(15 * 60_000, 10 * factor, 'Demasiados intentos de inicio de sesión. Espera 15 minutos.'),
    recuperacion: crear_limite(15 * 60_000, 5 * factor, 'Demasiadas solicitudes de recuperación. Espera 15 minutos.'),
    registro: crear_limite(60 * 60_000, 10 * factor, 'Demasiados registros desde esta conexión. Intenta más tarde.'),
    geocodificacion: crear_limite(60_000, 30 * factor, 'Demasiadas búsquedas de direcciones. Espera un minuto.', true),
    reportes_pdf: crear_limite(60_000, 10 * factor, 'Demasiados reportes solicitados. Espera un minuto.', true),
  };
}
