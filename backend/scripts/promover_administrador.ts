/**
 * Procedimiento seguro para crear la PRIMERA cuenta privilegiada (sin contraseñas predeterminadas):
 *   1. La persona se registra normalmente en la aplicación (queda con rol "usuario").
 *   2. Alguien con acceso al servidor y a backend/.env ejecuta:
 *        npm run promover-administrador -- --correo persona@entidad.gov.co --rol administrador --confirmar
 *   3. El cambio queda auditado. A partir de ahí, los roles se gestionan desde "Usuarios y roles".
 * Sin --confirmar sólo muestra lo que haría.
 */
import { ModeloAuditoria, ModeloUsuario } from '../src/infraestructura/persistencia/modelos/modelos';
import { conectar_para_script, ejecutar_script, leer_argumentos } from './utilidades_script';

ejecutar_script(async () => {
  const argumentos = leer_argumentos();
  const correo = typeof argumentos.correo === 'string' ? argumentos.correo.trim().toLowerCase() : '';
  const rol = typeof argumentos.rol === 'string' ? argumentos.rol : 'administrador';
  if (!correo) throw new Error('Indica --correo de una cuenta ya registrada.');
  if (!['administrador', 'funcionario'].includes(rol)) throw new Error('--rol debe ser "administrador" o "funcionario".');
  await conectar_para_script(typeof argumentos.base === 'string' ? argumentos.base : undefined);
  const cuenta = await ModeloUsuario.findOne({ correo }).collation({ locale: 'es', strength: 2 }).lean<Record<string, unknown>>();
  if (!cuenta) throw new Error('No existe una cuenta con ese correo. Primero debe registrarse desde la aplicación.');
  console.log(`Cuenta encontrada: ${cuenta.nombre} ${cuenta.apellido} · rol actual "${cuenta.rol}" · estado "${cuenta.estado}".`);
  if (argumentos.confirmar !== true) {
    console.log(`Simulación: se cambiaría el rol a "${rol}" y el estado a "activo". Repite con --confirmar para aplicarlo.`);
    return;
  }
  await ModeloUsuario.updateOne({ _id: cuenta._id }, { $set: { rol, estado: 'activo' } });
  await ModeloAuditoria.create({
    accion: 'promover_cuenta_por_script',
    entidad: 'usuarios',
    entidadId: cuenta._id,
    usuarioNombre: 'script promover_administrador',
    detalle: { rol_anterior: cuenta.rol, rol_nuevo: rol },
    fecha: new Date(),
  });
  console.log(`Listo: la cuenta ahora tiene rol "${rol}". El cambio quedó registrado en Auditoria.`);
});
