/**
 * Restauración de un respaldo en una base AISLADA (RNF14).
 * Uso:  npm run restaurar -- --origen respaldos/SGRICN_2026-... --destino SGRICN_restauracion
 * Por seguridad se niega a restaurar sobre la base configurada en MONGODB_DB o sobre una base con datos,
 * salvo que se indique explícitamente --reemplazar (y nunca sobre la base de producción sin
 * --confirmar-produccion). Al terminar compara la cantidad de documentos con el manifiesto.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import mongoose from 'mongoose';
import { cargar_configuracion } from '../src/configuracion/entorno';
import { conectar_para_script, ejecutar_script, leer_argumentos } from './utilidades_script';

ejecutar_script(async () => {
  const argumentos = leer_argumentos();
  if (typeof argumentos.origen !== 'string' || typeof argumentos.destino !== 'string') {
    throw new Error('Indica --origen (carpeta del respaldo) y --destino (base aislada).');
  }
  const base_produccion = cargar_configuracion().mongodb_db;
  if (argumentos.destino === base_produccion && argumentos['confirmar-produccion'] !== true) {
    throw new Error(`No se restaura sobre "${base_produccion}" sin --confirmar-produccion. Usa una base aislada.`);
  }
  const carpeta = path.resolve(argumentos.origen);
  const manifiesto = JSON.parse(readFileSync(path.join(carpeta, 'manifiesto.json'), 'utf8')) as { colecciones: Record<string, number> };
  await conectar_para_script(argumentos.destino);
  const db = mongoose.connection.db!;
  const existentes = (await db.listCollections().toArray()).map((coleccion) => coleccion.name);
  if (existentes.length > 0 && argumentos.reemplazar !== true) {
    throw new Error(`La base "${argumentos.destino}" ya tiene colecciones. Usa otra base o --reemplazar.`);
  }
  const { EJSON } = mongoose.mongo.BSON;
  const verificacion: Record<string, { esperado: number; restaurado: number }> = {};
  for (const [nombre, esperado] of Object.entries(manifiesto.colecciones)) {
    const documentos = EJSON.parse(gunzipSync(readFileSync(path.join(carpeta, `${nombre}.json.gz`))).toString('utf8'), { relaxed: false }) as Record<string, unknown>[];
    if (argumentos.reemplazar === true) await db.collection(nombre).deleteMany({});
    if (documentos.length > 0) await db.collection(nombre).insertMany(documentos);
    verificacion[nombre] = { esperado, restaurado: await db.collection(nombre).countDocuments() };
  }
  console.table(verificacion);
  const correcto = Object.values(verificacion).every((fila) => fila.esperado === fila.restaurado);
  console.log(correcto ? 'Restauración verificada: las cantidades coinciden con el manifiesto.' : 'ATENCIÓN: hay diferencias con el manifiesto.');
  if (!correcto) process.exitCode = 1;
});
