import type { IRepositorioEntidad } from '../../dominio/contratos/repositorio';
import { nombre_completo, type ContextoSolicitud } from '../dto/contexto';

/**
 * Auditoría de operaciones relevantes (creación, edición, eliminación, cambios de estado,
 * gestión de cuentas). Nunca guarda contraseñas, hashes ni tokens en el detalle.
 */
export class ServicioAuditoria {
  private readonly _repositorio: IRepositorioEntidad;

  constructor(repositorio: IRepositorioEntidad) {
    this._repositorio = repositorio;
  }

  async registrar(
    accion: string,
    entidad: string,
    entidad_id: string | null,
    contexto: ContextoSolicitud | null,
    detalle: Record<string, unknown> = {},
  ): Promise<void> {
    const detalle_seguro = Object.fromEntries(
      Object.entries(detalle).filter(([clave]) => !/password|hash|token|contrasena/i.test(clave)),
    );
    try {
      await this._repositorio.crear({
        accion,
        entidad,
        entidad_id,
        usuario_id: contexto?.usuario.id ?? null,
        usuario_nombre: contexto ? nombre_completo(contexto) : 'sistema',
        detalle: detalle_seguro,
        fecha: new Date().toISOString(),
      });
    } catch (error) {
      // La auditoría no debe impedir la operación principal, pero el fallo queda registrado.
      console.error('[auditoria] No se pudo registrar la operación:', (error as Error).message);
    }
  }
}
