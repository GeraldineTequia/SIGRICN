import { ErrorAplicacion } from '../errores';
import {
  EQUIVALENCIAS_ESTADO_HEREDADO,
  ESTADOS_EMERGENCIA,
  obtener_etiqueta,
  type EstadoEmergencia,
} from '../reglas/catalogos';
import type { EfectosEntradaEstado, IEstadoEmergencia } from './IEstadoEmergencia';

/** Base con el comportamiento común: un estado sólo acepta los destinos de su lista. */
abstract class EstadoEmergenciaBase implements IEstadoEmergencia {
  abstract readonly nombre: EstadoEmergencia;
  abstract readonly descripcion: string;
  protected abstract readonly _destinos: readonly EstadoEmergencia[];

  transiciones_permitidas(): readonly EstadoEmergencia[] {
    return this._destinos;
  }

  puede_transicionar_a(destino: EstadoEmergencia): boolean {
    return this._destinos.includes(destino);
  }

  al_entrar(_fecha_cambio: Date): EfectosEntradaEstado {
    return {};
  }
}

export class EstadoActiva extends EstadoEmergenciaBase {
  readonly nombre = 'activa' as const;
  readonly descripcion = 'Emergencia reportada, pendiente de iniciar la atención.';
  protected readonly _destinos = ['en_atencion'] as const;
}

export class EstadoEnAtencion extends EstadoEmergenciaBase {
  readonly nombre = 'en_atencion' as const;
  readonly descripcion = 'Equipos y recursos atendiendo la emergencia.';
  protected readonly _destinos = ['controlada'] as const;
}

export class EstadoControlada extends EstadoEmergenciaBase {
  readonly nombre = 'controlada' as const;
  readonly descripcion = 'La situación está controlada; continúan labores de cierre.';
  protected readonly _destinos = ['finalizada'] as const;
}

export class EstadoFinalizada extends EstadoEmergenciaBase {
  readonly nombre = 'finalizada' as const;
  readonly descripcion = 'Atención concluida. Estado final del ciclo.';
  protected readonly _destinos = [] as const;

  /** Al finalizar se establece fechaFin con la fecha del cambio. */
  override al_entrar(fecha_cambio: Date): EfectosEntradaEstado {
    return { fecha_fin: fecha_cambio.toISOString() };
  }
}

const ESTADOS: Record<EstadoEmergencia, IEstadoEmergencia> = {
  activa: new EstadoActiva(),
  en_atencion: new EstadoEnAtencion(),
  controlada: new EstadoControlada(),
  finalizada: new EstadoFinalizada(),
};

/** Traduce un estado almacenado (incluidos valores heredados documentados) al estado del ciclo. */
export function interpretar_estado_almacenado(estado_almacenado: unknown): EstadoEmergencia | null {
  if (typeof estado_almacenado !== 'string') return null;
  const valor = estado_almacenado.trim().toLowerCase();
  if ((ESTADOS_EMERGENCIA as readonly string[]).includes(valor)) return valor as EstadoEmergencia;
  return EQUIVALENCIAS_ESTADO_HEREDADO[valor] ?? null;
}

export function obtener_estado_emergencia(estado_almacenado: unknown): IEstadoEmergencia {
  const estado = interpretar_estado_almacenado(estado_almacenado);
  if (!estado) {
    throw new ErrorAplicacion(
      'TRANSICION_INVALIDA',
      'El estado almacenado de esta emergencia no pertenece al catálogo. Debe revisarse con el script de inspección antes de cambiarlo.',
    );
  }
  return ESTADOS[estado];
}

export interface ResultadoTransicion {
  estado_anterior: EstadoEmergencia;
  estado_nuevo: EstadoEmergencia;
  efectos: EfectosEntradaEstado;
}

/** Aplica la transición o lanza un error con las opciones válidas. */
export function transicionar_emergencia(
  estado_almacenado: unknown,
  destino: EstadoEmergencia,
  fecha_cambio: Date,
): ResultadoTransicion {
  const estado_actual = obtener_estado_emergencia(estado_almacenado);
  if (!estado_actual.puede_transicionar_a(destino)) {
    const opciones = estado_actual.transiciones_permitidas().map(obtener_etiqueta).join(', ');
    throw new ErrorAplicacion(
      'TRANSICION_INVALIDA',
      `No se puede pasar de "${obtener_etiqueta(estado_actual.nombre)}" a "${obtener_etiqueta(destino)}". ` +
        (opciones ? `Transiciones permitidas: ${opciones}.` : 'La emergencia ya está finalizada.'),
    );
  }
  return { estado_anterior: estado_actual.nombre, estado_nuevo: destino, efectos: ESTADOS[destino].al_entrar(fecha_cambio) };
}
