import { normalizar_texto_comparacion } from '../validacion/validador';

/**
 * Regla funcional de SGRICN (no es una definición científica universal):
 * una emergencia de tipo terremoto sólo puede registrarse con magnitud >= 5.0.
 */
export const MAGNITUD_MINIMA_TERREMOTO = 5.0;
export const MAGNITUD_MAXIMA_REGISTRABLE = 10.0;
export const MENSAJE_MAGNITUD_TERREMOTO =
  'Para registrar una emergencia de terremoto, la magnitud debe ser mayor o igual a 5.0.';

/** "Terremoto" y su sinónimo "Sismo" (usado en el mockup) se tratan igual, sin importar tildes o mayúsculas. */
const TIPOS_SISMICOS = ['terremoto', 'sismo'];

export function es_tipo_terremoto(tipo: unknown): boolean {
  return typeof tipo === 'string' && TIPOS_SISMICOS.includes(normalizar_texto_comparacion(tipo));
}

/**
 * Valida la magnitud de un terremoto. Rechaza vacíos, textos no numéricos, NaN, Infinity
 * y valores inferiores a 5.0. Devuelve null si es válida o el mensaje de error.
 */
export function validar_magnitud_terremoto(magnitud: unknown): string | null {
  if (magnitud === null || magnitud === undefined) return MENSAJE_MAGNITUD_TERREMOTO;
  if (typeof magnitud === 'string' && magnitud.trim() === '') return MENSAJE_MAGNITUD_TERREMOTO;
  if (typeof magnitud !== 'number' && typeof magnitud !== 'string') return MENSAJE_MAGNITUD_TERREMOTO;
  const valor = typeof magnitud === 'number' ? magnitud : Number(magnitud.trim().replace(',', '.'));
  if (!Number.isFinite(valor)) return MENSAJE_MAGNITUD_TERREMOTO;
  if (valor < MAGNITUD_MINIMA_TERREMOTO) return MENSAJE_MAGNITUD_TERREMOTO;
  if (valor > MAGNITUD_MAXIMA_REGISTRABLE) return `La magnitud no puede superar ${MAGNITUD_MAXIMA_REGISTRABLE.toFixed(1)}.`;
  return null;
}
