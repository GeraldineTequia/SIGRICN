import { NIVELES_EMERGENCIA, type NivelEmergencia } from '../reglas/catalogos';
import type { ClasificacionEmergencia, DatosReglaEmergencia, IEstrategiaEmergencia } from './IEstrategiaEmergencia';

/**
 * Estrategia por defecto. Contiene las reglas comunes a todos los tipos;
 * las estrategias específicas heredan de ella y añaden sus propias reglas.
 */
export class EstrategiaGeneral implements IEstrategiaEmergencia {
  readonly nombre: string = 'general';

  aplica_a(_tipo: string): boolean {
    return true;
  }

  preparar(datos: DatosReglaEmergencia): DatosReglaEmergencia {
    // La magnitud sólo tiene sentido para terremotos: en los demás tipos no se exige ni se conserva.
    return { ...datos, magnitud: null };
  }

  validar(datos: DatosReglaEmergencia): Record<string, string> {
    const errores: Record<string, string> = {};
    if (!NIVELES_EMERGENCIA.includes(datos.nivel_emergencia as NivelEmergencia)) {
      errores.nivel_emergencia = 'El nivel de emergencia no es válido.';
    }
    const inicio = datos.fecha_inicio ? new Date(datos.fecha_inicio) : null;
    const fin = datos.fecha_fin ? new Date(datos.fecha_fin) : null;
    // Se tolera un pequeño desfase de reloj (1 hora) entre el cliente y el servidor.
    if (inicio && inicio.getTime() > Date.now() + 60 * 60 * 1000) {
      errores.fecha_inicio = 'La fecha de inicio no puede estar en el futuro.';
    }
    if (inicio && fin && fin.getTime() < inicio.getTime()) {
      errores.fecha_fin = 'La fecha de finalización no puede ser anterior a la fecha de inicio.';
    }
    return errores;
  }

  clasificar(datos: DatosReglaEmergencia): ClasificacionEmergencia {
    const nivel = (NIVELES_EMERGENCIA as readonly string[]).includes(datos.nivel_emergencia)
      ? (datos.nivel_emergencia as NivelEmergencia)
      : 'medio';
    return { nivel_sugerido: nivel, criterio: 'Nivel reportado por la fuente de información.' };
  }
}
