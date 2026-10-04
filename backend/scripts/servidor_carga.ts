/**
 * Servidor de la prueba de carga, ejecutado en un PROCESO SEPARADO del generador de solicitudes
 * para que ambos no compitan por el mismo hilo de Node.js. Lo inicia scripts/prueba_carga.ts.
 */
import crypto from 'node:crypto';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import mongoose from 'mongoose';
import { crear_aplicacion } from '../src/aplicacion_express';
import { crear_contenedor } from '../src/composicion/contenedor';
import { cargar_configuracion } from '../src/configuracion/entorno';

(async () => {
  process.env.NODE_ENV = 'test';
  const uri = process.env.MONGODB_URI_PRUEBAS ?? 'mongodb://127.0.0.1:27017';
  const base = process.env.BASE_CARGA ?? '';
  if (!base.endsWith('_pruebas')) throw new Error('La prueba de carga sólo usa bases *_pruebas.');
  await mongoose.connect(uri, { dbName: base, maxPoolSize: 100 });
  const configuracion = cargar_configuracion({
    es_prueba: true,
    mongodb_uri: uri,
    mongodb_db: base,
    secreto_sesion: crypto.randomBytes(32).toString('hex'),
    clave_cifrado_datos: crypto.randomBytes(32).toString('base64'),
  });
  const servidor = http.createServer(crear_aplicacion(crear_contenedor(configuracion))).listen(0, '127.0.0.1', () => {
    console.log(`LISTO ${(servidor.address() as AddressInfo).port}`);
  });
  servidor.keepAliveTimeout = 65_000;
  process.on('SIGTERM', async () => {
    servidor.close();
    await mongoose.disconnect();
    process.exit(0);
  });
})().catch((error: Error) => {
  console.error(error.message);
  process.exit(1);
});
