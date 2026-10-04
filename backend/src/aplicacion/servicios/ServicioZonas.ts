import type { IPublicadorEventos } from '../../dominio/contratos/servicios_externos';
import type { Registro } from '../../dominio/contratos/repositorio';
import { ErrorConflicto, ErrorValidacion } from '../../dominio/errores';
import { interpretar_estado_atencion, TRANSICIONES_ATENCION_ZONA, validar_transicion_atencion } from '../../dominio/estados/estados_atencion_zona';
import { obtener_etiqueta, type EstadoAtencionZona } from '../../dominio/reglas/catalogos';
import { sugerir_prioridad_zona, type SugerenciaPrioridad } from '../../dominio/reglas/prioridad_zona';
import { ESQUEMA_ATENCION_ZONA, ESQUEMA_ZONA } from '../../dominio/validacion/esquemas';
import { validar_datos } from '../../dominio/validacion/validador';
import type { ContextoSolicitud } from '../dto/contexto';
import type { RepositoriosAplicacion } from '../dto/repositorios';
import { ROLES_OPERATIVOS, type ServicioAlertas } from './ServicioAlertas';
import type { ServicioAuditoria } from './ServicioAuditoria';
import { ServicioEntidad } from './ServicioEntidad';
import type { ServicioHistorial } from './ServicioHistorial';

const HORAS_LIMITE_SIN_ATENCION = 24;

/** Zonas afectadas (RF10, RF12, RF13): ubicación por dirección, prioridad y estado de atención. */
export class ServicioZonas extends ServicioEntidad {
  private readonly _repositorios: RepositoriosAplicacion;
  private readonly _historial: ServicioHistorial;
  private readonly _alertas: ServicioAlertas;
  private readonly _auditoria_zonas: ServicioAuditoria;

  constructor(
    repositorios: RepositoriosAplicacion,
    auditoria: ServicioAuditoria,
    publicador: IPublicadorEventos,
    historial: ServicioHistorial,
    alertas: ServicioAlertas,
  ) {
    super(
      {
        entidad: 'zonas',
        nombre: 'La zona afectada',
        repositorio: repositorios.zonas,
        esquema_creacion: ESQUEMA_ZONA,
        esquema_edicion: ESQUEMA_ZONA,
        permiso_lectura: 'consultar_informacion_operativa',
        permiso_escritura: 'editar_registros_operativos',
        campos_busqueda: ['direccion', 'barrio', 'municipio', 'departamento', 'descripcion'],
        filtros: {
          catastrofe_id: 'catastrofe_id',
          departamento: 'departamento',
          municipio: 'municipio',
          nivel_afectacion: 'nivel_afectacion',
          prioridad: 'prioridad',
          estado: 'estado',
          estado_atencion: 'estado_atencion',
        },
        ordenes: ['porcentaje_afectacion', 'nivel_afectacion', 'prioridad', 'municipio', 'creado_en'],
        orden_predeterminado: { campo: 'porcentaje_afectacion', direccion: 'desc' },
        campos_direccion: { direccion: 'direccion' },
        campos_restringidos: ['registrado_por'],
        relaciones: [{ campo: 'catastrofe_id', repositorio: repositorios.emergencias, nombre: 'La emergencia' }],
        dependencias_eliminacion: [
          { repositorio: repositorios.poblacion, campo: 'zona_id', descripcion: 'registros de población' },
          { repositorio: repositorios.necesidades, campo: 'zona_id', descripcion: 'necesidades' },
          { repositorio: repositorios.asignaciones, campo: 'zona_id', descripcion: 'asignaciones de recursos' },
          { repositorio: repositorios.familias, campo: 'zona_id', descripcion: 'familias' },
          { repositorio: repositorios.personas, campo: 'zona_id', descripcion: 'personas' },
          { repositorio: repositorios.recursos_humanos, campo: 'zona_id', descripcion: 'equipos humanos asignados' },
        ],
      },
      auditoria,
      publicador,
    );
    this._repositorios = repositorios;
    this._historial = historial;
    this._alertas = alertas;
    this._auditoria_zonas = auditoria;
    this.definicion.aplicar_reglas = async (datos, existente, contexto) => {
      if (!existente) return { ...datos, estado_atencion: 'sin_atender', registrado_por: contexto.usuario.id };
      return datos;
    };
    this.definicion.enriquecer = (registro) => {
      const estado_atencion = interpretar_estado_atencion(registro.estado_atencion);
      return {
        ...registro,
        estado_atencion,
        transiciones_atencion: TRANSICIONES_ATENCION_ZONA[estado_atencion],
        // Sólo se dibujan áreas con geometría registrada y validada; nunca se inventan a partir de la dirección.
        geometria: registro.geometria_validada === true ? registro.geometria : null,
      };
    };
    this.definicion.despues_de_guardar = async (registro, accion, contexto) => {
      if (accion === 'creado' && ['alta', 'critica'].includes(String(registro.prioridad))) {
        await this._alertar_zona_sin_atencion(registro, `${contexto.usuario.nombre} ${contexto.usuario.apellido}`);
      }
    };
  }

  private async _alertar_zona_sin_atencion(zona: Registro, responsable: string): Promise<void> {
    await this._alertas.generar({
      tipo: 'zona_sin_atencion',
      severidad: zona.prioridad === 'critica' ? 'critica' : 'alta',
      titulo: `Zona sin atender: ${zona.barrio || zona.direccion} · ${zona.municipio}`,
      mensaje: `Prioridad ${obtener_etiqueta(String(zona.prioridad))}, afectación ${zona.porcentaje_afectacion}%. Asigna equipos o recursos.`,
      entidad: 'zonas',
      entidad_id: zona.id,
      roles_destinatarios: ROLES_OPERATIVOS,
      responsable,
      clave_deduplicacion: `zona_sin_atencion:${zona.id}`,
    });
  }

  async cambiar_estado_atencion(id: string, entrada: unknown, contexto: ContextoSolicitud): Promise<Registro> {
    this.exigir_permiso(contexto, 'cambiar_estados');
    const validacion = validar_datos(entrada, ESQUEMA_ATENCION_ZONA);
    if (!validacion.es_valido) throw new ErrorValidacion(validacion.errores);
    const destino = validacion.datos.estado_atencion as EstadoAtencionZona;
    const zona = await this.obtener_registro(id);
    const origen = validar_transicion_atencion(zona.estado_atencion, destino);
    const actualizado = await this.definicion.repositorio.actualizar_si(
      zona.id,
      [{ campo: 'estado_atencion', operador: 'igual', valor: zona.estado_atencion ?? null }],
      { establecer: { estado_atencion: destino } },
    );
    if (!actualizado) throw new ErrorConflicto('El estado de atención cambió mientras se procesaba la solicitud. Recarga e intenta de nuevo.');
    await this._historial.registrar('zonas', zona.id, origen, destino, contexto, (validacion.datos.observacion as string) ?? null);
    await this._auditoria_zonas.registrar('cambiar_estado_atencion', 'zonas', zona.id, contexto, { origen, destino });
    this.notificar_cambio_estado(zona.id);
    return this.presentar(actualizado, contexto);
  }

  async historial(id: string, contexto: ContextoSolicitud): Promise<Registro[]> {
    this.exigir_permiso(contexto, 'consultar_informacion_operativa');
    return this._historial.listar('zonas', (await this.obtener_registro(id)).id);
  }

  /** Sugerencia documentada de prioridad (RF12). El funcionario decide la prioridad definitiva. */
  async sugerir_prioridad(id: string, contexto: ContextoSolicitud): Promise<SugerenciaPrioridad> {
    this.exigir_permiso(contexto, 'consultar_informacion_operativa');
    const zona = await this.obtener_registro(id);
    const emergencia = zona.catastrofe_id ? await this._repositorios.emergencias.obtener(String(zona.catastrofe_id)) : null;
    const registros_poblacion = await this._repositorios.poblacion.listar_todos([{ campo: 'zona_id', operador: 'igual', valor: zona.id }], 50);
    const mas_reciente = registros_poblacion[0];
    const necesidades_criticas = await this._repositorios.necesidades.contar([
      { campo: 'zona_id', operador: 'igual', valor: zona.id },
      { campo: 'prioridad', operador: 'en', valor: ['alta', 'critica'] },
      { campo: 'estado', operador: 'en', valor: ['pendiente', 'en_proceso'] },
    ]);
    return sugerir_prioridad_zona({
      nivel_afectacion: String(zona.nivel_afectacion ?? 'medio'),
      porcentaje_afectacion: typeof zona.porcentaje_afectacion === 'number' ? zona.porcentaje_afectacion : null,
      nivel_emergencia: emergencia ? String(emergencia.nivel_emergencia ?? '') : null,
      personas_afectadas: Number(mas_reciente?.personas_afectadas ?? 0),
      necesidades_criticas_pendientes: necesidades_criticas,
      estado_atencion: interpretar_estado_atencion(zona.estado_atencion),
    });
  }

  /** Tarea periódica: alerta zonas de prioridad alta o crítica que siguen sin atención después de 24 horas. */
  async verificar_zonas_desatendidas(): Promise<number> {
    const limite = new Date(Date.now() - HORAS_LIMITE_SIN_ATENCION * 3_600_000).toISOString();
    const zonas = await this.definicion.repositorio.listar_todos(
      [
        { campo: 'prioridad', operador: 'en', valor: ['alta', 'critica'] },
        { campo: 'estado_atencion', operador: 'en', valor: ['sin_atender', null] },
        { campo: 'creado_en', operador: 'menor_igual', valor: limite },
      ],
      500,
    );
    for (const zona of zonas) await this._alertar_zona_sin_atencion(zona, 'Sistema (verificación automática)');
    return zonas.length;
  }
}
