import type { Request, RequestHandler, Response } from 'express';
import type { ServicioAutenticacion } from '../../aplicacion/servicios/ServicioAutenticacion';
import type { EventoSistema, IPublicadorEventos } from '../../dominio/contratos/servicios_externos';

const INTERVALO_LATIDO_MS = 20_000;

function recargar_sesion(solicitud: Request): Promise<boolean> {
  return new Promise((resolver) => solicitud.session.reload((error) => resolver(!error)));
}

/**
 * Canal de eventos en tiempo real con Server-Sent Events (RNF3).
 * Cada cambio persistido se publica en el bus y llega a los usuarios conectados en milisegundos;
 * el frontend vuelve a consultar los datos afectados. Sólo se envían avisos (entidad e identificador),
 * nunca datos completos, y se filtran por rol.
 * El canal no renueva la inactividad: en cada latido se relee la sesión y, si expiró por inactividad
 * o la cuenta fue desactivada, se informa al cliente y se cierra la conexión.
 */
export function crear_controlador_eventos(publicador: IPublicadorEventos, autenticacion: ServicioAutenticacion, inactividad_ms: number): RequestHandler {
  return (solicitud: Request, respuesta: Response) => {
    const usuario = solicitud.contexto?.usuario;
    if (!usuario) {
      respuesta.status(401).end();
      return;
    }
    respuesta.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    const enviar = (nombre: string, datos: unknown) => respuesta.write(`event: ${nombre}\ndata: ${JSON.stringify(datos)}\n\n`);
    enviar('conectado', { fecha: new Date().toISOString() });

    const cancelar = publicador.suscribir((evento: EventoSistema) => {
      if (evento.roles.includes(usuario.rol)) enviar(evento.tipo, evento);
    });

    const latido = setInterval(async () => {
      const sigue_valida = await recargar_sesion(solicitud);
      const ultima = solicitud.session?.ultima_actividad ?? 0;
      const vigente = sigue_valida && solicitud.session?.usuario_id ? await autenticacion.obtener_usuario_vigente(usuario.id) : null;
      if (!vigente || Date.now() - ultima > inactividad_ms) {
        enviar('sesion_expirada', { mensaje: 'La sesión terminó por inactividad o cambios en la cuenta.' });
        cerrar();
        respuesta.end();
        return;
      }
      respuesta.write(': latido\n\n');
    }, INTERVALO_LATIDO_MS);

    const cerrar = () => {
      clearInterval(latido);
      cancelar();
    };
    solicitud.on('close', cerrar);
  };
}
