import type { IAlmacenEvidencias, IPublicadorEventos } from '../../dominio/contratos/servicios_externos';
import type { IRepositorioEntidad, Registro } from '../../dominio/contratos/repositorio';
import { ErrorAplicacion, ErrorConflicto, ErrorNoEncontrado, ErrorValidacion } from '../../dominio/errores';
import { obtener_etiqueta } from '../../dominio/reglas/catalogos';
import { TRANSICIONES_DONACION, TRANSICIONES_REPORTE_CIUDADANO } from '../../dominio/reglas/recursos_y_fondos';
import {
  ESQUEMA_CENTRO_DONACION,
  ESQUEMA_DONACION,
  ESQUEMA_ESTADO_DONACION,
  ESQUEMA_ESTADO_REPORTE,
  ESQUEMA_REPORTE_CIUDADANO,
} from '../../dominio/validacion/esquemas';
import { validar_datos } from '../../dominio/validacion/validador';
import type { ContextoSolicitud } from '../dto/contexto';
import type { RepositoriosAplicacion } from '../dto/repositorios';
import { ROLES_OPERATIVOS, type ServicioAlertas } from './ServicioAlertas';
import type { ServicioAuditoria } from './ServicioAuditoria';
import { ServicioEntidad } from './ServicioEntidad';
import type { ServicioHistorial } from './ServicioHistorial';

export function crear_servicio_centros(
  repositorios: RepositoriosAplicacion,
  auditoria: ServicioAuditoria,
  publicador: IPublicadorEventos,
): ServicioEntidad {
  return new ServicioEntidad(
    {
      entidad: 'centros',
      nombre: 'El centro de donación',
      repositorio: repositorios.centros,
      esquema_creacion: ESQUEMA_CENTRO_DONACION,
      esquema_edicion: ESQUEMA_CENTRO_DONACION,
      permiso_lectura: 'consultar_informacion_operativa',
      permiso_escritura: 'editar_registros_operativos',
      campos_busqueda: ['nombre', 'direccion', 'barrio', 'municipio'],
      filtros: { departamento: 'departamento', municipio: 'municipio', estado: 'estado' },
      ordenes: ['nombre', 'municipio', 'estado'],
      orden_predeterminado: { campo: 'nombre', direccion: 'asc' },
      campos_direccion: { direccion: 'direccion' },
      dependencias_eliminacion: [{ repositorio: repositorios.donaciones, campo: 'centro_donacion_id', descripcion: 'donaciones' }],
    },
    auditoria,
    publicador,
  );
}

const ESTADOS_DONACION_EDITABLES = ['registrada', 'en_verificacion'];

/**
 * Donaciones (RF18) como REGISTRO ADMINISTRATIVO: no hay integración bancaria y ninguna
 * donación se confirma automáticamente. Inician "registrada" y sólo un funcionario o
 * administrador cambia su estado. Las confirmadas no se editan ni eliminan: se anulan.
 */
export class ServicioDonaciones extends ServicioEntidad {
  private readonly _historial: ServicioHistorial;

  constructor(repositorios: RepositoriosAplicacion, auditoria: ServicioAuditoria, publicador: IPublicadorEventos, historial: ServicioHistorial) {
    super(
      {
        entidad: 'donaciones',
        nombre: 'La donación',
        repositorio: repositorios.donaciones,
        esquema_creacion: ESQUEMA_DONACION,
        esquema_edicion: ESQUEMA_DONACION,
        permiso_lectura: 'consultar_informacion_operativa',
        permiso_escritura: 'registrar_donaciones',
        campos_busqueda: ['tipo', 'metodo_pago', 'descripcion'],
        filtros: {
          catastrofe_id: 'catastrofe_id',
          centro_donacion_id: 'centro_donacion_id',
          tipo: 'tipo',
          estado: 'estado',
          metodo_pago: 'metodo_pago',
        },
        ordenes: ['fecha', 'valor', 'estado', 'tipo'],
        orden_predeterminado: { campo: 'fecha', direccion: 'desc' },
        campo_fecha: 'fecha',
        // Datos personales del donante: el rol usuario no los recibe.
        campos_restringidos: ['usuario_id', 'donante_nombre', 'registrado_por'],
        relaciones: [
          { campo: 'catastrofe_id', repositorio: repositorios.emergencias, nombre: 'La emergencia' },
          { campo: 'centro_donacion_id', repositorio: repositorios.centros, nombre: 'El centro de donación' },
          { campo: 'usuario_id', repositorio: repositorios.usuarios, nombre: 'La cuenta del donante' },
        ],
        aplicar_reglas: async (datos, existente, contexto) => {
          if (existente && !ESTADOS_DONACION_EDITABLES.includes(String(existente.estado))) {
            throw new ErrorConflicto(
              `Una donación en estado "${obtener_etiqueta(String(existente.estado))}" no se puede editar; registra una anulación si corresponde.`,
            );
          }
          const errores: Record<string, string> = {};
          if (datos.tipo === 'Monetaria') {
            if (datos.metodo_pago === 'Especie') errores.metodo_pago = 'Una donación monetaria no puede registrarse en especie.';
            if (Number(datos.valor) < 1) errores.valor = 'El valor de una donación monetaria debe ser mayor que cero.';
          } else if (datos.metodo_pago !== 'Especie') {
            errores.metodo_pago = 'Las donaciones en bienes se registran con el método "Especie" (el valor es estimado).';
          }
          if (new Date(String(datos.fecha)).getTime() > Date.now() + 3_600_000) errores.fecha = 'La fecha no puede estar en el futuro.';
          if (Object.keys(errores).length > 0) throw new ErrorValidacion(errores);
          return existente ? datos : { ...datos, estado: 'registrada', registrado_por: contexto.usuario.id };
        },
        antes_de_eliminar: async (registro) => {
          if (registro.estado !== 'registrada') {
            throw new ErrorConflicto('Sólo se eliminan donaciones recién registradas. Para conservar la trazabilidad, anula la donación.');
          }
        },
      },
      auditoria,
      publicador,
    );
    this._historial = historial;
  }

  async cambiar_estado(id: string, entrada: unknown, contexto: ContextoSolicitud): Promise<Registro> {
    this.exigir_permiso(contexto, 'registrar_donaciones');
    const validacion = validar_datos(entrada, ESQUEMA_ESTADO_DONACION);
    if (!validacion.es_valido) throw new ErrorValidacion(validacion.errores);
    const donacion = await this.obtener_registro(id);
    const destino = String(validacion.datos.estado);
    const permitidos = TRANSICIONES_DONACION[String(donacion.estado)] ?? [];
    if (!permitidos.includes(destino)) {
      throw new ErrorAplicacion(
        'TRANSICION_INVALIDA',
        `La donación no puede pasar de "${obtener_etiqueta(String(donacion.estado))}" a "${obtener_etiqueta(destino)}".`,
      );
    }
    const actualizada = await this.definicion.repositorio.actualizar_si(donacion.id, [{ campo: 'estado', operador: 'igual', valor: donacion.estado }], {
      establecer: { estado: destino },
    });
    if (!actualizada) throw new ErrorConflicto('La donación cambió mientras se procesaba la solicitud.');
    await this._historial.registrar('donaciones', donacion.id, String(donacion.estado), destino, contexto, (validacion.datos.observacion as string) ?? null);
    this.notificar_cambio_estado(donacion.id);
    return this.presentar(actualizada, contexto);
  }
}

/** Reportes ciudadanos recibidos por funcionarios o administradores. Siempre inician "pendiente". */
export class ServicioReportesCiudadanos extends ServicioEntidad {
  private readonly _historial: ServicioHistorial;
  private readonly _almacen: IAlmacenEvidencias;
  private readonly _emergencias: IRepositorioEntidad;

  constructor(
    repositorios: RepositoriosAplicacion,
    auditoria: ServicioAuditoria,
    publicador: IPublicadorEventos,
    historial: ServicioHistorial,
    alertas: ServicioAlertas,
    almacen: IAlmacenEvidencias,
  ) {
    super(
      {
        entidad: 'reportes_ciudadanos',
        nombre: 'El reporte ciudadano',
        repositorio: repositorios.reportes_ciudadanos,
        esquema_creacion: ESQUEMA_REPORTE_CIUDADANO,
        esquema_edicion: ESQUEMA_REPORTE_CIUDADANO,
        permiso_lectura: 'consultar_informacion_operativa',
        permiso_escritura: 'gestionar_reportes_ciudadanos',
        campos_busqueda: ['titulo', 'descripcion', 'direccion', 'barrio', 'municipio', 'fuente'],
        filtros: { tipo: 'tipo', estado: 'estado', departamento: 'departamento', municipio: 'municipio', catastrofe_id: 'catastrofe_id' },
        ordenes: ['fecha_reporte', 'estado', 'tipo'],
        orden_predeterminado: { campo: 'fecha_reporte', direccion: 'desc' },
        campo_fecha: 'fecha_reporte',
        campos_direccion: { direccion: 'direccion' },
        campos_restringidos: ['evidencia', 'registrado_por'],
        aplicar_reglas: async (datos, existente, contexto) => {
          if (new Date(String(datos.fecha_reporte)).getTime() > Date.now() + 3_600_000) {
            throw new ErrorValidacion({ fecha_reporte: 'La fecha del reporte no puede estar en el futuro.' });
          }
          // El estado nunca se acepta del cliente: todo reporte nuevo comienza pendiente.
          return existente ? datos : { ...datos, estado: 'pendiente', catastrofe_id: null, registrado_por: contexto.usuario.id };
        },
        enriquecer: (registro) => ({ ...registro, tiene_evidencia: Boolean((registro.evidencia as Record<string, unknown> | null)?.nombreAlmacenado) }),
        despues_de_guardar: async (registro, accion, contexto) => {
          if (accion !== 'creado') return;
          await alertas.generar({
            tipo: 'reporte_ciudadano',
            severidad: 'media',
            titulo: `Reporte ciudadano pendiente: ${registro.titulo}`,
            mensaje: `${registro.tipo} en ${registro.municipio}. Fuente: ${registro.fuente}. Requiere verificación.`,
            entidad: 'reportes_ciudadanos',
            entidad_id: registro.id,
            roles_destinatarios: ROLES_OPERATIVOS,
            responsable: `${contexto.usuario.nombre} ${contexto.usuario.apellido}`,
            clave_deduplicacion: `reporte_ciudadano:${registro.id}`,
          });
        },
        antes_de_eliminar: async (registro) => {
          const evidencia = registro.evidencia as { nombreAlmacenado?: string } | null;
          if (evidencia?.nombreAlmacenado) await almacen.eliminar(evidencia.nombreAlmacenado);
        },
      },
      auditoria,
      publicador,
    );
    this._historial = historial;
    this._almacen = almacen;
    this._emergencias = repositorios.emergencias;
  }

  async cambiar_estado(id: string, entrada: unknown, contexto: ContextoSolicitud): Promise<Registro> {
    this.exigir_permiso(contexto, 'gestionar_reportes_ciudadanos');
    const validacion = validar_datos(entrada, ESQUEMA_ESTADO_REPORTE);
    if (!validacion.es_valido) throw new ErrorValidacion(validacion.errores);
    const reporte = await this.obtener_registro(id);
    const destino = String(validacion.datos.estado);
    if (!(TRANSICIONES_REPORTE_CIUDADANO[String(reporte.estado)] ?? []).includes(destino)) {
      throw new ErrorAplicacion(
        'TRANSICION_INVALIDA',
        `El reporte no puede pasar de "${obtener_etiqueta(String(reporte.estado))}" a "${obtener_etiqueta(destino)}".`,
      );
    }
    const cambios: Record<string, unknown> = { estado: destino };
    if (validacion.datos.catastrofe_id) {
      const emergencia = await this._emergencias.obtener(String(validacion.datos.catastrofe_id));
      if (!emergencia) throw new ErrorValidacion({ catastrofe_id: 'La emergencia seleccionada no existe.' });
      cambios.catastrofe_id = emergencia.id;
    }
    const actualizado = await this.definicion.repositorio.actualizar_si(reporte.id, [{ campo: 'estado', operador: 'igual', valor: reporte.estado }], {
      establecer: cambios,
    });
    if (!actualizado) throw new ErrorConflicto('El reporte cambió mientras se procesaba la solicitud.');
    await this._historial.registrar('reportes_ciudadanos', reporte.id, String(reporte.estado), destino, contexto, (validacion.datos.observacion as string) ?? null);
    this.notificar_cambio_estado(reporte.id);
    return this.presentar(actualizado, contexto);
  }

  async guardar_evidencia(id: string, archivo: { nombre_original: string; tipo_mime: string; contenido: Uint8Array }, contexto: ContextoSolicitud): Promise<Registro> {
    this.exigir_permiso(contexto, 'gestionar_reportes_ciudadanos');
    const reporte = await this.obtener_registro(id);
    const nombre_almacenado = await this._almacen.guardar(archivo);
    const anterior = reporte.evidencia as { nombreAlmacenado?: string } | null;
    const actualizado = await this.definicion.repositorio.actualizar(reporte.id, {
      evidencia: {
        nombreAlmacenado: nombre_almacenado,
        nombreOriginal: archivo.nombre_original.replace(/[^\w.\- ]/g, '_').slice(0, 120),
        tipoMime: archivo.tipo_mime,
        tamano: archivo.contenido.length,
      },
    });
    if (anterior?.nombreAlmacenado) await this._almacen.eliminar(anterior.nombreAlmacenado);
    if (!actualizado) throw new ErrorNoEncontrado(this.definicion.nombre);
    this.notificar_cambio_estado(reporte.id);
    return this.presentar(actualizado, contexto);
  }

  /** La evidencia puede contener datos personales: sólo personal operativo la descarga. */
  async leer_evidencia(id: string, contexto: ContextoSolicitud): Promise<{ contenido: Uint8Array; tipo_mime: string; nombre: string }> {
    this.exigir_permiso(contexto, 'consultar_datos_restringidos');
    const reporte = await this.obtener_registro(id);
    const evidencia = reporte.evidencia as { nombreAlmacenado?: string; tipoMime?: string; nombreOriginal?: string } | null;
    if (!evidencia?.nombreAlmacenado) throw new ErrorNoEncontrado('La evidencia');
    return {
      contenido: await this._almacen.leer(evidencia.nombreAlmacenado),
      tipo_mime: evidencia.tipoMime ?? 'application/octet-stream',
      nombre: evidencia.nombreOriginal ?? 'evidencia',
    };
  }
}
