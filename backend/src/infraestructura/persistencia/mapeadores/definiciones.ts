import type { DefinicionMapeo } from './MapeadorDocumento';

/**
 * Mapeo por entidad: campo de la API (snake_case) → campo en MongoDB (nombre heredado o nuevo).
 * Los campos registrado_por / actualizado_por los llena el servidor, nunca el cliente.
 */

const DIRECCION = { pais: 'pais', departamento: 'departamento', municipio: 'municipio', barrio: 'barrio' };

export const MAPEO_USUARIO: DefinicionMapeo = {
  campos: {
    nombre: 'nombre',
    apellido: 'apellido',
    correo: 'correo',
    rol: 'rol',
    estado: 'estado',
    telefono: 'telefono',
    fecha_registro: 'fechaRegistro',
    ultima_sesion: 'ultimaSesion',
  },
  fechas: ['fecha_registro', 'ultima_sesion'],
};

export const MAPEO_EMERGENCIA: DefinicionMapeo = {
  campos: {
    titulo: 'titulo',
    tipo: 'tipo',
    descripcion: 'descripcion',
    fecha_inicio: 'fechaInicio',
    fecha_fin: 'fechaFin',
    estado: 'estado',
    ...DIRECCION,
    direccion_referencia: 'direccionReferencia',
    nivel_emergencia: 'nivelEmergencia',
    fuente_informacion: 'fuenteInformacion',
    fecha_registro: 'fechaRegistro',
    magnitud: 'magnitud',
    clasificacion: 'clasificacion',
    registrado_por: 'registradoPor',
    actualizado_por: 'actualizadoPor',
  },
  referencias: ['registrado_por', 'actualizado_por'],
  fechas: ['fecha_inicio', 'fecha_fin', 'fecha_registro'],
  tiene_ubicacion: true,
};

export const MAPEO_ZONA: DefinicionMapeo = {
  campos: {
    catastrofe_id: 'catastrofeId',
    ...DIRECCION,
    direccion: 'direccion',
    nivel_afectacion: 'nivelAfectacion',
    porcentaje_afectacion: 'porcentajeAfectacion',
    prioridad: 'prioridad',
    estado: 'estado',
    estado_atencion: 'estadoAtencion',
    descripcion: 'descripcion',
    danos: 'danos',
    geometria: 'geometria',
    geometria_validada: 'geometriaValidada',
    registrado_por: 'registradoPor',
  },
  referencias: ['catastrofe_id', 'registrado_por'],
  tiene_ubicacion: true,
};

export const MAPEO_POBLACION: DefinicionMapeo = {
  campos: {
    catastrofe_id: 'catastrofeId',
    zona_id: 'zonaId',
    personas_afectadas: 'personasAfectadas',
    familias_afectadas: 'familiasAfectadas',
    ninos: 'ninos',
    adultos: 'adultos',
    adultos_mayores: 'adultosMayores',
    personas_discapacidad: 'personasDiscapacidad',
    personas_heridas: 'personasHeridas',
    personas_fallecidas: 'personasFallecidas',
    personas_desaparecidas: 'personasDesaparecidas',
    personas_evacuadas: 'personasEvacuadas',
    personas_albergadas: 'personasAlbergadas',
    personas_pendientes_atencion: 'personasPendientesAtencion',
    registrado_por: 'registradoPor',
  },
  referencias: ['catastrofe_id', 'zona_id', 'registrado_por'],
};

export const MAPEO_NECESIDAD: DefinicionMapeo = {
  campos: {
    catastrofe_id: 'catastrofeId',
    tipo: 'tipo',
    descripcion: 'descripcion',
    cantidad_requerida: 'cantidadRequerida',
    cantidad_recibida: 'cantidadRecibida',
    prioridad: 'prioridad',
    estado: 'estado',
    ambito: 'ambito',
    zona_id: 'zonaId',
    familia_id: 'familiaId',
    persona_id: 'personaId',
    unidad: 'unidad',
    responsable: 'responsable',
    registrado_por: 'registradoPor',
  },
  referencias: ['catastrofe_id', 'zona_id', 'familia_id', 'persona_id', 'registrado_por'],
};

export const MAPEO_CENTRO_DONACION: DefinicionMapeo = {
  campos: {
    nombre: 'nombre',
    ...DIRECCION,
    direccion: 'direccion',
    telefono: 'telefono',
    correo: 'correo',
    horario: 'horario',
    tipos_donacion: 'tiposDonacion',
    estado: 'estado',
  },
  tiene_ubicacion: true,
};

export const MAPEO_DONACION: DefinicionMapeo = {
  campos: {
    usuario_id: 'usuarioId',
    catastrofe_id: 'catastrofeId',
    centro_donacion_id: 'centroDonacionId',
    donante_nombre: 'donanteNombre',
    tipo: 'tipo',
    metodo_pago: 'metodoPago',
    valor: 'valor',
    descripcion: 'descripcion',
    fecha: 'fecha',
    estado: 'estado',
    registrado_por: 'registradoPor',
  },
  referencias: ['usuario_id', 'catastrofe_id', 'centro_donacion_id', 'registrado_por'],
  fechas: ['fecha'],
};

export const MAPEO_FAMILIA: DefinicionMapeo = {
  campos: {
    catastrofe_id: 'catastrofeId',
    zona_id: 'zonaId',
    nombre_referencia: 'nombreReferencia',
    integrantes_reportados: 'integrantesReportados',
    observaciones: 'observaciones',
    registrado_por: 'registradoPor',
  },
  referencias: ['catastrofe_id', 'zona_id', 'registrado_por'],
};

export const MAPEO_PERSONA: DefinicionMapeo = {
  campos: {
    catastrofe_id: 'catastrofeId',
    zona_id: 'zonaId',
    familia_id: 'familiaId',
    nombres: 'nombres',
    apellidos: 'apellidos',
    fecha_nacimiento: 'fechaNacimiento',
    edad: 'edad',
    grupo_edad: 'grupoEdad',
    registrado_por: 'registradoPor',
  },
  referencias: ['catastrofe_id', 'zona_id', 'familia_id', 'registrado_por'],
  fechas: ['fecha_nacimiento'],
  cifrados: {
    documento: 'documentoCifrado',
    condiciones_vulnerabilidad: 'condicionesCifradas',
    observaciones: 'observacionesCifradas',
  },
};

export const MAPEO_RECURSO: DefinicionMapeo = {
  campos: {
    tipo: 'tipo',
    descripcion: 'descripcion',
    unidad: 'unidad',
    cantidad_disponible: 'cantidadDisponible',
    cantidad_asignada: 'cantidadAsignada',
    cantidad_entregada: 'cantidadEntregada',
    cantidad_minima: 'cantidadMinima',
    ubicacion_almacen: 'ubicacionAlmacen',
    departamento: 'departamento',
    municipio: 'municipio',
    organizacion_responsable: 'organizacionResponsable',
    estado: 'estado',
    catastrofe_id: 'catastrofeId',
  },
  referencias: ['catastrofe_id'],
};

export const MAPEO_MOVIMIENTO_RECURSO: DefinicionMapeo = {
  campos: {
    recurso_id: 'recursoId',
    asignacion_id: 'asignacionId',
    tipo: 'tipo',
    cantidad: 'cantidad',
    motivo: 'motivo',
    estado: 'estado',
    clave_idempotencia: 'claveIdempotencia',
    responsable_id: 'responsableId',
    fecha: 'fecha',
  },
  referencias: ['recurso_id', 'asignacion_id', 'responsable_id'],
  fechas: ['fecha'],
};

export const MAPEO_ASIGNACION: DefinicionMapeo = {
  campos: {
    recurso_id: 'recursoId',
    cantidad: 'cantidad',
    cantidad_entregada: 'cantidadEntregada',
    cantidad_devuelta: 'cantidadDevuelta',
    cantidad_pendiente: 'cantidadPendiente',
    catastrofe_id: 'catastrofeId',
    zona_id: 'zonaId',
    responsable: 'responsable',
    fecha: 'fecha',
    observaciones: 'observaciones',
    estado: 'estado',
    clave_idempotencia: 'claveIdempotencia',
    registrado_por: 'registradoPor',
  },
  referencias: ['recurso_id', 'catastrofe_id', 'zona_id', 'registrado_por'],
  fechas: ['fecha'],
};

export const MAPEO_RECURSO_HUMANO: DefinicionMapeo = {
  campos: {
    nombre: 'nombre',
    funcion: 'funcion',
    entidad: 'entidad',
    integrantes: 'integrantes',
    telefono_contacto: 'telefonoContacto',
    disponibilidad: 'disponibilidad',
    catastrofe_id: 'catastrofeId',
    zona_id: 'zonaId',
    observaciones: 'observaciones',
  },
  referencias: ['catastrofe_id', 'zona_id'],
};

export const MAPEO_FONDO: DefinicionMapeo = {
  campos: {
    catastrofe_id: 'catastrofeId',
    origen: 'origen',
    entidad: 'entidad',
    concepto: 'concepto',
    moneda: 'moneda',
    monto_asignado: 'montoAsignado',
    monto_comprometido: 'montoComprometido',
    monto_gastado: 'montoGastado',
    monto_disponible: 'montoDisponible',
    estado: 'estado',
    registrado_por: 'registradoPor',
  },
  referencias: ['catastrofe_id', 'registrado_por'],
};

export const MAPEO_MOVIMIENTO_FONDO: DefinicionMapeo = {
  campos: {
    fondo_id: 'fondoId',
    tipo: 'tipo',
    monto: 'monto',
    concepto: 'concepto',
    movimiento_relacionado_id: 'movimientoRelacionadoId',
    estado: 'estado',
    clave_idempotencia: 'claveIdempotencia',
    responsable_id: 'responsableId',
    fecha: 'fecha',
  },
  referencias: ['fondo_id', 'movimiento_relacionado_id', 'responsable_id'],
  fechas: ['fecha'],
};

export const MAPEO_REPORTE_CIUDADANO: DefinicionMapeo = {
  campos: {
    titulo: 'titulo',
    tipo: 'tipo',
    descripcion: 'descripcion',
    ...DIRECCION,
    direccion: 'direccion',
    fecha_reporte: 'fechaReporte',
    fuente: 'fuente',
    estado: 'estado',
    catastrofe_id: 'catastrofeId',
    evidencia: 'evidencia',
    registrado_por: 'registradoPor',
  },
  referencias: ['catastrofe_id', 'registrado_por'],
  fechas: ['fecha_reporte'],
  tiene_ubicacion: true,
};

export const MAPEO_HISTORIAL: DefinicionMapeo = {
  campos: {
    entidad: 'entidad',
    entidad_id: 'entidadId',
    estado_anterior: 'estadoAnterior',
    estado_nuevo: 'estadoNuevo',
    usuario_id: 'usuarioId',
    usuario_nombre: 'usuarioNombre',
    observacion: 'observacion',
    fecha: 'fecha',
  },
  referencias: ['entidad_id', 'usuario_id'],
  fechas: ['fecha'],
};

export const MAPEO_ALERTA: DefinicionMapeo = {
  campos: {
    tipo: 'tipo',
    severidad: 'severidad',
    titulo: 'titulo',
    mensaje: 'mensaje',
    entidad: 'entidad',
    entidad_id: 'entidadId',
    roles_destinatarios: 'rolesDestinatarios',
    responsable: 'responsable',
    clave_deduplicacion: 'claveDeduplicacion',
    fecha: 'fecha',
  },
  referencias: ['entidad_id'],
  fechas: ['fecha'],
};

export const MAPEO_LECTURA_ALERTA: DefinicionMapeo = {
  campos: { alerta_id: 'alertaId', usuario_id: 'usuarioId', entregada_en: 'entregadaEn', leida_en: 'leidaEn' },
  referencias: ['alerta_id', 'usuario_id'],
  fechas: ['entregada_en', 'leida_en'],
};

export const MAPEO_AUDITORIA: DefinicionMapeo = {
  campos: {
    accion: 'accion',
    entidad: 'entidad',
    entidad_id: 'entidadId',
    usuario_id: 'usuarioId',
    usuario_nombre: 'usuarioNombre',
    detalle: 'detalle',
    fecha: 'fecha',
  },
  referencias: ['entidad_id', 'usuario_id'],
  fechas: ['fecha'],
};

export const MAPEO_TOKEN_RECUPERACION: DefinicionMapeo = {
  campos: { usuario_id: 'usuarioId', token_hash: 'tokenHash', vence_en: 'venceEn', usado_en: 'usadoEn' },
  referencias: ['usuario_id'],
  fechas: ['vence_en', 'usado_en'],
};
