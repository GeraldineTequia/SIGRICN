import { EventEmitter } from 'node:events';
import type { EventoSistema, IPublicadorEventos } from '../../dominio/contratos/servicios_externos';

/**
 * Bus de eventos en memoria que alimenta el canal SSE (RNF3).
 * Limitación documentada: con varias instancias del backend se necesitaría un bus compartido
 * (por ejemplo, MongoDB Change Streams o Redis Pub/Sub).
 */
export class PublicadorEventosMemoria implements IPublicadorEventos {
  private readonly _emisor = new EventEmitter();

  constructor() {
    this._emisor.setMaxListeners(0);
  }

  publicar(evento: Omit<EventoSistema, 'fecha'>): void {
    this._emisor.emit('evento', { ...evento, fecha: new Date().toISOString() });
  }

  suscribir(manejador: (evento: EventoSistema) => void): () => void {
    this._emisor.on('evento', manejador);
    return () => this._emisor.off('evento', manejador);
  }
}
