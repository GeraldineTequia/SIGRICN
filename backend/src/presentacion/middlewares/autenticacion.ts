import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ContextoSolicitud } from '../../aplicacion/dto/contexto';
import type { ServicioAutenticacion } from '../../aplicacion/servicios/ServicioAutenticacion';
import { ErrorAplicacion, ErrorSinPermiso } from '../../dominio/errores';
import { tiene_permiso, type Permiso } from '../../dominio/reglas/permisos';

declare module 'express-serve-static-core' {
  interface Request {
    contexto?: ContextoSolicitud;
  }
}

/** Cabecera que el frontend envía en consultas automáticas (sondeo, SSE, alertas). */
export const CABECERA_AUTOMATICA = 'x-solicitud-automatica';

export function es_solicitud_automatica(solicitud: Request): boolean {
  return solicitud.get(CABECERA_AUTOMATICA) === '1';
}

export function destruir_sesion(solicitud: Request): Promise<void> {
  return new Promise((resolver) => solicitud.session.destroy(() => resolver()));
}

/**
 * 401 si no hay sesión válida. Aplica también el cierre por inactividad (RNF12):
 * si pasaron más de N minutos desde la última ACCIÓN del usuario, la sesión se destruye.
 * Las consultas automáticas no renuevan la actividad.
 * El usuario se relee de MongoDB en cada solicitud: un cambio de rol o una desactivación
 * tiene efecto inmediato sobre las sesiones vigentes.
 */
export function requerir_autenticacion(autenticacion: ServicioAutenticacion, inactividad_ms: number): RequestHandler {
  return async (solicitud: Request, _respuesta: Response, siguiente: NextFunction) => {
    try {
      const usuario_id = solicitud.session?.usuario_id;
      if (!usuario_id) throw new ErrorAplicacion('NO_AUTENTICADO', 'Debes iniciar sesión para continuar.');
      const ahora = Date.now();
      const ultima_actividad = solicitud.session.ultima_actividad ?? solicitud.session.iniciada_en ?? 0;
      if (ahora - ultima_actividad > inactividad_ms) {
        await destruir_sesion(solicitud);
        throw new ErrorAplicacion('SESION_EXPIRADA', 'Tu sesión se cerró por inactividad. Inicia sesión de nuevo.');
      }
      const usuario = await autenticacion.obtener_usuario_vigente(usuario_id);
      if (!usuario) {
        await destruir_sesion(solicitud);
        throw new ErrorAplicacion('NO_AUTENTICADO', 'Tu cuenta no está activa o la sesión ya no es válida.');
      }
      if (!es_solicitud_automatica(solicitud)) solicitud.session.ultima_actividad = ahora;
      solicitud.contexto = { usuario };
      siguiente();
    } catch (error) {
      siguiente(error);
    }
  };
}

/** 403 cuando el rol autenticado no tiene el permiso. Siempre después de requerir_autenticacion. */
export function requerir_permiso(permiso: Permiso): RequestHandler {
  return (solicitud, _respuesta, siguiente) => {
    if (!solicitud.contexto) return siguiente(new ErrorAplicacion('NO_AUTENTICADO', 'Debes iniciar sesión para continuar.'));
    if (!tiene_permiso(solicitud.contexto.usuario.rol, permiso)) return siguiente(new ErrorSinPermiso());
    siguiente();
  };
}

export function obtener_contexto(solicitud: Request): ContextoSolicitud {
  if (!solicitud.contexto) throw new ErrorAplicacion('NO_AUTENTICADO', 'Debes iniciar sesión para continuar.');
  return solicitud.contexto;
}
