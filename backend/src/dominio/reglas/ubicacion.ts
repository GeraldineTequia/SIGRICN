import { normalizar_texto_comparacion, type UbicacionEntrada } from '../validacion/validador';

export interface UbicacionDominio extends UbicacionEntrada {
  confirmada_por?: string | null;
  confirmada_en?: string | null;
}

export const UBICACION_VACIA: UbicacionDominio = {
  estado: 'sin_ubicacion',
  punto: null,
  direccion_consultada: null,
  direccion_encontrada: null,
  origen: null,
  precision: null,
};

function coincide_direccion(direccion_consultada: string | null, direccion_actual: string): boolean {
  if (!direccion_consultada) return false;
  return normalizar_texto_comparacion(direccion_consultada) === normalizar_texto_comparacion(direccion_actual);
}

/**
 * Decide qué ubicación se guarda (sección "Mapa mediante direcciones"):
 * - Una ubicación confirmada sólo es válida para la dirección con la que se buscó. Si la dirección
 *   del registro cambió, la confirmación anterior pasa a "pendiente" (no se conserva en silencio
 *   un marcador que corresponde a otra dirección). El mapa general no dibuja ubicaciones pendientes.
 * - Si no hay punto, el registro queda "sin_ubicacion": nunca se inventa una localización.
 */
export function resolver_ubicacion(
  direccion_actual: string,
  ubicacion_entrante: UbicacionEntrada | null | undefined,
  ubicacion_guardada: UbicacionDominio | null | undefined,
  usuario_id: string,
  fecha: Date,
): UbicacionDominio {
  if (ubicacion_entrante) {
    if (ubicacion_entrante.estado === 'sin_ubicacion' || !ubicacion_entrante.punto) return { ...UBICACION_VACIA };
    if (ubicacion_entrante.estado === 'confirmada') {
      if (!coincide_direccion(ubicacion_entrante.direccion_consultada, direccion_actual)) {
        return { ...ubicacion_entrante, estado: 'pendiente', confirmada_por: null, confirmada_en: null };
      }
      return { ...ubicacion_entrante, confirmada_por: usuario_id, confirmada_en: fecha.toISOString() };
    }
    return { ...ubicacion_entrante, confirmada_por: null, confirmada_en: null };
  }
  const guardada = ubicacion_guardada ?? UBICACION_VACIA;
  if (guardada.estado === 'confirmada' && !coincide_direccion(guardada.direccion_consultada, direccion_actual)) {
    return { ...guardada, estado: 'pendiente' };
  }
  return guardada;
}
