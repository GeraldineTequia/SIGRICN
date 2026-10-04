import type { Rol } from '@dominio/reglas/catalogos';
import type { UbicacionEntrada } from '@dominio/validacion/validador';

/** Formato común de las respuestas de la API. */
export interface RespuestaApi<T> {
  exito: boolean;
  datos: T;
  mensaje?: string;
  codigo?: string;
  errores?: Record<string, string>;
  paginacion?: Paginacion;
}

export interface Paginacion {
  total: number;
  pagina: number;
  limite: number;
  total_paginas: number;
}

export interface Listado<T> {
  elementos: T[];
  paginacion: Paginacion;
}

export interface Usuario {
  id: string;
  nombre: string;
  apellido: string;
  correo: string;
  rol: Rol;
  estado: string;
}

export interface CuentaDirectorio extends Usuario, RegistroBase {
  telefono: string | null;
  fecha_registro: string | null;
  ultima_sesion: string | null;
}

export interface Ubicacion extends UbicacionEntrada {
  confirmada_por?: string | null;
  confirmada_en?: string | null;
}

/** Registro genérico devuelto por la API (todos tienen id y fechas de auditoría). */
export interface RegistroBase {
  id: string;
  creado_en: string | null;
  actualizado_en: string | null;
  [campo: string]: unknown;
}

export interface Emergencia extends RegistroBase {
  titulo: string;
  tipo: string;
  descripcion: string;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  estado: string;
  estado_ciclo: string | null;
  es_estado_heredado: boolean;
  es_estado_desconocido: boolean;
  transiciones_permitidas: string[];
  pais: string;
  departamento: string;
  municipio: string;
  barrio: string | null;
  direccion_referencia: string | null;
  nivel_emergencia: string;
  fuente_informacion: string;
  fecha_registro: string | null;
  magnitud: number | null;
  pendiente_validacion: boolean;
  estrategia: string;
  clasificacion: { nivel_sugerido: string; criterio: string } | null;
  ubicacion: Ubicacion;
}

export interface Zona extends RegistroBase {
  catastrofe_id: string;
  pais: string;
  departamento: string;
  municipio: string;
  barrio: string | null;
  direccion: string;
  nivel_afectacion: string;
  porcentaje_afectacion: number;
  prioridad: string | null;
  estado: string;
  estado_atencion: string;
  transiciones_atencion: string[];
  descripcion: string | null;
  danos: string | null;
  ubicacion: Ubicacion;
  geometria: unknown;
}

export interface Recurso extends RegistroBase {
  tipo: string;
  descripcion: string;
  unidad: string;
  cantidad_disponible: number;
  cantidad_asignada: number;
  cantidad_entregada: number;
  cantidad_minima: number | null;
  cantidad_total: number;
  disponibilidad: string;
  ubicacion_almacen: string;
  departamento: string;
  municipio: string;
  organizacion_responsable: string;
  estado: string;
}

export interface Fondo extends RegistroBase {
  catastrofe_id: string;
  origen: string;
  entidad: string;
  concepto: string;
  moneda: string;
  monto_asignado: number;
  monto_comprometido: number;
  monto_gastado: number;
  monto_disponible: number;
  porcentaje_ejecutado: number;
  estado: string;
}

export interface Alerta extends RegistroBase {
  tipo: string;
  severidad: string;
  titulo: string;
  mensaje: string;
  entidad: string;
  entidad_id: string | null;
  responsable: string;
  fecha: string;
  leida: boolean;
  leida_en: string | null;
  entregada_en: string | null;
}

export interface ElementoMapa {
  capa: 'emergencias' | 'zonas' | 'centros';
  id: string;
  titulo: string;
  direccion: string;
  departamento: string;
  municipio: string;
  estado: string;
  nivel: string | null;
  estado_ubicacion: string;
  precision: string | null;
  punto: { latitud: number; longitud: number } | null;
  detalle: Record<string, unknown>;
  geometria: unknown;
}

export interface CoincidenciaGeocodificacion {
  direccion_encontrada: string;
  punto: { latitud: number; longitud: number };
  precision: 'direccion' | 'aproximada';
  tipo_lugar: string;
}

export interface ConteoAgrupado {
  clave: string;
  cantidad: number;
  valor_total?: number;
}

export interface IndicadoresTablero {
  emergencias: { total: number; por_estado: ConteoAgrupado[]; por_nivel: ConteoAgrupado[]; criticas_abiertas: number };
  zonas: { total: number; sin_atender: number; criticas: number; por_estado_atencion: ConteoAgrupado[] };
  poblacion: { personas_afectadas: number; familias_afectadas: number; registros_considerados: number; categorias: Record<string, number> };
  necesidades: { pendientes: number; criticas_pendientes: { id: string; tipo: string; prioridad: string; descripcion: string }[] };
  recursos: { unidades_disponibles: number; unidades_asignadas: number; unidades_entregadas: number; insuficientes: number; agotados: number };
  recursos_humanos: ConteoAgrupado[];
  centros_activos: number;
  donaciones: ConteoAgrupado[];
  fondos: { asignado: number; comprometido: number; gastado: number; disponible: number };
  generado_en: string;
}

export interface SerieMensual {
  anio: number;
  meses: string[];
  series: { tipo: string; valores: number[] }[];
}

export interface HistorialEstado extends RegistroBase {
  estado_anterior: string | null;
  estado_nuevo: string;
  usuario_nombre: string;
  observacion: string | null;
  fecha: string;
}
