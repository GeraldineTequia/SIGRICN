import type { IRepositorioEntidad, Registro } from '../../dominio/contratos/repositorio';
import { nombre_completo, type ContextoSolicitud } from '../dto/contexto';

/** Historial de cambios de estado (emergencias, zonas, donaciones, reportes): quién, cuándo, de qué a qué. */
export class ServicioHistorial {
  private readonly _repositorio: IRepositorioEntidad;

  constructor(repositorio: IRepositorioEntidad) {
    this._repositorio = repositorio;
  }

  async registrar(
    entidad: string,
    entidad_id: string,
    estado_anterior: string | null,
    estado_nuevo: string,
    contexto: ContextoSolicitud,
    observacion: string | null = null,
  ): Promise<Registro> {
    return this._repositorio.crear({
      entidad,
      entidad_id,
      estado_anterior,
      estado_nuevo,
      usuario_id: contexto.usuario.id,
      usuario_nombre: nombre_completo(contexto),
      observacion,
      fecha: new Date().toISOString(),
    });
  }

  async listar(entidad: string, entidad_id: string): Promise<Registro[]> {
    return this._repositorio.listar_todos(
      [
        { campo: 'entidad', operador: 'igual', valor: entidad },
        { campo: 'entidad_id', operador: 'igual', valor: entidad_id },
      ],
      200,
    );
  }
}
