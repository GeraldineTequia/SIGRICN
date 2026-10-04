import type { IPublicadorEventos } from '../../dominio/contratos/servicios_externos';
import type { Registro } from '../../dominio/contratos/repositorio';
import { ErrorConflicto, ErrorValidacion } from '../../dominio/errores';
import { ESQUEMA_ASIGNACION_RECURSO_HUMANO, ESQUEMA_RECURSO_HUMANO } from '../../dominio/validacion/esquemas';
import { validar_datos } from '../../dominio/validacion/validador';
import type { ContextoSolicitud } from '../dto/contexto';
import type { RepositoriosAplicacion } from '../dto/repositorios';
import type { ServicioAuditoria } from './ServicioAuditoria';
import { ServicioEntidad } from './ServicioEntidad';
import { exigir_misma_emergencia } from './reglas_relaciones';

/** Recursos humanos: personas o equipos, su función, entidad, disponibilidad y asignación. */
export class ServicioRecursosHumanos extends ServicioEntidad {
  private readonly _repositorios: RepositoriosAplicacion;
  private readonly _auditoria_humanos: ServicioAuditoria;

  constructor(repositorios: RepositoriosAplicacion, auditoria: ServicioAuditoria, publicador: IPublicadorEventos) {
    super(
      {
        entidad: 'recursos_humanos',
        nombre: 'El recurso humano',
        repositorio: repositorios.recursos_humanos,
        esquema_creacion: ESQUEMA_RECURSO_HUMANO,
        esquema_edicion: ESQUEMA_RECURSO_HUMANO,
        permiso_lectura: 'consultar_informacion_operativa',
        permiso_escritura: 'gestionar_recursos_y_fondos',
        campos_busqueda: ['nombre', 'entidad', 'funcion'],
        filtros: { funcion: 'funcion', entidad: 'entidad', disponibilidad: 'disponibilidad', catastrofe_id: 'catastrofe_id', zona_id: 'zona_id' },
        ordenes: ['nombre', 'funcion', 'disponibilidad'],
        orden_predeterminado: { campo: 'nombre', direccion: 'asc' },
        campos_restringidos: ['telefono_contacto'],
        aplicar_reglas: async (datos, existente) => {
          // Mientras está asignado, la disponibilidad sólo cambia al liberar la asignación.
          if (existente?.disponibilidad === 'asignado') return { ...datos, disponibilidad: 'asignado' };
          return { ...datos, catastrofe_id: null, zona_id: null };
        },
        antes_de_eliminar: async (registro) => {
          if (registro.disponibilidad === 'asignado') throw new ErrorConflicto('Libera la asignación del equipo antes de eliminarlo.');
        },
      },
      auditoria,
      publicador,
    );
    this._repositorios = repositorios;
    this._auditoria_humanos = auditoria;
  }

  async asignar(id: string, entrada: unknown, contexto: ContextoSolicitud): Promise<Registro> {
    this.exigir_permiso(contexto, 'gestionar_recursos_y_fondos');
    const validacion = validar_datos(entrada, ESQUEMA_ASIGNACION_RECURSO_HUMANO);
    if (!validacion.es_valido) throw new ErrorValidacion(validacion.errores);
    const emergencia = await this._repositorios.emergencias.obtener(String(validacion.datos.catastrofe_id));
    if (!emergencia) throw new ErrorValidacion({ catastrofe_id: 'La emergencia seleccionada no existe.' });
    const zona = await exigir_misma_emergencia(this._repositorios.zonas, validacion.datos.zona_id, emergencia.id, 'zona_id', 'La zona');
    const registro = await this.obtener_registro(id);
    // Atómico: un equipo disponible no puede asignarse a dos zonas por solicitudes simultáneas.
    const actualizado = await this.definicion.repositorio.actualizar_si(registro.id, [{ campo: 'disponibilidad', operador: 'igual', valor: 'disponible' }], {
      establecer: { disponibilidad: 'asignado', catastrofe_id: emergencia.id, zona_id: zona?.id ?? null },
    });
    if (!actualizado) throw new ErrorConflicto('El equipo no está disponible para asignarse.');
    await this._auditoria_humanos.registrar('asignar', 'recursos_humanos', registro.id, contexto, { zona_id: zona?.id });
    this.notificar_cambio_estado(registro.id);
    return this.presentar(actualizado, contexto);
  }

  async liberar(id: string, contexto: ContextoSolicitud): Promise<Registro> {
    this.exigir_permiso(contexto, 'gestionar_recursos_y_fondos');
    const registro = await this.obtener_registro(id);
    const actualizado = await this.definicion.repositorio.actualizar_si(registro.id, [{ campo: 'disponibilidad', operador: 'igual', valor: 'asignado' }], {
      establecer: { disponibilidad: 'disponible', catastrofe_id: null, zona_id: null },
    });
    if (!actualizado) throw new ErrorConflicto('El equipo no tiene una asignación activa.');
    await this._auditoria_humanos.registrar('liberar', 'recursos_humanos', registro.id, contexto);
    this.notificar_cambio_estado(registro.id);
    return this.presentar(actualizado, contexto);
  }
}
