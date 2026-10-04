import mongoose from 'mongoose';
import { hash_token } from '../src/aplicacion/servicios/ServicioAutenticacion';
import { ModeloTokenRecuperacion, ModeloUsuario } from '../src/infraestructura/persistencia/modelos/modelos';
import { COLECCIONES_NUEVAS } from '../src/infraestructura/persistencia/nombres_colecciones';
import {
  ClientePrueba,
  CONTRASENA_PRUEBA,
  cerrar_entorno,
  cliente_con_rol,
  crear_cuenta,
  preparar_entorno,
  type EntornoPrueba,
} from './entorno_pruebas';

let entorno: EntornoPrueba;
beforeAll(async () => {
  entorno = await preparar_entorno();
});
afterAll(cerrar_entorno);

const REGISTRO = {
  nombre: 'Natalia',
  apellido: 'Iriarte',
  correo: '  Natalia.Prueba@Ejemplo.COM ',
  telefono: '3001112233',
  password: 'Clave segura 2026',
  confirmacion_password: 'Clave segura 2026',
};

describe('RF1 · Registro', () => {
  it('crea la cuenta con rol "usuario", estado "activo", correo normalizado y sólo el hash bcrypt', async () => {
    const cliente = new ClientePrueba(entorno.aplicacion);
    await cliente.preparar_csrf();
    const respuesta = await cliente.post('/api/auth/registro', REGISTRO);
    expect(respuesta.status).toBe(201);
    expect(respuesta.body.datos.usuario.rol).toBe('usuario');
    expect(JSON.stringify(respuesta.body)).not.toMatch(/password|\$2[aby]\$/);
    const documento = await ModeloUsuario.findOne({ correo: 'natalia.prueba@ejemplo.com' }).lean<Record<string, unknown>>();
    expect(documento?.rol).toBe('usuario');
    expect(documento?.estado).toBe('activo');
    expect(String(documento?.password)).toMatch(/^\$2[aby]\$\d{2}\$/);
    expect(String(documento?.password)).not.toContain('Clave segura');
  });

  it('rechaza el correo duplicado aunque cambien mayúsculas', async () => {
    const cliente = new ClientePrueba(entorno.aplicacion);
    await cliente.preparar_csrf();
    const respuesta = await cliente.post('/api/auth/registro', { ...REGISTRO, correo: 'NATALIA.prueba@ejemplo.com' });
    expect(respuesta.status).toBe(409);
  });

  it('rechaza intentos de asignar un rol privilegiado o un estado', async () => {
    const cliente = new ClientePrueba(entorno.aplicacion);
    await cliente.preparar_csrf();
    const con_rol = await cliente.post('/api/auth/registro', { ...REGISTRO, correo: 'escalada@ejemplo.com', rol: 'administrador' });
    expect(con_rol.status).toBe(400);
    expect(con_rol.body.errores.rol).toBeDefined();
    const con_estado = await cliente.post('/api/auth/registro', { ...REGISTRO, correo: 'escalada2@ejemplo.com', estado: 'activo' });
    expect(con_estado.status).toBe(400);
    expect(await ModeloUsuario.countDocuments({ correo: /escalada/ })).toBe(0);
  });

  it('valida campos en el backend (correo, contraseña y confirmación)', async () => {
    const cliente = new ClientePrueba(entorno.aplicacion);
    await cliente.preparar_csrf();
    const respuesta = await cliente.post('/api/auth/registro', { ...REGISTRO, correo: 'no-es-correo', password: 'corta', confirmacion_password: 'x' });
    expect(respuesta.status).toBe(400);
    expect(Object.keys(respuesta.body.errores)).toEqual(expect.arrayContaining(['correo', 'password', 'confirmacion_password']));
  });

  it('exige el token CSRF en solicitudes que modifican datos', async () => {
    const cliente = new ClientePrueba(entorno.aplicacion);
    const respuesta = await cliente.agente.post('/api/auth/registro').send({ ...REGISTRO, correo: 'sin.csrf@ejemplo.com' });
    expect(respuesta.status).toBe(403);
    expect(respuesta.body.codigo).toBe('CSRF_INVALIDO');
  });
});

describe('RF2 · Inicio y cierre de sesión', () => {
  it('inicia sesión con cookie HttpOnly, actualiza ultimaSesion y permite consultar la sesión', async () => {
    const cliente = new ClientePrueba(entorno.aplicacion);
    const respuesta = await cliente.iniciar_sesion('natalia.prueba@ejemplo.com', REGISTRO.password);
    expect(respuesta.status).toBe(200);
    const cookie = String(respuesta.headers['set-cookie']);
    expect(cookie).toMatch(/sgricn\.sid=/);
    expect(cookie).toMatch(/HttpOnly/i);
    const documento = await ModeloUsuario.findOne({ correo: 'natalia.prueba@ejemplo.com' }).lean<Record<string, unknown>>();
    expect(documento?.ultimaSesion).toBeInstanceOf(Date);
    const sesion = await cliente.get('/api/auth/sesion');
    expect(sesion.status).toBe(200);
    expect(sesion.body.datos.usuario.correo).toBe('natalia.prueba@ejemplo.com');
    const cierre = await cliente.post('/api/auth/cierre-sesion');
    expect(cierre.status).toBe(200);
    expect((await cliente.get('/api/auth/sesion')).status).toBe(401);
  });

  it('responde 401 con credenciales incorrectas y sin revelar si el correo existe', async () => {
    const cliente = new ClientePrueba(entorno.aplicacion);
    const malo = await cliente.iniciar_sesion('natalia.prueba@ejemplo.com', 'otra clave 1');
    const inexistente = await cliente.iniciar_sesion('nadie@ejemplo.com', 'otra clave 1');
    expect(malo.status).toBe(401);
    expect(inexistente.status).toBe(401);
    expect(malo.body.mensaje).toBe(inexistente.body.mensaje);
  });

  it('bloquea el inicio de sesión de cuentas inactivas', async () => {
    const cuenta = await crear_cuenta('usuario', undefined, 'inactivo');
    const respuesta = await new ClientePrueba(entorno.aplicacion).iniciar_sesion(cuenta.correo, CONTRASENA_PRUEBA);
    expect(respuesta.status).toBe(403);
  });

  it('acepta hashes bcrypt existentes con prefijo $2a$ (compatibilidad)', async () => {
    const bcrypt = await import('bcrypt');
    const hash_2a = (await bcrypt.hash('Heredada 2026', 4)).replace(/^\$2b\$/, '$2a$');
    await ModeloUsuario.create({ nombre: 'Heredado', apellido: 'X', correo: 'heredado@ejemplo.com', password: hash_2a, rol: 'usuario', estado: 'activo' });
    const respuesta = await new ClientePrueba(entorno.aplicacion).iniciar_sesion('heredado@ejemplo.com', 'Heredada 2026');
    expect(respuesta.status).toBe(200);
  });

  it('cierra la sesión por inactividad (RNF12) y las consultas automáticas no la renuevan', async () => {
    const { cliente, id } = await cliente_con_rol(entorno.aplicacion, 'usuario');
    expect((await cliente.get('/api/emergencias').set('X-Solicitud-Automatica', '1')).status).toBe(200);
    // Se simula que la última acción del usuario ocurrió hace 6 minutos.
    await mongoose.connection
      .collection(COLECCIONES_NUEVAS.sesiones)
      .updateMany({ 'session.usuario_id': id }, { $set: { 'session.ultima_actividad': Date.now() - 6 * 60_000 } });
    const respuesta = await cliente.get('/api/emergencias').set('X-Solicitud-Automatica', '1');
    expect(respuesta.status).toBe(401);
    expect(respuesta.body.codigo).toBe('SESION_EXPIRADA');
  });

  it('aplica de inmediato el cambio de rol y la desactivación sobre sesiones vigentes', async () => {
    const administrador = await cliente_con_rol(entorno.aplicacion, 'administrador');
    const afectado = await cliente_con_rol(entorno.aplicacion, 'funcionario');
    expect((await afectado.cliente.get('/api/usuarios')).status).toBe(200);
    const cambio = await administrador.cliente.patch(`/api/usuarios/${afectado.id}/rol`, { rol: 'usuario' });
    expect(cambio.status).toBe(200);
    expect((await afectado.cliente.get('/api/usuarios')).status).toBe(403);
    const desactivacion = await administrador.cliente.patch(`/api/usuarios/${afectado.id}/estado`, { estado: 'inactivo' });
    expect(desactivacion.status).toBe(200);
    expect((await afectado.cliente.get('/api/emergencias')).status).toBe(401);
  });
});

describe('RF3 · Recuperación de contraseña', () => {
  const extraer_token = () => {
    const ultimo = entorno.correo.mensajes.at(-1);
    const coincidencia = ultimo?.texto.match(/token=([A-Za-z0-9_%-]+)/);
    return coincidencia ? decodeURIComponent(coincidencia[1]) : '';
  };

  it('responde de forma genérica exista o no la cuenta y sólo guarda el hash del token', async () => {
    const cliente = new ClientePrueba(entorno.aplicacion);
    await cliente.preparar_csrf();
    const enviados_antes = entorno.correo.mensajes.length;
    const existente = await cliente.post('/api/auth/recuperar-contrasena', { correo: 'natalia.prueba@ejemplo.com' });
    const inexistente = await cliente.post('/api/auth/recuperar-contrasena', { correo: 'nadie@ejemplo.com' });
    expect(existente.status).toBe(200);
    expect(existente.body.mensaje).toBe(inexistente.body.mensaje);
    expect(JSON.stringify(existente.body)).not.toMatch(/token/i);
    expect(entorno.correo.mensajes.length).toBe(enviados_antes + 1);
    const token = extraer_token();
    const guardado = await ModeloTokenRecuperacion.findOne({ tokenHash: hash_token(token) }).lean<Record<string, unknown>>();
    expect(guardado).not.toBeNull();
    expect(JSON.stringify(guardado)).not.toContain(token);
    expect(entorno.correo.mensajes.at(-1)?.texto).not.toMatch(/Clave segura/);
  });

  it('restablece con token válido, invalida sesiones anteriores y no permite reutilizarlo', async () => {
    const sesion_previa = new ClientePrueba(entorno.aplicacion);
    expect((await sesion_previa.iniciar_sesion('natalia.prueba@ejemplo.com', REGISTRO.password)).status).toBe(200);
    const cliente = new ClientePrueba(entorno.aplicacion);
    await cliente.preparar_csrf();
    await cliente.post('/api/auth/recuperar-contrasena', { correo: 'natalia.prueba@ejemplo.com' });
    const token = extraer_token();
    const nueva = 'Nueva clave 2026';
    const primera = await cliente.post('/api/auth/restablecer-contrasena', { token, password: nueva, confirmacion_password: nueva });
    expect(primera.status).toBe(200);
    expect((await sesion_previa.get('/api/auth/sesion')).status).toBe(401);
    const reutilizado = await cliente.post('/api/auth/restablecer-contrasena', { token, password: 'Otra clave 2026', confirmacion_password: 'Otra clave 2026' });
    expect(reutilizado.status).toBe(400);
    expect((await new ClientePrueba(entorno.aplicacion).iniciar_sesion('natalia.prueba@ejemplo.com', nueva)).status).toBe(200);
  });

  it('rechaza un token vencido', async () => {
    const cliente = new ClientePrueba(entorno.aplicacion);
    await cliente.preparar_csrf();
    await cliente.post('/api/auth/recuperar-contrasena', { correo: 'natalia.prueba@ejemplo.com' });
    const token = extraer_token();
    await ModeloTokenRecuperacion.updateOne({ tokenHash: hash_token(token) }, { $set: { venceEn: new Date(Date.now() - 1000) } });
    const respuesta = await cliente.post('/api/auth/restablecer-contrasena', { token, password: 'Vencida 2026x', confirmacion_password: 'Vencida 2026x' });
    expect(respuesta.status).toBe(400);
  });
});
