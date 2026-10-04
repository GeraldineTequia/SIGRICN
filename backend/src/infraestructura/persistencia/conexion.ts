import mongoose from 'mongoose';
import { ocultar_secretos } from '../../configuracion/entorno';

/**
 * Conecta Mongoose seleccionando EXPLÍCITAMENTE la base (dbName), sin depender de la ruta de la URI.
 * Si la conexión falla se lanza el error: nunca se sustituye por datos simulados.
 */
export async function conectar_mongodb(uri: string, nombre_base: string): Promise<typeof mongoose> {
  mongoose.set('strictQuery', true);
  mongoose.set('autoIndex', false);
  try {
    return await mongoose.connect(uri, { dbName: nombre_base, serverSelectionTimeoutMS: 10_000, maxPoolSize: 50 });
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : String(error);
    // Sólo se informa el mensaje sin credenciales; el error original no se adjunta para que no llegue a los registros.
    // eslint-disable-next-line preserve-caught-error
    throw new Error(`No fue posible conectar con MongoDB (${nombre_base}): ${ocultar_secretos(mensaje)}`);
  }
}

export async function desconectar_mongodb(): Promise<void> {
  await mongoose.disconnect();
}

/** Consulta mínima de verificación (ping) usada por /api/salud. */
export async function verificar_mongodb(): Promise<{ conectado: boolean; base: string | null }> {
  try {
    if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) return { conectado: false, base: null };
    await mongoose.connection.db.admin().command({ ping: 1 });
    return { conectado: true, base: mongoose.connection.db.databaseName };
  } catch {
    return { conectado: false, base: null };
  }
}
