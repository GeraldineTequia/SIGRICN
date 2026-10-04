import MongoStore from 'connect-mongo';
import session, { type SessionOptions } from 'express-session';
import mongoose from 'mongoose';
import type { RequestHandler } from 'express';
import type { IGestorSesiones } from '../../dominio/contratos/autenticacion';
import type { ConfiguracionEntorno } from '../../configuracion/entorno';
import { COLECCIONES_NUEVAS } from '../persistencia/nombres_colecciones';

declare module 'express-session' {
  interface SessionData {
    usuario_id?: string;
    token_csrf?: string;
    /** Última acción del usuario (no se actualiza con consultas automáticas). RNF12. */
    ultima_actividad?: number;
    iniciada_en?: number;
  }
}

export const NOMBRE_COOKIE_SESION = 'sgricn.sid';

/**
 * Sesiones del servidor persistidas en MongoDB (colección Sesiones) con cookie HttpOnly,
 * SameSite=Lax, Secure en producción y caducidad absoluta. La inactividad de 5 minutos
 * se controla aparte (middleware de inactividad) para no contar las consultas automáticas.
 */
export function crear_middleware_sesion(configuracion: ConfiguracionEntorno): RequestHandler {
  const almacen = MongoStore.create({
    // connect-mongo y mongoose traen copias distintas del controlador; el cliente es compatible en ejecución.
    client: mongoose.connection.getClient() as unknown as Parameters<typeof MongoStore.create>[0]['client'],
    dbName: mongoose.connection.db?.databaseName,
    collectionName: COLECCIONES_NUEVAS.sesiones,
    // Se guarda como objeto (no texto) para poder invalidar todas las sesiones de un usuario.
    stringify: false,
    ttl: Math.ceil(configuracion.sesion_duracion_maxima_ms / 1000),
    autoRemove: 'native',
    // Renueva el vencimiento en la base como máximo cada 60 s (evita una escritura por solicitud).
    touchAfter: 60,
  });
  const opciones: SessionOptions = {
    name: NOMBRE_COOKIE_SESION,
    secret: configuracion.secreto_sesion,
    store: almacen,
    resave: false,
    saveUninitialized: false,
    rolling: false,
    proxy: configuracion.es_produccion,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: configuracion.es_produccion,
      maxAge: configuracion.sesion_duracion_maxima_ms,
    },
  };
  return session(opciones);
}

export class GestorSesionesMongo implements IGestorSesiones {
  async invalidar_sesiones_usuario(usuario_id: string): Promise<number> {
    const coleccion = mongoose.connection.collection(COLECCIONES_NUEVAS.sesiones);
    const resultado = await coleccion.deleteMany({ 'session.usuario_id': usuario_id });
    return resultado.deletedCount;
  }
}
