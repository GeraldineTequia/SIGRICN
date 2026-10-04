import type { CondicionCampo, IRepositorioEntidad, Registro } from '../../dominio/contratos/repositorio';
import type { IPublicadorEventos } from '../../dominio/contratos/servicios_externos';
import { ErrorConflicto, ErrorNoEncontrado } from '../../dominio/errores';
import { ROLES, type Rol, type SeveridadAlerta, type TipoAlerta } from '../../dominio/reglas/catalogos';
import type { ContextoSolicitud } from '../dto/contexto';

export interface NuevaAlerta {
  tipo: TipoAlerta;
  severidad: SeveridadAlerta;
  titulo: string;
  mensaje: string;
  entidad: string;
  entidad_id: string | null;
  roles_destinatarios: readonly Rol[];
  responsable: string;
  /** Evita alertas repetidas por la misma causa (índice único en la colección Alertas). */
  clave_deduplicacion: string;
}

export const ROLES_OPERATIVOS: readonly Rol[] = ['funcionario', 'administrador'];
export const TODOS_LOS_ROLES: readonly Rol[] = ROLES;

/**
 * Alertas persistentes de negocio (RF22) y notificaciones (RF23).
 * - Se guardan en MongoDB con destinatarios por rol, por lo que un usuario desconectado
 *   las encuentra al volver a iniciar sesión.
 * - La lectura y la entrega se registran por usuario (colección Lecturas_alertas).
 * - Cerrar un aviso visual en la interfaz no elimina la alerta persistente.
 */
export class ServicioAlertas {
  private readonly _alertas: IRepositorioEntidad;
  private readonly _lecturas: IRepositorioEntidad;
  private readonly _publicador: IPublicadorEventos;

  constructor(alertas: IRepositorioEntidad, lecturas: IRepositorioEntidad, publicador: IPublicadorEventos) {
    this._alertas = alertas;
    this._lecturas = lecturas;
    this._publicador = publicador;
  }

  async generar(alerta: NuevaAlerta): Promise<Registro | null> {
    try {
      const creada = await this._alertas.crear({ ...alerta, roles_destinatarios: [...alerta.roles_destinatarios], fecha: new Date().toISOString() });
      this._publicador.publicar({
        tipo: 'nueva_alerta',
        entidad: 'alertas',
        accion: 'creado',
        identificador: creada.id,
        roles: alerta.roles_destinatarios,
      });
      return creada;
    } catch (error) {
      if (error instanceof ErrorConflicto) return null; // Duplicada: ya existe una alerta por la misma causa.
      console.error('[alertas] No se pudo generar la alerta:', (error as Error).message);
      return null;
    }
  }

  async listar_para_usuario(
    contexto: ContextoSolicitud,
    opciones: { solo_no_leidas?: boolean; severidad?: string; limite?: number },
  ): Promise<{ elementos: Registro[]; no_leidas: number }> {
    const condiciones: CondicionCampo[] = [{ campo: 'roles_destinatarios', operador: 'igual', valor: contexto.usuario.rol }];
    if (opciones.severidad) condiciones.push({ campo: 'severidad', operador: 'igual', valor: opciones.severidad });
    const alertas = await this._alertas.listar_todos(condiciones, 300);
    const lecturas = await this._lecturas.listar_todos([{ campo: 'usuario_id', operador: 'igual', valor: contexto.usuario.id }], 5000);
    const lecturas_por_alerta = new Map(lecturas.map((lectura) => [String(lectura.alerta_id), lectura]));

    // Registrar la entrega de las alertas que el usuario aún no había recibido.
    const sin_entregar = alertas.filter((alerta) => !lecturas_por_alerta.has(alerta.id));
    await Promise.all(
      sin_entregar.map(async (alerta) => {
        try {
          const lectura = await this._lecturas.crear({
            alerta_id: alerta.id,
            usuario_id: contexto.usuario.id,
            entregada_en: new Date().toISOString(),
            leida_en: null,
          });
          lecturas_por_alerta.set(alerta.id, lectura);
        } catch {
          // Otra solicitud simultánea ya registró la entrega (índice único).
        }
      }),
    );

    const con_estado = alertas.map((alerta) => {
      const lectura = lecturas_por_alerta.get(alerta.id);
      return { ...alerta, leida: Boolean(lectura?.leida_en), leida_en: lectura?.leida_en ?? null, entregada_en: lectura?.entregada_en ?? null };
    });
    const no_leidas = con_estado.filter((alerta) => !alerta.leida).length;
    const filtradas = opciones.solo_no_leidas ? con_estado.filter((alerta) => !alerta.leida) : con_estado;
    return { elementos: filtradas.slice(0, opciones.limite ?? 100), no_leidas };
  }

  async marcar_leida(alerta_id: string, contexto: ContextoSolicitud): Promise<void> {
    const alerta = await this._alertas.obtener(alerta_id);
    const roles = (alerta?.roles_destinatarios as string[] | undefined) ?? [];
    if (!alerta || !roles.includes(contexto.usuario.rol)) throw new ErrorNoEncontrado('La alerta');
    const condiciones = [
      { campo: 'alerta_id', operador: 'igual' as const, valor: alerta.id },
      { campo: 'usuario_id', operador: 'igual' as const, valor: contexto.usuario.id },
    ];
    const existente = await this._lecturas.buscar_uno(condiciones);
    const ahora = new Date().toISOString();
    if (existente) await this._lecturas.actualizar(existente.id, { leida_en: ahora });
    else await this._lecturas.crear({ alerta_id: alerta.id, usuario_id: contexto.usuario.id, entregada_en: ahora, leida_en: ahora });
  }

  async marcar_todas_leidas(contexto: ContextoSolicitud): Promise<number> {
    const { elementos } = await this.listar_para_usuario(contexto, { solo_no_leidas: true, limite: 300 });
    for (const alerta of elementos) await this.marcar_leida(alerta.id, contexto);
    return elementos.length;
  }

  /** Resumen de entrega para el panel "Estado de entrega" (sólo personal operativo). */
  async resumen_entrega(): Promise<{ total_alertas: number; lecturas_registradas: number; leidas: number }> {
    const [total_alertas, lecturas_registradas, leidas] = await Promise.all([
      this._alertas.contar([]),
      this._lecturas.contar([]),
      this._lecturas.contar([{ campo: 'leida_en', operador: 'existe', valor: true }]),
    ]);
    return { total_alertas, lecturas_registradas, leidas };
  }
}
