/**
 * Política de contraseñas: 8 a 72 caracteres (72 bytes es el límite de bcrypt),
 * con al menos una letra y un número.
 */
export const LONGITUD_MINIMA_CONTRASENA = 8;
export const LONGITUD_MAXIMA_CONTRASENA = 72;

export function validar_contrasena(contrasena: unknown, confirmacion?: unknown): Record<string, string> {
  const errores: Record<string, string> = {};
  if (typeof contrasena !== 'string' || contrasena === '') {
    errores.password = 'La contraseña es obligatoria.';
    return errores;
  }
  if (contrasena.length < LONGITUD_MINIMA_CONTRASENA) {
    errores.password = `La contraseña debe tener al menos ${LONGITUD_MINIMA_CONTRASENA} caracteres.`;
  } else if (new TextEncoder().encode(contrasena).length > LONGITUD_MAXIMA_CONTRASENA) {
    errores.password = `La contraseña no puede superar ${LONGITUD_MAXIMA_CONTRASENA} caracteres.`;
  } else if (!/[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(contrasena) || !/[0-9]/.test(contrasena)) {
    errores.password = 'La contraseña debe incluir al menos una letra y un número.';
  }
  if (confirmacion !== undefined && confirmacion !== contrasena) {
    errores.confirmacion_password = 'La confirmación no coincide con la contraseña.';
  }
  return errores;
}
