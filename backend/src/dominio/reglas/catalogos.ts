/**
 * Catálogos de valores permitidos del dominio SGRICN.
 * Este archivo no depende de Express, Mongoose ni React: lo reutilizan el backend y el frontend
 * (mediante el alias @dominio) para que las listas de valores sean una sola fuente de verdad.
 */

export const ROLES = ['usuario', 'funcionario', 'administrador'] as const;
export type Rol = (typeof ROLES)[number];

export const ESTADOS_CUENTA = ['activo', 'inactivo'] as const;
export type EstadoCuenta = (typeof ESTADOS_CUENTA)[number];

export const TIPOS_EMERGENCIA = [
  'Inundación',
  'Terremoto',
  'Deslizamiento',
  'Avenida torrencial',
  'Incendio forestal',
  'Vendaval',
  'Huracán',
  'Sequía',
  'Tsunami',
  'Erupción volcánica',
  'Otro',
] as const;

export const NIVELES_EMERGENCIA = ['bajo', 'medio', 'alto', 'critico'] as const;
export type NivelEmergencia = (typeof NIVELES_EMERGENCIA)[number];

/** Ciclo de atención controlado por el patrón State (RF9). */
export const ESTADOS_EMERGENCIA = ['activa', 'en_atencion', 'controlada', 'finalizada'] as const;
export type EstadoEmergencia = (typeof ESTADOS_EMERGENCIA)[number];

/**
 * Equivalencias documentadas para estados heredados que puedan existir en la base.
 * NO se migran automáticamente: sólo se usan para mostrar el registro y decidir sus transiciones.
 */
export const EQUIVALENCIAS_ESTADO_HEREDADO: Record<string, EstadoEmergencia> = {
  en_proceso: 'en_atencion',
  'en proceso': 'en_atencion',
  atendida: 'controlada',
  contenida: 'controlada',
  cerrada: 'finalizada',
  finalizado: 'finalizada',
  inactiva: 'finalizada',
};

export const PRIORIDADES = ['baja', 'media', 'alta', 'critica'] as const;
export type Prioridad = (typeof PRIORIDADES)[number];

export const ESTADOS_ZONA = ['activa', 'en_recuperacion', 'cerrada'] as const;

/** Estados de atención de zonas (RF13). */
export const ESTADOS_ATENCION_ZONA = [
  'sin_atender',
  'en_atencion',
  'atendida_parcialmente',
  'atendida_completamente',
] as const;
export type EstadoAtencionZona = (typeof ESTADOS_ATENCION_ZONA)[number];

export const TIPOS_NECESIDAD = [
  'Alimentos',
  'Agua potable',
  'Albergue',
  'Medicamentos',
  'Atención médica',
  'Ropa',
  'Higiene',
  'Transporte',
  'Apoyo psicosocial',
  'Otro',
] as const;
export const ESTADOS_NECESIDAD = ['pendiente', 'en_proceso', 'atendida'] as const;
export const AMBITOS_NECESIDAD = ['zona', 'familia', 'persona'] as const;
export type AmbitoNecesidad = (typeof AMBITOS_NECESIDAD)[number];

export const TIPOS_DONACION = ['Monetaria', 'Alimentos', 'Ropa', 'Medicamentos', 'Higiene', 'Otro'] as const;
export const METODOS_DONACION = ['PSE', 'Transferencia', 'Efectivo', 'Tarjeta', 'Especie'] as const;
export const ESTADOS_DONACION = ['registrada', 'en_verificacion', 'confirmada', 'rechazada', 'anulada'] as const;

export const ESTADOS_CENTRO = ['activo', 'inactivo'] as const;
export const TIPOS_DONACION_CENTRO = ['Alimentos', 'Ropa', 'Medicamentos', 'Higiene', 'Agua', 'Monetaria', 'Otro'] as const;

export const ESTADOS_REPORTE_CIUDADANO = ['pendiente', 'en_revision', 'verificado', 'descartado'] as const;

export const TIPOS_RECURSO_MATERIAL = [
  'Agua',
  'Alimentos',
  'Kits de emergencia',
  'Carpas',
  'Frazadas',
  'Medicamentos',
  'Herramientas',
  'Vehículos',
  'Combustible',
  'Otro',
] as const;
export const ESTADOS_RECURSO = ['activo', 'inactivo'] as const;
export const DISPONIBILIDADES_RECURSO = ['disponible', 'insuficiente', 'agotado'] as const;
export type DisponibilidadRecurso = (typeof DISPONIBILIDADES_RECURSO)[number];

export const TIPOS_MOVIMIENTO_RECURSO = ['ingreso', 'asignacion', 'entrega', 'devolucion', 'agotamiento', 'anulacion'] as const;
export type TipoMovimientoRecurso = (typeof TIPOS_MOVIMIENTO_RECURSO)[number];

export const ESTADOS_ASIGNACION = ['asignada', 'entregada_parcialmente', 'entregada', 'cerrada', 'anulada'] as const;

export const FUNCIONES_RECURSO_HUMANO = [
  'Rescate',
  'Atención médica',
  'Apoyo psicosocial',
  'Logística',
  'Ingeniería estructural',
  'Bomberos',
  'Censo y registro',
  'Comunicaciones',
  'Voluntariado general',
  'Otro',
] as const;
export const DISPONIBILIDADES_RECURSO_HUMANO = ['disponible', 'asignado', 'no_disponible'] as const;

export const ORIGENES_FONDO = [
  'Nacional (UNGRD)',
  'Departamental',
  'Municipal',
  'Donación',
  'Cooperación internacional',
  'Privado',
  'Otro',
] as const;
export const ESTADOS_FONDO = ['activo', 'cerrado'] as const;
export const TIPOS_MOVIMIENTO_FONDO = ['compromiso', 'gasto', 'anulacion_compromiso', 'anulacion_gasto', 'ajuste_asignacion'] as const;
export type TipoMovimientoFondo = (typeof TIPOS_MOVIMIENTO_FONDO)[number];

/** Moneda de los montos financieros: pesos colombianos enteros (sin decimales). */
export const MONEDA = 'COP';

export const CONDICIONES_VULNERABILIDAD = [
  'discapacidad',
  'movilidad_reducida',
  'enfermedad_cronica',
  'embarazo_o_lactancia',
  'menor_no_acompanado',
  'adulto_mayor_sin_red_de_apoyo',
  'requiere_medicamentos',
  'otra',
] as const;

export const GRUPOS_EDAD = ['nino', 'adolescente', 'adulto', 'adulto_mayor', 'pendiente'] as const;
export type GrupoEdad = (typeof GRUPOS_EDAD)[number];

export const TIPOS_ALERTA = [
  'nueva_emergencia',
  'caso_critico',
  'zona_sin_atencion',
  'recurso_insuficiente',
  'cambio_estado_emergencia',
  'asignacion_recurso',
  'entrega_recurso',
  'reporte_ciudadano',
] as const;
export type TipoAlerta = (typeof TIPOS_ALERTA)[number];
export const SEVERIDADES_ALERTA = ['informativa', 'media', 'alta', 'critica'] as const;
export type SeveridadAlerta = (typeof SEVERIDADES_ALERTA)[number];

export const ESTADOS_UBICACION = ['sin_ubicacion', 'pendiente', 'confirmada'] as const;
export type EstadoUbicacion = (typeof ESTADOS_UBICACION)[number];

export const ETIQUETAS: Record<string, string> = {
  bajo: 'Bajo',
  medio: 'Medio',
  alto: 'Alto',
  critico: 'Crítico',
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
  critica: 'Crítica',
  activa: 'Activa',
  en_atencion: 'En atención',
  controlada: 'Controlada',
  finalizada: 'Finalizada',
  sin_atender: 'Sin atender',
  atendida_parcialmente: 'Atendida parcialmente',
  atendida_completamente: 'Atendida completamente',
  en_recuperacion: 'En recuperación',
  cerrada: 'Cerrada',
  pendiente: 'Pendiente',
  en_proceso: 'En proceso',
  atendida: 'Atendida',
  registrada: 'Registrada',
  en_verificacion: 'En verificación',
  confirmada: 'Confirmada',
  rechazada: 'Rechazada',
  anulada: 'Anulada',
  activo: 'Activo',
  inactivo: 'Inactivo',
  en_revision: 'En revisión',
  verificado: 'Verificado',
  descartado: 'Descartado',
  disponible: 'Disponible',
  insuficiente: 'Insuficiente',
  agotado: 'Agotado',
  asignado: 'Asignado',
  no_disponible: 'No disponible',
  asignada: 'Asignada',
  entregada_parcialmente: 'Entregada parcialmente',
  entregada: 'Entregada',
  usuario: 'Usuario',
  funcionario: 'Funcionario',
  administrador: 'Administrador',
  nino: 'Niño o niña (0–11)',
  adolescente: 'Adolescente (12–17)',
  adulto: 'Adulto (18–59)',
  adulto_mayor: 'Adulto mayor (60+)',
  sin_ubicacion: 'Sin ubicación',
  zona: 'Zona',
  familia: 'Familia',
  persona: 'Persona',
  compromiso: 'Compromiso',
  gasto: 'Gasto',
  anulacion_compromiso: 'Anulación de compromiso',
  anulacion_gasto: 'Anulación de gasto',
  ajuste_asignacion: 'Ajuste de asignación',
  ingreso: 'Ingreso',
  asignacion: 'Asignación',
  entrega: 'Entrega',
  devolucion: 'Devolución',
  agotamiento: 'Agotamiento',
  anulacion: 'Anulación',
  informativa: 'Informativa',
  discapacidad: 'Discapacidad',
  movilidad_reducida: 'Movilidad reducida',
  enfermedad_cronica: 'Enfermedad crónica',
  embarazo_o_lactancia: 'Embarazo o lactancia',
  menor_no_acompanado: 'Menor no acompañado',
  adulto_mayor_sin_red_de_apoyo: 'Adulto mayor sin red de apoyo',
  requiere_medicamentos: 'Requiere medicamentos',
  otra: 'Otra',
};

/** Devuelve la etiqueta legible de un valor de catálogo, o el mismo valor si no está catalogado. */
export function obtener_etiqueta(valor: string | null | undefined): string {
  if (valor === null || valor === undefined || valor === '') return '—';
  return ETIQUETAS[valor] ?? valor;
}
