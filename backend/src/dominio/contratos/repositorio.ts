/**
 * Contrato de persistencia independiente de MongoDB. Los servicios de aplicación construyen
 * consultas con estos tipos (sólo campos permitidos) y los repositorios de infraestructura
 * los traducen a Mongoose. Ningún filtro del cliente llega directamente a la base.
 */

export type Registro = Record<string, unknown> & { id: string };

export type OperadorCondicion = 'igual' | 'en' | 'distinto' | 'no_en' | 'mayor_igual' | 'menor_igual' | 'existe';

export interface CondicionCampo {
  campo: string;
  operador: OperadorCondicion;
  valor: unknown;
}

export interface ConsultaListado {
  condiciones: CondicionCampo[];
  busqueda?: { texto: string; campos: string[] };
  rango_fecha?: { campo: string; desde?: string; hasta?: string };
  orden?: { campo: string; direccion: 'asc' | 'desc' };
  pagina: number;
  limite: number;
}

export interface PaginaResultados<T = Registro> {
  elementos: T[];
  total: number;
  pagina: number;
  limite: number;
  total_paginas: number;
}

export interface CambiosAtomicos {
  establecer?: Record<string, unknown>;
  incrementar?: Record<string, number>;
  agregar_a_lista?: Record<string, unknown>;
}

export interface IRepositorioEntidad {
  listar(consulta: ConsultaListado): Promise<PaginaResultados>;
  listar_todos(condiciones: CondicionCampo[], limite?: number): Promise<Registro[]>;
  obtener(id: string): Promise<Registro | null>;
  buscar_uno(condiciones: CondicionCampo[]): Promise<Registro | null>;
  contar(condiciones: CondicionCampo[]): Promise<number>;
  crear(datos: Record<string, unknown>): Promise<Registro>;
  /** Reemplaza los campos indicados ($set). Devuelve null si el registro no existe. */
  actualizar(id: string, cambios: Record<string, unknown>): Promise<Registro | null>;
  /**
   * Actualización atómica condicionada: sólo se aplica si el registro cumple las condiciones
   * (por ejemplo, existencias suficientes o estado vigente). Devuelve null si no se cumplieron.
   */
  actualizar_si(id: string, condiciones: CondicionCampo[], cambios: CambiosAtomicos): Promise<Registro | null>;
  eliminar(id: string): Promise<boolean>;
  /** Valores distintos de un campo (para construir filtros con datos reales). */
  valores_distintos(campo: string): Promise<string[]>;
}
