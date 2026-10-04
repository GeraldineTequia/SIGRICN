import type { CondicionCampo, ConsultaListado, IRepositorioEntidad, Registro } from '../../dominio/contratos/repositorio';
import type { IPublicadorEventos } from '../../dominio/contratos/servicios_externos';
import { ErrorConflicto, ErrorNoEncontrado, ErrorSinPermiso, ErrorValidacion } from '../../dominio/errores';
import { ROLES } from '../../dominio/reglas/catalogos';
import { tiene_permiso, type Permiso } from '../../dominio/reglas/permisos';
import { resolver_ubicacion, type UbicacionDominio } from '../../dominio/reglas/ubicacion';
import { componer_direccion, validar_datos, type EsquemaValidacion, type UbicacionEntrada } from '../../dominio/validacion/validador';
import type { ContextoSolicitud, ParametrosConsulta, RespuestaListado } from '../dto/contexto';
import type { ServicioAuditoria } from './ServicioAuditoria';

export interface RelacionEntidad {
  campo: string;
  repositorio: IRepositorioEntidad;
  nombre: string;
}

export interface DependenciaEliminacion {
  repositorio: IRepositorioEntidad;
  campo: string;
  descripcion: string;
}

export interface DefinicionEntidad {
  /** Clave usada en auditoría, eventos y rutas (p. ej. "emergencias"). */
  entidad: string;
  /** Nombre en mensajes: "La emergencia", "El recurso". */
  nombre: string;
  repositorio: IRepositorioEntidad;
  esquema_creacion: EsquemaValidacion;
  esquema_edicion: EsquemaValidacion;
  permiso_lectura: Permiso;
  permiso_escritura: Permiso;
  campos_busqueda: string[];
  /** parámetro de consulta → campo de la API filtrable por igualdad. */
  filtros: Record<string, string>;
  ordenes: string[];
  orden_predeterminado: { campo: string; direccion: 'asc' | 'desc' };
  campo_fecha?: string;
  relaciones?: RelacionEntidad[];
  /** Política de integridad: si existen registros dependientes, la eliminación se BLOQUEA (409). */
  dependencias_eliminacion?: DependenciaEliminacion[];
  /** Campos con datos personales que sólo ven roles con "consultar_datos_restringidos". */
  campos_restringidos?: string[];
  /** Campos que componen la dirección para validar la ubicación confirmada. */
  campos_direccion?: { direccion: string };
  /** Hook de reglas de negocio: recibe los datos completos (existente + cambios) y devuelve los definitivos. */
  aplicar_reglas?: (datos: Record<string, unknown>, existente: Registro | null, contexto: ContextoSolicitud) => Promise<Record<string, unknown>>;
  /** Campos calculados que se agregan al responder (no se guardan). */
  enriquecer?: (registro: Registro) => Registro;
  /** Acciones posteriores (alertas, etc.). No deben lanzar errores. */
  despues_de_guardar?: (registro: Registro, accion: 'creado' | 'actualizado', contexto: ContextoSolicitud, anterior: Registro | null) => Promise<void>;
  /** Comprobación adicional antes de eliminar (p. ej. movimientos confirmados). */
  antes_de_eliminar?: (registro: Registro) => Promise<void>;
  /** Roles que reciben el evento SSE de cambios. */
  roles_eventos?: readonly string[];
}

const LIMITE_MAXIMO = 100;

/**
 * Servicio de aplicación genérico para CRUD. Evita duplicar en cada módulo la validación,
 * la verificación de relaciones, los permisos, la auditoría, la integridad al eliminar y la
 * notificación de cambios. Las reglas específicas se inyectan mediante hooks.
 */
export class ServicioEntidad {
  readonly definicion: DefinicionEntidad;
  private readonly _auditoria: ServicioAuditoria;
  private readonly _publicador: IPublicadorEventos;

  constructor(definicion: DefinicionEntidad, auditoria: ServicioAuditoria, publicador: IPublicadorEventos) {
    this.definicion = definicion;
    this._auditoria = auditoria;
    this._publicador = publicador;
  }

  exigir_permiso(contexto: ContextoSolicitud, permiso: Permiso): void {
    if (!tiene_permiso(contexto.usuario.rol, permiso)) throw new ErrorSinPermiso();
  }

  /** Construye la consulta SOLO con parámetros permitidos (búsqueda, filtros, rango, orden, página). */
  construir_consulta(parametros: ParametrosConsulta): ConsultaListado {
    const texto = (nombre: string): string | undefined => {
      const valor = parametros[nombre];
      return typeof valor === 'string' && valor.trim() !== '' ? valor.trim().slice(0, 120) : undefined;
    };
    const condiciones: CondicionCampo[] = [];
    for (const [parametro, campo] of Object.entries(this.definicion.filtros)) {
      const valor = texto(parametro);
      if (valor !== undefined) condiciones.push({ campo, operador: 'igual', valor });
    }
    const pagina = Math.max(1, Math.floor(Number(texto('pagina') ?? 1)) || 1);
    const limite = Math.min(LIMITE_MAXIMO, Math.max(1, Math.floor(Number(texto('limite') ?? 10)) || 10));
    let orden = this.definicion.orden_predeterminado;
    const orden_solicitado = texto('orden');
    if (orden_solicitado) {
      const direccion = orden_solicitado.startsWith('-') ? 'desc' : 'asc';
      const campo = orden_solicitado.replace(/^-/, '');
      if (this.definicion.ordenes.includes(campo)) orden = { campo, direccion };
    }
    const consulta: ConsultaListado = { condiciones, pagina, limite, orden };
    const busqueda = texto('busqueda');
    if (busqueda) consulta.busqueda = { texto: busqueda, campos: this.definicion.campos_busqueda };
    if (this.definicion.campo_fecha) {
      const desde = texto('desde');
      const hasta = texto('hasta');
      const es_fecha = (valor?: string) => valor !== undefined && !Number.isNaN(new Date(valor).getTime());
      if ((desde && !es_fecha(desde)) || (hasta && !es_fecha(hasta))) {
        throw new ErrorValidacion({ desde: 'El rango de fechas no es válido.' });
      }
      if (desde && hasta && new Date(desde) > new Date(hasta)) {
        throw new ErrorValidacion({ hasta: 'La fecha final no puede ser anterior a la inicial.' });
      }
      if (desde || hasta) consulta.rango_fecha = { campo: this.definicion.campo_fecha, desde, hasta: hasta ? this._fin_del_dia(hasta) : undefined };
    }
    return consulta;
  }

  private _fin_del_dia(fecha: string): string {
    return /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? `${fecha}T23:59:59.999Z` : fecha;
  }

  /** Oculta datos personales a quien no tiene el permiso de datos restringidos y agrega campos calculados. */
  presentar(registro: Registro, contexto: ContextoSolicitud): Registro {
    let resultado = this.definicion.enriquecer ? this.definicion.enriquecer(registro) : { ...registro };
    if (!tiene_permiso(contexto.usuario.rol, 'consultar_datos_restringidos')) {
      resultado = { ...resultado };
      for (const campo of this.definicion.campos_restringidos ?? []) delete resultado[campo];
    }
    return resultado;
  }

  async listar(parametros: ParametrosConsulta, contexto: ContextoSolicitud, condiciones_extra: CondicionCampo[] = []): Promise<RespuestaListado> {
    this.exigir_permiso(contexto, this.definicion.permiso_lectura);
    const consulta = this.construir_consulta(parametros);
    consulta.condiciones.push(...condiciones_extra);
    const pagina = await this.definicion.repositorio.listar(consulta);
    return { ...pagina, elementos: pagina.elementos.map((registro) => this.presentar(registro, contexto)) };
  }

  async obtener_registro(id: string): Promise<Registro> {
    const registro = await this.definicion.repositorio.obtener(id);
    if (!registro) throw new ErrorNoEncontrado(this.definicion.nombre);
    return registro;
  }

  async obtener(id: string, contexto: ContextoSolicitud): Promise<Registro> {
    this.exigir_permiso(contexto, this.definicion.permiso_lectura);
    return this.presentar(await this.obtener_registro(id), contexto);
  }

  /** Verifica que existan los registros referenciados y normaliza su identificador. */
  private async _validar_relaciones(datos: Record<string, unknown>, campos_a_revisar: string[]): Promise<void> {
    const errores: Record<string, string> = {};
    for (const relacion of this.definicion.relaciones ?? []) {
      if (!campos_a_revisar.includes(relacion.campo)) continue;
      const valor = datos[relacion.campo];
      if (valor === null || valor === undefined || valor === '') continue;
      const referenciado = await relacion.repositorio.obtener(String(valor));
      if (!referenciado) errores[relacion.campo] = `${relacion.nombre} seleccionada no existe.`;
      else datos[relacion.campo] = referenciado.id;
    }
    if (Object.keys(errores).length > 0) throw new ErrorValidacion(errores);
  }

  private _resolver_ubicacion(datos: Record<string, unknown>, existente: Registro | null, entrante: unknown, contexto: ContextoSolicitud): void {
    if (!this.definicion.campos_direccion) return;
    const direccion_actual = componer_direccion({
      pais: datos.pais,
      departamento: datos.departamento,
      municipio: datos.municipio,
      barrio: datos.barrio,
      direccion: datos[this.definicion.campos_direccion.direccion],
    });
    datos.ubicacion = resolver_ubicacion(
      direccion_actual,
      (entrante ?? null) as UbicacionEntrada | null,
      (existente?.ubicacion ?? null) as UbicacionDominio | null,
      contexto.usuario.id,
      new Date(),
    );
  }

  private _notificar(accion: 'creado' | 'actualizado' | 'eliminado' | 'estado', identificador: string): void {
    this._publicador.publicar({
      tipo: 'datos_actualizados',
      entidad: this.definicion.entidad,
      accion,
      identificador,
      roles: this.definicion.roles_eventos ?? ROLES,
    });
  }

  async crear(entrada: unknown, contexto: ContextoSolicitud): Promise<Registro> {
    this.exigir_permiso(contexto, 'crear_registros_operativos');
    this.exigir_permiso(contexto, this.definicion.permiso_escritura);
    const validacion = validar_datos(entrada, this.definicion.esquema_creacion);
    if (!validacion.es_valido) throw new ErrorValidacion(validacion.errores);
    let datos = { ...validacion.datos };
    await this._validar_relaciones(datos, Object.keys(datos));
    if (this.definicion.aplicar_reglas) datos = await this.definicion.aplicar_reglas(datos, null, contexto);
    this._resolver_ubicacion(datos, null, validacion.datos.ubicacion, contexto);
    const creado = await this.definicion.repositorio.crear(datos);
    await this._auditoria.registrar('crear', this.definicion.entidad, creado.id, contexto);
    this._notificar('creado', creado.id);
    if (this.definicion.despues_de_guardar) await this.definicion.despues_de_guardar(creado, 'creado', contexto, null);
    return this.presentar(creado, contexto);
  }

  /**
   * PUT (parcial=false) o PATCH (parcial=true). Las reglas se aplican sobre los datos COMPLETOS
   * (registro guardado + cambios), y sólo se escriben los campos que realmente cambiaron,
   * para no reescribir valores heredados que no se tocaron.
   */
  async actualizar(id: string, entrada: unknown, parcial: boolean, contexto: ContextoSolicitud): Promise<Registro> {
    this.exigir_permiso(contexto, 'editar_registros_operativos');
    this.exigir_permiso(contexto, this.definicion.permiso_escritura);
    const existente = await this.obtener_registro(id);
    const validacion = validar_datos(entrada, this.definicion.esquema_edicion, { parcial });
    if (!validacion.es_valido) throw new ErrorValidacion(validacion.errores);
    if (Object.keys(validacion.datos).length === 0) throw new ErrorValidacion({ general: 'No se enviaron cambios.' });
    let combinados: Record<string, unknown> = { ...existente, ...validacion.datos };
    await this._validar_relaciones(combinados, Object.keys(validacion.datos));
    if (this.definicion.aplicar_reglas) combinados = await this.definicion.aplicar_reglas(combinados, existente, contexto);
    this._resolver_ubicacion(combinados, existente, validacion.datos.ubicacion, contexto);
    const cambios: Record<string, unknown> = {};
    for (const [campo, valor] of Object.entries(combinados)) {
      if (['id', 'creado_en', 'actualizado_en'].includes(campo)) continue;
      if (JSON.stringify(valor ?? null) !== JSON.stringify(existente[campo] ?? null)) cambios[campo] = valor;
    }
    if (Object.keys(cambios).length === 0) return this.presentar(existente, contexto);
    const actualizado = await this.definicion.repositorio.actualizar(id, cambios);
    if (!actualizado) throw new ErrorNoEncontrado(this.definicion.nombre);
    await this._auditoria.registrar('actualizar', this.definicion.entidad, id, contexto, { campos: Object.keys(cambios) });
    this._notificar('actualizado', id);
    if (this.definicion.despues_de_guardar) await this.definicion.despues_de_guardar(actualizado, 'actualizado', contexto, existente);
    return this.presentar(actualizado, contexto);
  }

  async eliminar(id: string, contexto: ContextoSolicitud): Promise<void> {
    this.exigir_permiso(contexto, 'eliminar_registros_operativos');
    this.exigir_permiso(contexto, this.definicion.permiso_escritura);
    const registro = await this.obtener_registro(id);
    const bloqueos: string[] = [];
    for (const dependencia of this.definicion.dependencias_eliminacion ?? []) {
      const cantidad = await dependencia.repositorio.contar([{ campo: dependencia.campo, operador: 'igual', valor: registro.id }]);
      if (cantidad > 0) bloqueos.push(`${cantidad} ${dependencia.descripcion}`);
    }
    if (bloqueos.length > 0) {
      throw new ErrorConflicto(
        `${this.definicion.nombre} no se puede eliminar porque tiene registros relacionados: ${bloqueos.join(', ')}. ` +
          'Elimina o reasigna primero esos registros (política de integridad: restringir).',
      );
    }
    if (this.definicion.antes_de_eliminar) await this.definicion.antes_de_eliminar(registro);
    await this.definicion.repositorio.eliminar(registro.id);
    await this._auditoria.registrar('eliminar', this.definicion.entidad, registro.id, contexto);
    this._notificar('eliminado', registro.id);
  }

  /** Para cambios de estado de servicios especializados (State, transiciones). */
  notificar_cambio_estado(identificador: string): void {
    this._notificar('estado', identificador);
  }
}
