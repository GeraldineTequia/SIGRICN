import { Router, type RequestHandler } from 'express';
import type { ServicioEntidad } from '../../aplicacion/servicios/ServicioEntidad';
import { obtener_contexto, requerir_permiso } from '../middlewares/autenticacion';
import { asincrono, leer_identificador, leer_parametros, responder, responder_listado } from './utilidades_http';

export interface OpcionesRutasEntidad {
  /** Rutas específicas que deben registrarse antes de "/:identificador". */
  rutas_previas?: (enrutador: Router) => void;
  rutas_adicionales?: (enrutador: Router) => void;
  /** Mensajes de confirmación para el frontend. */
  mensajes?: { creado?: string; actualizado?: string; eliminado?: string };
}

/**
 * Rutas REST consistentes para una entidad:
 *   GET / · GET /:identificador · POST / · PUT /:identificador · PATCH /:identificador · DELETE /:identificador
 * Cada ruta comprueba el permiso en el servidor (además de la comprobación del servicio).
 */
export function crear_rutas_entidad(servicio: ServicioEntidad, opciones: OpcionesRutasEntidad = {}): Router {
  const enrutador = Router();
  const { permiso_lectura, permiso_escritura } = servicio.definicion;
  const lectura: RequestHandler = requerir_permiso(permiso_lectura);
  const escritura: RequestHandler = requerir_permiso(permiso_escritura);
  const mensajes = { creado: 'Registro creado correctamente.', actualizado: 'Cambios guardados correctamente.', eliminado: 'Registro eliminado.', ...opciones.mensajes };

  opciones.rutas_previas?.(enrutador);

  enrutador.get(
    '/',
    lectura,
    asincrono(async (solicitud, respuesta) => {
      responder_listado(respuesta, await servicio.listar(leer_parametros(solicitud), obtener_contexto(solicitud)));
    }),
  );
  enrutador.get(
    '/:identificador',
    lectura,
    asincrono(async (solicitud, respuesta) => {
      responder(respuesta, await servicio.obtener(leer_identificador(solicitud), obtener_contexto(solicitud)));
    }),
  );
  enrutador.post(
    '/',
    requerir_permiso('crear_registros_operativos'),
    escritura,
    asincrono(async (solicitud, respuesta) => {
      responder(respuesta, await servicio.crear(solicitud.body, obtener_contexto(solicitud)), 201, mensajes.creado);
    }),
  );
  for (const metodo of ['put', 'patch'] as const) {
    enrutador[metodo](
      '/:identificador',
      requerir_permiso('editar_registros_operativos'),
      escritura,
      asincrono(async (solicitud, respuesta) => {
        const actualizado = await servicio.actualizar(leer_identificador(solicitud), solicitud.body, metodo === 'patch', obtener_contexto(solicitud));
        responder(respuesta, actualizado, 200, mensajes.actualizado);
      }),
    );
  }
  enrutador.delete(
    '/:identificador',
    requerir_permiso('eliminar_registros_operativos'),
    escritura,
    asincrono(async (solicitud, respuesta) => {
      await servicio.eliminar(leer_identificador(solicitud), obtener_contexto(solicitud));
      responder(respuesta, null, 200, mensajes.eliminado);
    }),
  );
  opciones.rutas_adicionales?.(enrutador);
  return enrutador;
}
