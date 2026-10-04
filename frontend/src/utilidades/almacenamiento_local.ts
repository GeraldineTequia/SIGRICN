/**
 * Preferencias por navegador (tema, barra lateral, borradores). Se protegen con try/catch porque el
 * almacenamiento puede estar bloqueado (modo privado); la aplicación funciona igual sin él.
 * Nunca se guardan datos sensibles ni de sesión aquí.
 */
export function leer_preferencia<T>(clave: string, predeterminado: T): T {
  try {
    const valor = window.localStorage.getItem(`sgricn:${clave}`);
    return valor === null ? predeterminado : (JSON.parse(valor) as T);
  } catch {
    return predeterminado;
  }
}

export function guardar_preferencia(clave: string, valor: unknown): void {
  try {
    window.localStorage.setItem(`sgricn:${clave}`, JSON.stringify(valor));
  } catch {
    // Sin almacenamiento disponible: la preferencia dura sólo esta sesión.
  }
}

export function borrar_preferencia(clave: string): void {
  try {
    window.localStorage.removeItem(`sgricn:${clave}`);
  } catch {
    // Sin almacenamiento disponible.
  }
}
