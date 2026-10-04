/**
 * Respaldo lógico de la base (RNF14). Exporta cada colección en Extended JSON (conserva tipos:
 * ObjectId, Date, números) y comprime con gzip. Aplica la política de retención.
 * Uso:  npm run respaldar [-- --base SGRICN]
 * Programación sugerida: diario a las 03:00 con el Programador de tareas de Windows o cron.
 */
import { mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import mongoose from 'mongoose';
import { conectar_para_script, ejecutar_script, leer_argumentos } from './utilidades_script';

ejecutar_script(async () => {
  const argumentos = leer_argumentos();
  const configuracion = await conectar_para_script(typeof argumentos.base === 'string' ? argumentos.base : undefined);
  const db = mongoose.connection.db!;
  const marca = new Date().toISOString().replace(/[:.]/g, '-');
  const carpeta = path.join(configuracion.directorio_respaldos, `${db.databaseName}_${marca}`);
  mkdirSync(carpeta, { recursive: true });
  const { EJSON } = mongoose.mongo.BSON;
  const manifiesto: Record<string, number> = {};
  for (const { name: nombre } of await db.listCollections().toArray()) {
    if (nombre === 'Sesiones') continue; // Las sesiones son temporales y contienen datos de autenticación.
    const documentos = await db.collection(nombre).find({}).toArray();
    writeFileSync(path.join(carpeta, `${nombre}.json.gz`), gzipSync(EJSON.stringify(documentos, { relaxed: false })));
    manifiesto[nombre] = documentos.length;
  }
  writeFileSync(path.join(carpeta, 'manifiesto.json'), JSON.stringify({ base: db.databaseName, fecha: new Date().toISOString(), colecciones: manifiesto }, null, 2));
  console.log(`Respaldo creado en ${carpeta}`);
  console.log(manifiesto);

  const limite = Date.now() - configuracion.respaldo_retencion_dias * 86_400_000;
  for (const entrada of readdirSync(configuracion.directorio_respaldos)) {
    const ruta = path.join(configuracion.directorio_respaldos, entrada);
    if (entrada.startsWith(`${db.databaseName}_`) && statSync(ruta).mtimeMs < limite) {
      rmSync(ruta, { recursive: true, force: true });
      console.log(`Respaldo antiguo eliminado por retención: ${entrada}`);
    }
  }
});
