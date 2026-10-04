import type { ConfiguracionEntorno } from '../configuracion/entorno';
import type { IGeocodificador, IPublicadorEventos, IServicioCorreo } from '../dominio/contratos/servicios_externos';
import type { RepositoriosAplicacion } from '../aplicacion/dto/repositorios';
import { ServicioAlertas, ROLES_OPERATIVOS } from '../aplicacion/servicios/ServicioAlertas';
import { ServicioAuditoria } from '../aplicacion/servicios/ServicioAuditoria';
import { CacheConsultas } from '../aplicacion/servicios/CacheConsultas';
import { ServicioAutenticacion } from '../aplicacion/servicios/ServicioAutenticacion';
import { ServicioBusqueda, ServicioGeocodificacion, ServicioMapa, ServicioTablero } from '../aplicacion/servicios/ServicioConsultas';
import { ServicioCuentas } from '../aplicacion/servicios/ServicioCuentas';
import { ServicioEmergencias } from '../aplicacion/servicios/ServicioEmergencias';
import type { ServicioEntidad } from '../aplicacion/servicios/ServicioEntidad';
import { ServicioFondos } from '../aplicacion/servicios/ServicioFondos';
import { ServicioHistorial } from '../aplicacion/servicios/ServicioHistorial';
import { ServicioRecursos, ServicioAsignaciones } from '../aplicacion/servicios/ServicioRecursos';
import { ServicioRecursosHumanos } from '../aplicacion/servicios/ServicioRecursosHumanos';
import { ServicioReportesPdf } from '../aplicacion/servicios/ServicioReportesPdf';
import { ServicioZonas } from '../aplicacion/servicios/ServicioZonas';
import {
  ServicioDonaciones,
  ServicioReportesCiudadanos,
  crear_servicio_centros,
} from '../aplicacion/servicios/modulos_donaciones_reportes';
import {
  ServicioPersonas,
  crear_servicio_familias,
  crear_servicio_necesidades,
  crear_servicio_poblacion,
} from '../aplicacion/servicios/modulos_poblacion';
import { AlmacenEvidenciasDisco } from '../infraestructura/almacenamiento/AlmacenEvidenciasDisco';
import { ServicioCorreoSmtp } from '../infraestructura/correo/ServicioCorreoSmtp';
import { GeocodificadorNominatim } from '../infraestructura/geocodificacion/GeocodificadorNominatim';
import { PublicadorEventosMemoria } from '../infraestructura/notificaciones/PublicadorEventosMemoria';
import { MapeadorDocumento, type DefinicionMapeo } from '../infraestructura/persistencia/mapeadores/MapeadorDocumento';
import * as mapeos from '../infraestructura/persistencia/mapeadores/definiciones';
import * as modelos from '../infraestructura/persistencia/modelos/modelos';
import { RepositorioEstadisticas } from '../infraestructura/persistencia/repositorios/RepositorioEstadisticas';
import { RepositorioMongo } from '../infraestructura/persistencia/repositorios/RepositorioMongo';
import { RepositorioTokensRecuperacion } from '../infraestructura/persistencia/repositorios/RepositorioTokensRecuperacion';
import { RepositorioUsuarios } from '../infraestructura/persistencia/repositorios/RepositorioUsuarios';
import { GeneradorPdfKit } from '../infraestructura/reportes/GeneradorPdfKit';
import { CifradorAes } from '../infraestructura/seguridad/CifradorAes';
import { HashBcrypt } from '../infraestructura/seguridad/HashBcrypt';
import { GestorSesionesMongo } from '../infraestructura/sesiones/configurar_sesiones';

export interface Contenedor {
  configuracion: ConfiguracionEntorno;
  repositorios: RepositoriosAplicacion;
  publicador: IPublicadorEventos;
  correo: IServicioCorreo;
  autenticacion: ServicioAutenticacion;
  cuentas: ServicioCuentas;
  auditoria: ServicioAuditoria;
  alertas: ServicioAlertas;
  emergencias: ServicioEmergencias;
  zonas: ServicioZonas;
  poblacion: ServicioEntidad;
  familias: ServicioEntidad;
  personas: ServicioPersonas;
  necesidades: ServicioEntidad;
  centros: ServicioEntidad;
  donaciones: ServicioDonaciones;
  reportes_ciudadanos: ServicioReportesCiudadanos;
  recursos: ServicioRecursos;
  asignaciones: ServicioAsignaciones;
  recursos_humanos: ServicioRecursosHumanos;
  fondos: ServicioFondos;
  tablero: ServicioTablero;
  mapa: ServicioMapa;
  busqueda: ServicioBusqueda;
  geocodificacion: ServicioGeocodificacion;
  reportes_pdf: ServicioReportesPdf;
}

export interface SustitucionesContenedor {
  correo?: IServicioCorreo;
  geocodificador?: IGeocodificador;
}

/**
 * Raíz de composición: el único lugar que conoce las implementaciones concretas.
 * Los servicios de aplicación reciben contratos (repositorios, correo, geocodificador...).
 */
export function crear_contenedor(configuracion: ConfiguracionEntorno, sustituciones: SustitucionesContenedor = {}): Contenedor {
  const cifrador = new CifradorAes(configuracion.clave_cifrado_datos);
  const repositorio = (modelo: (typeof modelos)['ModeloEmergencia'], definicion: DefinicionMapeo, con_cifrado = false) =>
    new RepositorioMongo(modelo, new MapeadorDocumento(definicion, con_cifrado ? cifrador : null));

  const repositorios: RepositoriosAplicacion = {
    usuarios: new RepositorioUsuarios(modelos.ModeloUsuario),
    tokens_recuperacion: new RepositorioTokensRecuperacion(),
    emergencias: repositorio(modelos.ModeloEmergencia, mapeos.MAPEO_EMERGENCIA),
    zonas: repositorio(modelos.ModeloZona, mapeos.MAPEO_ZONA),
    poblacion: repositorio(modelos.ModeloPoblacion, mapeos.MAPEO_POBLACION),
    necesidades: repositorio(modelos.ModeloNecesidad, mapeos.MAPEO_NECESIDAD),
    centros: repositorio(modelos.ModeloCentroDonacion, mapeos.MAPEO_CENTRO_DONACION),
    donaciones: repositorio(modelos.ModeloDonacion, mapeos.MAPEO_DONACION),
    familias: repositorio(modelos.ModeloFamilia, mapeos.MAPEO_FAMILIA),
    personas: repositorio(modelos.ModeloPersona, mapeos.MAPEO_PERSONA, true),
    recursos: repositorio(modelos.ModeloRecurso, mapeos.MAPEO_RECURSO),
    movimientos_recursos: repositorio(modelos.ModeloMovimientoRecurso, mapeos.MAPEO_MOVIMIENTO_RECURSO),
    asignaciones: repositorio(modelos.ModeloAsignacion, mapeos.MAPEO_ASIGNACION),
    recursos_humanos: repositorio(modelos.ModeloRecursoHumano, mapeos.MAPEO_RECURSO_HUMANO),
    fondos: repositorio(modelos.ModeloFondo, mapeos.MAPEO_FONDO),
    movimientos_fondos: repositorio(modelos.ModeloMovimientoFondo, mapeos.MAPEO_MOVIMIENTO_FONDO),
    reportes_ciudadanos: repositorio(modelos.ModeloReporteCiudadano, mapeos.MAPEO_REPORTE_CIUDADANO),
    historial: repositorio(modelos.ModeloHistorialEstado, mapeos.MAPEO_HISTORIAL),
    alertas: repositorio(modelos.ModeloAlerta, mapeos.MAPEO_ALERTA),
    lecturas_alertas: repositorio(modelos.ModeloLecturaAlerta, mapeos.MAPEO_LECTURA_ALERTA),
    auditoria: repositorio(modelos.ModeloAuditoria, mapeos.MAPEO_AUDITORIA),
    estadisticas: new RepositorioEstadisticas(),
  };

  const publicador = new PublicadorEventosMemoria();
  const correo = sustituciones.correo ?? new ServicioCorreoSmtp(configuracion.smtp);
  const geocodificador =
    sustituciones.geocodificador ??
    new GeocodificadorNominatim(configuracion.geocodificacion.url, configuracion.geocodificacion.correo_contacto, configuracion.geocodificacion.intervalo_ms);
  const auditoria = new ServicioAuditoria(repositorios.auditoria);
  const historial = new ServicioHistorial(repositorios.historial);
  const alertas = new ServicioAlertas(repositorios.alertas, repositorios.lecturas_alertas, publicador);
  const sesiones = new GestorSesionesMongo();
  const cache = new CacheConsultas(publicador);

  return {
    configuracion,
    repositorios,
    publicador,
    correo,
    auditoria,
    alertas,
    autenticacion: new ServicioAutenticacion({
      usuarios: repositorios.usuarios,
      tokens: repositorios.tokens_recuperacion,
      hash: new HashBcrypt(configuracion.es_prueba ? 4 : 12),
      correo,
      sesiones,
      auditoria,
      url_frontend: configuracion.url_frontend,
    }),
    cuentas: new ServicioCuentas(repositorios.usuarios, sesiones, auditoria, publicador),
    emergencias: new ServicioEmergencias(repositorios, auditoria, publicador, historial, alertas),
    zonas: new ServicioZonas(repositorios, auditoria, publicador, historial, alertas),
    poblacion: crear_servicio_poblacion(repositorios, auditoria, publicador),
    familias: crear_servicio_familias(repositorios, auditoria, publicador),
    personas: new ServicioPersonas(repositorios, auditoria, publicador),
    necesidades: crear_servicio_necesidades(repositorios, auditoria, publicador, async (necesidad, responsable) => {
      await alertas.generar({
        tipo: 'caso_critico',
        severidad: 'critica',
        titulo: `Necesidad crítica: ${necesidad.tipo}`,
        mensaje: String(necesidad.descripcion ?? ''),
        entidad: 'necesidades',
        entidad_id: necesidad.id,
        roles_destinatarios: ROLES_OPERATIVOS,
        responsable,
        clave_deduplicacion: `necesidad_critica:${necesidad.id}`,
      });
    }),
    centros: crear_servicio_centros(repositorios, auditoria, publicador),
    donaciones: new ServicioDonaciones(repositorios, auditoria, publicador, historial),
    reportes_ciudadanos: new ServicioReportesCiudadanos(
      repositorios,
      auditoria,
      publicador,
      historial,
      alertas,
      new AlmacenEvidenciasDisco(configuracion.directorio_evidencias),
    ),
    recursos: new ServicioRecursos(repositorios, auditoria, publicador, alertas),
    asignaciones: new ServicioAsignaciones(repositorios, auditoria, publicador, alertas),
    recursos_humanos: new ServicioRecursosHumanos(repositorios, auditoria, publicador),
    fondos: new ServicioFondos(repositorios, auditoria, publicador),
    tablero: new ServicioTablero(repositorios, cache),
    mapa: new ServicioMapa(repositorios, cache),
    busqueda: new ServicioBusqueda(repositorios),
    geocodificacion: new ServicioGeocodificacion(geocodificador),
    reportes_pdf: new ServicioReportesPdf(repositorios, new GeneradorPdfKit()),
  };
}
