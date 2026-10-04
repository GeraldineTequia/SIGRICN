import { normalizar_texto_comparacion } from '../validacion/validador';
import { EstrategiaGeneral } from './EstrategiaGeneral';
import type { ClasificacionEmergencia, DatosReglaEmergencia } from './IEstrategiaEmergencia';

const TIPOS_HIDRICOS = ['inundacion', 'avenida torrencial'];

/**
 * Reglas de inundaciones y avenidas torrenciales (regla funcional de SGRICN):
 * cuando el nivel es alto o crítico se exige una dirección o referencia del sector,
 * porque es el dato mínimo para planear evacuaciones por cuadrantes.
 */
export class EstrategiaInundacion extends EstrategiaGeneral {
  override readonly nombre = 'inundacion';

  override aplica_a(tipo: string): boolean {
    return TIPOS_HIDRICOS.includes(normalizar_texto_comparacion(tipo));
  }

  override validar(datos: DatosReglaEmergencia): Record<string, string> {
    const errores = super.validar(datos);
    const requiere_referencia = datos.nivel_emergencia === 'alto' || datos.nivel_emergencia === 'critico';
    const referencia = typeof datos.direccion_referencia === 'string' ? datos.direccion_referencia.trim() : '';
    if (requiere_referencia && referencia === '') {
      errores.direccion_referencia =
        'Las inundaciones de nivel alto o crítico requieren una dirección o referencia del sector afectado.';
    }
    return errores;
  }

  override clasificar(datos: DatosReglaEmergencia): ClasificacionEmergencia {
    const base = super.clasificar(datos);
    return { ...base, criterio: 'Nivel reportado; las inundaciones se priorizan por sector y referencia de evacuación.' };
  }
}
