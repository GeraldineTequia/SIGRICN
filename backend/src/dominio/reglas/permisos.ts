import type { Rol } from './catalogos';

/**
 * Matriz de permisos definitiva de SGRICN (RF4). Se comprueba en cada ruta del backend;
 * el frontend la reutiliza sólo para ocultar acciones (nunca como mecanismo de seguridad).
 */
export const PERMISOS = {
  consultar_informacion_operativa: ['usuario', 'funcionario', 'administrador'],
  consultar_mapa_y_dashboard: ['usuario', 'funcionario', 'administrador'],
  exportar_informacion: ['usuario', 'funcionario', 'administrador'],
  crear_registros_operativos: ['funcionario', 'administrador'],
  editar_registros_operativos: ['funcionario', 'administrador'],
  eliminar_registros_operativos: ['funcionario', 'administrador'],
  cambiar_estados: ['funcionario', 'administrador'],
  gestionar_recursos_y_fondos: ['funcionario', 'administrador'],
  registrar_donaciones: ['funcionario', 'administrador'],
  gestionar_reportes_ciudadanos: ['funcionario', 'administrador'],
  administrar_cuentas: ['funcionario', 'administrador'],
  /** Datos personales e información de vulnerabilidad de personas afectadas (RF15). */
  consultar_datos_restringidos: ['funcionario', 'administrador'],
} as const satisfies Record<string, readonly Rol[]>;

export type Permiso = keyof typeof PERMISOS;

export function tiene_permiso(rol: Rol | null | undefined, permiso: Permiso): boolean {
  if (!rol) return false;
  return (PERMISOS[permiso] as readonly Rol[]).includes(rol);
}

/**
 * Regla de gestión de cuentas: nadie puede otorgar un rol superior al propio
 * ni modificar cuentas de un rol superior. Así un funcionario no puede crear administradores.
 */
const JERARQUIA_ROLES: Record<Rol, number> = { usuario: 1, funcionario: 2, administrador: 3 };

export function puede_gestionar_cuenta(rol_actor: Rol, rol_objetivo_actual: Rol, rol_objetivo_nuevo?: Rol): boolean {
  const nivel_actor = JERARQUIA_ROLES[rol_actor];
  if (JERARQUIA_ROLES[rol_objetivo_actual] > nivel_actor) return false;
  if (rol_objetivo_nuevo && JERARQUIA_ROLES[rol_objetivo_nuevo] > nivel_actor) return false;
  return tiene_permiso(rol_actor, 'administrar_cuentas');
}
