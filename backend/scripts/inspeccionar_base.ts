/**
 * Inspección de SOLO LECTURA de la base existente (sección 5 y 9).
 * Uso:  npm run inspeccionar-base [-- --base SGRICN] [-- --salida ../docs/inspeccion_base.json]
 * Informa colecciones, cantidad de documentos, campos y tipos (sin mostrar valores personales),
 * tipos de _id, relaciones reales entre catastrofeId/zonaId/usuarioId y _id, estados existentes,
 * terremotos sin magnitud y correos duplicados. No escribe nada en MongoDB.
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { EQUIVALENCIAS_ESTADO_HEREDADO, ESTADOS_EMERGENCIA } from '../src/dominio/reglas/catalogos';
import { es_tipo_terremoto } from '../src/dominio/reglas/regla_magnitud';
import { conectar_para_script, ejecutar_script, leer_argumentos } from './utilidades_script';

type Documento = Record<string, unknown>;
const MUESTRA = 500;

function tipo_de(valor: unknown): string {
  if (valor === null) return 'null';
  if (valor === undefined) return 'ausente';
  if (valor instanceof Date) return 'Date';
  if (valor instanceof mongoose.Types.ObjectId) return 'ObjectId';
  if (Array.isArray(valor)) return 'Array';
  const bson = (valor as { _bsontype?: string })._bsontype;
  if (bson) return bson;
  if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(valor)) return 'string(fecha ISO)';
  return typeof valor;
}

ejecutar_script(async () => {
  const argumentos = leer_argumentos();
  await conectar_para_script(typeof argumentos.base === 'string' ? argumentos.base : undefined);
  const db = mongoose.connection.db!;
  const informe: Record<string, unknown> = { base: db.databaseName, fecha: new Date().toISOString(), colecciones: {} };
  const colecciones = (await db.listCollections().toArray()).map((coleccion) => coleccion.name).sort();
  const ids_por_coleccion: Record<string, Set<string>> = {};

  for (const nombre of colecciones) {
    const coleccion = db.collection(nombre);
    const total = await coleccion.estimatedDocumentCount();
    const muestra = await coleccion.find({}).limit(MUESTRA).toArray();
    const campos: Record<string, Record<string, number>> = {};
    for (const documento of muestra) {
      for (const [campo, valor] of Object.entries(documento)) {
        campos[campo] ??= {};
        const tipo = tipo_de(valor);
        campos[campo][tipo] = (campos[campo][tipo] ?? 0) + 1;
      }
    }
    ids_por_coleccion[nombre] = new Set(muestra.map((documento) => String(documento._id)));
    (informe.colecciones as Record<string, unknown>)[nombre] = { total_documentos: total, documentos_revisados: muestra.length, campos };
  }

  // Relaciones: ¿a qué colección apuntan realmente las referencias?
  const relaciones: Record<string, unknown> = {};
  const referencias = ['catastrofeId', 'zonaId', 'usuarioId', 'centroDonacionId', 'emergenciaId'];
  for (const nombre of colecciones) {
    const muestra = await db.collection(nombre).find({}).limit(MUESTRA).toArray();
    for (const campo of referencias) {
      const valores = muestra.map((documento) => (documento as Documento)[campo]).filter((valor) => valor !== undefined && valor !== null);
      if (valores.length === 0) continue;
      const destinos: Record<string, number> = {};
      let sin_destino = 0;
      for (const valor of valores) {
        const texto = String(valor);
        const destino = Object.entries(ids_por_coleccion).find(([, ids]) => ids.has(texto))?.[0];
        if (destino) destinos[destino] = (destinos[destino] ?? 0) + 1;
        else sin_destino += 1;
      }
      relaciones[`${nombre}.${campo}`] = {
        tipos: [...new Set(valores.map(tipo_de))],
        ejemplos_formato: [...new Set(valores.slice(0, 3).map((valor) => (typeof valor === 'string' && !/^[0-9a-f]{24}$/i.test(valor) ? 'texto (no ObjectId)' : tipo_de(valor))))],
        coincide_con_id_de: destinos,
        sin_registro_relacionado: sin_destino,
      };
    }
  }
  informe.relaciones = relaciones;

  if (colecciones.includes('Emergencias')) {
    const emergencias = db.collection('Emergencias');
    const estados = (await emergencias.distinct('estado')) as unknown[];
    informe.estados_emergencia = estados.map((estado) => {
      const texto = String(estado);
      const en_catalogo = (ESTADOS_EMERGENCIA as readonly string[]).includes(texto);
      return {
        estado: texto,
        cantidad: 0,
        compatibilidad: en_catalogo ? 'pertenece al catálogo' : EQUIVALENCIAS_ESTADO_HEREDADO[texto.toLowerCase()] ? `equivale a "${EQUIVALENCIAS_ESTADO_HEREDADO[texto.toLowerCase()]}" (no se migra)` : 'NO RECONOCIDO: requiere revisión/migración',
      };
    });
    for (const fila of informe.estados_emergencia as { estado: string; cantidad: number }[]) {
      fila.cantidad = await emergencias.countDocuments({ estado: fila.estado });
    }
    const terremotos = await emergencias.find({}, { projection: { tipo: 1, magnitud: 1 } }).toArray();
    informe.terremotos_pendientes_validacion = terremotos.filter(
      (documento) => es_tipo_terremoto(documento.tipo) && !(typeof documento.magnitud === 'number' && Number.isFinite(documento.magnitud)),
    ).length;
  }
  if (colecciones.includes('Usuarios')) {
    const duplicados = await db
      .collection('Usuarios')
      .aggregate([{ $group: { _id: { $toLower: { $trim: { input: { $ifNull: ['$correo', ''] } } } }, cantidad: { $sum: 1 } } }, { $match: { cantidad: { $gt: 1 } } }])
      .toArray();
    informe.correos_duplicados = duplicados.length;
    informe.roles_existentes = await db.collection('Usuarios').distinct('rol');
    const hashes = await db.collection('Usuarios').find({}, { projection: { password: 1 } }).limit(MUESTRA).toArray();
    informe.formato_password = {
      bcrypt: hashes.filter((documento) => /^\$2[aby]\$\d{2}\$/.test(String(documento.password))).length,
      otro_formato: hashes.filter((documento) => !/^\$2[aby]\$\d{2}\$/.test(String(documento.password))).length,
    };
  }

  const salida = JSON.stringify(informe, null, 2);
  console.log(salida);
  if (typeof argumentos.salida === 'string') {
    writeFileSync(path.resolve(argumentos.salida), salida);
    console.log(`Informe guardado en ${argumentos.salida}`);
  }
});
