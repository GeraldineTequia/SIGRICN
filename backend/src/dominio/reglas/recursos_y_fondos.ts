import type { DisponibilidadRecurso } from './catalogos';

/**
 * Disponibilidad de un recurso material (RF20, RF21):
 * agotado si no quedan existencias; insuficiente si está por debajo del mínimo operativo.
 */
export function calcular_disponibilidad(cantidad_disponible: number, cantidad_minima: number | null | undefined): DisponibilidadRecurso {
  if (cantidad_disponible <= 0) return 'agotado';
  if (typeof cantidad_minima === 'number' && cantidad_disponible < cantidad_minima) return 'insuficiente';
  return 'disponible';
}

/**
 * Saldo de un fondo (RF19). Montos en pesos colombianos ENTEROS (COP no usa centavos en la práctica;
 * los valores con decimales se rechazan, por lo que no hay redondeo).
 *   saldo disponible = monto asignado − compromisos vigentes − gastos ejecutados
 * Cuando un compromiso se convierte en gasto, el monto sale de "comprometido" y entra en "gastado"
 * en la misma operación: nunca se descuenta dos veces.
 */
export function calcular_saldo_fondo(monto_asignado: number, monto_comprometido: number, monto_gastado: number): number {
  return monto_asignado - monto_comprometido - monto_gastado;
}

/** Transiciones de estado de donaciones: registro administrativo, nunca confirmación automática. */
export const TRANSICIONES_DONACION: Record<string, readonly string[]> = {
  registrada: ['en_verificacion', 'anulada'],
  en_verificacion: ['confirmada', 'rechazada', 'anulada'],
  confirmada: ['anulada'],
  rechazada: [],
  anulada: [],
};

export const TRANSICIONES_REPORTE_CIUDADANO: Record<string, readonly string[]> = {
  pendiente: ['en_revision', 'descartado'],
  en_revision: ['verificado', 'descartado'],
  verificado: [],
  descartado: ['en_revision'],
};
