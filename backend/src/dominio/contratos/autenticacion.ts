import type { Rol } from '../reglas/catalogos';
import type { IRepositorioEntidad, Registro } from './repositorio';

/** Usuario autenticado tal como lo ven los servicios (sin hash ni datos internos). */
export interface UsuarioAutenticado {
  id: string;
  nombre: string;
  apellido: string;
  correo: string;
  rol: Rol;
  estado: string;
}

export interface CredencialesAlmacenadas {
  usuario: Registro;
  password_hash: string;
}

export interface IRepositorioUsuarios extends IRepositorioEntidad {
  buscar_credenciales(correo: string): Promise<CredencialesAlmacenadas | null>;
  existe_correo(correo: string): Promise<boolean>;
  crear_cuenta(datos: Record<string, unknown>, password_hash: string): Promise<Registro>;
  actualizar_password(id: string, password_hash: string): Promise<void>;
  registrar_ultima_sesion(id: string, fecha: Date): Promise<void>;
}

export interface IRepositorioTokensRecuperacion {
  guardar(usuario_id: string, token_hash: string, vence_en: Date): Promise<void>;
  /** Marca el token como usado de forma atómica y devuelve el usuario, o null si es inválido, vencido o ya usado. */
  consumir(token_hash: string, ahora: Date): Promise<string | null>;
  invalidar_de_usuario(usuario_id: string): Promise<void>;
}

export interface IHashContrasenas {
  generar(contrasena: string): Promise<string>;
  comparar(contrasena: string, hash: string): Promise<boolean>;
}

export interface IGestorSesiones {
  /** Elimina las sesiones persistidas de un usuario (cambio de contraseña, desactivación). */
  invalidar_sesiones_usuario(usuario_id: string): Promise<number>;
}
