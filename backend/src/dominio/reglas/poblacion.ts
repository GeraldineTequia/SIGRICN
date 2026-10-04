import type { GrupoEdad } from './catalogos';

/**
 * Rangos de edad SIN solapamientos. Son una decisión del proyecto SGRICN para la atención
 * humanitaria (no una norma oficial):
 *   niño o niña: 0 a 11 años · adolescente: 12 a 17 · adulto: 18 a 59 · adulto mayor: 60 o más.
 */
export const RANGOS_EDAD: ReadonlyArray<{ grupo: Exclude<GrupoEdad, 'pendiente'>; minimo: number; maximo: number }> = [
  { grupo: 'nino', minimo: 0, maximo: 11 },
  { grupo: 'adolescente', minimo: 12, maximo: 17 },
  { grupo: 'adulto', minimo: 18, maximo: 59 },
  { grupo: 'adulto_mayor', minimo: 60, maximo: 130 },
];

export function calcular_edad(fecha_nacimiento: string, fecha_referencia: Date = new Date()): number | null {
  const nacimiento = new Date(fecha_nacimiento);
  if (Number.isNaN(nacimiento.getTime()) || nacimiento.getTime() > fecha_referencia.getTime()) return null;
  let edad = fecha_referencia.getUTCFullYear() - nacimiento.getUTCFullYear();
  const aun_no_cumple =
    fecha_referencia.getUTCMonth() < nacimiento.getUTCMonth() ||
    (fecha_referencia.getUTCMonth() === nacimiento.getUTCMonth() && fecha_referencia.getUTCDate() < nacimiento.getUTCDate());
  if (aun_no_cumple) edad -= 1;
  return edad;
}

/**
 * Clasificación automática por grupo de edad (RF14). Prioriza la fecha de nacimiento;
 * si no hay edad ni fecha, la clasificación queda "pendiente" (nunca se inventa una edad).
 */
export function clasificar_grupo_edad(edad: number | null | undefined, fecha_nacimiento?: string | null): GrupoEdad {
  const edad_calculada = fecha_nacimiento ? calcular_edad(fecha_nacimiento) : null;
  const edad_final = edad_calculada ?? (typeof edad === 'number' && Number.isInteger(edad) ? edad : null);
  if (edad_final === null || edad_final < 0) return 'pendiente';
  return RANGOS_EDAD.find((rango) => edad_final >= rango.minimo && edad_final <= rango.maximo)?.grupo ?? 'pendiente';
}

export interface EstadisticaPoblacion {
  personas_afectadas: number;
  ninos?: number | null;
  adultos?: number | null;
  adultos_mayores?: number | null;
  [campo: string]: unknown;
}

/** Categorías que se reportan por separado y PUEDEN SOLAPARSE: nunca se suman entre sí. */
export const CATEGORIAS_SOLAPABLES = [
  'personas_discapacidad',
  'personas_heridas',
  'personas_fallecidas',
  'personas_desaparecidas',
  'personas_evacuadas',
  'personas_albergadas',
  'personas_pendientes_atencion',
] as const;

/**
 * Coherencia de una estadística agregada:
 * - Los grupos de edad son excluyentes: su suma no puede superar el total de personas afectadas.
 * - Cada categoría solapable, por separado, no puede superar el total.
 */
export function validar_estadistica_poblacion(datos: EstadisticaPoblacion): Record<string, string> {
  const errores: Record<string, string> = {};
  const total = datos.personas_afectadas;
  const suma_grupos = ['ninos', 'adultos', 'adultos_mayores']
    .map((campo) => datos[campo])
    .reduce<number>((suma, valor) => suma + (typeof valor === 'number' ? valor : 0), 0);
  if (suma_grupos > total) {
    errores.personas_afectadas = `La suma de los grupos de edad (${suma_grupos}) supera el total de personas afectadas (${total}).`;
  }
  for (const campo of CATEGORIAS_SOLAPABLES) {
    const valor = datos[campo];
    if (typeof valor === 'number' && valor > total) {
      errores[campo] = 'No puede superar el total de personas afectadas.';
    }
  }
  if (typeof datos.familias_afectadas === 'number' && datos.familias_afectadas > total) {
    errores.familias_afectadas = 'El número de familias no puede superar el de personas afectadas.';
  }
  return errores;
}
