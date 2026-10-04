import { cargar_configuracion, describir_configuracion_segura, ocultar_secretos, validar_configuracion } from './configuracion/entorno';
import { crear_contenedor } from './composicion/contenedor';
import { crear_aplicacion } from './aplicacion_express';
import { conectar_mongodb, desconectar_mongodb } from './infraestructura/persistencia/conexion';
import { crear_indices_colecciones_nuevas } from './infraestructura/persistencia/modelos/modelos';

const INTERVALO_VERIFICACION_ZONAS_MS = 15 * 60_000;

/**
 * Punto de entrada. Si la configuración o la conexión con MongoDB fallan, el proceso termina
 * con un mensaje claro: nunca arranca con datos simulados.
 */
async function iniciar(): Promise<void> {
  const configuracion = cargar_configuracion();
  const problemas = validar_configuracion(configuracion);
  if (problemas.length > 0) {
    console.error('No se puede iniciar SGRICN. Revisa backend/.env:');
    for (const problema of problemas) console.error(`  - ${problema}`);
    process.exit(1);
  }
  console.log('Configuración:', describir_configuracion_segura(configuracion));
  await conectar_mongodb(configuracion.mongodb_uri, configuracion.mongodb_db);
  console.log(`MongoDB conectado (base "${configuracion.mongodb_db}").`);
  if (configuracion.crear_indices_colecciones_nuevas) {
    await crear_indices_colecciones_nuevas();
    console.log('Índices de colecciones nuevas verificados (las colecciones heredadas no se modifican).');
  }
  if (!configuracion.smtp.host) {
    console.warn('Correo SMTP no configurado: los enlaces de recuperación NO se enviarán (envío no verificado).');
  }

  const contenedor = crear_contenedor(configuracion);
  const aplicacion = crear_aplicacion(contenedor);
  const servidor = aplicacion.listen(configuracion.puerto, () => {
    console.log(`API de SGRICN escuchando en http://localhost:${configuracion.puerto}/api`);
  });

  const verificacion = setInterval(() => {
    contenedor.zonas.verificar_zonas_desatendidas().catch((error: Error) => console.error('[zonas]', error.message));
  }, INTERVALO_VERIFICACION_ZONAS_MS);

  const detener = async () => {
    clearInterval(verificacion);
    servidor.close();
    await desconectar_mongodb();
    process.exit(0);
  };
  process.on('SIGINT', detener);
  process.on('SIGTERM', detener);
}

iniciar().catch((error: Error) => {
  console.error(ocultar_secretos(error.message));
  process.exit(1);
});
