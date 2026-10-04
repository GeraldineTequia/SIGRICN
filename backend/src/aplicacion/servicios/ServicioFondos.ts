import type { CambiosAtomicos, CondicionCampo, IRepositorioEntidad, Registro } from '../../dominio/contratos/repositorio';
import type { IPublicadorEventos } from '../../dominio/contratos/servicios_externos';
import { ErrorConflicto, ErrorValidacion } from '../../dominio/errores';
import { MONEDA, type TipoMovimientoFondo } from '../../dominio/reglas/catalogos';
import { calcular_saldo_fondo } from '../../dominio/reglas/recursos_y_fondos';
import { ESQUEMA_FONDO_CREACION, ESQUEMA_FONDO_EDICION, ESQUEMA_MOVIMIENTO_FONDO } from '../../dominio/validacion/esquemas';
import { validar_datos } from '../../dominio/validacion/validador';
import type { ContextoSolicitud } from '../dto/contexto';
import type { RepositoriosAplicacion } from '../dto/repositorios';
import type { ServicioAuditoria } from './ServicioAuditoria';
import { ServicioEntidad } from './ServicioEntidad';

const formato_moneda = (monto: number) => `$${monto.toLocaleString('es-CO')} ${MONEDA}`;

interface PlanMovimiento {
  condiciones_fondo: CondicionCampo[];
  cambios_fondo: CambiosAtomicos;
  /** Movimiento relacionado que se marca (p. ej. compromiso → ejecutado) de forma atómica. */
  relacionado?: { id: string; estado_esperado: string; estado_nuevo: string };
  monto: number;
  mensaje_rechazo: string;
}

/**
 * Fondos financieros (RF19) con historial inmutable de movimientos.
 *
 * Montos: pesos colombianos ENTEROS (COP). Se mantiene el invariante
 *   disponible = asignado − comprometido − gastado
 * con incrementos atómicos y condiciones (disponible >= monto), por lo que dos solicitudes
 * simultáneas no pueden comprometer el mismo saldo. Un gasto que ejecuta un compromiso mueve el
 * monto de "comprometido" a "gastado" (el disponible no cambia): no se descuenta dos veces.
 * Los movimientos confirmados nunca se editan ni se borran: se corrigen con anulaciones o ajustes.
 */
export class ServicioFondos extends ServicioEntidad {
  private readonly _movimientos: IRepositorioEntidad;
  private readonly _auditoria_fondos: ServicioAuditoria;

  constructor(repositorios: RepositoriosAplicacion, auditoria: ServicioAuditoria, publicador: IPublicadorEventos) {
    super(
      {
        entidad: 'fondos',
        nombre: 'El fondo',
        repositorio: repositorios.fondos,
        esquema_creacion: ESQUEMA_FONDO_CREACION,
        esquema_edicion: ESQUEMA_FONDO_EDICION,
        permiso_lectura: 'consultar_informacion_operativa',
        permiso_escritura: 'gestionar_recursos_y_fondos',
        campos_busqueda: ['entidad', 'concepto', 'origen'],
        filtros: { catastrofe_id: 'catastrofe_id', origen: 'origen', estado: 'estado' },
        ordenes: ['monto_asignado', 'monto_disponible', 'entidad', 'creado_en'],
        orden_predeterminado: { campo: 'creado_en', direccion: 'desc' },
        campos_restringidos: ['registrado_por'],
        relaciones: [{ campo: 'catastrofe_id', repositorio: repositorios.emergencias, nombre: 'La emergencia' }],
        dependencias_eliminacion: [
          { repositorio: repositorios.movimientos_fondos, campo: 'fondo_id', descripcion: 'movimientos (se conservan por trazabilidad; puedes cerrar el fondo)' },
        ],
        aplicar_reglas: async (datos, existente, contexto) => {
          if (existente) return datos;
          const monto = Number(datos.monto_asignado);
          return {
            ...datos,
            moneda: MONEDA,
            monto_comprometido: 0,
            monto_gastado: 0,
            monto_disponible: monto,
            estado: 'activo',
            registrado_por: contexto.usuario.id,
          };
        },
        enriquecer: (registro) => ({
          ...registro,
          saldo_calculado: calcular_saldo_fondo(Number(registro.monto_asignado ?? 0), Number(registro.monto_comprometido ?? 0), Number(registro.monto_gastado ?? 0)),
          porcentaje_ejecutado:
            Number(registro.monto_asignado ?? 0) > 0 ? Math.round((Number(registro.monto_gastado ?? 0) / Number(registro.monto_asignado)) * 100) : 0,
        }),
      },
      auditoria,
      publicador,
    );
    this._movimientos = repositorios.movimientos_fondos;
    this._auditoria_fondos = auditoria;
  }

  private async _planificar(fondo: Registro, datos: Record<string, unknown>): Promise<PlanMovimiento> {
    const tipo = datos.tipo as TipoMovimientoFondo;
    const monto_solicitado = Number(datos.monto ?? 0);
    const disponible = Number(fondo.monto_disponible ?? 0);
    const exigir_monto = () => {
      if (!(monto_solicitado >= 1)) throw new ErrorValidacion({ monto: 'Indica un monto mayor que cero.' });
    };
    const sin_saldo = `El monto solicitado supera el saldo disponible. Saldo actual: ${formato_moneda(disponible)}.`;
    const activo: CondicionCampo = { campo: 'estado', operador: 'igual', valor: 'activo' };

    const obtener_relacionado = async (tipo_esperado: string, estado_esperado: string) => {
      if (!datos.movimiento_relacionado_id) throw new ErrorValidacion({ movimiento_relacionado_id: 'Selecciona el movimiento relacionado.' });
      const relacionado = await this._movimientos.obtener(String(datos.movimiento_relacionado_id));
      if (!relacionado || String(relacionado.fondo_id) !== fondo.id || relacionado.tipo !== tipo_esperado) {
        throw new ErrorValidacion({ movimiento_relacionado_id: 'El movimiento relacionado no corresponde a este fondo.' });
      }
      if (relacionado.estado !== estado_esperado) {
        throw new ErrorConflicto(`El movimiento relacionado ya no está "${estado_esperado}".`);
      }
      return relacionado;
    };

    switch (tipo) {
      case 'compromiso':
        exigir_monto();
        return {
          monto: monto_solicitado,
          condiciones_fondo: [activo, { campo: 'monto_disponible', operador: 'mayor_igual', valor: monto_solicitado }],
          cambios_fondo: { incrementar: { monto_comprometido: monto_solicitado, monto_disponible: -monto_solicitado } },
          mensaje_rechazo: sin_saldo,
        };
      case 'gasto': {
        if (datos.movimiento_relacionado_id) {
          // Ejecución de un compromiso: el monto pasa de comprometido a gastado.
          const compromiso = await obtener_relacionado('compromiso', 'vigente');
          const monto = Number(compromiso.monto);
          return {
            monto,
            condiciones_fondo: [{ campo: 'monto_comprometido', operador: 'mayor_igual', valor: monto }],
            cambios_fondo: { incrementar: { monto_comprometido: -monto, monto_gastado: monto } },
            relacionado: { id: compromiso.id, estado_esperado: 'vigente', estado_nuevo: 'ejecutado' },
            mensaje_rechazo: 'El compromiso no tiene saldo comprometido suficiente.',
          };
        }
        exigir_monto();
        return {
          monto: monto_solicitado,
          condiciones_fondo: [activo, { campo: 'monto_disponible', operador: 'mayor_igual', valor: monto_solicitado }],
          cambios_fondo: { incrementar: { monto_gastado: monto_solicitado, monto_disponible: -monto_solicitado } },
          mensaje_rechazo: sin_saldo,
        };
      }
      case 'anulacion_compromiso': {
        const compromiso = await obtener_relacionado('compromiso', 'vigente');
        const monto = Number(compromiso.monto);
        return {
          monto,
          condiciones_fondo: [{ campo: 'monto_comprometido', operador: 'mayor_igual', valor: monto }],
          cambios_fondo: { incrementar: { monto_comprometido: -monto, monto_disponible: monto } },
          relacionado: { id: compromiso.id, estado_esperado: 'vigente', estado_nuevo: 'anulado' },
          mensaje_rechazo: 'No fue posible anular el compromiso.',
        };
      }
      case 'anulacion_gasto': {
        const gasto = await obtener_relacionado('gasto', 'confirmado');
        const monto = Number(gasto.monto);
        return {
          monto,
          condiciones_fondo: [{ campo: 'monto_gastado', operador: 'mayor_igual', valor: monto }],
          cambios_fondo: { incrementar: { monto_gastado: -monto, monto_disponible: monto } },
          relacionado: { id: gasto.id, estado_esperado: 'confirmado', estado_nuevo: 'anulado' },
          mensaje_rechazo: 'No fue posible anular el gasto.',
        };
      }
      case 'ajuste_asignacion': {
        exigir_monto();
        if (datos.sentido !== 'aumento' && datos.sentido !== 'reduccion') {
          throw new ErrorValidacion({ sentido: 'Indica si el ajuste aumenta o reduce el monto asignado.' });
        }
        const signo = datos.sentido === 'aumento' ? 1 : -1;
        const condiciones: CondicionCampo[] = [activo];
        if (signo < 0) condiciones.push({ campo: 'monto_disponible', operador: 'mayor_igual', valor: monto_solicitado });
        return {
          monto: monto_solicitado,
          condiciones_fondo: condiciones,
          cambios_fondo: { incrementar: { monto_asignado: signo * monto_solicitado, monto_disponible: signo * monto_solicitado } },
          mensaje_rechazo: signo < 0 ? 'La reducción supera el saldo disponible.' : 'El fondo no está activo.',
        };
      }
    }
  }

  async registrar_movimiento(fondo_id: string, entrada: unknown, contexto: ContextoSolicitud): Promise<{ movimiento: Registro; fondo: Registro; es_repeticion: boolean }> {
    this.exigir_permiso(contexto, 'gestionar_recursos_y_fondos');
    const validacion = validar_datos(entrada, ESQUEMA_MOVIMIENTO_FONDO);
    if (!validacion.es_valido) throw new ErrorValidacion(validacion.errores);
    const datos = validacion.datos;
    const fondo = await this.obtener_registro(fondo_id);
    const clave = String(datos.clave_idempotencia);

    const previo = await this._movimientos.buscar_uno([{ campo: 'clave_idempotencia', operador: 'igual', valor: clave }]);
    if (previo) return { movimiento: previo, fondo: this.presentar(fondo, contexto), es_repeticion: true };

    const plan = await this._planificar(fondo, datos);
    let movimiento: Registro;
    try {
      movimiento = await this._movimientos.crear({
        fondo_id: fondo.id,
        tipo: datos.tipo,
        monto: plan.monto,
        concepto: datos.concepto,
        movimiento_relacionado_id: plan.relacionado?.id ?? null,
        estado: 'procesando',
        clave_idempotencia: clave,
        responsable_id: contexto.usuario.id,
        fecha: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof ErrorConflicto) {
        const repetido = await this._movimientos.buscar_uno([{ campo: 'clave_idempotencia', operador: 'igual', valor: clave }]);
        if (repetido) return { movimiento: repetido, fondo: this.presentar(fondo, contexto), es_repeticion: true };
      }
      throw error;
    }

    // 1) Marcar el movimiento relacionado (impide ejecutar o anular dos veces el mismo compromiso).
    if (plan.relacionado) {
      const marcado = await this._movimientos.actualizar_si(plan.relacionado.id, [{ campo: 'estado', operador: 'igual', valor: plan.relacionado.estado_esperado }], {
        establecer: { estado: plan.relacionado.estado_nuevo },
      });
      if (!marcado) {
        await this._movimientos.eliminar(movimiento.id);
        throw new ErrorConflicto('El movimiento relacionado ya fue procesado por otra solicitud.');
      }
    }
    // 2) Actualizar los saldos del fondo de forma condicionada.
    const fondo_actualizado = await this.definicion.repositorio.actualizar_si(fondo.id, plan.condiciones_fondo, plan.cambios_fondo);
    if (!fondo_actualizado) {
      if (plan.relacionado) {
        await this._movimientos.actualizar(plan.relacionado.id, { estado: plan.relacionado.estado_esperado });
      }
      await this._movimientos.eliminar(movimiento.id);
      const actual = await this.obtener_registro(fondo.id);
      throw new ErrorConflicto(
        actual.estado !== 'activo' && plan.condiciones_fondo.some((condicion) => condicion.campo === 'estado')
          ? 'El fondo está cerrado y no admite nuevos movimientos.'
          : plan.mensaje_rechazo.replace(/Saldo actual: .*$/, `Saldo actual: ${formato_moneda(Number(actual.monto_disponible ?? 0))}.`),
        { monto: `Saldo disponible: ${formato_moneda(Number(actual.monto_disponible ?? 0))}` },
      );
    }
    const estado_final = datos.tipo === 'compromiso' ? 'vigente' : 'confirmado';
    const confirmado = (await this._movimientos.actualizar(movimiento.id, { estado: estado_final })) ?? movimiento;
    await this._auditoria_fondos.registrar(`movimiento_${String(datos.tipo)}`, 'fondos', fondo.id, contexto, { monto: plan.monto });
    this.notificar_cambio_estado(fondo.id);
    return { movimiento: confirmado, fondo: this.presentar(fondo_actualizado, contexto), es_repeticion: false };
  }

  async listar_movimientos(fondo_id: string, contexto: ContextoSolicitud): Promise<Registro[]> {
    this.exigir_permiso(contexto, 'consultar_informacion_operativa');
    const fondo = await this.obtener_registro(fondo_id);
    return this._movimientos.listar_todos(
      [
        { campo: 'fondo_id', operador: 'igual', valor: fondo.id },
        { campo: 'estado', operador: 'distinto', valor: 'procesando' },
      ],
      1000,
    );
  }
}
