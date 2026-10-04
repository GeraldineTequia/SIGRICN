import { Router, type Request } from 'express';
import type { Contenedor } from '../../composicion/contenedor';
import { NOMBRE_COOKIE_SESION } from '../../infraestructura/sesiones/configurar_sesiones';
import { destruir_sesion, requerir_autenticacion, obtener_contexto } from '../middlewares/autenticacion';
import { obtener_token_csrf } from '../middlewares/csrf';
import type { crear_limites } from '../middlewares/limites';
import { asincrono, responder } from './utilidades_http';

function regenerar_sesion(solicitud: Request): Promise<void> {
  return new Promise((resolver, rechazar) => solicitud.session.regenerate((error) => (error ? rechazar(error) : resolver())));
}

function guardar_sesion(solicitud: Request): Promise<void> {
  return new Promise((resolver, rechazar) => solicitud.session.save((error) => (error ? rechazar(error) : resolver())));
}

/** Rutas de autenticación y recuperación (RF1–RF3). */
export function crear_rutas_autenticacion(contenedor: Contenedor, limites: ReturnType<typeof crear_limites>): Router {
  const enrutador = Router();
  const { autenticacion, configuracion } = contenedor;
  const autenticado = requerir_autenticacion(autenticacion, configuracion.sesion_inactividad_ms);

  /** Entrega el token CSRF de la sesión actual (crea una sesión anónima si no existe). */
  enrutador.get(
    '/csrf',
    asincrono(async (solicitud, respuesta) => {
      const token = obtener_token_csrf(solicitud);
      await guardar_sesion(solicitud);
      responder(respuesta, { token_csrf: token });
    }),
  );

  enrutador.post(
    '/registro',
    limites.registro,
    asincrono(async (solicitud, respuesta) => {
      const usuario = await autenticacion.registrar(solicitud.body);
      responder(respuesta, { usuario }, 201, 'Cuenta creada. Ya puedes iniciar sesión.');
    }),
  );

  enrutador.post(
    '/inicio-sesion',
    limites.inicio_sesion,
    asincrono(async (solicitud, respuesta) => {
      const usuario = await autenticacion.iniciar_sesion(solicitud.body);
      // Nueva sesión tras autenticarse: evita la fijación de sesión.
      await regenerar_sesion(solicitud);
      const ahora = Date.now();
      solicitud.session.usuario_id = usuario.id;
      solicitud.session.iniciada_en = ahora;
      solicitud.session.ultima_actividad = ahora;
      const token_csrf = obtener_token_csrf(solicitud);
      await guardar_sesion(solicitud);
      responder(respuesta, { usuario, token_csrf, inactividad_minutos: configuracion.sesion_inactividad_ms / 60_000 }, 200, `Bienvenido, ${usuario.nombre}.`);
    }),
  );

  enrutador.post(
    '/cierre-sesion',
    asincrono(async (solicitud, respuesta) => {
      await destruir_sesion(solicitud);
      respuesta.clearCookie(NOMBRE_COOKIE_SESION);
      responder(respuesta, null, 200, 'Sesión cerrada.');
    }),
  );

  enrutador.get(
    '/sesion',
    autenticado,
    asincrono(async (solicitud, respuesta) => {
      responder(respuesta, {
        usuario: obtener_contexto(solicitud).usuario,
        token_csrf: obtener_token_csrf(solicitud),
        inactividad_minutos: configuracion.sesion_inactividad_ms / 60_000,
      });
    }),
  );

  /** El frontend lo llama cuando el usuario interactúa sin generar solicitudes (por ejemplo, escribe un formulario). */
  enrutador.post(
    '/actividad',
    autenticado,
    asincrono(async (_solicitud, respuesta) => {
      responder(respuesta, { registrada: true });
    }),
  );

  enrutador.post(
    '/recuperar-contrasena',
    limites.recuperacion,
    asincrono(async (solicitud, respuesta) => {
      const resultado = await autenticacion.solicitar_recuperacion(solicitud.body);
      responder(respuesta, { correo_configurado: resultado.correo_configurado }, 200, resultado.mensaje);
    }),
  );

  enrutador.post(
    '/restablecer-contrasena',
    limites.recuperacion,
    asincrono(async (solicitud, respuesta) => {
      await autenticacion.restablecer_contrasena(solicitud.body);
      responder(respuesta, null, 200, 'Contraseña actualizada. Inicia sesión con tu nueva contraseña.');
    }),
  );

  return enrutador;
}
