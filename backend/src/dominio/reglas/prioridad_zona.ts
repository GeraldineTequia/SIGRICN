import type { Prioridad } from './catalogos';

export interface DatosPrioridadZona {
  nivel_afectacion: string;
  porcentaje_afectacion: number | null;
  nivel_emergencia: string | null;
  personas_afectadas: number;
  necesidades_criticas_pendientes: number;
  estado_atencion: string;
}

export interface SugerenciaPrioridad {
  prioridad: Prioridad;
  motivos: string[];
}

const ESCALA: Record<string, number> = { bajo: 1, medio: 2, alto: 3, critico: 4 };
const PRIORIDADES_POR_PUNTAJE: Prioridad[] = ['baja', 'baja', 'media', 'alta', 'critica'];

/**
 * Sugerencia de prioridad de zona (RF12). Es un CRITERIO DE APOYO documentado del proyecto,
 * no una puntuación oficial: el funcionario decide y guarda la prioridad definitiva.
 * Punto de partida: nivel de afectación (1–4). Se suma 1 por cada condición agravante:
 * porcentaje >= 70 %, emergencia crítica, 1.000+ personas afectadas, necesidades críticas pendientes
 * o zona sin atender. El resultado se limita a "crítica".
 */
export function sugerir_prioridad_zona(datos: DatosPrioridadZona): SugerenciaPrioridad {
  const motivos: string[] = [];
  let puntaje = ESCALA[datos.nivel_afectacion] ?? 2;
  motivos.push(`Nivel de afectación: ${datos.nivel_afectacion}.`);
  if ((datos.porcentaje_afectacion ?? 0) >= 70) {
    puntaje += 1;
    motivos.push(`Afectación del ${datos.porcentaje_afectacion}%.`);
  }
  if (datos.nivel_emergencia === 'critico') {
    puntaje += 1;
    motivos.push('La emergencia asociada es crítica.');
  }
  if (datos.personas_afectadas >= 1000) {
    puntaje += 1;
    motivos.push(`${datos.personas_afectadas} personas afectadas registradas.`);
  }
  if (datos.necesidades_criticas_pendientes > 0) {
    puntaje += 1;
    motivos.push(`${datos.necesidades_criticas_pendientes} necesidades críticas o altas pendientes.`);
  }
  if (datos.estado_atencion === 'sin_atender') {
    puntaje += 1;
    motivos.push('La zona aún no recibe atención.');
  }
  return { prioridad: PRIORIDADES_POR_PUNTAJE[Math.min(puntaje, 4)], motivos };
}
