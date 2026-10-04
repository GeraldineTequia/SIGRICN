import crypto from 'node:crypto';
import type {
  IGestorSesiones,
  IHashContrasenas,
  IRepositorioTokensRecuperacion,
  IRepositorioUsuarios,
  UsuarioAutenticado,
} from '../../dominio/contratos/autenticacion';
import type { Registro } from '../../dominio/contratos/repositorio';
import type { IServicioCorreo } from '../../dominio/contratos/servicios_externos';
import { ErrorAplicacion, ErrorConflicto, ErrorValidacion } from '../../dominio/errores';
import { ROLES, type Rol } from '../../dominio/reglas/catalogos';
import { validar_contrasena } from '../../dominio/reglas/contrasena';
import { ESQUEMA_INICIO_SESION, ESQUEMA_REGISTRO, ESQUEMA_RESTABLECER, ESQUEMA_SOLICITUD_RECUPERACION } from '../../dominio/validacion/esquemas';
import { validar_datos } from '../../dominio/validacion/validador';
import type { ServicioAuditoria } from './ServicioAuditoria';

const MINUTOS_VIGENCIA_TOKEN = 30;
const MENSAJE_CREDENCIALES = 'Correo o contraseña incorrectos.';

export function hash_token(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function a_usuario_autenticado(registro: Registro): UsuarioAutenticado {
  return {
    id: registro.id,
    nombre: String(registro.nombre ?? ''),
    apellido: String(registro.apellido ?? ''),
    correo: String(registro.correo ?? ''),
    rol: (ROLES as readonly string[]).includes(String(registro.rol)) ? (registro.rol as Rol) : 'usuario',
    estado: String(registro.estado ?? 'inactivo'),
  };
}

export interface RespuestaRecuperacion {
  mensaje: string;
  /** Indica sólo si el servidor tiene correo configurado; NO revela si la cuenta existe. */
  correo_configurado: boolean;
}

/** Casos de uso de autenticación (RF1, RF2, RF3). La sesión HTTP la maneja la capa de presentación. */
export class ServicioAutenticacion {
  private readonly _usuarios: IRepositorioUsuarios;
  private readonly _tokens: IRepositorioTokensRecuperacion;
  private readonly _hash: IHashContrasenas;
  private readonly _correo: IServicioCorreo;
  private readonly _sesiones: IGestorSesiones;
  private readonly _auditoria: ServicioAuditoria;
  private readonly _url_frontend: string;
  /** Hash de relleno para igualar el tiempo de respuesta cuando el correo no existe (evita enumerar cuentas). */
  private _hash_relleno: Promise<string> | null = null;

  constructor(dependencias: {
    usuarios: IRepositorioUsuarios;
    tokens: IRepositorioTokensRecuperacion;
    hash: IHashContrasenas;
    correo: IServicioCorreo;
    sesiones: IGestorSesiones;
    auditoria: ServicioAuditoria;
    url_frontend: string;
  }) {
    this._usuarios = dependencias.usuarios;
    this._tokens = dependencias.tokens;
    this._hash = dependencias.hash;
    this._correo = dependencias.correo;
    this._sesiones = dependencias.sesiones;
    this._auditoria = dependencias.auditoria;
    this._url_frontend = dependencias.url_frontend;
  }

  /**
   * RF1. El esquema de registro no admite "rol" ni "estado": cualquier intento de enviarlos
   * se rechaza con 400. El servidor asigna siempre rol "usuario" y estado "activo".
   */
  async registrar(entrada: unknown): Promise<UsuarioAutenticado> {
    const validacion = validar_datos(entrada, ESQUEMA_REGISTRO);
    const errores = { ...validacion.errores, ...validar_contrasena(validacion.datos.password, validacion.datos.confirmacion_password) };
    if (Object.keys(errores).length > 0) {
      const intenta_privilegios = typeof entrada === 'object' && entrada !== null && ('rol' in entrada || 'estado' in entrada);
      throw new ErrorValidacion(errores, intenta_privilegios ? 'El registro no permite asignar rol ni estado.' : undefined);
    }
    const correo = String(validacion.datos.correo);
    if (await this._usuarios.existe_correo(correo)) throw new ErrorConflicto('Ya existe una cuenta con ese correo.', { correo: 'Este correo ya está registrado.' });
    const password_hash = await this._hash.generar(String(validacion.datos.password));
    const ahora = new Date().toISOString();
    const creado = await this._usuarios.crear_cuenta(
      {
        nombre: validacion.datos.nombre,
        apellido: validacion.datos.apellido,
        correo,
        telefono: validacion.datos.telefono,
        rol: 'usuario',
        estado: 'activo',
        fecha_registro: ahora,
        ultima_sesion: null,
      },
      password_hash,
    );
    await this._auditoria.registrar('registro', 'usuarios', creado.id, null, { correo });
    return a_usuario_autenticado(creado);
  }

  /** RF2. Las cuentas inactivas no pueden iniciar sesión. */
  async iniciar_sesion(entrada: unknown): Promise<UsuarioAutenticado> {
    const validacion = validar_datos(entrada, ESQUEMA_INICIO_SESION);
    if (!validacion.es_valido) throw new ErrorValidacion(validacion.errores);
    const credenciales = await this._usuarios.buscar_credenciales(String(validacion.datos.correo));
    const es_valida = await this._hash.comparar(String(validacion.datos.password), credenciales?.password_hash ?? (await this._obtener_hash_relleno()));
    if (!credenciales || !es_valida) throw new ErrorAplicacion('NO_AUTENTICADO', MENSAJE_CREDENCIALES);
    const usuario = a_usuario_autenticado(credenciales.usuario);
    if (usuario.estado !== 'activo') {
      throw new ErrorAplicacion('SIN_PERMISO', 'La cuenta está inactiva. Comunícate con un funcionario o administrador.');
    }
    await this._usuarios.registrar_ultima_sesion(usuario.id, new Date());
    await this._auditoria.registrar('inicio_sesion', 'usuarios', usuario.id, { usuario });
    return usuario;
  }

  private _obtener_hash_relleno(): Promise<string> {
    this._hash_relleno ??= this._hash.generar(crypto.randomBytes(16).toString('hex'));
    return this._hash_relleno;
  }

  /** Recarga el usuario en cada solicitud: un cambio de rol o una desactivación surte efecto inmediato. */
  async obtener_usuario_vigente(usuario_id: string): Promise<UsuarioAutenticado | null> {
    const registro = await this._usuarios.obtener(usuario_id);
    if (!registro) return null;
    const usuario = a_usuario_autenticado(registro);
    return usuario.estado === 'activo' ? usuario : null;
  }

  /** RF3 paso 1–5: respuesta genérica exista o no la cuenta. */
  async solicitar_recuperacion(entrada: unknown): Promise<RespuestaRecuperacion> {
    const validacion = validar_datos(entrada, ESQUEMA_SOLICITUD_RECUPERACION);
    if (!validacion.es_valido) throw new ErrorValidacion(validacion.errores);
    const respuesta: RespuestaRecuperacion = {
      mensaje: 'Si el correo está registrado, recibirás un enlace para restablecer la contraseña. Revisa también la carpeta de spam.',
      correo_configurado: this._correo.esta_configurado(),
    };
    const credenciales = await this._usuarios.buscar_credenciales(String(validacion.datos.correo));
    if (!credenciales) return respuesta;
    const usuario = a_usuario_autenticado(credenciales.usuario);
    if (usuario.estado !== 'activo') return respuesta;

    const token = crypto.randomBytes(32).toString('base64url');
    await this._tokens.invalidar_de_usuario(usuario.id);
    await this._tokens.guardar(usuario.id, hash_token(token), new Date(Date.now() + MINUTOS_VIGENCIA_TOKEN * 60_000));
    const enlace = `${this._url_frontend}/restablecer-contrasena?token=${encodeURIComponent(token)}`;
    const resultado = await this._correo.enviar({
      destinatario: usuario.correo,
      asunto: 'SGRICN · Restablecer contraseña',
      texto: `Hola ${usuario.nombre}. Para restablecer tu contraseña abre este enlace (válido ${MINUTOS_VIGENCIA_TOKEN} minutos y de un solo uso): ${enlace}\nSi no solicitaste el cambio, ignora este mensaje.`,
      html: `<p>Hola ${usuario.nombre.replace(/[<>&]/g, '')}.</p><p>Para restablecer tu contraseña abre este enlace (válido ${MINUTOS_VIGENCIA_TOKEN} minutos y de un solo uso):</p><p><a href="${enlace}">Restablecer contraseña</a></p><p>Si no solicitaste el cambio, ignora este mensaje.</p>`,
    });
    if (!resultado.enviado) console.warn(`[recuperacion] Envío NO verificado para la cuenta ${usuario.id}: ${resultado.detalle}`);
    await this._auditoria.registrar('solicitud_recuperacion', 'usuarios', usuario.id, null, { envio_verificado: resultado.enviado });
    return respuesta;
  }

  /** RF3 pasos 6–8: token de un solo uso; invalida tokens y sesiones anteriores. */
  async restablecer_contrasena(entrada: unknown): Promise<void> {
    const validacion = validar_datos(entrada, ESQUEMA_RESTABLECER);
    const errores = { ...validacion.errores, ...validar_contrasena(validacion.datos.password, validacion.datos.confirmacion_password) };
    if (Object.keys(errores).length > 0) throw new ErrorValidacion(errores);
    const usuario_id = await this._tokens.consumir(hash_token(String(validacion.datos.token)), new Date());
    if (!usuario_id) {
      throw new ErrorValidacion({ token: 'El enlace no es válido, venció o ya fue utilizado. Solicita uno nuevo.' }, 'El enlace de recuperación no es válido.');
    }
    await this._usuarios.actualizar_password(usuario_id, await this._hash.generar(String(validacion.datos.password)));
    await this._tokens.invalidar_de_usuario(usuario_id);
    await this._sesiones.invalidar_sesiones_usuario(usuario_id);
    await this._auditoria.registrar('restablecer_contrasena', 'usuarios', usuario_id, null);
  }
}
