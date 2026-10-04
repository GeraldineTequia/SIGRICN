import * as catalogo from '../reglas/catalogos';
import type { EsquemaValidacion } from './validador';

/**
 * Esquemas de entrada por operación. Los nombres son los de la API (snake_case);
 * los mapeadores de infraestructura los traducen a los campos heredados de MongoDB.
 * Un campo ausente del esquema NO puede enviarse en esa operación.
 */

const CAMPOS_DIRECCION: EsquemaValidacion = {
  pais: { tipo: 'texto', etiqueta: 'País', requerido: true, max_longitud: 80 },
  departamento: { tipo: 'texto', etiqueta: 'Departamento', requerido: true, max_longitud: 80 },
  municipio: { tipo: 'texto', etiqueta: 'Municipio', requerido: true, max_longitud: 80 },
  barrio: { tipo: 'texto', etiqueta: 'Barrio', max_longitud: 120 },
};

/* ------------------------------ Cuentas ------------------------------ */

export const ESQUEMA_REGISTRO: EsquemaValidacion = {
  nombre: { tipo: 'texto', etiqueta: 'Nombre', requerido: true, min_longitud: 2, max_longitud: 60 },
  apellido: { tipo: 'texto', etiqueta: 'Apellido', requerido: true, min_longitud: 2, max_longitud: 60 },
  correo: { tipo: 'correo', etiqueta: 'Correo', requerido: true, max_longitud: 120 },
  telefono: { tipo: 'telefono', etiqueta: 'Teléfono', requerido: true },
  // Las contraseñas se validan con su propia política (reglas/contrasena.ts).
  password: { tipo: 'texto', etiqueta: 'Contraseña', requerido: true, max_longitud: 200 },
  confirmacion_password: { tipo: 'texto', etiqueta: 'Confirmación', requerido: true, max_longitud: 200 },
};

export const ESQUEMA_INICIO_SESION: EsquemaValidacion = {
  correo: { tipo: 'correo', etiqueta: 'Correo', requerido: true, max_longitud: 120 },
  password: { tipo: 'texto', etiqueta: 'Contraseña', requerido: true, max_longitud: 200 },
};

export const ESQUEMA_SOLICITUD_RECUPERACION: EsquemaValidacion = {
  correo: { tipo: 'correo', etiqueta: 'Correo', requerido: true, max_longitud: 120 },
};

export const ESQUEMA_RESTABLECER: EsquemaValidacion = {
  token: { tipo: 'texto', etiqueta: 'Enlace de recuperación', requerido: true, min_longitud: 20, max_longitud: 200 },
  password: { tipo: 'texto', etiqueta: 'Contraseña', requerido: true, max_longitud: 200 },
  confirmacion_password: { tipo: 'texto', etiqueta: 'Confirmación', requerido: true, max_longitud: 200 },
};

export const ESQUEMA_EDICION_CUENTA: EsquemaValidacion = {
  nombre: { tipo: 'texto', etiqueta: 'Nombre', requerido: true, min_longitud: 2, max_longitud: 60 },
  apellido: { tipo: 'texto', etiqueta: 'Apellido', requerido: true, min_longitud: 2, max_longitud: 60 },
  telefono: { tipo: 'telefono', etiqueta: 'Teléfono', requerido: true },
};

export const ESQUEMA_CAMBIO_ROL: EsquemaValidacion = {
  rol: { tipo: 'enumeracion', etiqueta: 'Rol', requerido: true, valores: catalogo.ROLES },
};

export const ESQUEMA_CAMBIO_ESTADO_CUENTA: EsquemaValidacion = {
  estado: { tipo: 'enumeracion', etiqueta: 'Estado', requerido: true, valores: catalogo.ESTADOS_CUENTA },
};

/* ---------------------------- Emergencias ---------------------------- */

export const ESQUEMA_EMERGENCIA: EsquemaValidacion = {
  titulo: { tipo: 'texto', etiqueta: 'Título', requerido: true, min_longitud: 5, max_longitud: 140 },
  tipo: { tipo: 'enumeracion', etiqueta: 'Tipo', requerido: true, valores: catalogo.TIPOS_EMERGENCIA },
  descripcion: { tipo: 'texto', etiqueta: 'Descripción', requerido: true, min_longitud: 10, max_longitud: 2000 },
  fecha_inicio: { tipo: 'fecha', etiqueta: 'Fecha de inicio', requerido: true },
  nivel_emergencia: { tipo: 'enumeracion', etiqueta: 'Nivel de gravedad', requerido: true, valores: catalogo.NIVELES_EMERGENCIA },
  ...CAMPOS_DIRECCION,
  direccion_referencia: { tipo: 'texto', etiqueta: 'Dirección o referencia', max_longitud: 200 },
  fuente_informacion: { tipo: 'texto', etiqueta: 'Fuente de información', requerido: true, max_longitud: 120 },
  // La regla de magnitud la aplica la estrategia; aquí sólo se valida que, si llega, sea numérica.
  magnitud: { tipo: 'numero', etiqueta: 'Magnitud', minimo: 0, maximo: 10 },
  ubicacion: { tipo: 'ubicacion', etiqueta: 'Ubicación' },
};

export const ESQUEMA_TRANSICION_EMERGENCIA: EsquemaValidacion = {
  estado: { tipo: 'enumeracion', etiqueta: 'Nuevo estado', requerido: true, valores: catalogo.ESTADOS_EMERGENCIA },
  observacion: { tipo: 'texto', etiqueta: 'Observación', max_longitud: 500 },
};

/* ------------------------------- Zonas ------------------------------- */

export const ESQUEMA_ZONA: EsquemaValidacion = {
  catastrofe_id: { tipo: 'identificador', etiqueta: 'Emergencia asociada', requerido: true },
  ...CAMPOS_DIRECCION,
  direccion: { tipo: 'texto', etiqueta: 'Dirección o referencia', requerido: true, max_longitud: 200 },
  nivel_afectacion: { tipo: 'enumeracion', etiqueta: 'Nivel de afectación', requerido: true, valores: catalogo.NIVELES_EMERGENCIA },
  porcentaje_afectacion: { tipo: 'numero', etiqueta: 'Porcentaje de afectación', requerido: true, minimo: 0, maximo: 100 },
  prioridad: { tipo: 'enumeracion', etiqueta: 'Prioridad', requerido: true, valores: catalogo.PRIORIDADES },
  estado: { tipo: 'enumeracion', etiqueta: 'Estado general', requerido: true, valores: catalogo.ESTADOS_ZONA },
  descripcion: { tipo: 'texto', etiqueta: 'Descripción', max_longitud: 1000 },
  danos: { tipo: 'texto', etiqueta: 'Daños registrados', max_longitud: 1000 },
  ubicacion: { tipo: 'ubicacion', etiqueta: 'Ubicación' },
};

export const ESQUEMA_ATENCION_ZONA: EsquemaValidacion = {
  estado_atencion: { tipo: 'enumeracion', etiqueta: 'Estado de atención', requerido: true, valores: catalogo.ESTADOS_ATENCION_ZONA },
  observacion: { tipo: 'texto', etiqueta: 'Observación', max_longitud: 500 },
};

/* ------------------------ Población agregada ------------------------- */

const CONTEO = (etiqueta: string, requerido = false) =>
  ({ tipo: 'entero', etiqueta, requerido, minimo: 0, maximo: 10_000_000 }) as const;

export const ESQUEMA_POBLACION: EsquemaValidacion = {
  catastrofe_id: { tipo: 'identificador', etiqueta: 'Emergencia', requerido: true },
  zona_id: { tipo: 'identificador', etiqueta: 'Zona', requerido: true },
  personas_afectadas: CONTEO('Personas afectadas', true),
  familias_afectadas: CONTEO('Familias afectadas'),
  ninos: CONTEO('Niños y niñas'),
  adultos: CONTEO('Adultos'),
  adultos_mayores: CONTEO('Adultos mayores'),
  personas_discapacidad: CONTEO('Personas con discapacidad'),
  personas_heridas: CONTEO('Personas heridas'),
  personas_fallecidas: CONTEO('Personas fallecidas'),
  personas_desaparecidas: CONTEO('Personas desaparecidas'),
  personas_evacuadas: CONTEO('Personas evacuadas'),
  personas_albergadas: CONTEO('Personas albergadas'),
  personas_pendientes_atencion: CONTEO('Personas pendientes de atención'),
};

/* ------------------ Personas y familias (restringido) ----------------- */

export const ESQUEMA_FAMILIA: EsquemaValidacion = {
  catastrofe_id: { tipo: 'identificador', etiqueta: 'Emergencia', requerido: true },
  zona_id: { tipo: 'identificador', etiqueta: 'Zona', requerido: true },
  nombre_referencia: { tipo: 'texto', etiqueta: 'Nombre de referencia', requerido: true, min_longitud: 3, max_longitud: 100 },
  integrantes_reportados: { tipo: 'entero', etiqueta: 'Integrantes reportados', minimo: 1, maximo: 50 },
  observaciones: { tipo: 'texto', etiqueta: 'Observaciones', max_longitud: 1000 },
};

export const ESQUEMA_PERSONA: EsquemaValidacion = {
  catastrofe_id: { tipo: 'identificador', etiqueta: 'Emergencia', requerido: true },
  zona_id: { tipo: 'identificador', etiqueta: 'Zona', requerido: true },
  familia_id: { tipo: 'identificador', etiqueta: 'Familia' },
  nombres: { tipo: 'texto', etiqueta: 'Nombres', requerido: true, min_longitud: 2, max_longitud: 80 },
  apellidos: { tipo: 'texto', etiqueta: 'Apellidos', max_longitud: 80 },
  documento: { tipo: 'texto', etiqueta: 'Documento de identidad', max_longitud: 30 },
  fecha_nacimiento: { tipo: 'fecha', etiqueta: 'Fecha de nacimiento' },
  edad: { tipo: 'entero', etiqueta: 'Edad', minimo: 0, maximo: 130 },
  condiciones_vulnerabilidad: {
    tipo: 'lista_enumeracion',
    etiqueta: 'Condiciones de vulnerabilidad',
    valores: catalogo.CONDICIONES_VULNERABILIDAD,
  },
  observaciones: { tipo: 'texto', etiqueta: 'Observaciones', max_longitud: 1000 },
};

/* ----------------------------- Necesidades ---------------------------- */

export const ESQUEMA_NECESIDAD: EsquemaValidacion = {
  catastrofe_id: { tipo: 'identificador', etiqueta: 'Emergencia', requerido: true },
  ambito: { tipo: 'enumeracion', etiqueta: 'Ámbito', requerido: true, valores: catalogo.AMBITOS_NECESIDAD },
  zona_id: { tipo: 'identificador', etiqueta: 'Zona' },
  familia_id: { tipo: 'identificador', etiqueta: 'Familia' },
  persona_id: { tipo: 'identificador', etiqueta: 'Persona' },
  tipo: { tipo: 'enumeracion', etiqueta: 'Tipo de necesidad', requerido: true, valores: catalogo.TIPOS_NECESIDAD },
  descripcion: { tipo: 'texto', etiqueta: 'Descripción', requerido: true, min_longitud: 5, max_longitud: 1000 },
  cantidad_requerida: { tipo: 'entero', etiqueta: 'Cantidad requerida', requerido: true, minimo: 1, maximo: 100_000_000 },
  cantidad_recibida: { tipo: 'entero', etiqueta: 'Cantidad recibida', minimo: 0, maximo: 100_000_000 },
  unidad: { tipo: 'texto', etiqueta: 'Unidad', max_longitud: 30 },
  prioridad: { tipo: 'enumeracion', etiqueta: 'Prioridad', requerido: true, valores: catalogo.PRIORIDADES },
  estado: { tipo: 'enumeracion', etiqueta: 'Estado', requerido: true, valores: catalogo.ESTADOS_NECESIDAD },
  responsable: { tipo: 'texto', etiqueta: 'Responsable', max_longitud: 120 },
};

/* ------------------------ Centros y donaciones ------------------------ */

export const ESQUEMA_CENTRO_DONACION: EsquemaValidacion = {
  nombre: { tipo: 'texto', etiqueta: 'Nombre', requerido: true, min_longitud: 3, max_longitud: 120 },
  ...CAMPOS_DIRECCION,
  direccion: { tipo: 'texto', etiqueta: 'Dirección', requerido: true, max_longitud: 200 },
  telefono: { tipo: 'telefono', etiqueta: 'Teléfono' },
  correo: { tipo: 'correo', etiqueta: 'Correo', max_longitud: 120 },
  horario: { tipo: 'texto', etiqueta: 'Horario', max_longitud: 120 },
  tipos_donacion: { tipo: 'lista_enumeracion', etiqueta: 'Tipos de donación', valores: catalogo.TIPOS_DONACION_CENTRO },
  estado: { tipo: 'enumeracion', etiqueta: 'Estado', requerido: true, valores: catalogo.ESTADOS_CENTRO },
  ubicacion: { tipo: 'ubicacion', etiqueta: 'Ubicación' },
};

export const ESQUEMA_DONACION: EsquemaValidacion = {
  catastrofe_id: { tipo: 'identificador', etiqueta: 'Emergencia', requerido: true },
  centro_donacion_id: { tipo: 'identificador', etiqueta: 'Centro de donación' },
  usuario_id: { tipo: 'identificador', etiqueta: 'Cuenta del donante' },
  donante_nombre: { tipo: 'texto', etiqueta: 'Nombre del donante', max_longitud: 120 },
  tipo: { tipo: 'enumeracion', etiqueta: 'Tipo', requerido: true, valores: catalogo.TIPOS_DONACION },
  metodo_pago: { tipo: 'enumeracion', etiqueta: 'Método', requerido: true, valores: catalogo.METODOS_DONACION },
  valor: { tipo: 'entero', etiqueta: 'Valor (COP)', requerido: true, minimo: 0, maximo: 1_000_000_000_000 },
  descripcion: { tipo: 'texto', etiqueta: 'Descripción', max_longitud: 500 },
  fecha: { tipo: 'fecha', etiqueta: 'Fecha', requerido: true },
};

export const ESQUEMA_ESTADO_DONACION: EsquemaValidacion = {
  estado: { tipo: 'enumeracion', etiqueta: 'Estado', requerido: true, valores: catalogo.ESTADOS_DONACION },
  observacion: { tipo: 'texto', etiqueta: 'Observación', max_longitud: 500 },
};

/* ------------------------- Recursos materiales ------------------------ */

const CAMPOS_RECURSO: EsquemaValidacion = {
  tipo: { tipo: 'enumeracion', etiqueta: 'Tipo de recurso', requerido: true, valores: catalogo.TIPOS_RECURSO_MATERIAL },
  descripcion: { tipo: 'texto', etiqueta: 'Descripción', requerido: true, min_longitud: 3, max_longitud: 300 },
  unidad: { tipo: 'texto', etiqueta: 'Unidad', requerido: true, max_longitud: 30 },
  cantidad_minima: { tipo: 'entero', etiqueta: 'Mínimo operativo', minimo: 0, maximo: 100_000_000 },
  ubicacion_almacen: { tipo: 'texto', etiqueta: 'Bodega o ubicación', requerido: true, max_longitud: 150 },
  departamento: { tipo: 'texto', etiqueta: 'Departamento', requerido: true, max_longitud: 80 },
  municipio: { tipo: 'texto', etiqueta: 'Municipio', requerido: true, max_longitud: 80 },
  organizacion_responsable: { tipo: 'texto', etiqueta: 'Entidad responsable', requerido: true, max_longitud: 120 },
  estado: { tipo: 'enumeracion', etiqueta: 'Estado', requerido: true, valores: catalogo.ESTADOS_RECURSO },
  catastrofe_id: { tipo: 'identificador', etiqueta: 'Emergencia asociada' },
};

/** La cantidad inicial sólo se fija al crear; después cambia únicamente mediante movimientos (RF20). */
export const ESQUEMA_RECURSO_CREACION: EsquemaValidacion = {
  ...CAMPOS_RECURSO,
  cantidad_disponible: { tipo: 'entero', etiqueta: 'Cantidad inicial', requerido: true, minimo: 0, maximo: 100_000_000 },
};
export const ESQUEMA_RECURSO_EDICION: EsquemaValidacion = CAMPOS_RECURSO;

export const ESQUEMA_MOVIMIENTO_RECURSO: EsquemaValidacion = {
  tipo: { tipo: 'enumeracion', etiqueta: 'Tipo de movimiento', requerido: true, valores: ['ingreso', 'agotamiento'] },
  cantidad: { tipo: 'entero', etiqueta: 'Cantidad', requerido: true, minimo: 1, maximo: 100_000_000 },
  motivo: { tipo: 'texto', etiqueta: 'Motivo', requerido: true, min_longitud: 3, max_longitud: 300 },
  clave_idempotencia: { tipo: 'identificador', etiqueta: 'Clave de operación', requerido: true },
};

export const ESQUEMA_ASIGNACION: EsquemaValidacion = {
  recurso_id: { tipo: 'identificador', etiqueta: 'Recurso', requerido: true },
  cantidad: { tipo: 'entero', etiqueta: 'Cantidad', requerido: true, minimo: 1, maximo: 100_000_000 },
  catastrofe_id: { tipo: 'identificador', etiqueta: 'Emergencia', requerido: true },
  zona_id: { tipo: 'identificador', etiqueta: 'Zona de destino', requerido: true },
  responsable: { tipo: 'texto', etiqueta: 'Responsable', requerido: true, min_longitud: 3, max_longitud: 120 },
  fecha: { tipo: 'fecha', etiqueta: 'Fecha', requerido: true },
  observaciones: { tipo: 'texto', etiqueta: 'Observaciones', max_longitud: 500 },
  clave_idempotencia: { tipo: 'identificador', etiqueta: 'Clave de operación', requerido: true },
};

export const ESQUEMA_EDICION_ASIGNACION: EsquemaValidacion = {
  responsable: { tipo: 'texto', etiqueta: 'Responsable', requerido: true, min_longitud: 3, max_longitud: 120 },
  fecha: { tipo: 'fecha', etiqueta: 'Fecha', requerido: true },
  observaciones: { tipo: 'texto', etiqueta: 'Observaciones', max_longitud: 500 },
};

export const ESQUEMA_MOVIMIENTO_ASIGNACION: EsquemaValidacion = {
  tipo: { tipo: 'enumeracion', etiqueta: 'Movimiento', requerido: true, valores: ['entrega', 'devolucion'] },
  cantidad: { tipo: 'entero', etiqueta: 'Cantidad', requerido: true, minimo: 1, maximo: 100_000_000 },
  observaciones: { tipo: 'texto', etiqueta: 'Observaciones', max_longitud: 500 },
  clave_idempotencia: { tipo: 'identificador', etiqueta: 'Clave de operación', requerido: true },
};

/* -------------------------- Recursos humanos -------------------------- */

export const ESQUEMA_RECURSO_HUMANO: EsquemaValidacion = {
  nombre: { tipo: 'texto', etiqueta: 'Nombre de la persona o equipo', requerido: true, min_longitud: 3, max_longitud: 120 },
  funcion: { tipo: 'enumeracion', etiqueta: 'Función o especialidad', requerido: true, valores: catalogo.FUNCIONES_RECURSO_HUMANO },
  entidad: { tipo: 'texto', etiqueta: 'Entidad', requerido: true, max_longitud: 120 },
  integrantes: { tipo: 'entero', etiqueta: 'Integrantes', requerido: true, minimo: 1, maximo: 1000 },
  telefono_contacto: { tipo: 'telefono', etiqueta: 'Teléfono de contacto' },
  disponibilidad: { tipo: 'enumeracion', etiqueta: 'Disponibilidad', requerido: true, valores: ['disponible', 'no_disponible'] },
  observaciones: { tipo: 'texto', etiqueta: 'Observaciones', max_longitud: 500 },
};

export const ESQUEMA_ASIGNACION_RECURSO_HUMANO: EsquemaValidacion = {
  catastrofe_id: { tipo: 'identificador', etiqueta: 'Emergencia', requerido: true },
  zona_id: { tipo: 'identificador', etiqueta: 'Zona de destino', requerido: true },
};

/* -------------------------------- Fondos ------------------------------- */

export const ESQUEMA_FONDO_CREACION: EsquemaValidacion = {
  catastrofe_id: { tipo: 'identificador', etiqueta: 'Emergencia', requerido: true },
  origen: { tipo: 'enumeracion', etiqueta: 'Origen', requerido: true, valores: catalogo.ORIGENES_FONDO },
  entidad: { tipo: 'texto', etiqueta: 'Entidad', requerido: true, min_longitud: 2, max_longitud: 120 },
  concepto: { tipo: 'texto', etiqueta: 'Concepto', requerido: true, min_longitud: 3, max_longitud: 200 },
  monto_asignado: { tipo: 'entero', etiqueta: 'Monto asignado (COP)', requerido: true, minimo: 1, maximo: 1_000_000_000_000_000 },
};

export const ESQUEMA_FONDO_EDICION: EsquemaValidacion = {
  origen: ESQUEMA_FONDO_CREACION.origen,
  entidad: ESQUEMA_FONDO_CREACION.entidad,
  concepto: ESQUEMA_FONDO_CREACION.concepto,
  estado: { tipo: 'enumeracion', etiqueta: 'Estado', requerido: true, valores: catalogo.ESTADOS_FONDO },
};

export const ESQUEMA_MOVIMIENTO_FONDO: EsquemaValidacion = {
  tipo: { tipo: 'enumeracion', etiqueta: 'Tipo de movimiento', requerido: true, valores: catalogo.TIPOS_MOVIMIENTO_FONDO },
  monto: { tipo: 'entero', etiqueta: 'Monto (COP)', minimo: 1, maximo: 1_000_000_000_000_000 },
  concepto: { tipo: 'texto', etiqueta: 'Concepto', requerido: true, min_longitud: 3, max_longitud: 200 },
  /** Para un gasto que ejecuta un compromiso, o para anular un movimiento. */
  movimiento_relacionado_id: { tipo: 'identificador', etiqueta: 'Movimiento relacionado' },
  sentido: { tipo: 'enumeracion', etiqueta: 'Sentido del ajuste', valores: ['aumento', 'reduccion'] },
  clave_idempotencia: { tipo: 'identificador', etiqueta: 'Clave de operación', requerido: true },
};

/* ------------------------ Reportes ciudadanos ------------------------- */

export const ESQUEMA_REPORTE_CIUDADANO: EsquemaValidacion = {
  titulo: { tipo: 'texto', etiqueta: 'Título', requerido: true, min_longitud: 5, max_longitud: 140 },
  tipo: { tipo: 'enumeracion', etiqueta: 'Tipo', requerido: true, valores: catalogo.TIPOS_EMERGENCIA },
  descripcion: { tipo: 'texto', etiqueta: 'Descripción', requerido: true, min_longitud: 10, max_longitud: 2000 },
  ...CAMPOS_DIRECCION,
  direccion: { tipo: 'texto', etiqueta: 'Dirección o referencia', requerido: true, max_longitud: 200 },
  fecha_reporte: { tipo: 'fecha', etiqueta: 'Fecha del reporte', requerido: true },
  fuente: { tipo: 'texto', etiqueta: 'Fuente (medio de recepción)', requerido: true, max_longitud: 120 },
  ubicacion: { tipo: 'ubicacion', etiqueta: 'Ubicación' },
};

export const ESQUEMA_ESTADO_REPORTE: EsquemaValidacion = {
  estado: { tipo: 'enumeracion', etiqueta: 'Estado', requerido: true, valores: catalogo.ESTADOS_REPORTE_CIUDADANO },
  catastrofe_id: { tipo: 'identificador', etiqueta: 'Emergencia asociada' },
  observacion: { tipo: 'texto', etiqueta: 'Observación', max_longitud: 500 },
};

/* ------------------------------ Reportes PDF ----------------------------- */

export const CATEGORIAS_REPORTE_PDF = [
  'emergencias',
  'zonas',
  'poblacion',
  'necesidades',
  'recursos',
  'asignaciones',
  'donaciones',
  'fondos',
  'centros',
] as const;
export type CategoriaReportePdf = (typeof CATEGORIAS_REPORTE_PDF)[number];
