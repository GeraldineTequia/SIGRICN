import type { NivelEmergencia } from '../reglas/catalogos';

/** Datos de una emergencia sobre los que actúan las estrategias (ya combinados en una edición parcial). */
export interface DatosReglaEmergencia {
  tipo: string;
  nivel_emergencia: string;
  /** Puede llegar como texto desde un formulario o una importación; la estrategia lo normaliza. */
  magnitud?: unknown;
  direccion_referencia?: string | null;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  [campo: string]: unknown;
}

/** Clasificación de apoyo calculada por la estrategia (RF8). No reemplaza el nivel reportado. */
export interface ClasificacionEmergencia {
  nivel_sugerido: NivelEmergencia;
  criterio: string;
}

/**
 * Contrato del patrón Strategy: cada tipo de emergencia aporta sus propias reglas
 * de validación, preparación y clasificación. GestorEmergencia elige la estrategia.
 */
export interface IEstrategiaEmergencia {
  readonly nombre: string;
  /** Indica si la estrategia se encarga del tipo de emergencia recibido. */
  aplica_a(tipo: string): boolean;
  /** Ajusta los datos antes de validarlos (por ejemplo, descarta campos que no aplican al tipo). */
  preparar(datos: DatosReglaEmergencia): DatosReglaEmergencia;
  /** Devuelve los errores encontrados por campo; un objeto vacío significa que los datos son válidos. */
  validar(datos: DatosReglaEmergencia): Record<string, string>;
  clasificar(datos: DatosReglaEmergencia): ClasificacionEmergencia;
}
