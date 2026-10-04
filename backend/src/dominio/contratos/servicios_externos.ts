/** Contratos de servicios externos. La infraestructura los implementa; el dominio no conoce sus detalles. */

export interface MensajeCorreo {
  destinatario: string;
  asunto: string;
  texto: string;
  html: string;
}

export interface ResultadoEnvioCorreo {
  /** true sólo si el proveedor SMTP aceptó el mensaje. */
  enviado: boolean;
  detalle: string;
}

export interface IServicioCorreo {
  esta_configurado(): boolean;
  enviar(mensaje: MensajeCorreo): Promise<ResultadoEnvioCorreo>;
}

export interface ParametrosGeocodificacion {
  pais: string;
  departamento: string;
  municipio: string;
  barrio?: string;
  direccion: string;
}

export interface CoincidenciaGeocodificacion {
  direccion_encontrada: string;
  punto: { latitud: number; longitud: number };
  /** "direccion": coincidencia con la dirección; "aproximada": sólo barrio o municipio. */
  precision: 'direccion' | 'aproximada';
  tipo_lugar: string;
}

export interface IGeocodificador {
  buscar(parametros: ParametrosGeocodificacion): Promise<CoincidenciaGeocodificacion[]>;
  buscar_inversa(latitud: number, longitud: number): Promise<string | null>;
}

export interface ICifrador {
  cifrar(texto: string): string;
  descifrar(texto_cifrado: string): string;
}

export interface EventoSistema {
  tipo: 'datos_actualizados' | 'nueva_alerta';
  entidad: string;
  accion: 'creado' | 'actualizado' | 'eliminado' | 'estado';
  identificador?: string;
  /** Roles que pueden recibir el evento (para no filtrar información restringida). */
  roles: readonly string[];
  fecha: string;
}

export interface IPublicadorEventos {
  publicar(evento: Omit<EventoSistema, 'fecha'>): void;
  suscribir(manejador: (evento: EventoSistema) => void): () => void;
}

export interface SeccionReportePdf {
  titulo: string;
  columnas: { titulo: string; ancho: number }[];
  filas: string[][];
  nota?: string;
}

export interface DocumentoReportePdf {
  titulo: string;
  generado_por: string;
  fecha_generacion: string;
  filtros_aplicados: string[];
  secciones: SeccionReportePdf[];
}

export interface IGeneradorPdf {
  generar(documento: DocumentoReportePdf): Promise<Uint8Array>;
}

export interface ArchivoEvidencia {
  nombre_original: string;
  tipo_mime: string;
  /** Bytes del archivo (Uint8Array: el dominio no depende de tipos de Node.js). */
  contenido: Uint8Array;
}

export interface IAlmacenEvidencias {
  guardar(archivo: ArchivoEvidencia): Promise<string>;
  leer(nombre_almacenado: string): Promise<Uint8Array>;
  eliminar(nombre_almacenado: string): Promise<void>;
}
