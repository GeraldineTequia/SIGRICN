import type { UsuarioAutenticado } from '../../dominio/contratos/autenticacion';
import type { PaginaResultados, Registro } from '../../dominio/contratos/repositorio';

/** Información de quién realiza la operación; la construye el middleware de autenticación. */
export interface ContextoSolicitud {
  usuario: UsuarioAutenticado;
}

/** Parámetros de consulta tal como llegan del cliente (se filtran contra listas permitidas). */
export type ParametrosConsulta = Record<string, unknown>;

export type RespuestaListado = PaginaResultados<Registro>;

export function nombre_completo(contexto: ContextoSolicitud): string {
  return `${contexto.usuario.nombre} ${contexto.usuario.apellido}`.trim();
}
