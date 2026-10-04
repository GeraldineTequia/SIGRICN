/**
 * Errores del dominio y de la aplicación. No dependen de HTTP: la capa de presentación
 * los traduce a códigos de estado en el manejador centralizado de errores.
 */
export type CodigoError =
  | 'VALIDACION'
  | 'NO_AUTENTICADO'
  | 'SESION_EXPIRADA'
  | 'SIN_PERMISO'
  | 'NO_ENCONTRADO'
  | 'CONFLICTO'
  | 'TRANSICION_INVALIDA'
  | 'CSRF_INVALIDO'
  | 'DEMASIADAS_SOLICITUDES'
  | 'SERVICIO_EXTERNO'
  | 'INTERNO';

export class ErrorAplicacion extends Error {
  readonly codigo: CodigoError;
  readonly detalles?: Record<string, string>;

  constructor(codigo: CodigoError, mensaje: string, detalles?: Record<string, string>) {
    super(mensaje);
    this.name = 'ErrorAplicacion';
    this.codigo = codigo;
    this.detalles = detalles;
  }
}

export class ErrorValidacion extends ErrorAplicacion {
  constructor(detalles: Record<string, string>, mensaje = 'Revisa los datos marcados en el formulario.') {
    super('VALIDACION', mensaje, detalles);
  }
}

export class ErrorNoEncontrado extends ErrorAplicacion {
  constructor(recurso: string) {
    super('NO_ENCONTRADO', `${recurso} no existe o fue eliminado.`);
  }
}

export class ErrorConflicto extends ErrorAplicacion {
  constructor(mensaje: string, detalles?: Record<string, string>) {
    super('CONFLICTO', mensaje, detalles);
  }
}

export class ErrorSinPermiso extends ErrorAplicacion {
  constructor(mensaje = 'No tienes permisos para realizar esta acción.') {
    super('SIN_PERMISO', mensaje);
  }
}
