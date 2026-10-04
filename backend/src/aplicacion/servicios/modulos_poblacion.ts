import type { IPublicadorEventos } from '../../dominio/contratos/servicios_externos';
import { ErrorConflicto, ErrorSinPermiso, ErrorValidacion } from '../../dominio/errores';
import { CONDICIONES_VULNERABILIDAD, GRUPOS_EDAD } from '../../dominio/reglas/catalogos';
import { tiene_permiso } from '../../dominio/reglas/permisos';
import { calcular_edad, clasificar_grupo_edad, validar_estadistica_poblacion, type EstadisticaPoblacion } from '../../dominio/reglas/poblacion';
import { ESQUEMA_FAMILIA, ESQUEMA_NECESIDAD, ESQUEMA_PERSONA, ESQUEMA_POBLACION } from '../../dominio/validacion/esquemas';
import type { IRepositorioEntidad } from '../../dominio/contratos/repositorio';
import type { ContextoSolicitud } from '../dto/contexto';
import type { RepositoriosAplicacion } from '../dto/repositorios';
import type { ServicioAuditoria } from './ServicioAuditoria';
import { ServicioEntidad } from './ServicioEntidad';
import { exigir_misma_emergencia } from './reglas_relaciones';

/** Estadísticas agregadas de población (consulta para todos los roles). */
export function crear_servicio_poblacion(
  repositorios: RepositoriosAplicacion,
  auditoria: ServicioAuditoria,
  publicador: IPublicadorEventos,
): ServicioEntidad {
  return new ServicioEntidad(
    {
      entidad: 'poblacion',
      nombre: 'El registro de población',
      repositorio: repositorios.poblacion,
      esquema_creacion: ESQUEMA_POBLACION,
      esquema_edicion: ESQUEMA_POBLACION,
      permiso_lectura: 'consultar_informacion_operativa',
      permiso_escritura: 'editar_registros_operativos',
      campos_busqueda: [],
      filtros: { catastrofe_id: 'catastrofe_id', zona_id: 'zona_id' },
      ordenes: ['personas_afectadas', 'creado_en'],
      orden_predeterminado: { campo: 'personas_afectadas', direccion: 'desc' },
      campos_restringidos: ['registrado_por'],
      relaciones: [
        { campo: 'catastrofe_id', repositorio: repositorios.emergencias, nombre: 'La emergencia' },
        { campo: 'zona_id', repositorio: repositorios.zonas, nombre: 'La zona' },
      ],
      aplicar_reglas: async (datos, existente, contexto) => {
        const errores = validar_estadistica_poblacion(datos as EstadisticaPoblacion);
        if (Object.keys(errores).length > 0) throw new ErrorValidacion(errores);
        await exigir_misma_emergencia(repositorios.zonas, datos.zona_id, datos.catastrofe_id, 'zona_id', 'La zona');
        // Un registro por pareja emergencia–zona: evita contar dos veces a las mismas personas.
        const duplicado = await repositorios.poblacion.buscar_uno([
          { campo: 'catastrofe_id', operador: 'igual', valor: datos.catastrofe_id },
          { campo: 'zona_id', operador: 'igual', valor: datos.zona_id },
        ]);
        if (duplicado && duplicado.id !== existente?.id) {
          throw new ErrorConflicto('Ya existe un registro de población para esta zona y emergencia. Actualiza ese registro.');
        }
        return existente ? datos : { ...datos, registrado_por: contexto.usuario.id };
      },
    },
    auditoria,
    publicador,
  );
}

/** Familias afectadas: datos de acceso restringido (RF15). */
export function crear_servicio_familias(
  repositorios: RepositoriosAplicacion,
  auditoria: ServicioAuditoria,
  publicador: IPublicadorEventos,
): ServicioEntidad {
  return new ServicioEntidad(
    {
      entidad: 'familias',
      nombre: 'La familia',
      repositorio: repositorios.familias,
      esquema_creacion: ESQUEMA_FAMILIA,
      esquema_edicion: ESQUEMA_FAMILIA,
      permiso_lectura: 'consultar_datos_restringidos',
      permiso_escritura: 'editar_registros_operativos',
      campos_busqueda: ['nombre_referencia'],
      filtros: { catastrofe_id: 'catastrofe_id', zona_id: 'zona_id' },
      ordenes: ['nombre_referencia', 'creado_en'],
      orden_predeterminado: { campo: 'creado_en', direccion: 'desc' },
      relaciones: [
        { campo: 'catastrofe_id', repositorio: repositorios.emergencias, nombre: 'La emergencia' },
        { campo: 'zona_id', repositorio: repositorios.zonas, nombre: 'La zona' },
      ],
      dependencias_eliminacion: [
        { repositorio: repositorios.personas, campo: 'familia_id', descripcion: 'personas' },
        { repositorio: repositorios.necesidades, campo: 'familia_id', descripcion: 'necesidades' },
      ],
      roles_eventos: ['funcionario', 'administrador'],
      aplicar_reglas: async (datos, existente, contexto) => {
        await exigir_misma_emergencia(repositorios.zonas, datos.zona_id, datos.catastrofe_id, 'zona_id', 'La zona');
        return existente ? datos : { ...datos, registrado_por: contexto.usuario.id };
      },
    },
    auditoria,
    publicador,
  );
}

/** Personas afectadas: registro individual restringido; documento y condiciones se cifran (RNF5). */
export class ServicioPersonas extends ServicioEntidad {
  private readonly _repositorio_personas: IRepositorioEntidad;

  constructor(repositorios: RepositoriosAplicacion, auditoria: ServicioAuditoria, publicador: IPublicadorEventos) {
    super(
      {
        entidad: 'personas',
        nombre: 'La persona',
        repositorio: repositorios.personas,
        esquema_creacion: ESQUEMA_PERSONA,
        esquema_edicion: ESQUEMA_PERSONA,
        permiso_lectura: 'consultar_datos_restringidos',
        permiso_escritura: 'editar_registros_operativos',
        campos_busqueda: ['nombres', 'apellidos'],
        filtros: { catastrofe_id: 'catastrofe_id', zona_id: 'zona_id', familia_id: 'familia_id', grupo_edad: 'grupo_edad' },
        ordenes: ['apellidos', 'nombres', 'edad', 'creado_en'],
        orden_predeterminado: { campo: 'creado_en', direccion: 'desc' },
        relaciones: [
          { campo: 'catastrofe_id', repositorio: repositorios.emergencias, nombre: 'La emergencia' },
          { campo: 'zona_id', repositorio: repositorios.zonas, nombre: 'La zona' },
        ],
        dependencias_eliminacion: [{ repositorio: repositorios.necesidades, campo: 'persona_id', descripcion: 'necesidades' }],
        roles_eventos: ['funcionario', 'administrador'],
        aplicar_reglas: async (datos, existente, contexto) => {
          await exigir_misma_emergencia(repositorios.zonas, datos.zona_id, datos.catastrofe_id, 'zona_id', 'La zona');
          await exigir_misma_emergencia(repositorios.familias, datos.familia_id, datos.catastrofe_id, 'familia_id', 'La familia');
          const fecha = typeof datos.fecha_nacimiento === 'string' ? datos.fecha_nacimiento : null;
          if (fecha) {
            const edad_por_fecha = calcular_edad(fecha);
            if (edad_por_fecha === null) throw new ErrorValidacion({ fecha_nacimiento: 'La fecha de nacimiento no puede estar en el futuro.' });
            if (typeof datos.edad === 'number' && datos.edad !== edad_por_fecha) {
              throw new ErrorValidacion({ edad: `La edad no coincide con la fecha de nacimiento (${edad_por_fecha} años).` });
            }
            datos.edad = edad_por_fecha;
          }
          // Clasificación automática; si falta la edad queda "pendiente" (nunca se inventa).
          const grupo_edad = clasificar_grupo_edad(datos.edad as number | null, fecha);
          return { ...datos, grupo_edad, ...(existente ? {} : { registrado_por: contexto.usuario.id }) };
        },
      },
      auditoria,
      publicador,
    );
    this._repositorio_personas = repositorios.personas;
  }

  /**
   * Resumen agregado (sin datos personales): disponible para todos los roles.
   * Las condiciones de vulnerabilidad se cuentan por separado porque pueden solaparse.
   */
  async resumen(contexto: ContextoSolicitud, catastrofe_id?: string): Promise<Record<string, unknown>> {
    if (!tiene_permiso(contexto.usuario.rol, 'consultar_informacion_operativa')) throw new ErrorSinPermiso();
    const condiciones = catastrofe_id ? [{ campo: 'catastrofe_id', operador: 'igual' as const, valor: catastrofe_id }] : [];
    const personas = await this._repositorio_personas.listar_todos(condiciones, 20000);
    const por_grupo = Object.fromEntries(GRUPOS_EDAD.map((grupo) => [grupo, 0]));
    const por_condicion = Object.fromEntries(CONDICIONES_VULNERABILIDAD.map((condicion) => [condicion, 0]));
    for (const persona of personas) {
      const grupo = String(persona.grupo_edad ?? 'pendiente');
      por_grupo[grupo] = (por_grupo[grupo] ?? 0) + 1;
      for (const condicion of (persona.condiciones_vulnerabilidad as string[] | null) ?? []) {
        if (condicion in por_condicion) por_condicion[condicion] += 1;
      }
    }
    return { total_registradas: personas.length, por_grupo_edad: por_grupo, por_condicion_vulnerabilidad: por_condicion };
  }
}

/** Necesidades de zona, familia o persona (RF16), siempre vinculadas a su emergencia. */
export function crear_servicio_necesidades(
  repositorios: RepositoriosAplicacion,
  auditoria: ServicioAuditoria,
  publicador: IPublicadorEventos,
  generar_alerta_critica: (necesidad: Record<string, unknown> & { id: string }, responsable: string) => Promise<void>,
): ServicioEntidad {
  return new ServicioEntidad(
    {
      entidad: 'necesidades',
      nombre: 'La necesidad',
      repositorio: repositorios.necesidades,
      esquema_creacion: ESQUEMA_NECESIDAD,
      esquema_edicion: ESQUEMA_NECESIDAD,
      permiso_lectura: 'consultar_informacion_operativa',
      permiso_escritura: 'editar_registros_operativos',
      campos_busqueda: ['tipo', 'descripcion', 'responsable'],
      filtros: {
        catastrofe_id: 'catastrofe_id',
        zona_id: 'zona_id',
        ambito: 'ambito',
        tipo: 'tipo',
        prioridad: 'prioridad',
        estado: 'estado',
      },
      ordenes: ['prioridad', 'estado', 'cantidad_requerida', 'creado_en'],
      orden_predeterminado: { campo: 'creado_en', direccion: 'desc' },
      // Las necesidades de personas o familias no exponen a qué persona o familia pertenecen al rol usuario.
      campos_restringidos: ['familia_id', 'persona_id', 'registrado_por'],
      relaciones: [{ campo: 'catastrofe_id', repositorio: repositorios.emergencias, nombre: 'La emergencia' }],
      aplicar_reglas: async (datos, existente, contexto) => {
        const ambito = datos.ambito;
        const errores: Record<string, string> = {};
        if (ambito === 'zona' && !datos.zona_id) errores.zona_id = 'Selecciona la zona de la necesidad.';
        if (ambito === 'familia' && !datos.familia_id) errores.familia_id = 'Selecciona la familia de la necesidad.';
        if (ambito === 'persona' && !datos.persona_id) errores.persona_id = 'Selecciona la persona de la necesidad.';
        if (Object.keys(errores).length > 0) throw new ErrorValidacion(errores);
        if (ambito !== 'familia') datos.familia_id = null;
        if (ambito !== 'persona') datos.persona_id = null;
        // La zona se deriva de la familia o persona para mantener una sola fuente de verdad.
        const familia = await exigir_misma_emergencia(repositorios.familias, datos.familia_id, datos.catastrofe_id, 'familia_id', 'La familia');
        const persona = await exigir_misma_emergencia(repositorios.personas, datos.persona_id, datos.catastrofe_id, 'persona_id', 'La persona');
        if (familia) datos.zona_id = familia.zona_id;
        if (persona) datos.zona_id = persona.zona_id;
        const zona = await exigir_misma_emergencia(repositorios.zonas, datos.zona_id, datos.catastrofe_id, 'zona_id', 'La zona');
        if (zona) datos.zona_id = zona.id;
        if (datos.cantidad_recibida === undefined || datos.cantidad_recibida === null) datos.cantidad_recibida = 0;
        // Evita duplicados: misma emergencia, mismo destinatario y mismo tipo mientras no esté atendida.
        if (datos.estado !== 'atendida') {
          const condiciones = [
            { campo: 'catastrofe_id', operador: 'igual' as const, valor: datos.catastrofe_id },
            { campo: 'tipo', operador: 'igual' as const, valor: datos.tipo },
            { campo: 'estado', operador: 'en' as const, valor: ['pendiente', 'en_proceso'] },
            { campo: 'ambito', operador: 'igual' as const, valor: ambito },
          ];
          const destino = ambito === 'zona' ? 'zona_id' : ambito === 'familia' ? 'familia_id' : 'persona_id';
          condiciones.push({ campo: destino, operador: 'igual', valor: datos[destino] });
          const duplicada = await repositorios.necesidades.buscar_uno(condiciones);
          if (duplicada && duplicada.id !== existente?.id) {
            throw new ErrorConflicto('Ya existe una necesidad abierta del mismo tipo para este destinatario. Actualiza esa necesidad.');
          }
        }
        return existente ? datos : { ...datos, registrado_por: contexto.usuario.id };
      },
      enriquecer: (registro) => {
        const requerida = Number(registro.cantidad_requerida ?? 0);
        const recibida = Number(registro.cantidad_recibida ?? 0);
        return { ...registro, porcentaje_cubierto: requerida > 0 ? Math.min(100, Math.round((recibida / requerida) * 100)) : 0 };
      },
      despues_de_guardar: async (registro, _accion, contexto) => {
        if (registro.prioridad === 'critica' && registro.estado !== 'atendida') {
          await generar_alerta_critica(registro, `${contexto.usuario.nombre} ${contexto.usuario.apellido}`);
        }
      },
    },
    auditoria,
    publicador,
  );
}
