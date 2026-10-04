import type { RespuestaApi } from '../tipos/api';

/**
 * Cliente HTTP único de la aplicación. Los componentes NUNCA llaman a fetch directamente.
 * - Envía la cookie de sesión (credentials) y el token CSRF en solicitudes que modifican datos.
 * - Marca las consultas automáticas (sondeos, alertas) para que no cuenten como actividad (RNF12).
 * - Convierte las respuestas de error en ErrorApi con mensaje en español y errores por campo.
 */
export class ErrorApi extends Error {
  readonly estado: number;
  readonly codigo: string;
  readonly errores: Record<string, string>;

  constructor(estado: number, codigo: string, mensaje: string, errores: Record<string, string> = {}) {
    super(mensaje);
    this.name = 'ErrorApi';
    this.estado = estado;
    this.codigo = codigo;
    this.errores = errores;
  }
}

const BASE_API = '/api';
let token_csrf = '';
const oyentes_sesion_expirada = new Set<(codigo: string) => void>();

export function establecer_token_csrf(token: string): void {
  token_csrf = token;
}

/** Se notifica cuando el servidor indica que la sesión expiró o ya no es válida. */
export function al_expirar_sesion(oyente: (codigo: string) => void): () => void {
  oyentes_sesion_expirada.add(oyente);
  return () => oyentes_sesion_expirada.delete(oyente);
}

export async function obtener_token_csrf(): Promise<string> {
  const respuesta = await fetch(`${BASE_API}/auth/csrf`, { credentials: 'same-origin' });
  const cuerpo = (await respuesta.json()) as RespuestaApi<{ token_csrf: string }>;
  token_csrf = cuerpo.datos.token_csrf;
  return token_csrf;
}

export interface OpcionesSolicitud {
  metodo?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  cuerpo?: unknown;
  parametros?: Record<string, string | number | boolean | undefined | null>;
  /** Consulta automática: no renueva el tiempo de inactividad. */
  automatica?: boolean;
  formulario?: FormData;
  /** Evita notificar la expiración (p. ej. al consultar la sesión al cargar la aplicación). */
  silenciar_expiracion?: boolean;
}

export function construir_url(ruta: string, parametros?: OpcionesSolicitud['parametros']): string {
  const busqueda = new URLSearchParams();
  for (const [clave, valor] of Object.entries(parametros ?? {})) {
    if (valor !== undefined && valor !== null && valor !== '') busqueda.set(clave, String(valor));
  }
  const texto = busqueda.toString();
  return `${BASE_API}${ruta}${texto ? `?${texto}` : ''}`;
}

async function ejecutar(ruta: string, opciones: OpcionesSolicitud, es_reintento = false): Promise<Response> {
  const metodo = opciones.metodo ?? 'GET';
  const cabeceras: Record<string, string> = {};
  if (metodo !== 'GET') {
    if (!token_csrf) await obtener_token_csrf();
    cabeceras['X-CSRF-Token'] = token_csrf;
  }
  if (opciones.automatica) cabeceras['X-Solicitud-Automatica'] = '1';
  let cuerpo: BodyInit | undefined;
  if (opciones.formulario) cuerpo = opciones.formulario;
  else if (opciones.cuerpo !== undefined) {
    cabeceras['Content-Type'] = 'application/json';
    cuerpo = JSON.stringify(opciones.cuerpo);
  }
  let respuesta: Response;
  try {
    respuesta = await fetch(construir_url(ruta, opciones.parametros), { method: metodo, headers: cabeceras, body: cuerpo, credentials: 'same-origin' });
  } catch {
    throw new ErrorApi(0, 'SIN_CONEXION', 'No hay conexión con el servidor. Revisa tu red e inténtalo de nuevo.');
  }
  // Si el token CSRF cambió (por ejemplo, tras iniciar sesión en otra pestaña), se renueva una vez.
  if (respuesta.status === 403 && !es_reintento && metodo !== 'GET') {
    const copia = respuesta.clone();
    const cuerpo_error = (await copia.json().catch(() => ({}))) as { codigo?: string };
    if (cuerpo_error.codigo === 'CSRF_INVALIDO') {
      await obtener_token_csrf();
      return ejecutar(ruta, opciones, true);
    }
  }
  return respuesta;
}

async function convertir_error(respuesta: Response, opciones: OpcionesSolicitud): Promise<ErrorApi> {
  const cuerpo = (await respuesta.json().catch(() => ({}))) as Partial<RespuestaApi<unknown>>;
  const codigo = cuerpo.codigo ?? 'ERROR';
  if (respuesta.status === 401 && !opciones.silenciar_expiracion) {
    for (const oyente of oyentes_sesion_expirada) oyente(codigo);
  }
  const mensaje =
    cuerpo.mensaje ??
    (respuesta.status === 403
      ? 'No tienes permisos para realizar esta acción.'
      : respuesta.status >= 500
        ? 'El servidor no pudo completar la solicitud. Intenta de nuevo.'
        : 'No fue posible completar la solicitud.');
  return new ErrorApi(respuesta.status, codigo, mensaje, cuerpo.errores ?? {});
}

/** Solicitud que devuelve la respuesta completa (datos, mensaje y paginación). */
export async function solicitar<T>(ruta: string, opciones: OpcionesSolicitud = {}): Promise<RespuestaApi<T>> {
  const respuesta = await ejecutar(ruta, opciones);
  if (!respuesta.ok) throw await convertir_error(respuesta, opciones);
  return (await respuesta.json()) as RespuestaApi<T>;
}

/** Descarga binaria (PDF, evidencias) respetando la sesión y los permisos. */
export async function descargar(ruta: string, parametros?: OpcionesSolicitud['parametros']): Promise<{ contenido: Blob; nombre: string; filas: number | null }> {
  const opciones: OpcionesSolicitud = { parametros };
  const respuesta = await ejecutar(ruta, opciones);
  if (!respuesta.ok) throw await convertir_error(respuesta, opciones);
  const disposicion = respuesta.headers.get('Content-Disposition') ?? '';
  const nombre = decodeURIComponent(disposicion.match(/filename="?([^";]+)"?/)?.[1] ?? 'archivo');
  const filas = respuesta.headers.get('X-Total-Filas');
  return { contenido: await respuesta.blob(), nombre, filas: filas ? Number(filas) : null };
}
