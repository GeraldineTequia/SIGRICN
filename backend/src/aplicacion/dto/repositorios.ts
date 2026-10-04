import type { IRepositorioUsuarios, IRepositorioTokensRecuperacion } from '../../dominio/contratos/autenticacion';
import type { IRepositorioEstadisticas } from '../../dominio/contratos/estadisticas';
import type { IRepositorioEntidad } from '../../dominio/contratos/repositorio';

/** Conjunto de repositorios que la composición inyecta en los servicios de aplicación. */
export interface RepositoriosAplicacion {
  usuarios: IRepositorioUsuarios;
  tokens_recuperacion: IRepositorioTokensRecuperacion;
  emergencias: IRepositorioEntidad;
  zonas: IRepositorioEntidad;
  poblacion: IRepositorioEntidad;
  necesidades: IRepositorioEntidad;
  centros: IRepositorioEntidad;
  donaciones: IRepositorioEntidad;
  familias: IRepositorioEntidad;
  personas: IRepositorioEntidad;
  recursos: IRepositorioEntidad;
  movimientos_recursos: IRepositorioEntidad;
  asignaciones: IRepositorioEntidad;
  recursos_humanos: IRepositorioEntidad;
  fondos: IRepositorioEntidad;
  movimientos_fondos: IRepositorioEntidad;
  reportes_ciudadanos: IRepositorioEntidad;
  historial: IRepositorioEntidad;
  alertas: IRepositorioEntidad;
  lecturas_alertas: IRepositorioEntidad;
  auditoria: IRepositorioEntidad;
  estadisticas: IRepositorioEstadisticas;
}
