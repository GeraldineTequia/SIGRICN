import mongoose, { Schema, Types, type Model } from 'mongoose';
import { COLECCIONES_HEREDADAS as HEREDADAS, COLECCIONES_NUEVAS as NUEVAS } from '../nombres_colecciones';

/**
 * Modelos Mongoose con nombres de colección EXPLÍCITOS (tercer argumento de model()).
 *
 * Decisiones de compatibilidad con la base existente:
 * - _id y las referencias (catastrofeId, zonaId, usuarioId) son Mixed: pueden ser ObjectId o texto.
 * - Las fechas heredadas son Mixed: pueden estar guardadas como texto ISO o como BSON Date.
 *   Los registros nuevos se escriben con Date. No se convierte ningún valor existente.
 * - Los campos heredados conservan su nombre (camelCase); el mapeador los traduce a la API.
 * - autoIndex está desactivado: los índices se crean con un script revisable (ver scripts/crear_indices.ts),
 *   salvo índices de colecciones NUEVAS, que se crean al iniciar si la configuración lo permite.
 */

const Mixto = Schema.Types.Mixed;
const ID_PREDETERMINADO = { type: Mixto, default: () => new Types.ObjectId() };
const OPCIONES = { timestamps: true, versionKey: false, autoIndex: false, strict: true } as const;

/**
 * Ubicación interna: { estado, punto: GeoJSON Point | null, direccionConsultada, direccionEncontrada,
 * origen, precision, confirmadaPor, confirmadaEn }. Se declara Mixed y su forma la garantiza el mapeador.
 */
const ESQUEMA_UBICACION = { type: Mixto, default: undefined };

function crear_modelo(nombre: string, coleccion: string, definicion: Record<string, unknown>): Model<Record<string, unknown>> {
  if (mongoose.models[nombre]) return mongoose.models[nombre] as Model<Record<string, unknown>>;
  const esquema = new Schema({ _id: ID_PREDETERMINADO, ...definicion }, { ...OPCIONES, collection: coleccion });
  return mongoose.model<Record<string, unknown>>(nombre, esquema, coleccion);
}

/* ------------------------------ Heredadas ------------------------------ */

export const ModeloUsuario = crear_modelo('Usuario', HEREDADAS.usuarios, {
  nombre: String,
  apellido: String,
  correo: String,
  password: String,
  rol: String,
  estado: String,
  telefono: String,
  fechaRegistro: Mixto,
  ultimaSesion: Mixto,
});

export const ModeloEmergencia = crear_modelo('Emergencia', HEREDADAS.emergencias, {
  titulo: String,
  tipo: String,
  descripcion: String,
  fechaInicio: Mixto,
  fechaFin: Mixto,
  estado: String,
  pais: String,
  departamento: String,
  municipio: String,
  barrio: String,
  direccionReferencia: String,
  nivelEmergencia: String,
  fuenteInformacion: String,
  fechaRegistro: Mixto,
  // Campos nuevos (no existen en la estructura de referencia)
  magnitud: Number,
  ubicacion: ESQUEMA_UBICACION,
  // { nivel_sugerido, criterio } calculado por la estrategia (campo nuevo, no heredado).
  clasificacion: Mixto,
  registradoPor: Mixto,
  actualizadoPor: Mixto,
});

export const ModeloZona = crear_modelo('ZonaAfectada', HEREDADAS.zonas_afectadas, {
  catastrofeId: Mixto,
  pais: String,
  departamento: String,
  municipio: String,
  barrio: String,
  direccion: String,
  nivelAfectacion: String,
  porcentajeAfectacion: Number,
  estado: String,
  descripcion: String,
  // Campos nuevos
  prioridad: String,
  estadoAtencion: String,
  danos: String,
  ubicacion: ESQUEMA_UBICACION,
  geometria: Mixto,
  geometriaValidada: Boolean,
  registradoPor: Mixto,
});

export const ModeloPoblacion = crear_modelo('PoblacionAfectada', HEREDADAS.poblacion_afectada, {
  catastrofeId: Mixto,
  zonaId: Mixto,
  personasAfectadas: Number,
  familiasAfectadas: Number,
  ninos: Number,
  adultos: Number,
  adultosMayores: Number,
  personasDiscapacidad: Number,
  personasHeridas: Number,
  personasFallecidas: Number,
  personasDesaparecidas: Number,
  personasEvacuadas: Number,
  personasAlbergadas: Number,
  personasPendientesAtencion: Number,
  registradoPor: Mixto,
});

export const ModeloNecesidad = crear_modelo('Necesidad', HEREDADAS.necesidades, {
  catastrofeId: Mixto,
  tipo: String,
  descripcion: String,
  cantidadRequerida: Number,
  cantidadRecibida: Number,
  prioridad: String,
  estado: String,
  // Campos nuevos (RF16)
  ambito: String,
  zonaId: Mixto,
  familiaId: Mixto,
  personaId: Mixto,
  unidad: String,
  responsable: String,
  registradoPor: Mixto,
});

export const ModeloCentroDonacion = crear_modelo('CentroDonacion', HEREDADAS.centros_donacion, {
  nombre: String,
  pais: String,
  departamento: String,
  municipio: String,
  barrio: String,
  direccion: String,
  telefono: String,
  correo: String,
  horario: String,
  tiposDonacion: [String],
  estado: String,
  ubicacion: ESQUEMA_UBICACION,
});

export const ModeloDonacion = crear_modelo('Donacion', HEREDADAS.donaciones, {
  usuarioId: Mixto,
  catastrofeId: Mixto,
  tipo: String,
  metodoPago: String,
  valor: Number,
  fecha: Mixto,
  estado: String,
  // Campos nuevos
  centroDonacionId: Mixto,
  donanteNombre: String,
  descripcion: String,
  registradoPor: Mixto,
});

/* -------------------------------- Nuevas -------------------------------- */

export const ModeloFamilia = crear_modelo('FamiliaAfectada', NUEVAS.familias_afectadas, {
  catastrofeId: Mixto,
  zonaId: Mixto,
  nombreReferencia: String,
  integrantesReportados: Number,
  observaciones: String,
  registradoPor: Mixto,
});

/** Datos individuales restringidos. documento, condiciones y observaciones se guardan cifrados (RNF5). */
export const ModeloPersona = crear_modelo('PersonaAfectada', NUEVAS.personas_afectadas, {
  catastrofeId: Mixto,
  zonaId: Mixto,
  familiaId: Mixto,
  nombres: String,
  apellidos: String,
  documentoCifrado: String,
  fechaNacimiento: Mixto,
  edad: Number,
  grupoEdad: String,
  condicionesCifradas: String,
  observacionesCifradas: String,
  registradoPor: Mixto,
});

export const ModeloRecurso = crear_modelo('Recurso', NUEVAS.recursos, {
  tipo: String,
  descripcion: String,
  unidad: String,
  cantidadDisponible: Number,
  cantidadAsignada: Number,
  cantidadEntregada: Number,
  cantidadMinima: Number,
  ubicacionAlmacen: String,
  departamento: String,
  municipio: String,
  organizacionResponsable: String,
  estado: String,
  catastrofeId: Mixto,
});

export const ModeloMovimientoRecurso = crear_modelo('MovimientoRecurso', NUEVAS.movimientos_recursos, {
  recursoId: Mixto,
  asignacionId: Mixto,
  tipo: String,
  cantidad: Number,
  motivo: String,
  estado: String,
  claveIdempotencia: String,
  responsableId: Mixto,
  fecha: Date,
});

export const ModeloAsignacion = crear_modelo('AsignacionRecurso', NUEVAS.asignaciones_recursos, {
  recursoId: Mixto,
  cantidad: Number,
  cantidadEntregada: Number,
  cantidadDevuelta: Number,
  // Unidades asignadas que aún no se entregan ni se devuelven (se descuenta de forma atómica).
  cantidadPendiente: Number,
  catastrofeId: Mixto,
  zonaId: Mixto,
  responsable: String,
  fecha: Date,
  observaciones: String,
  estado: String,
  claveIdempotencia: String,
  registradoPor: Mixto,
});

export const ModeloRecursoHumano = crear_modelo('RecursoHumano', NUEVAS.recursos_humanos, {
  nombre: String,
  funcion: String,
  entidad: String,
  integrantes: Number,
  telefonoContacto: String,
  disponibilidad: String,
  catastrofeId: Mixto,
  zonaId: Mixto,
  observaciones: String,
});

export const ModeloFondo = crear_modelo('Fondo', NUEVAS.fondos, {
  catastrofeId: Mixto,
  origen: String,
  entidad: String,
  concepto: String,
  moneda: String,
  montoAsignado: Number,
  montoComprometido: Number,
  montoGastado: Number,
  // Invariante: montoDisponible = montoAsignado − montoComprometido − montoGastado
  montoDisponible: Number,
  estado: String,
  registradoPor: Mixto,
});

export const ModeloMovimientoFondo = crear_modelo('MovimientoFondo', NUEVAS.movimientos_fondos, {
  fondoId: Mixto,
  tipo: String,
  monto: Number,
  concepto: String,
  movimientoRelacionadoId: Mixto,
  estado: String,
  claveIdempotencia: String,
  responsableId: Mixto,
  fecha: Date,
});

export const ModeloReporteCiudadano = crear_modelo('ReporteCiudadano', NUEVAS.reportes_ciudadanos, {
  titulo: String,
  tipo: String,
  descripcion: String,
  pais: String,
  departamento: String,
  municipio: String,
  barrio: String,
  direccion: String,
  fechaReporte: Date,
  fuente: String,
  estado: String,
  catastrofeId: Mixto,
  evidencia: { nombreAlmacenado: String, nombreOriginal: String, tipoMime: String, tamano: Number },
  ubicacion: ESQUEMA_UBICACION,
  registradoPor: Mixto,
});

export const ModeloHistorialEstado = crear_modelo('HistorialEstado', NUEVAS.historial_estados, {
  entidad: String,
  entidadId: Mixto,
  estadoAnterior: String,
  estadoNuevo: String,
  usuarioId: Mixto,
  usuarioNombre: String,
  observacion: String,
  fecha: Date,
});

export const ModeloAlerta = crear_modelo('Alerta', NUEVAS.alertas, {
  tipo: String,
  severidad: String,
  titulo: String,
  mensaje: String,
  entidad: String,
  entidadId: Mixto,
  rolesDestinatarios: [String],
  responsable: String,
  claveDeduplicacion: String,
  fecha: Date,
});

export const ModeloLecturaAlerta = crear_modelo('LecturaAlerta', NUEVAS.lecturas_alertas, {
  alertaId: Mixto,
  usuarioId: Mixto,
  entregadaEn: Date,
  leidaEn: Date,
});

export const ModeloAuditoria = crear_modelo('Auditoria', NUEVAS.auditoria, {
  accion: String,
  entidad: String,
  entidadId: Mixto,
  usuarioId: Mixto,
  usuarioNombre: String,
  detalle: Mixto,
  fecha: Date,
});

export const ModeloTokenRecuperacion = crear_modelo('TokenRecuperacion', NUEVAS.tokens_recuperacion, {
  usuarioId: Mixto,
  tokenHash: String,
  venceEn: Date,
  usadoEn: Date,
});

/** Índices de colecciones NUEVAS (no afectan datos heredados). Garantizan idempotencia y unicidad. */
export async function crear_indices_colecciones_nuevas(): Promise<void> {
  await ModeloMovimientoRecurso.collection.createIndex({ claveIdempotencia: 1 }, { unique: true, sparse: true });
  await ModeloAsignacion.collection.createIndex({ claveIdempotencia: 1 }, { unique: true, sparse: true });
  await ModeloMovimientoFondo.collection.createIndex({ claveIdempotencia: 1 }, { unique: true, sparse: true });
  await ModeloAlerta.collection.createIndex({ claveDeduplicacion: 1 }, { unique: true, sparse: true });
  await ModeloAlerta.collection.createIndex({ fecha: -1 });
  await ModeloLecturaAlerta.collection.createIndex({ alertaId: 1, usuarioId: 1 }, { unique: true });
  await ModeloTokenRecuperacion.collection.createIndex({ tokenHash: 1 }, { unique: true });
  // Los tokens vencidos se eliminan automáticamente un día después de su vencimiento.
  await ModeloTokenRecuperacion.collection.createIndex({ venceEn: 1 }, { expireAfterSeconds: 86_400 });
  await ModeloHistorialEstado.collection.createIndex({ entidad: 1, entidadId: 1, fecha: -1 });
  await ModeloAuditoria.collection.createIndex({ fecha: -1 });
}
