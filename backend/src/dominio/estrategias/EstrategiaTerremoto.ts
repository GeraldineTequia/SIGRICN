import { es_tipo_terremoto, validar_magnitud_terremoto } from '../reglas/regla_magnitud';
import type { NivelEmergencia } from '../reglas/catalogos';
import { EstrategiaGeneral } from './EstrategiaGeneral';
import type { ClasificacionEmergencia, DatosReglaEmergencia } from './IEstrategiaEmergencia';

/**
 * Reglas de terremotos: exige magnitud >= 5.0 (regla funcional de SGRICN)
 * y sugiere un nivel de gravedad según la magnitud.
 */
export class EstrategiaTerremoto extends EstrategiaGeneral {
  override readonly nombre = 'terremoto';

  override aplica_a(tipo: string): boolean {
    return es_tipo_terremoto(tipo);
  }

  override preparar(datos: DatosReglaEmergencia): DatosReglaEmergencia {
    const magnitud = datos.magnitud;
    // Se conserva el valor tal como llega para que la validación pueda rechazarlo con el mensaje oficial.
    if (typeof magnitud === 'string') {
      const texto = magnitud.trim().replace(',', '.');
      return { ...datos, magnitud: texto === '' ? null : Number(texto) };
    }
    return { ...datos };
  }

  override validar(datos: DatosReglaEmergencia): Record<string, string> {
    const errores = super.validar(datos);
    const error_magnitud = validar_magnitud_terremoto(datos.magnitud);
    if (error_magnitud) errores.magnitud = error_magnitud;
    return errores;
  }

  /** Criterio del proyecto (no oficial): 5.0–5.9 medio, 6.0–6.9 alto, 7.0 o más crítico. */
  override clasificar(datos: DatosReglaEmergencia): ClasificacionEmergencia {
    const magnitud = typeof datos.magnitud === 'number' ? datos.magnitud : NaN;
    if (!Number.isFinite(magnitud)) {
      return { nivel_sugerido: 'alto', criterio: 'Magnitud pendiente de validación.' };
    }
    let nivel: NivelEmergencia = 'medio';
    if (magnitud >= 7) nivel = 'critico';
    else if (magnitud >= 6) nivel = 'alto';
    return { nivel_sugerido: nivel, criterio: `Magnitud ${magnitud.toFixed(1)} según criterio SGRICN.` };
  }
}
