import nodemailer, { type Transporter } from 'nodemailer';
import type { IServicioCorreo, MensajeCorreo, ResultadoEnvioCorreo } from '../../dominio/contratos/servicios_externos';
import type { ConfiguracionEntorno } from '../../configuracion/entorno';

/**
 * Envío de correos por SMTP. Si no está configurado, NO simula una entrega:
 * informa que el envío no está verificado.
 */
export class ServicioCorreoSmtp implements IServicioCorreo {
  private readonly _transporte: Transporter | null;
  private readonly _remitente: string;

  constructor(configuracion: ConfiguracionEntorno['smtp']) {
    this._remitente = configuracion.remitente;
    this._transporte = configuracion.host
      ? nodemailer.createTransport({
          host: configuracion.host,
          port: configuracion.puerto,
          secure: configuracion.seguro,
          auth: configuracion.usuario ? { user: configuracion.usuario, pass: configuracion.contrasena } : undefined,
        })
      : null;
  }

  esta_configurado(): boolean {
    return this._transporte !== null;
  }

  async enviar(mensaje: MensajeCorreo): Promise<ResultadoEnvioCorreo> {
    if (!this._transporte) {
      return { enviado: false, detalle: 'El servicio de correo no está configurado: el envío no está verificado.' };
    }
    try {
      await this._transporte.sendMail({
        from: this._remitente,
        to: mensaje.destinatario,
        subject: mensaje.asunto,
        text: mensaje.texto,
        html: mensaje.html,
      });
      return { enviado: true, detalle: 'Mensaje aceptado por el servidor SMTP.' };
    } catch (error) {
      return { enviado: false, detalle: `El servidor SMTP rechazó el envío: ${(error as Error).message}` };
    }
  }
}

/** Implementación para pruebas automáticas: guarda los mensajes en memoria (no envía nada). */
export class ServicioCorreoMemoria implements IServicioCorreo {
  readonly mensajes: MensajeCorreo[] = [];

  esta_configurado(): boolean {
    return true;
  }

  async enviar(mensaje: MensajeCorreo): Promise<ResultadoEnvioCorreo> {
    this.mensajes.push(mensaje);
    return { enviado: true, detalle: 'Mensaje guardado en memoria (entorno de pruebas).' };
  }
}
