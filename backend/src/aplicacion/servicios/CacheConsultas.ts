import type { IPublicadorEventos } from '../../dominio/contratos/servicios_externos';

/**
 * Caché breve para consultas costosas (mapa e indicadores del dashboard).
 * - Duración máxima de 5 s, y se VACÍA en cuanto se publica cualquier cambio de datos,
 *   por lo que nunca muestra información desactualizada después de una operación (RNF3).
 * - Reduce el trabajo repetido cuando muchos usuarios consultan lo mismo a la vez (RNF1, RNF4).
 */
export class CacheConsultas {
  private readonly _entradas = new Map<string, { vence: number; valor: Promise<unknown> }>();
  private readonly _duracion_ms: number;

  constructor(publicador: IPublicadorEventos, duracion_ms = 5000) {
    this._duracion_ms = duracion_ms;
    publicador.suscribir((evento) => {
      if (evento.tipo === 'datos_actualizados') this._entradas.clear();
    });
  }

  obtener<T>(clave: string, calcular: () => Promise<T>): Promise<T> {
    const ahora = Date.now();
    const existente = this._entradas.get(clave);
    if (existente && existente.vence > ahora) return existente.valor as Promise<T>;
    const valor = calcular();
    this._entradas.set(clave, { vence: ahora + this._duracion_ms, valor });
    // Si el cálculo falla, no se conserva el error en caché.
    valor.catch(() => this._entradas.delete(clave));
    if (this._entradas.size > 500) this._entradas.delete(this._entradas.keys().next().value as string);
    return valor;
  }
}
