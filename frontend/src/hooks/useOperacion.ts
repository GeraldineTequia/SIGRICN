import { useCallback, useState } from 'react';
import { useAvisos } from '../contextos/ContextoAvisos';
import { useTiempoReal } from '../contextos/ContextoTiempoReal';
import { ErrorApi } from '../servicios/cliente_api';

/**
 * Ejecuta una operación que modifica datos y centraliza su retroalimentación:
 * - El aviso de éxito se muestra SÓLO después de la respuesta del backend.
 * - Los errores por campo se devuelven para mostrarlos junto a cada campo.
 * - Tras el éxito, se notifica el cambio para refrescar listados e indicadores.
 */
export function useOperacion() {
  const { mostrar_aviso } = useAvisos();
  const { notificar_cambio } = useTiempoReal();
  const [en_proceso, establecer_en_proceso] = useState(false);
  const [errores_campos, establecer_errores] = useState<Record<string, string>>({});

  const ejecutar = useCallback(
    async <T,>(operacion: () => Promise<T>, opciones: { entidades?: string[]; mensaje_exito?: (resultado: T) => string; titulo_error?: string } = {}): Promise<T | null> => {
      establecer_en_proceso(true);
      establecer_errores({});
      try {
        const resultado = await operacion();
        for (const entidad of opciones.entidades ?? []) notificar_cambio(entidad);
        const mensaje = opciones.mensaje_exito?.(resultado);
        if (mensaje) mostrar_aviso({ tipo: 'exito', titulo: mensaje });
        return resultado;
      } catch (causa) {
        if (causa instanceof ErrorApi) {
          establecer_errores(causa.errores);
          // 401 ya lo gestiona la sesión (aviso de expiración); aquí se informan los demás errores.
          if (causa.estado !== 401) {
            mostrar_aviso({
              tipo: causa.estado === 409 || causa.estado === 400 ? 'advertencia' : 'error',
              titulo: opciones.titulo_error ?? (causa.estado === 403 ? 'Permiso no autorizado' : 'No se pudo completar la operación'),
              mensaje: causa.message,
              persistente: causa.estado >= 500 || causa.estado === 0 || causa.estado === 403,
            });
          }
        } else {
          mostrar_aviso({ tipo: 'error', titulo: 'Error inesperado', mensaje: 'Intenta de nuevo en unos segundos.' });
        }
        return null;
      } finally {
        establecer_en_proceso(false);
      }
    },
    [mostrar_aviso, notificar_cambio],
  );

  return { ejecutar, en_proceso, errores_campos, establecer_errores };
}
