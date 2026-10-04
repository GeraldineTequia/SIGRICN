import type { CondicionCampo, IRepositorioEntidad, Registro } from '../../dominio/contratos/repositorio';
import type { IPublicadorEventos } from '../../dominio/contratos/servicios_externos';
import { ErrorConflicto, ErrorNoEncontrado, ErrorValidacion } from '../../dominio/errores';
import { obtener_etiqueta } from '../../dominio/reglas/catalogos';
import { calcular_disponibilidad } from '../../dominio/reglas/recursos_y_fondos';
import {
  ESQUEMA_ASIGNACION,
  ESQUEMA_EDICION_ASIGNACION,
  ESQUEMA_MOVIMIENTO_ASIGNACION,
  ESQUEMA_MOVIMIENTO_RECURSO,
  ESQUEMA_RECURSO_CREACION,
  ESQUEMA_RECURSO_EDICION,
} from '../../dominio/validacion/esquemas';
import { validar_datos } from '../../dominio/validacion/validador';
import type { ContextoSolicitud, ParametrosConsulta, RespuestaListado } from '../dto/contexto';
import type { RepositoriosAplicacion } from '../dto/repositorios';
import { ROLES_OPERATIVOS, type ServicioAlertas } from './ServicioAlertas';
import type { ServicioAuditoria } from './ServicioAuditoria';
import { ServicioEntidad } from './ServicioEntidad';
import { exigir_misma_emergencia } from './reglas_relaciones';

export interface ResultadoMovimiento {
  movimiento: Registro;
  recurso: Registro;
  asignacion?: Registro;
  /** true cuando la misma clave de operación ya se había procesado (reintento): no se aplica dos veces. */
  es_repeticion: boolean;
}

function fecha_hoy(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Comprobación compartida: alerta si un recurso queda por debajo de su mínimo o agotado (RF22).
 * La clave de deduplicación incluye el día para no repetir la misma alerta en cada movimiento.
 */
async function alertar_si_insuficiente(alertas: ServicioAlertas, recurso: Registro, responsable: string): Promise<void> {
  const disponibilidad = calcular_disponibilidad(Number(recurso.cantidad_disponible ?? 0), recurso.cantidad_minima as number | null);
  if (disponibilidad === 'disponible') return;
  await alertas.generar({
    tipo: 'recurso_insuficiente',
    severidad: disponibilidad === 'agotado' ? 'critica' : 'alta',
    titulo: `${obtener_etiqueta(disponibilidad)}: ${recurso.descripcion}`,
    mensaje: `Quedan ${recurso.cantidad_disponible} ${recurso.unidad} en ${recurso.ubicacion_almacen} (mínimo operativo: ${recurso.cantidad_minima ?? 0}).`,
    entidad: 'recursos',
    entidad_id: recurso.id,
    roles_destinatarios: ROLES_OPERATIVOS,
    responsable,
    clave_deduplicacion: `recurso_insuficiente:${recurso.id}:${disponibilidad}:${fecha_hoy()}`,
  });
}

/** Recursos materiales (RF17, RF20, RF21). Las existencias sólo cambian mediante movimientos atómicos. */
export class ServicioRecursos extends ServicioEntidad {
  private readonly _movimientos: IRepositorioEntidad;
  private readonly _alertas: ServicioAlertas;
  private readonly _auditoria_recursos: ServicioAuditoria;

  constructor(repositorios: RepositoriosAplicacion, auditoria: ServicioAuditoria, publicador: IPublicadorEventos, alertas: ServicioAlertas) {
    super(
      {
        entidad: 'recursos',
        nombre: 'El recurso',
        repositorio: repositorios.recursos,
        esquema_creacion: ESQUEMA_RECURSO_CREACION,
        esquema_edicion: ESQUEMA_RECURSO_EDICION,
        permiso_lectura: 'consultar_informacion_operativa',
        permiso_escritura: 'gestionar_recursos_y_fondos',
        campos_busqueda: ['descripcion', 'tipo', 'organizacion_responsable', 'ubicacion_almacen', 'municipio'],
        filtros: {
          tipo: 'tipo',
          estado: 'estado',
          organizacion_responsable: 'organizacion_responsable',
          departamento: 'departamento',
          municipio: 'municipio',
          ubicacion_almacen: 'ubicacion_almacen',
          catastrofe_id: 'catastrofe_id',
        },
        ordenes: ['descripcion', 'cantidad_disponible', 'cantidad_asignada', 'tipo', 'creado_en'],
        orden_predeterminado: { campo: 'descripcion', direccion: 'asc' },
        relaciones: [{ campo: 'catastrofe_id', repositorio: repositorios.emergencias, nombre: 'La emergencia' }],
        dependencias_eliminacion: [
          { repositorio: repositorios.asignaciones, campo: 'recurso_id', descripcion: 'asignaciones' },
          { repositorio: repositorios.movimientos_recursos, campo: 'recurso_id', descripcion: 'movimientos registrados (se conservan por trazabilidad; puedes inactivarlo)' },
        ],
        aplicar_reglas: async (datos, existente) =>
          existente ? datos : { ...datos, cantidad_asignada: 0, cantidad_entregada: 0 },
        enriquecer: (registro) => ({
          ...registro,
          disponibilidad: calcular_disponibilidad(Number(registro.cantidad_disponible ?? 0), registro.cantidad_minima as number | null),
          cantidad_total: Number(registro.cantidad_disponible ?? 0) + Number(registro.cantidad_asignada ?? 0),
        }),
      },
      auditoria,
      publicador,
    );
    this._movimientos = repositorios.movimientos_recursos;
    this._alertas = alertas;
    this._auditoria_recursos = auditoria;
    this.definicion.despues_de_guardar = async (registro, _accion, contexto) =>
      alertar_si_insuficiente(alertas, registro, `${contexto.usuario.nombre} ${contexto.usuario.apellido}`);
  }

  /** La disponibilidad es un valor calculado: se filtra después de consultar (RF21). */
  override async listar(parametros: ParametrosConsulta, contexto: ContextoSolicitud): Promise<RespuestaListado> {
    const disponibilidad = typeof parametros.disponibilidad === 'string' ? parametros.disponibilidad : '';
    if (!['disponible', 'insuficiente', 'agotado'].includes(disponibilidad)) return super.listar(parametros, contexto);
    this.exigir_permiso(contexto, this.definicion.permiso_lectura);
    const consulta = this.construir_consulta(parametros);
    const todos = (await this.definicion.repositorio.listar({ ...consulta, pagina: 1, limite: 5000 }))
      .elementos.map((registro) => this.presentar(registro, contexto))
      .filter((registro) => registro.disponibilidad === disponibilidad);
    const inicio = (consulta.pagina - 1) * consulta.limite;
    return {
      elementos: todos.slice(inicio, inicio + consulta.limite),
      total: todos.length,
      pagina: consulta.pagina,
      limite: consulta.limite,
      total_paginas: Math.max(1, Math.ceil(todos.length / consulta.limite)),
    };
  }

  /** Ingreso de existencias o agotamiento (baja). Idempotente por clave_idempotencia. */
  async registrar_movimiento(id: string, entrada: unknown, contexto: ContextoSolicitud): Promise<ResultadoMovimiento> {
    this.exigir_permiso(contexto, 'gestionar_recursos_y_fondos');
    const validacion = validar_datos(entrada, ESQUEMA_MOVIMIENTO_RECURSO);
    if (!validacion.es_valido) throw new ErrorValidacion(validacion.errores);
    const { tipo, cantidad, motivo, clave_idempotencia } = validacion.datos as { tipo: 'ingreso' | 'agotamiento'; cantidad: number; motivo: string; clave_idempotencia: string };
    const recurso = await this.obtener_registro(id);

    const previo = await this._movimientos.buscar_uno([{ campo: 'clave_idempotencia', operador: 'igual', valor: clave_idempotencia }]);
    if (previo) return { movimiento: previo, recurso: this.presentar(recurso, contexto), es_repeticion: true };

    let movimiento: Registro;
    try {
      movimiento = await this._movimientos.crear({
        recurso_id: recurso.id,
        tipo,
        cantidad,
        motivo,
        estado: 'procesando',
        clave_idempotencia,
        responsable_id: contexto.usuario.id,
        fecha: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof ErrorConflicto) {
        const repetido = await this._movimientos.buscar_uno([{ campo: 'clave_idempotencia', operador: 'igual', valor: clave_idempotencia }]);
        if (repetido) return { movimiento: repetido, recurso: this.presentar(recurso, contexto), es_repeticion: true };
      }
      throw error;
    }

    const condiciones: CondicionCampo[] = [{ campo: 'estado', operador: 'igual', valor: 'activo' }];
    if (tipo === 'agotamiento') condiciones.push({ campo: 'cantidad_disponible', operador: 'mayor_igual', valor: cantidad });
    const actualizado = await this.definicion.repositorio.actualizar_si(recurso.id, condiciones, {
      incrementar: { cantidad_disponible: tipo === 'ingreso' ? cantidad : -cantidad },
    });
    if (!actualizado) {
      await this._movimientos.eliminar(movimiento.id);
      const actual = await this.obtener_registro(recurso.id);
      if (actual.estado !== 'activo') throw new ErrorConflicto('El recurso está inactivo: actívalo antes de registrar movimientos.');
      throw new ErrorConflicto(`Existencias insuficientes: solicitado ${cantidad}, disponible ${actual.cantidad_disponible}.`);
    }
    const confirmado = (await this._movimientos.actualizar(movimiento.id, { estado: 'confirmado' })) ?? movimiento;
    await this._auditoria_recursos.registrar(`movimiento_${tipo}`, 'recursos', recurso.id, contexto, { cantidad });
    this.notificar_cambio_estado(recurso.id);
    await alertar_si_insuficiente(this._alertas, actualizado, `${contexto.usuario.nombre} ${contexto.usuario.apellido}`);
    return { movimiento: confirmado, recurso: this.presentar(actualizado, contexto), es_repeticion: false };
  }

  async listar_movimientos(id: string, contexto: ContextoSolicitud): Promise<Registro[]> {
    this.exigir_permiso(contexto, 'consultar_informacion_operativa');
    const recurso = await this.obtener_registro(id);
    return this._movimientos.listar_todos(
      [
        { campo: 'recurso_id', operador: 'igual', valor: recurso.id },
        { campo: 'estado', operador: 'igual', valor: 'confirmado' },
      ],
      500,
    );
  }
}

/**
 * Asignaciones, entregas y devoluciones (RF20). Reglas:
 * - Nunca se asigna más de lo disponible: la resta se hace con una actualización condicionada
 *   (cantidadDisponible >= cantidad) en una sola operación de MongoDB, segura ante solicitudes simultáneas.
 * - Cada operación lleva una clave de idempotencia: un reintento no duplica el movimiento.
 * - Las asignaciones no se borran: DELETE las ANULA y devuelve lo pendiente al inventario.
 */
export class ServicioAsignaciones extends ServicioEntidad {
  private readonly _repositorios: RepositoriosAplicacion;
  private readonly _alertas: ServicioAlertas;
  private readonly _auditoria_asignaciones: ServicioAuditoria;
  private readonly _publicador_asignaciones: IPublicadorEventos;

  constructor(repositorios: RepositoriosAplicacion, auditoria: ServicioAuditoria, publicador: IPublicadorEventos, alertas: ServicioAlertas) {
    super(
      {
        entidad: 'asignaciones',
        nombre: 'La asignación',
        repositorio: repositorios.asignaciones,
        esquema_creacion: ESQUEMA_ASIGNACION,
        esquema_edicion: ESQUEMA_EDICION_ASIGNACION,
        permiso_lectura: 'consultar_informacion_operativa',
        permiso_escritura: 'gestionar_recursos_y_fondos',
        campos_busqueda: ['responsable', 'observaciones'],
        filtros: { recurso_id: 'recurso_id', catastrofe_id: 'catastrofe_id', zona_id: 'zona_id', estado: 'estado' },
        ordenes: ['fecha', 'cantidad', 'estado'],
        orden_predeterminado: { campo: 'fecha', direccion: 'desc' },
        campo_fecha: 'fecha',
        campos_restringidos: ['registrado_por'],
        enriquecer: (registro) => {
          const cantidad = Number(registro.cantidad ?? 0);
          return { ...registro, porcentaje_entregado: cantidad > 0 ? Math.round((Number(registro.cantidad_entregada ?? 0) / cantidad) * 100) : 0 };
        },
      },
      auditoria,
      publicador,
    );
    this._repositorios = repositorios;
    this._alertas = alertas;
    this._auditoria_asignaciones = auditoria;
    this._publicador_asignaciones = publicador;
  }

  override async listar(parametros: ParametrosConsulta, contexto: ContextoSolicitud): Promise<RespuestaListado> {
    return super.listar(parametros, contexto, [{ campo: 'estado', operador: 'distinto', valor: 'procesando' }]);
  }

  private _responsable(contexto: ContextoSolicitud): string {
    return `${contexto.usuario.nombre} ${contexto.usuario.apellido}`;
  }

  private _notificar_recurso(recurso_id: string): void {
    this._publicador_asignaciones.publicar({
      tipo: 'datos_actualizados',
      entidad: 'recursos',
      accion: 'actualizado',
      identificador: recurso_id,
      roles: ['usuario', 'funcionario', 'administrador'],
    });
  }

  override async crear(entrada: unknown, contexto: ContextoSolicitud): Promise<Registro> {
    this.exigir_permiso(contexto, 'crear_registros_operativos');
    this.exigir_permiso(contexto, 'gestionar_recursos_y_fondos');
    const validacion = validar_datos(entrada, ESQUEMA_ASIGNACION);
    if (!validacion.es_valido) throw new ErrorValidacion(validacion.errores);
    const datos = validacion.datos as Record<string, unknown> & { cantidad: number; clave_idempotencia: string };

    const previa = await this.definicion.repositorio.buscar_uno([{ campo: 'clave_idempotencia', operador: 'igual', valor: datos.clave_idempotencia }]);
    if (previa) {
      if (previa.estado === 'procesando') throw new ErrorConflicto('La asignación con esta clave todavía se está procesando.');
      return this.presentar(previa, contexto);
    }
    const recurso = await this._repositorios.recursos.obtener(String(datos.recurso_id));
    if (!recurso) throw new ErrorValidacion({ recurso_id: 'El recurso seleccionado no existe.' });
    const emergencia = await this._repositorios.emergencias.obtener(String(datos.catastrofe_id));
    if (!emergencia) throw new ErrorValidacion({ catastrofe_id: 'La emergencia seleccionada no existe.' });
    const zona = await exigir_misma_emergencia(this._repositorios.zonas, datos.zona_id, emergencia.id, 'zona_id', 'La zona');

    let asignacion: Registro;
    try {
      asignacion = await this.definicion.repositorio.crear({
        ...datos,
        recurso_id: recurso.id,
        catastrofe_id: emergencia.id,
        zona_id: zona?.id ?? null,
        cantidad_entregada: 0,
        cantidad_devuelta: 0,
        cantidad_pendiente: datos.cantidad,
        estado: 'procesando',
        registrado_por: contexto.usuario.id,
      });
    } catch (error) {
      if (error instanceof ErrorConflicto) throw new ErrorConflicto('Esta asignación ya fue enviada; actualiza la lista para verla.');
      throw error;
    }

    // Paso crítico y atómico: sólo descuenta si hay existencias suficientes en ese mismo instante.
    const recurso_actualizado = await this._repositorios.recursos.actualizar_si(
      recurso.id,
      [
        { campo: 'estado', operador: 'igual', valor: 'activo' },
        { campo: 'cantidad_disponible', operador: 'mayor_igual', valor: datos.cantidad },
      ],
      { incrementar: { cantidad_disponible: -datos.cantidad, cantidad_asignada: datos.cantidad } },
    );
    if (!recurso_actualizado) {
      await this.definicion.repositorio.eliminar(asignacion.id);
      const actual = await this._repositorios.recursos.obtener(recurso.id);
      if (actual?.estado !== 'activo') throw new ErrorConflicto('El recurso está inactivo y no puede asignarse.');
      throw new ErrorConflicto(
        `Existencias insuficientes: solicitado ${datos.cantidad}, disponible ${actual?.cantidad_disponible ?? 0} ${recurso.unidad}.`,
        { cantidad: `Máximo disponible: ${actual?.cantidad_disponible ?? 0}` },
      );
    }
    const confirmada = (await this.definicion.repositorio.actualizar(asignacion.id, { estado: 'asignada' })) ?? asignacion;
    await this._repositorios.movimientos_recursos.crear({
      recurso_id: recurso.id,
      asignacion_id: confirmada.id,
      tipo: 'asignacion',
      cantidad: datos.cantidad,
      motivo: `Asignación a ${zona ? `${zona.barrio || zona.direccion}` : 'zona'} · ${emergencia.titulo}`,
      estado: 'confirmado',
      clave_idempotencia: `asignacion:${datos.clave_idempotencia}`,
      responsable_id: contexto.usuario.id,
      fecha: new Date().toISOString(),
    });
    await this._auditoria_asignaciones.registrar('crear', 'asignaciones', confirmada.id, contexto, { recurso_id: recurso.id, cantidad: datos.cantidad });
    this.notificar_cambio_estado(confirmada.id);
    this._notificar_recurso(recurso.id);
    await this._alertas.generar({
      tipo: 'asignacion_recurso',
      severidad: 'informativa',
      titulo: `Asignación: ${datos.cantidad} ${recurso.unidad} de ${recurso.descripcion}`,
      mensaje: `Destino: ${zona ? zona.barrio || zona.direccion : ''} (${emergencia.titulo}). Responsable: ${datos.responsable}.`,
      entidad: 'asignaciones',
      entidad_id: confirmada.id,
      roles_destinatarios: ROLES_OPERATIVOS,
      responsable: this._responsable(contexto),
      clave_deduplicacion: `asignacion:${confirmada.id}`,
    });
    await alertar_si_insuficiente(this._alertas, recurso_actualizado, this._responsable(contexto));
    return this.presentar(confirmada, contexto);
  }

  /** Entrega o devolución parcial/total de una asignación. */
  async registrar_movimiento(id: string, entrada: unknown, contexto: ContextoSolicitud): Promise<ResultadoMovimiento> {
    this.exigir_permiso(contexto, 'gestionar_recursos_y_fondos');
    const validacion = validar_datos(entrada, ESQUEMA_MOVIMIENTO_ASIGNACION);
    if (!validacion.es_valido) throw new ErrorValidacion(validacion.errores);
    const { tipo, cantidad, observaciones, clave_idempotencia } = validacion.datos as {
      tipo: 'entrega' | 'devolucion';
      cantidad: number;
      observaciones: string | null;
      clave_idempotencia: string;
    };
    const asignacion = await this.obtener_registro(id);
    const recurso = await this._repositorios.recursos.obtener(String(asignacion.recurso_id));
    if (!recurso) throw new ErrorNoEncontrado('El recurso de la asignación');
    const movimientos = this._repositorios.movimientos_recursos;

    const previo = await movimientos.buscar_uno([{ campo: 'clave_idempotencia', operador: 'igual', valor: clave_idempotencia }]);
    if (previo) return { movimiento: previo, recurso, asignacion: this.presentar(asignacion, contexto), es_repeticion: true };
    if (!['asignada', 'entregada_parcialmente'].includes(String(asignacion.estado))) {
      throw new ErrorConflicto(`La asignación está "${obtener_etiqueta(String(asignacion.estado))}" y no admite más movimientos.`);
    }

    const movimiento = await movimientos.crear({
      recurso_id: recurso.id,
      asignacion_id: asignacion.id,
      tipo,
      cantidad,
      motivo: observaciones ?? (tipo === 'entrega' ? 'Entrega en zona' : 'Devolución a inventario'),
      estado: 'procesando',
      clave_idempotencia,
      responsable_id: contexto.usuario.id,
      fecha: new Date().toISOString(),
    });
    const incremento: Record<string, number> =
      tipo === 'entrega' ? { cantidad_pendiente: -cantidad, cantidad_entregada: cantidad } : { cantidad_pendiente: -cantidad, cantidad_devuelta: cantidad };
    const actualizada = await this.definicion.repositorio.actualizar_si(
      asignacion.id,
      [
        { campo: 'cantidad_pendiente', operador: 'mayor_igual', valor: cantidad },
        { campo: 'estado', operador: 'en', valor: ['asignada', 'entregada_parcialmente'] },
      ],
      { incrementar: incremento },
    );
    if (!actualizada) {
      await movimientos.eliminar(movimiento.id);
      const actual = await this.obtener_registro(asignacion.id);
      throw new ErrorConflicto(`La cantidad supera lo pendiente de la asignación (${actual.cantidad_pendiente}).`);
    }
    const recurso_actualizado =
      (await this._repositorios.recursos.actualizar_si(recurso.id, [], {
        incrementar: tipo === 'entrega' ? { cantidad_asignada: -cantidad, cantidad_entregada: cantidad } : { cantidad_asignada: -cantidad, cantidad_disponible: cantidad },
      })) ?? recurso;
    const pendiente = Number(actualizada.cantidad_pendiente);
    const entregada = Number(actualizada.cantidad_entregada);
    const estado = pendiente > 0 ? (entregada > 0 ? 'entregada_parcialmente' : 'asignada') : entregada > 0 ? 'entregada' : 'cerrada';
    const final = (await this.definicion.repositorio.actualizar(asignacion.id, { estado })) ?? actualizada;
    const confirmado = (await movimientos.actualizar(movimiento.id, { estado: 'confirmado' })) ?? movimiento;
    await this._auditoria_asignaciones.registrar(`movimiento_${tipo}`, 'asignaciones', asignacion.id, contexto, { cantidad });
    this.notificar_cambio_estado(asignacion.id);
    this._notificar_recurso(recurso.id);
    if (tipo === 'entrega') {
      await this._alertas.generar({
        tipo: 'entrega_recurso',
        severidad: 'informativa',
        titulo: `Entrega registrada: ${cantidad} ${recurso.unidad} de ${recurso.descripcion}`,
        mensaje: `Avance de la asignación: ${entregada} de ${actualizada.cantidad} entregadas.`,
        entidad: 'asignaciones',
        entidad_id: asignacion.id,
        roles_destinatarios: ROLES_OPERATIVOS,
        responsable: this._responsable(contexto),
        clave_deduplicacion: `entrega:${confirmado.id}`,
      });
    }
    return { movimiento: confirmado, recurso: recurso_actualizado, asignacion: this.presentar(final, contexto), es_repeticion: false };
  }

  /** DELETE: anula la asignación (si no tiene entregas) y devuelve lo pendiente al inventario. */
  override async eliminar(id: string, contexto: ContextoSolicitud): Promise<void> {
    this.exigir_permiso(contexto, 'eliminar_registros_operativos');
    this.exigir_permiso(contexto, 'gestionar_recursos_y_fondos');
    const asignacion = await this.obtener_registro(id);
    const pendiente = Number(asignacion.cantidad_pendiente ?? 0);
    if (Number(asignacion.cantidad_entregada ?? 0) > 0) {
      throw new ErrorConflicto('La asignación ya tiene entregas: registra una devolución de lo pendiente en lugar de anularla.');
    }
    const anulada = await this.definicion.repositorio.actualizar_si(
      asignacion.id,
      [
        { campo: 'estado', operador: 'igual', valor: 'asignada' },
        { campo: 'cantidad_pendiente', operador: 'igual', valor: pendiente },
      ],
      { establecer: { estado: 'anulada', cantidad_pendiente: 0 }, incrementar: { cantidad_devuelta: pendiente } },
    );
    if (!anulada) throw new ErrorConflicto('La asignación cambió o ya no puede anularse. Recarga la información.');
    await this._repositorios.recursos.actualizar_si(String(asignacion.recurso_id), [], {
      incrementar: { cantidad_asignada: -pendiente, cantidad_disponible: pendiente },
    });
    await this._repositorios.movimientos_recursos.crear({
      recurso_id: asignacion.recurso_id,
      asignacion_id: asignacion.id,
      tipo: 'anulacion',
      cantidad: pendiente,
      motivo: 'Anulación de asignación',
      estado: 'confirmado',
      clave_idempotencia: `anulacion:${asignacion.id}`,
      responsable_id: contexto.usuario.id,
      fecha: new Date().toISOString(),
    });
    await this._auditoria_asignaciones.registrar('anular', 'asignaciones', asignacion.id, contexto, { cantidad_devuelta: pendiente });
    this.notificar_cambio_estado(asignacion.id);
    this._notificar_recurso(String(asignacion.recurso_id));
  }
}
