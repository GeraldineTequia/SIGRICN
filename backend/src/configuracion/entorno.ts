import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

/**
 * Configuración leída exclusivamente desde variables de entorno.
 * Nunca se imprime la URI de MongoDB ni otros secretos: usa describir_configuracion_segura().
 */
export interface ConfiguracionEntorno {
  es_produccion: boolean;
  es_prueba: boolean;
  puerto: number;
  mongodb_uri: string;
  mongodb_db: string;
  cors_origenes: string[];
  url_frontend: string;
  secreto_sesion: string;
  sesion_duracion_maxima_ms: number;
  sesion_inactividad_ms: number;
  clave_cifrado_datos: string;
  smtp: { host: string; puerto: number; seguro: boolean; usuario: string; contrasena: string; remitente: string };
  geocodificacion: { url: string; correo_contacto: string; intervalo_ms: number };
  directorio_evidencias: string;
  evidencia_tamano_maximo_bytes: number;
  directorio_respaldos: string;
  respaldo_retencion_dias: number;
  crear_indices_colecciones_nuevas: boolean;
  servir_frontend: boolean;
}

function leer_texto(nombre: string, predeterminado = ''): string {
  return (process.env[nombre] ?? predeterminado).trim();
}

function leer_numero(nombre: string, predeterminado: number): number {
  const valor = Number(process.env[nombre]);
  return Number.isFinite(valor) && valor > 0 ? valor : predeterminado;
}

export function cargar_configuracion(sobrescrituras: Partial<ConfiguracionEntorno> = {}): ConfiguracionEntorno {
  const raiz_backend = path.resolve(__dirname, '../..');
  const configuracion: ConfiguracionEntorno = {
    es_produccion: process.env.NODE_ENV === 'production',
    es_prueba: process.env.NODE_ENV === 'test',
    puerto: leer_numero('PUERTO', 5000),
    mongodb_uri: leer_texto('MONGODB_URI'),
    mongodb_db: leer_texto('MONGODB_DB', 'SGRICN'),
    cors_origenes: leer_texto('CORS_ORIGENES', 'http://localhost:5173')
      .split(',')
      .map((origen) => origen.trim())
      .filter(Boolean),
    url_frontend: leer_texto('URL_FRONTEND', 'http://localhost:5173').replace(/\/$/, ''),
    secreto_sesion: leer_texto('SECRETO_SESION'),
    sesion_duracion_maxima_ms: leer_numero('SESION_DURACION_MAXIMA_MINUTOS', 480) * 60_000,
    sesion_inactividad_ms: leer_numero('SESION_INACTIVIDAD_MINUTOS', 5) * 60_000,
    clave_cifrado_datos: leer_texto('CLAVE_CIFRADO_DATOS'),
    smtp: {
      host: leer_texto('SMTP_HOST'),
      puerto: leer_numero('SMTP_PUERTO', 587),
      seguro: leer_texto('SMTP_SEGURO') === 'true',
      usuario: leer_texto('SMTP_USUARIO'),
      contrasena: leer_texto('SMTP_CONTRASENA'),
      remitente: leer_texto('CORREO_REMITENTE', 'SGRICN <no-responder@example.com>'),
    },
    geocodificacion: {
      url: leer_texto('GEOCODIFICACION_URL', 'https://nominatim.openstreetmap.org').replace(/\/$/, ''),
      correo_contacto: leer_texto('GEOCODIFICACION_CORREO_CONTACTO'),
      intervalo_ms: leer_numero('GEOCODIFICACION_INTERVALO_MS', 1100),
    },
    directorio_evidencias: path.resolve(raiz_backend, leer_texto('DIRECTORIO_EVIDENCIAS', 'almacenamiento/evidencias')),
    evidencia_tamano_maximo_bytes: leer_numero('EVIDENCIA_TAMANO_MAXIMO_MB', 5) * 1024 * 1024,
    directorio_respaldos: path.resolve(raiz_backend, leer_texto('DIRECTORIO_RESPALDOS', 'respaldos')),
    respaldo_retencion_dias: leer_numero('RESPALDO_RETENCION_DIAS', 14),
    crear_indices_colecciones_nuevas: leer_texto('CREAR_INDICES_COLECCIONES_NUEVAS', 'true') !== 'false',
    servir_frontend: leer_texto('SERVIR_FRONTEND') === 'true',
    ...sobrescrituras,
  };
  return configuracion;
}

/** Comprueba que la configuración mínima exista. Devuelve los problemas sin revelar valores. */
export function validar_configuracion(configuracion: ConfiguracionEntorno): string[] {
  const problemas: string[] = [];
  if (!configuracion.mongodb_uri) problemas.push('Falta MONGODB_URI en backend/.env.');
  if (configuracion.mongodb_uri.includes('<CONTRASENA_NUEVA>') || configuracion.mongodb_uri.includes('<')) {
    problemas.push('MONGODB_URI todavía contiene el marcador <CONTRASENA_NUEVA>: escribe la credencial vigente en backend/.env.');
  }
  if (!configuracion.mongodb_db) problemas.push('Falta MONGODB_DB.');
  if (configuracion.secreto_sesion.length < 32) problemas.push('SECRETO_SESION debe tener al menos 32 caracteres.');
  if (Buffer.from(configuracion.clave_cifrado_datos, 'base64').length !== 32) {
    problemas.push('CLAVE_CIFRADO_DATOS debe ser una clave de 32 bytes en base64.');
  }
  return problemas;
}

/** Oculta credenciales en cualquier texto que pudiera llegar a un registro (log). */
export function ocultar_secretos(texto: string): string {
  return texto.replace(/(mongodb(?:\+srv)?:\/\/)([^@/\s]+)@/gi, '$1***:***@');
}

export function describir_configuracion_segura(configuracion: ConfiguracionEntorno): Record<string, unknown> {
  let host: string;
  try {
    host = new URL(configuracion.mongodb_uri.replace('mongodb+srv://', 'https://').replace('mongodb://', 'http://')).hostname;
  } catch {
    host = configuracion.mongodb_uri ? 'URI con formato no reconocido' : 'no configurado';
  }
  return {
    entorno: configuracion.es_produccion ? 'producción' : configuracion.es_prueba ? 'pruebas' : 'desarrollo',
    mongodb_host: host,
    mongodb_base: configuracion.mongodb_db,
    correo_configurado: Boolean(configuracion.smtp.host),
    geocodificacion: configuracion.geocodificacion.url,
  };
}
