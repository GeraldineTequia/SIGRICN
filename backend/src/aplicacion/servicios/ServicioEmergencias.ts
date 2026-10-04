import type { IPublicadorEventos } from '../../dominio/contratos/servicios_externos';
import type { Registro } from '../../dominio/contratos/repositorio';
import { ErrorConflicto, ErrorValidacion } from '../../dominio/errores';
import { GestorEmergencia } from '../../dominio/estrategias/GestorEmergencia';
import type { DatosReglaEmergencia } from '../../dominio/estrategias/IEstrategiaEmergencia';
import { interpretar_estado_almacenado, obtener_estado_emergencia, transicionar_emergencia } from '../../dominio/estados/EstadosEmergencia';
import { obtener_etiqueta, type EstadoEmergencia } from '../../dominio/reglas/catalogos';
import { ESQUEMA_EMERGENCIA, ESQUEMA_TRANSICION_EMERGENCIA } from '../../dominio/validacion/esquemas';
import { validar_datos } from '../../dominio/validacion/validador';
import type { ContextoSolicitud } from '../dto/contexto';
import type { RepositoriosAplicacion } from '../dto/repositorios';
import { TODOS_LOS_ROLES, type ServicioAlertas } from './ServicioAlertas';
import type { ServicioAuditoria } from './ServicioAuditoria';
import { ServicioEntidad } from './ServicioEntidad';
import type { ServicioHistorial } from './ServicioHistorial';

/**
 * Emergencias (RF5–RF9).
 * - Strategy: GestorEmergencia valida, prepara y clasifica en CADA creación y actualización
 *   (también PATCH parciales y cambios de tipo), sobre los datos combinados.
 * - State: el campo "estado" NO está en el esquema de PUT/PATCH, por lo que sólo cambia
 *   mediante cambiar_estado(), que aplica las transiciones de las clases de estado.
 */
export class ServicioEmergencias extends ServicioEntidad {
  private readonly _gestor: GestorEmergencia;
  private readonly _historial: ServicioHistorial;
  private readonly _alertas: ServicioAlertas;
  private readonly _auditoria_emergencias: ServicioAuditoria;

  constructor(
    repositorios: RepositoriosAplicacion,
    auditoria: ServicioAuditoria,
    publicador: IPublicadorEventos,
    historial: ServicioHistorial,
    alertas: ServicioAlertas,
    gestor = new GestorEmergencia(),
  ) {
    super(
      {
        entidad: 'emergencias',
        nombre: 'La emergencia',
        repositorio: repositorios.emergencias,
        esquema_creacion: ESQUEMA_EMERGENCIA,
        esquema_edicion: ESQUEMA_EMERGENCIA,
        permiso_lectura: 'consultar_informacion_operativa',
        permiso_escritura: 'editar_registros_operativos',
        campos_busqueda: ['titulo', 'descripcion', 'municipio', 'departamento', 'barrio', 'direccion_referencia', 'fuente_informacion'],
        filtros: {
          tipo: 'tipo',
          estado: 'estado',
          nivel_emergencia: 'nivel_emergencia',
          pais: 'pais',
          departamento: 'departamento',
          municipio: 'municipio',
        },
        ordenes: ['fecha_inicio', 'fecha_registro', 'titulo', 'nivel_emergencia', 'estado', 'municipio'],
        orden_predeterminado: { campo: 'fecha_inicio', direccion: 'desc' },
        campo_fecha: 'fecha_inicio',
        campos_direccion: { direccion: 'direccion_referencia' },
        campos_restringidos: ['registrado_por', 'actualizado_por'],
        dependencias_eliminacion: [
          { repositorio: repositorios.zonas, campo: 'catastrofe_id', descripcion: 'zonas afectadas' },
          { repositorio: repositorios.poblacion, campo: 'catastrofe_id', descripcion: 'registros de población' },
          { repositorio: repositorios.necesidades, campo: 'catastrofe_id', descripcion: 'necesidades' },
          { repositorio: repositorios.donaciones, campo: 'catastrofe_id', descripcion: 'donaciones' },
          { repositorio: repositorios.fondos, campo: 'catastrofe_id', descripcion: 'fondos' },
          { repositorio: repositorios.asignaciones, campo: 'catastrofe_id', descripcion: 'asignaciones de recursos' },
          { repositorio: repositorios.familias, campo: 'catastrofe_id', descripcion: 'familias registradas' },
          { repositorio: repositorios.personas, campo: 'catastrofe_id', descripcion: 'personas registradas' },
          { repositorio: repositorios.reportes_ciudadanos, campo: 'catastrofe_id', descripcion: 'reportes ciudadanos asociados' },
        ],
      },
      auditoria,
      publicador,
    );
    this._gestor = gestor;
    this._historial = historial;
    this._alertas = alertas;
    this._auditoria_emergencias = auditoria;
    // Hooks del servicio genérico: aquí se conecta el patrón Strategy con la creación y la edición.
    this.definicion.aplicar_reglas = async (datos, existente, contexto) => this._aplicar_estrategia(datos, existente, contexto);
    this.definicion.enriquecer = (registro) => this._enriquecer(registro);
    this.definicion.despues_de_guardar = async (registro, accion, contexto, anterior) =>
      this._generar_alertas(registro, accion, contexto, anterior);
  }

  private async _aplicar_estrategia(
    datos: Record<string, unknown>,
    existente: Registro | null,
    contexto: ContextoSolicitud,
  ): Promise<Record<string, unknown>> {
    const resultado = this._gestor.validar_y_preparar(datos as DatosReglaEmergencia);
    const finales: Record<string, unknown> = {
      ...resultado.datos,
      clasificacion: { nivel_sugerido: resultado.clasificacion.nivel_sugerido, criterio: resultado.clasificacion.criterio },
    };
    if (!existente) {
      finales.estado = 'activa';
      finales.fecha_fin = null;
      finales.fecha_registro = new Date().toISOString();
      finales.registrado_por = contexto.usuario.id;
    } else {
      finales.actualizado_por = contexto.usuario.id;
    }
    return finales;
  }

  private _enriquecer(registro: Registro): Registro {
    const estado_ciclo = interpretar_estado_almacenado(registro.estado);
    let transiciones: readonly EstadoEmergencia[] = [];
    if (estado_ciclo) transiciones = obtener_estado_emergencia(estado_ciclo).transiciones_permitidas();
    return {
      ...registro,
      estado_ciclo,
      es_estado_heredado: estado_ciclo !== null && estado_ciclo !== registro.estado,
      es_estado_desconocido: estado_ciclo === null,
      transiciones_permitidas: transiciones,
      pendiente_validacion: this._gestor.es_pendiente_validacion(registro),
      estrategia: this._gestor.seleccionar_estrategia(String(registro.tipo ?? '')).nombre,
    };
  }

  private async _generar_alertas(registro: Registro, accion: 'creado' | 'actualizado', contexto: ContextoSolicitud, anterior: Registro | null) {
    const responsable = `${contexto.usuario.nombre} ${contexto.usuario.apellido}`;
    if (accion === 'creado') {
      await this._alertas.generar({
        tipo: 'nueva_emergencia',
        severidad: registro.nivel_emergencia === 'critico' ? 'critica' : registro.nivel_emergencia === 'alto' ? 'alta' : 'media',
        titulo: `Nueva emergencia: ${registro.titulo}`,
        mensaje: `${registro.tipo} · ${registro.municipio}, ${registro.departamento} · Nivel ${obtener_etiqueta(String(registro.nivel_emergencia))}`,
        entidad: 'emergencias',
        entidad_id: registro.id,
        roles_destinatarios: TODOS_LOS_ROLES,
        responsable,
        clave_deduplicacion: `nueva_emergencia:${registro.id}`,
      });
    }
    const paso_a_critica = registro.nivel_emergencia === 'critico' && anterior?.nivel_emergencia !== 'critico';
    if (paso_a_critica) {
      await this._alertas.generar({
        tipo: 'caso_critico',
        severidad: 'critica',
        titulo: `Caso crítico: ${registro.titulo}`,
        mensaje: `La emergencia en ${registro.municipio} está clasificada como crítica. Requiere coordinación prioritaria.`,
        entidad: 'emergencias',
        entidad_id: registro.id,
        roles_destinatarios: TODOS_LOS_ROLES,
        responsable,
        clave_deduplicacion: `caso_critico:emergencia:${registro.id}`,
      });
    }
  }

  /** Cambio de estado mediante el patrón State, con control de concurrencia optimista. */
  async cambiar_estado(id: string, entrada: unknown, contexto: ContextoSolicitud): Promise<Registro> {
    this.exigir_permiso(contexto, 'cambiar_estados');
    const validacion = validar_datos(entrada, ESQUEMA_TRANSICION_EMERGENCIA);
    if (!validacion.es_valido) throw new ErrorValidacion(validacion.errores);
    const destino = validacion.datos.estado as EstadoEmergencia;
    const registro = await this.obtener_registro(id);
    const fecha_cambio = new Date();
    const transicion = transicionar_emergencia(registro.estado, destino, fecha_cambio);
    const cambios: Record<string, unknown> = { estado: transicion.estado_nuevo, actualizado_por: contexto.usuario.id };
    if (transicion.efectos.fecha_fin !== undefined) cambios.fecha_fin = transicion.efectos.fecha_fin;
    // Sólo se actualiza si el estado almacenado sigue siendo el que se leyó (evita carreras entre funcionarios).
    const actualizado = await this.definicion.repositorio.actualizar_si(
      registro.id,
      [{ campo: 'estado', operador: 'igual', valor: registro.estado }],
      { establecer: cambios },
    );
    if (!actualizado) {
      throw new ErrorConflicto('El estado de la emergencia cambió mientras se procesaba la solicitud. Recarga y vuelve a intentarlo.');
    }
    const observacion = (validacion.datos.observacion as string | null) ?? null;
    await this._historial.registrar('emergencias', registro.id, String(registro.estado ?? ''), transicion.estado_nuevo, contexto, observacion);
    await this._auditoria_emergencias.registrar('cambiar_estado', 'emergencias', registro.id, contexto, {
      estado_anterior: registro.estado,
      estado_nuevo: transicion.estado_nuevo,
    });
    this.notificar_cambio_estado(registro.id);
    await this._alertas.generar({
      tipo: 'cambio_estado_emergencia',
      severidad: 'informativa',
      titulo: `${registro.titulo}: ${obtener_etiqueta(transicion.estado_nuevo)}`,
      mensaje: `Cambio de estado de "${obtener_etiqueta(transicion.estado_anterior)}" a "${obtener_etiqueta(transicion.estado_nuevo)}".`,
      entidad: 'emergencias',
      entidad_id: registro.id,
      roles_destinatarios: TODOS_LOS_ROLES,
      responsable: `${contexto.usuario.nombre} ${contexto.usuario.apellido}`,
      clave_deduplicacion: `cambio_estado:${registro.id}:${transicion.estado_nuevo}`,
    });
    return this.presentar(actualizado, contexto);
  }

  async historial(id: string, contexto: ContextoSolicitud): Promise<Registro[]> {
    this.exigir_permiso(contexto, 'consultar_informacion_operativa');
    const registro = await this.obtener_registro(id);
    return this._historial.listar('emergencias', registro.id);
  }

  /** Importación (scripts/importar_emergencias.ts): cada elemento pasa por la misma estrategia. */
  validar_importacion(elementos: unknown[]): { indice: number; errores: Record<string, string> | null }[] {
    return elementos.map((elemento, indice) => {
      const validacion = validar_datos(elemento, ESQUEMA_EMERGENCIA);
      if (!validacion.es_valido) return { indice, errores: validacion.errores };
      try {
        this._gestor.validar_y_preparar(validacion.datos as DatosReglaEmergencia);
        return { indice, errores: null };
      } catch (error) {
        if (error instanceof ErrorValidacion) return { indice, errores: error.detalles ?? {} };
        throw error;
      }
    });
  }
}
