import type { EstadoEmergencia } from '../reglas/catalogos';

/** Cambios adicionales que un estado aplica al entrar (por ejemplo, fecha_fin al finalizar). */
export interface EfectosEntradaEstado {
  fecha_fin?: string | null;
}

/**
 * Contrato del patrón State. Cada estado conoce a qué estados puede pasar
 * y qué efectos produce al convertirse en el estado vigente.
 */
export interface IEstadoEmergencia {
  readonly nombre: EstadoEmergencia;
  readonly descripcion: string;
  transiciones_permitidas(): readonly EstadoEmergencia[];
  puede_transicionar_a(destino: EstadoEmergencia): boolean;
  al_entrar(fecha_cambio: Date): EfectosEntradaEstado;
}
