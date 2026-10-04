/**
 * Validador declarativo sin dependencias externas (RNF6).
 * - Sólo acepta los campos declarados en el esquema: cualquier otro campo se rechaza.
 *   Así se evita, por ejemplo, que el registro reciba un campo "rol" o que un PATCH
 *   genérico intente modificar el "estado" de una emergencia.
 * - Devuelve datos limpios (texto recortado, números convertidos, fechas en ISO 8601).
 * - Lo usan el backend (capa de presentación) y el frontend (formularios), con los mismos mensajes.
 */

export type TipoCampo =
  | 'texto'
  | 'entero'
  | 'numero'
  | 'fecha'
  | 'enumeracion'
  | 'lista_enumeracion'
  | 'lista_texto'
  | 'correo'
  | 'telefono'
  | 'booleano'
  | 'identificador'
  | 'url'
  | 'ubicacion';

export interface ReglaCampo {
  tipo: TipoCampo;
  etiqueta: string;
  requerido?: boolean;
  min_longitud?: number;
  max_longitud?: number;
  minimo?: number;
  maximo?: number;
  valores?: readonly string[];
  max_elementos?: number;
}

export type EsquemaValidacion = Record<string, ReglaCampo>;

export interface ResultadoValidacion {
  es_valido: boolean;
  datos: Record<string, unknown>;
  errores: Record<string, string>;
}

export interface OpcionesValidacion {
  /** En actualizaciones parciales (PATCH) los campos requeridos pueden omitirse. */
  parcial?: boolean;
}

const EXPRESION_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const EXPRESION_TELEFONO = /^\+?[0-9\s-]{7,20}$/;
const EXPRESION_IDENTIFICADOR = /^[A-Za-z0-9_-]{1,64}$/;

export function es_objeto_plano(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function es_vacio(valor: unknown): boolean {
  return valor === undefined || valor === null || (typeof valor === 'string' && valor.trim() === '');
}

/** Valida un único valor no vacío. Devuelve el valor normalizado o un mensaje de error. */
function validar_valor(valor: unknown, regla: ReglaCampo): { valor?: unknown; error?: string } {
  const { etiqueta } = regla;
  switch (regla.tipo) {
    case 'texto':
    case 'correo':
    case 'telefono':
    case 'identificador':
    case 'url': {
      if (typeof valor !== 'string' && typeof valor !== 'number') return { error: `${etiqueta} debe ser texto.` };
      let texto = String(valor).trim();
      if (regla.tipo === 'correo') texto = texto.toLowerCase();
      if (regla.min_longitud && texto.length < regla.min_longitud)
        return { error: `${etiqueta} debe tener al menos ${regla.min_longitud} caracteres.` };
      const maximo = regla.max_longitud ?? 500;
      if (texto.length > maximo) return { error: `${etiqueta} admite como máximo ${maximo} caracteres.` };
      if (regla.tipo === 'correo' && !EXPRESION_CORREO.test(texto))
        return { error: `${etiqueta} no es un correo electrónico válido.` };
      if (regla.tipo === 'telefono' && !EXPRESION_TELEFONO.test(texto))
        return { error: `${etiqueta} debe contener entre 7 y 20 dígitos.` };
      if (regla.tipo === 'identificador' && !EXPRESION_IDENTIFICADOR.test(texto))
        return { error: `${etiqueta} no es un identificador válido.` };
      if (regla.tipo === 'url') {
        try {
          const direccion = new URL(texto);
          if (!['http:', 'https:'].includes(direccion.protocol)) throw new Error('protocolo');
        } catch {
          return { error: `${etiqueta} debe ser un enlace http o https válido.` };
        }
      }
      return { valor: texto };
    }
    case 'entero':
    case 'numero': {
      const numero = typeof valor === 'number' ? valor : typeof valor === 'string' ? Number(valor.trim()) : NaN;
      if (!Number.isFinite(numero)) return { error: `${etiqueta} debe ser un número válido.` };
      if (regla.tipo === 'entero' && !Number.isInteger(numero)) return { error: `${etiqueta} debe ser un número entero.` };
      if (regla.minimo !== undefined && numero < regla.minimo)
        return { error: `${etiqueta} debe ser mayor o igual a ${regla.minimo}.` };
      if (regla.maximo !== undefined && numero > regla.maximo)
        return { error: `${etiqueta} debe ser menor o igual a ${regla.maximo}.` };
      return { valor: numero };
    }
    case 'fecha': {
      if (typeof valor !== 'string' && !(valor instanceof Date)) return { error: `${etiqueta} debe ser una fecha.` };
      const fecha = valor instanceof Date ? valor : new Date(valor);
      if (Number.isNaN(fecha.getTime())) return { error: `${etiqueta} no es una fecha válida.` };
      if (fecha.getUTCFullYear() < 1900 || fecha.getUTCFullYear() > 2200)
        return { error: `${etiqueta} está fuera del rango permitido.` };
      return { valor: fecha.toISOString() };
    }
    case 'enumeracion': {
      if (typeof valor !== 'string' || !(regla.valores ?? []).includes(valor))
        return { error: `${etiqueta} tiene un valor no permitido.` };
      return { valor };
    }
    case 'lista_enumeracion':
    case 'lista_texto': {
      if (!Array.isArray(valor)) return { error: `${etiqueta} debe ser una lista.` };
      const maximo_elementos = regla.max_elementos ?? 30;
      if (valor.length > maximo_elementos) return { error: `${etiqueta} admite como máximo ${maximo_elementos} elementos.` };
      const elementos: string[] = [];
      for (const elemento of valor) {
        if (typeof elemento !== 'string' || elemento.trim() === '') return { error: `${etiqueta} contiene un elemento inválido.` };
        const texto = elemento.trim();
        if (regla.tipo === 'lista_enumeracion' && !(regla.valores ?? []).includes(texto))
          return { error: `${etiqueta} contiene un valor no permitido: ${texto}.` };
        if (texto.length > (regla.max_longitud ?? 100)) return { error: `${etiqueta} contiene un elemento demasiado largo.` };
        if (!elementos.includes(texto)) elementos.push(texto);
      }
      return { valor: elementos };
    }
    case 'booleano': {
      if (typeof valor === 'boolean') return { valor };
      if (valor === 'true' || valor === 'false') return { valor: valor === 'true' };
      return { error: `${etiqueta} debe ser verdadero o falso.` };
    }
    case 'ubicacion': {
      const resultado = validar_ubicacion(valor);
      return resultado.error ? { error: resultado.error } : { valor: resultado.valor };
    }
  }
}

export function validar_datos(
  entrada: unknown,
  esquema: EsquemaValidacion,
  opciones: OpcionesValidacion = {},
): ResultadoValidacion {
  const errores: Record<string, string> = {};
  const datos: Record<string, unknown> = {};
  if (!es_objeto_plano(entrada)) {
    return { es_valido: false, datos, errores: { general: 'El cuerpo de la solicitud debe ser un objeto JSON.' } };
  }
  for (const campo of Object.keys(entrada)) {
    if (!(campo in esquema)) errores[campo] = `El campo "${campo}" no está permitido en esta operación.`;
  }
  for (const [campo, regla] of Object.entries(esquema)) {
    const esta_presente = Object.prototype.hasOwnProperty.call(entrada, campo);
    const valor = entrada[campo];
    if (!esta_presente && opciones.parcial) continue;
    if (es_vacio(valor)) {
      if (regla.requerido) errores[campo] = `${regla.etiqueta} es obligatorio.`;
      else if (esta_presente) datos[campo] = regla.tipo.startsWith('lista') ? [] : null;
      continue;
    }
    const resultado = validar_valor(valor, regla);
    if (resultado.error) errores[campo] = resultado.error;
    else datos[campo] = resultado.valor;
  }
  return { es_valido: Object.keys(errores).length === 0, datos, errores };
}

/* ------------------------------------------------------------------ */
/* Ubicación: las coordenadas viajan sólo como dato técnico interno.  */
/* ------------------------------------------------------------------ */

export interface UbicacionEntrada {
  estado: 'sin_ubicacion' | 'pendiente' | 'confirmada';
  punto: { latitud: number; longitud: number } | null;
  direccion_consultada: string | null;
  direccion_encontrada: string | null;
  origen: 'geocodificacion' | 'ajuste_manual' | 'seleccion_en_mapa' | null;
  precision: 'direccion' | 'aproximada' | null;
}

const ORIGENES_UBICACION = ['geocodificacion', 'ajuste_manual', 'seleccion_en_mapa'];

export function validar_ubicacion(valor: unknown): { valor?: UbicacionEntrada; error?: string } {
  if (!es_objeto_plano(valor)) return { error: 'La ubicación tiene un formato inválido.' };
  const permitidos = ['estado', 'punto', 'direccion_consultada', 'direccion_encontrada', 'origen', 'precision'];
  if (Object.keys(valor).some((clave) => !permitidos.includes(clave))) return { error: 'La ubicación contiene campos no permitidos.' };
  const estado = valor.estado;
  if (estado !== 'sin_ubicacion' && estado !== 'pendiente' && estado !== 'confirmada')
    return { error: 'El estado de la ubicación no es válido.' };
  let punto: UbicacionEntrada['punto'] = null;
  if (valor.punto !== undefined && valor.punto !== null) {
    if (!es_objeto_plano(valor.punto)) return { error: 'El punto del mapa no es válido.' };
    const latitud = Number(valor.punto.latitud);
    const longitud = Number(valor.punto.longitud);
    if (!Number.isFinite(latitud) || !Number.isFinite(longitud) || Math.abs(latitud) > 90 || Math.abs(longitud) > 180)
      return { error: 'El punto seleccionado en el mapa no es válido.' };
    punto = { latitud, longitud };
  }
  if (estado === 'confirmada' && !punto) return { error: 'Para confirmar la ubicación selecciona un punto en el mapa.' };
  const texto_opcional = (dato: unknown): string | null =>
    typeof dato === 'string' && dato.trim() !== '' ? dato.trim().slice(0, 300) : null;
  const origen = valor.origen === undefined || valor.origen === null ? null : String(valor.origen);
  if (origen !== null && !ORIGENES_UBICACION.includes(origen)) return { error: 'El origen de la ubicación no es válido.' };
  const precision = valor.precision === 'direccion' || valor.precision === 'aproximada' ? valor.precision : null;
  return {
    valor: {
      estado,
      punto: estado === 'sin_ubicacion' ? null : punto,
      direccion_consultada: texto_opcional(valor.direccion_consultada),
      direccion_encontrada: texto_opcional(valor.direccion_encontrada),
      origen: origen as UbicacionEntrada['origen'],
      precision,
    },
  };
}

/** Compone la dirección completa con la que se geocodifica y se compara si cambió. */
export function componer_direccion(partes: {
  pais?: unknown;
  departamento?: unknown;
  municipio?: unknown;
  barrio?: unknown;
  direccion?: unknown;
}): string {
  return [partes.direccion, partes.barrio, partes.municipio, partes.departamento, partes.pais]
    .map((parte) => (typeof parte === 'string' ? parte.trim() : ''))
    .filter((parte) => parte !== '')
    .join(', ');
}

export function normalizar_texto_comparacion(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
