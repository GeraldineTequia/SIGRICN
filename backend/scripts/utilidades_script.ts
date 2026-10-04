import mongoose from 'mongoose';
import { cargar_configuracion, ocultar_secretos, type ConfiguracionEntorno } from '../src/configuracion/entorno';
import { conectar_mongodb } from '../src/infraestructura/persistencia/conexion';

/** Lee argumentos con formato --nombre valor o --bandera. */
export function leer_argumentos(): Record<string, string | boolean> {
  const argumentos: Record<string, string | boolean> = {};
  const lista = process.argv.slice(2);
  for (let indice = 0; indice < lista.length; indice += 1) {
    const actual = lista[indice];
    if (!actual.startsWith('--')) continue;
    const siguiente = lista[indice + 1];
    if (siguiente && !siguiente.startsWith('--')) {
      argumentos[actual.slice(2)] = siguiente;
      indice += 1;
    } else {
      argumentos[actual.slice(2)] = true;
    }
  }
  return argumentos;
}

/** Conecta con la base configurada (o la indicada con --base) sin imprimir credenciales. */
export async function conectar_para_script(base?: string): Promise<ConfiguracionEntorno> {
  const configuracion = cargar_configuracion();
  if (!configuracion.mongodb_uri || configuracion.mongodb_uri.includes('<')) {
    throw new Error('MONGODB_URI no está configurada en backend/.env (o contiene <CONTRASENA_NUEVA>).');
  }
  const nombre_base = base ?? configuracion.mongodb_db;
  await conectar_mongodb(configuracion.mongodb_uri, nombre_base);
  console.log(`Conectado a la base "${nombre_base}".`);
  return { ...configuracion, mongodb_db: nombre_base };
}

export async function ejecutar_script(principal: () => Promise<void>): Promise<void> {
  try {
    await principal();
  } catch (error) {
    console.error(`Error: ${ocultar_secretos((error as Error).message)}`);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}
