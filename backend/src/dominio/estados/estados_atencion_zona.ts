import { ErrorAplicacion } from '../errores';
import { ESTADOS_ATENCION_ZONA, obtener_etiqueta, type EstadoAtencionZona } from '../reglas/catalogos';

/**
 * Estados de atención de zonas (RF13). Es un ciclo pequeño, por eso se modela con una tabla
 * de transiciones (sin clases), evitando complejidad innecesaria.
 * Una zona atendida completamente puede reabrirse (volver a "en_atencion") si surge una nueva necesidad.
 */
export const TRANSICIONES_ATENCION_ZONA: Record<EstadoAtencionZona, readonly EstadoAtencionZona[]> = {
  sin_atender: ['en_atencion'],
  en_atencion: ['atendida_parcialmente', 'atendida_completamente'],
  atendida_parcialmente: ['en_atencion', 'atendida_completamente'],
  atendida_completamente: ['en_atencion'],
};

/** Las zonas heredadas sin estado de atención se interpretan como "sin_atender" (sin escribir en la base). */
export function interpretar_estado_atencion(valor: unknown): EstadoAtencionZona {
  return (ESTADOS_ATENCION_ZONA as readonly string[]).includes(String(valor)) ? (valor as EstadoAtencionZona) : 'sin_atender';
}

export function validar_transicion_atencion(actual: unknown, destino: EstadoAtencionZona): EstadoAtencionZona {
  const origen = interpretar_estado_atencion(actual);
  if (!TRANSICIONES_ATENCION_ZONA[origen].includes(destino)) {
    throw new ErrorAplicacion(
      'TRANSICION_INVALIDA',
      `La zona no puede pasar de "${obtener_etiqueta(origen)}" a "${obtener_etiqueta(destino)}". ` +
        `Permitidas: ${TRANSICIONES_ATENCION_ZONA[origen].map(obtener_etiqueta).join(', ')}.`,
    );
  }
  return origen;
}
