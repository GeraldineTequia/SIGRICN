/**
 * Migración SEPARADA y revisable de índices (no se ejecuta al iniciar el servidor).
 * Uso:  npm run crear-indices            → sólo revisa y muestra el plan
 *       npm run crear-indices -- --aplicar
 * Antes de crear el índice único de correos revisa duplicados; si existen, NO crea el índice
 * y lista los correos afectados para resolverlos manualmente. No modifica documentos.
 */
import mongoose from 'mongoose';
import { crear_indices_colecciones_nuevas } from '../src/infraestructura/persistencia/modelos/modelos';
import { conectar_para_script, ejecutar_script, leer_argumentos } from './utilidades_script';

ejecutar_script(async () => {
  const argumentos = leer_argumentos();
  await conectar_para_script(typeof argumentos.base === 'string' ? argumentos.base : undefined);
  const usuarios = mongoose.connection.db!.collection('Usuarios');
  const duplicados = await usuarios
    .aggregate([{ $group: { _id: { $toLower: { $trim: { input: { $ifNull: ['$correo', ''] } } } }, cantidad: { $sum: 1 } } }, { $match: { cantidad: { $gt: 1 } } }])
    .toArray();
  console.log('Plan:');
  console.log('  1. Índices de colecciones nuevas (idempotencia, deduplicación de alertas, tokens).');
  console.log('  2. Índice único de Usuarios.correo sin distinguir mayúsculas (collation es, strength 2).');
  if (duplicados.length > 0) {
    console.log(`  ⚠ Se encontraron ${duplicados.length} correos duplicados. El paso 2 NO se aplicará:`);
    for (const duplicado of duplicados) console.log(`     - ${duplicado._id} (${duplicado.cantidad} cuentas)`);
  }
  if (argumentos.aplicar !== true) {
    console.log('Simulación terminada. Repite con --aplicar para crear los índices.');
    return;
  }
  await crear_indices_colecciones_nuevas();
  console.log('Índices de colecciones nuevas listos.');
  if (duplicados.length === 0) {
    await usuarios.createIndex({ correo: 1 }, { unique: true, collation: { locale: 'es', strength: 2 }, name: 'correo_unico_sin_mayusculas' });
    console.log('Índice único de correos creado.');
  }
});
