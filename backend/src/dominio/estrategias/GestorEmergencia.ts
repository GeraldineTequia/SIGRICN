import { ErrorValidacion } from '../errores';
import { es_tipo_terremoto } from '../reglas/regla_magnitud';
import { EstrategiaGeneral } from './EstrategiaGeneral';
import { EstrategiaInundacion } from './EstrategiaInundacion';
import { EstrategiaTerremoto } from './EstrategiaTerremoto';
import type { ClasificacionEmergencia, DatosReglaEmergencia, IEstrategiaEmergencia } from './IEstrategiaEmergencia';

export interface ResultadoGestionEmergencia {
  datos: DatosReglaEmergencia;
  clasificacion: ClasificacionEmergencia;
  estrategia: string;
}

/**
 * Contexto del patrón Strategy. Selecciona la estrategia según el tipo y la aplica
 * sobre los datos COMPLETOS de la emergencia (en un PATCH se combinan primero los datos
 * guardados con los cambios), de modo que un cambio de tipo o una edición parcial
 * también pasan por la regla de magnitud.
 */
export class GestorEmergencia {
  private readonly _estrategias: IEstrategiaEmergencia[];
  private readonly _estrategia_general: IEstrategiaEmergencia;

  constructor(estrategias?: IEstrategiaEmergencia[]) {
    this._estrategia_general = new EstrategiaGeneral();
    this._estrategias = estrategias ?? [new EstrategiaTerremoto(), new EstrategiaInundacion()];
  }

  seleccionar_estrategia(tipo: string): IEstrategiaEmergencia {
    return this._estrategias.find((estrategia) => estrategia.aplica_a(tipo)) ?? this._estrategia_general;
  }

  /** Prepara, valida y clasifica. Lanza ErrorValidacion con los mensajes por campo. */
  validar_y_preparar(datos: DatosReglaEmergencia): ResultadoGestionEmergencia {
    const estrategia = this.seleccionar_estrategia(datos.tipo);
    const datos_preparados = estrategia.preparar(datos);
    const errores = estrategia.validar(datos_preparados);
    if (Object.keys(errores).length > 0) throw new ErrorValidacion(errores);
    return { datos: datos_preparados, clasificacion: estrategia.clasificar(datos_preparados), estrategia: estrategia.nombre };
  }

  /** Terremotos históricos sin magnitud válida: se muestran como pendientes de validación, sin inventar datos. */
  es_pendiente_validacion(datos: Record<string, unknown>): boolean {
    if (!es_tipo_terremoto(datos.tipo)) return false;
    return typeof datos.magnitud !== 'number' || !Number.isFinite(datos.magnitud);
  }
}
