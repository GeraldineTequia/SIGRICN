import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import mongoose from 'mongoose';
import request from 'supertest';
import type { Express } from 'express';
import { crear_aplicacion } from '../src/aplicacion_express';
import { crear_contenedor, type Contenedor } from '../src/composicion/contenedor';
import { cargar_configuracion } from '../src/configuracion/entorno';
import type { CoincidenciaGeocodificacion, IGeocodificador, ParametrosGeocodificacion } from '../src/dominio/contratos/servicios_externos';
import { ErrorAplicacion } from '../src/dominio/errores';
import type { Rol } from '../src/dominio/reglas/catalogos';
import { ServicioCorreoMemoria } from '../src/infraestructura/correo/ServicioCorreoSmtp';
import { crear_indices_colecciones_nuevas, ModeloUsuario } from '../src/infraestructura/persistencia/modelos/modelos';
import { HashBcrypt } from '../src/infraestructura/seguridad/HashBcrypt';

process.env.NODE_ENV = 'test';

/** Geocodificador simulado SÓLO para pruebas automáticas (no se usa en ejecución normal). */
export class GeocodificadorPrueba implements IGeocodificador {
  debe_fallar = false;
  resultados: CoincidenciaGeocodificacion[] = [];
  consultas: ParametrosGeocodificacion[] = [];

  async buscar(parametros: ParametrosGeocodificacion): Promise<CoincidenciaGeocodificacion[]> {
    this.consultas.push(parametros);
    if (this.debe_fallar) throw new ErrorAplicacion('SERVICIO_EXTERNO', 'El servicio de geocodificación no está disponible en este momento.');
    return this.resultados;
  }

  async buscar_inversa(): Promise<string | null> {
    return this.debe_fallar ? null : 'Punto de prueba';
  }
}

export interface EntornoPrueba {
  aplicacion: Express;
  contenedor: Contenedor;
  correo: ServicioCorreoMemoria;
  geocodificador: GeocodificadorPrueba;
}

/**
 * Prepara la base AISLADA de pruebas. Por seguridad se niega a ejecutarse si el nombre de la
 * base no termina en "_pruebas": así es imposible borrar la base real SGRICN por error.
 */
export async function preparar_entorno(): Promise<EntornoPrueba> {
  const uri = process.env.MONGODB_URI_PRUEBAS ?? 'mongodb://127.0.0.1:27017';
  const base = process.env.MONGODB_DB_PRUEBAS ?? 'SGRICN_pruebas';
  if (!base.endsWith('_pruebas')) throw new Error(`Base de pruebas no permitida: ${base}`);
  const configuracion = cargar_configuracion({
    es_prueba: true,
    es_produccion: false,
    mongodb_uri: uri,
    mongodb_db: base,
    secreto_sesion: crypto.randomBytes(32).toString('hex'),
    clave_cifrado_datos: crypto.randomBytes(32).toString('base64'),
    url_frontend: 'http://localhost:5173',
    sesion_inactividad_ms: 5 * 60_000,
    directorio_evidencias: path.join(os.tmpdir(), 'sgricn_evidencias_pruebas'),
  });
  if (mongoose.connection.readyState !== 1) await mongoose.connect(uri, { dbName: base });
  await mongoose.connection.dropDatabase();
  await crear_indices_colecciones_nuevas();
  const correo = new ServicioCorreoMemoria();
  const geocodificador = new GeocodificadorPrueba();
  const contenedor = crear_contenedor(configuracion, { correo, geocodificador });
  return { aplicacion: crear_aplicacion(contenedor), contenedor, correo, geocodificador };
}

export async function cerrar_entorno(): Promise<void> {
  await mongoose.disconnect();
}

/** Agente HTTP con cookie de sesión y token CSRF, como lo usa el frontend. */
export class ClientePrueba {
  readonly agente: ReturnType<typeof request.agent>;
  token_csrf = '';

  constructor(aplicacion: Express) {
    this.agente = request.agent(aplicacion);
  }

  async preparar_csrf(): Promise<void> {
    const respuesta = await this.agente.get('/api/auth/csrf');
    this.token_csrf = respuesta.body.datos.token_csrf;
  }

  get(ruta: string) {
    return this.agente.get(ruta);
  }
  post(ruta: string, cuerpo?: object) {
    return this.agente.post(ruta).set('X-CSRF-Token', this.token_csrf).send(cuerpo);
  }
  put(ruta: string, cuerpo?: object) {
    return this.agente.put(ruta).set('X-CSRF-Token', this.token_csrf).send(cuerpo);
  }
  patch(ruta: string, cuerpo?: object) {
    return this.agente.patch(ruta).set('X-CSRF-Token', this.token_csrf).send(cuerpo);
  }
  delete(ruta: string) {
    return this.agente.delete(ruta).set('X-CSRF-Token', this.token_csrf);
  }

  async iniciar_sesion(correo: string, password: string) {
    await this.preparar_csrf();
    const respuesta = await this.post('/api/auth/inicio-sesion', { correo, password });
    if (respuesta.status === 200) this.token_csrf = respuesta.body.datos.token_csrf;
    return respuesta;
  }
}

export const CONTRASENA_PRUEBA = 'Clave segura 2026';

/**
 * Crea una cuenta con el rol indicado DIRECTAMENTE en la base de pruebas.
 * (En la aplicación real las cuentas privilegiadas se crean con scripts/promover_administrador.ts.)
 */
export async function crear_cuenta(rol: Rol, correo = `${rol}.${crypto.randomUUID().slice(0, 8)}@prueba.test`, estado = 'activo') {
  const hash = await new HashBcrypt(4).generar(CONTRASENA_PRUEBA);
  const documento = await ModeloUsuario.create({
    nombre: rol === 'usuario' ? 'Usuaria' : rol === 'funcionario' ? 'Laura' : 'Jesber',
    apellido: 'Prueba',
    correo,
    password: hash,
    rol,
    estado,
    telefono: '3001234567',
    fechaRegistro: new Date(),
  });
  return { id: String(documento._id), correo };
}

export async function cliente_con_rol(aplicacion: Express, rol: Rol): Promise<{ cliente: ClientePrueba; id: string; correo: string }> {
  const cuenta = await crear_cuenta(rol);
  const cliente = new ClientePrueba(aplicacion);
  const respuesta = await cliente.iniciar_sesion(cuenta.correo, CONTRASENA_PRUEBA);
  if (respuesta.status !== 200) throw new Error(`No se pudo iniciar sesión como ${rol}: ${JSON.stringify(respuesta.body)}`);
  return { cliente, ...cuenta };
}

export function datos_emergencia(cambios: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    titulo: 'Inundación río Atrato',
    tipo: 'Inundación',
    descripcion: 'Desbordamiento del río por lluvias intensas en el sector norte.',
    fecha_inicio: '2026-09-20T08:00:00.000Z',
    nivel_emergencia: 'alto',
    pais: 'Colombia',
    departamento: 'Chocó',
    municipio: 'Quibdó',
    barrio: 'Bellavista',
    direccion_referencia: 'Carrera 1 con calle 25',
    fuente_informacion: 'Prueba automatizada',
    ...cambios,
  };
}

export function datos_zona(catastrofe_id: string, cambios: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    catastrofe_id,
    pais: 'Colombia',
    departamento: 'Chocó',
    municipio: 'Quibdó',
    barrio: 'Bellavista',
    direccion: 'Calle 25 #3-10',
    nivel_afectacion: 'alto',
    porcentaje_afectacion: 86,
    prioridad: 'alta',
    estado: 'activa',
    descripcion: 'Zona inundada',
    ...cambios,
  };
}
