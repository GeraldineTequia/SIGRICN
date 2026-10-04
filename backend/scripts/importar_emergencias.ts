/**
 * Importación de emergencias desde un archivo JSON (lista de objetos con los campos de la API).
 * Cada elemento pasa por el MISMO validador y la MISMA estrategia (regla de magnitud incluida)
 * que la creación desde la interfaz.
 * Uso:  npm run importar-emergencias -- --archivo datos.json            → sólo valida (simulación)
 *       npm run importar-emergencias -- --archivo datos.json --aplicar  → inserta los válidos
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { crear_contenedor } from '../src/composicion/contenedor';
import { cargar_configuracion } from '../src/configuracion/entorno';
import { conectar_para_script, ejecutar_script, leer_argumentos } from './utilidades_script';

ejecutar_script(async () => {
  const argumentos = leer_argumentos();
  if (typeof argumentos.archivo !== 'string') throw new Error('Indica --archivo con la ruta del JSON.');
  const elementos = JSON.parse(readFileSync(path.resolve(argumentos.archivo), 'utf8')) as unknown;
  if (!Array.isArray(elementos)) throw new Error('El archivo debe contener una lista JSON.');
  const configuracion = await conectar_para_script(typeof argumentos.base === 'string' ? argumentos.base : undefined);
  const contenedor = crear_contenedor({ ...cargar_configuracion(), ...configuracion });
  const resultados = contenedor.emergencias.validar_importacion(elementos);
  const validos = resultados.filter((resultado) => !resultado.errores);
  for (const resultado of resultados.filter((item) => item.errores)) {
    console.log(`Elemento ${resultado.indice}: RECHAZADO →`, resultado.errores);
  }
  console.log(`${validos.length} válidos, ${resultados.length - validos.length} rechazados.`);
  if (argumentos.aplicar !== true) {
    console.log('Simulación: no se insertó nada. Usa --aplicar para importar los válidos.');
    return;
  }
  const contexto = {
    usuario: { id: 'script_importacion', nombre: 'Script', apellido: 'Importación', correo: '', rol: 'administrador' as const, estado: 'activo' },
  };
  let insertados = 0;
  for (const resultado of validos) {
    await contenedor.emergencias.crear(elementos[resultado.indice], contexto);
    insertados += 1;
  }
  console.log(`${insertados} emergencias importadas (estado inicial "activa").`);
});
