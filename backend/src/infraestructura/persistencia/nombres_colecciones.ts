/**
 * Nombres EXPLÍCITOS de las colecciones. Las heredadas conservan su nombre original
 * (excepción documentada al estándar snake_case). Si la inspección de la base muestra otro
 * nombre, basta con cambiarlo aquí.
 */
export const COLECCIONES_HEREDADAS = {
  usuarios: 'Usuarios',
  emergencias: 'Emergencias',
  zonas_afectadas: 'Zonas_afectadas',
  poblacion_afectada: 'Poblacion_afectada',
  necesidades: 'Necesidades',
  centros_donacion: 'Centros_donacion',
  donaciones: 'Donaciones',
} as const;

/** Colecciones nuevas creadas por SGRICN (no existían en la estructura de referencia). */
export const COLECCIONES_NUEVAS = {
  personas_afectadas: 'Personas_afectadas',
  familias_afectadas: 'Familias_afectadas',
  recursos: 'Recursos',
  movimientos_recursos: 'Movimientos_recursos',
  asignaciones_recursos: 'Asignaciones_recursos',
  recursos_humanos: 'Recursos_humanos',
  fondos: 'Fondos',
  movimientos_fondos: 'Movimientos_fondos',
  reportes_ciudadanos: 'Reportes_ciudadanos',
  historial_estados: 'Historial_estados',
  alertas: 'Alertas',
  lecturas_alertas: 'Lecturas_alertas',
  auditoria: 'Auditoria',
  tokens_recuperacion: 'Tokens_recuperacion',
  sesiones: 'Sesiones',
} as const;
