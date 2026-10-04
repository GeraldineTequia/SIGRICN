import type { IGestorSesiones, IRepositorioUsuarios } from '../../dominio/contratos/autenticacion';
import type { Registro } from '../../dominio/contratos/repositorio';
import { ErrorAplicacion, ErrorNoEncontrado, ErrorSinPermiso, ErrorValidacion } from '../../dominio/errores';
import type { Rol } from '../../dominio/reglas/catalogos';
import { puede_gestionar_cuenta, tiene_permiso } from '../../dominio/reglas/permisos';
import { ESQUEMA_CAMBIO_ESTADO_CUENTA, ESQUEMA_CAMBIO_ROL, ESQUEMA_EDICION_CUENTA } from '../../dominio/validacion/esquemas';
import { validar_datos } from '../../dominio/validacion/validador';
import type { ContextoSolicitud, ParametrosConsulta, RespuestaListado } from '../dto/contexto';
import type { ServicioAuditoria } from './ServicioAuditoria';
import { ServicioEntidad } from './ServicioEntidad';
import type { IPublicadorEventos } from '../../dominio/contratos/servicios_externos';

/**
 * Administración de cuentas con endpoints específicos y auditoría (RF4).
 * - Sólo funcionario y administrador acceden al directorio de cuentas.
 * - Nadie otorga un rol superior al propio ni gestiona cuentas de rango superior.
 * - Nadie cambia su propio rol ni se desactiva a sí mismo (evita bloqueos accidentales).
 * - Las cuentas no se eliminan: se desactivan (conserva auditoría y relaciones).
 * - Nunca se exponen hashes ni tokens (el mapeador de usuarios no incluye "password").
 */
export class ServicioCuentas {
  private readonly _usuarios: IRepositorioUsuarios;
  private readonly _sesiones: IGestorSesiones;
  private readonly _auditoria: ServicioAuditoria;
  private readonly _listador: ServicioEntidad;

  constructor(usuarios: IRepositorioUsuarios, sesiones: IGestorSesiones, auditoria: ServicioAuditoria, publicador: IPublicadorEventos) {
    this._usuarios = usuarios;
    this._sesiones = sesiones;
    this._auditoria = auditoria;
    this._listador = new ServicioEntidad(
      {
        entidad: 'usuarios',
        nombre: 'La cuenta',
        repositorio: usuarios,
        esquema_creacion: {},
        esquema_edicion: ESQUEMA_EDICION_CUENTA,
        permiso_lectura: 'administrar_cuentas',
        permiso_escritura: 'administrar_cuentas',
        campos_busqueda: ['nombre', 'apellido', 'correo'],
        filtros: { rol: 'rol', estado: 'estado' },
        ordenes: ['nombre', 'apellido', 'correo', 'ultima_sesion', 'fecha_registro'],
        orden_predeterminado: { campo: 'nombre', direccion: 'asc' },
        roles_eventos: ['funcionario', 'administrador'],
      },
      auditoria,
      publicador,
    );
  }

  private _exigir(contexto: ContextoSolicitud): void {
    if (!tiene_permiso(contexto.usuario.rol, 'administrar_cuentas')) throw new ErrorSinPermiso();
  }

  async listar(parametros: ParametrosConsulta, contexto: ContextoSolicitud): Promise<RespuestaListado> {
    return this._listador.listar(parametros, contexto);
  }

  async obtener(id: string, contexto: ContextoSolicitud): Promise<Registro> {
    return this._listador.obtener(id, contexto);
  }

  private async _cuenta_gestionable(id: string, contexto: ContextoSolicitud, rol_nuevo?: Rol): Promise<Registro> {
    this._exigir(contexto);
    const cuenta = await this._usuarios.obtener(id);
    if (!cuenta) throw new ErrorNoEncontrado('La cuenta');
    if (!puede_gestionar_cuenta(contexto.usuario.rol, cuenta.rol as Rol, rol_nuevo)) {
      throw new ErrorSinPermiso('No puedes asignar ni gestionar permisos superiores a tu rol.');
    }
    return cuenta;
  }

  async editar_datos(id: string, entrada: unknown, contexto: ContextoSolicitud): Promise<Registro> {
    const cuenta = await this._cuenta_gestionable(id, contexto);
    const validacion = validar_datos(entrada, ESQUEMA_EDICION_CUENTA, { parcial: true });
    if (!validacion.es_valido) throw new ErrorValidacion(validacion.errores);
    const actualizada = await this._usuarios.actualizar(cuenta.id, validacion.datos);
    if (!actualizada) throw new ErrorNoEncontrado('La cuenta');
    await this._auditoria.registrar('editar_cuenta', 'usuarios', cuenta.id, contexto, { campos: Object.keys(validacion.datos) });
    return actualizada;
  }

  async cambiar_rol(id: string, entrada: unknown, contexto: ContextoSolicitud): Promise<Registro> {
    const validacion = validar_datos(entrada, ESQUEMA_CAMBIO_ROL);
    if (!validacion.es_valido) throw new ErrorValidacion(validacion.errores);
    const rol_nuevo = validacion.datos.rol as Rol;
    if (id === contexto.usuario.id) throw new ErrorAplicacion('CONFLICTO', 'No puedes cambiar tu propio rol.');
    const cuenta = await this._cuenta_gestionable(id, contexto, rol_nuevo);
    const actualizada = await this._usuarios.actualizar(cuenta.id, { rol: rol_nuevo });
    if (!actualizada) throw new ErrorNoEncontrado('La cuenta');
    await this._auditoria.registrar('cambiar_rol', 'usuarios', cuenta.id, contexto, { rol_anterior: cuenta.rol, rol_nuevo });
    // El rol se relee en cada solicitud, por lo que el cambio aplica de inmediato a las sesiones vigentes.
    return actualizada;
  }

  async cambiar_estado(id: string, entrada: unknown, contexto: ContextoSolicitud): Promise<Registro> {
    const validacion = validar_datos(entrada, ESQUEMA_CAMBIO_ESTADO_CUENTA);
    if (!validacion.es_valido) throw new ErrorValidacion(validacion.errores);
    if (id === contexto.usuario.id) throw new ErrorAplicacion('CONFLICTO', 'No puedes cambiar el estado de tu propia cuenta.');
    const cuenta = await this._cuenta_gestionable(id, contexto);
    const estado = String(validacion.datos.estado);
    const actualizada = await this._usuarios.actualizar(cuenta.id, { estado });
    if (!actualizada) throw new ErrorNoEncontrado('La cuenta');
    let sesiones_cerradas = 0;
    if (estado === 'inactivo') sesiones_cerradas = await this._sesiones.invalidar_sesiones_usuario(cuenta.id);
    await this._auditoria.registrar('cambiar_estado_cuenta', 'usuarios', cuenta.id, contexto, {
      estado_anterior: cuenta.estado,
      estado_nuevo: estado,
      sesiones_cerradas,
    });
    return actualizada;
  }
}
