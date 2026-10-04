import type { FilterQuery, Model } from 'mongoose';
import { ErrorConflicto } from '../../../dominio/errores';
import type {
  CambiosAtomicos,
  CondicionCampo,
  ConsultaListado,
  IRepositorioEntidad,
  PaginaResultados,
  Registro,
} from '../../../dominio/contratos/repositorio';
import { candidatos_identificador } from '../identificadores';
import type { MapeadorDocumento } from '../mapeadores/MapeadorDocumento';

type Documento = Record<string, unknown>;

function escapar_expresion(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function es_error_duplicado(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: number }).code === 11000;
}

/**
 * Implementación del contrato IRepositorioEntidad con Mongoose.
 * Traduce condiciones del dominio a filtros MongoDB usando sólo campos mapeados:
 * los nombres y valores del cliente nunca se insertan como operadores.
 */
export class RepositorioMongo implements IRepositorioEntidad {
  protected readonly _modelo: Model<Documento>;
  protected readonly _mapeador: MapeadorDocumento;

  constructor(modelo: Model<Documento>, mapeador: MapeadorDocumento) {
    this._modelo = modelo;
    this._mapeador = mapeador;
  }

  get mapeador(): MapeadorDocumento {
    return this._mapeador;
  }

  /** Valores con los que puede coincidir un campo (identificadores con ambas representaciones). */
  private _valores_coincidencia(campo: string, valor: unknown): unknown[] {
    if (this._mapeador.es_referencia(campo) && typeof valor === 'string') return candidatos_identificador(valor);
    return [valor];
  }

  private _traducir_condicion(condicion: CondicionCampo): FilterQuery<Documento> {
    const campo_base = this._mapeador.campo_base(condicion.campo);
    const { operador, valor } = condicion;
    switch (operador) {
      case 'igual':
        if (valor === null) return { [campo_base]: null };
        return { [campo_base]: { $in: this._valores_coincidencia(condicion.campo, valor) } };
      case 'distinto':
        return { [campo_base]: { $nin: this._valores_coincidencia(condicion.campo, valor) } };
      case 'en':
      case 'no_en': {
        const lista = (Array.isArray(valor) ? valor : [valor]).flatMap((elemento) =>
          this._valores_coincidencia(condicion.campo, elemento),
        );
        return { [campo_base]: operador === 'en' ? { $in: lista } : { $nin: lista } };
      }
      case 'mayor_igual':
      case 'menor_igual': {
        const comparado = this._mapeador.es_fecha(condicion.campo) && typeof valor === 'string' ? new Date(valor) : valor;
        return { [campo_base]: operador === 'mayor_igual' ? { $gte: comparado } : { $lte: comparado } };
      }
      case 'existe':
        return valor ? { [campo_base]: { $exists: true, $nin: [null, ''] } } : { [campo_base]: { $in: [null, ''] } };
    }
  }

  /** Rango de fechas compatible con fechas guardadas como Date o como texto ISO. */
  private _traducir_rango(rango: NonNullable<ConsultaListado['rango_fecha']>): FilterQuery<Documento> | null {
    const campo_base = this._mapeador.campo_base(rango.campo);
    const como_fecha: Record<string, unknown> = {};
    const como_texto: Record<string, unknown> = {};
    if (rango.desde) {
      como_fecha.$gte = new Date(rango.desde);
      como_texto.$gte = new Date(rango.desde).toISOString();
    }
    if (rango.hasta) {
      como_fecha.$lte = new Date(rango.hasta);
      como_texto.$lte = new Date(rango.hasta).toISOString();
    }
    if (!rango.desde && !rango.hasta) return null;
    como_texto.$type = 'string';
    return { $or: [{ [campo_base]: como_fecha }, { [campo_base]: como_texto }] };
  }

  protected construir_filtro(
    condiciones: CondicionCampo[],
    busqueda?: ConsultaListado['busqueda'],
    rango?: ConsultaListado['rango_fecha'],
  ): FilterQuery<Documento> {
    const partes: FilterQuery<Documento>[] = condiciones.map((condicion) => this._traducir_condicion(condicion));
    if (busqueda && busqueda.texto.trim() !== '') {
      const expresion = new RegExp(escapar_expresion(busqueda.texto.trim().slice(0, 100)), 'i');
      partes.push({ $or: busqueda.campos.map((campo) => ({ [this._mapeador.campo_base(campo)]: expresion })) });
    }
    if (rango) {
      const filtro_rango = this._traducir_rango(rango);
      if (filtro_rango) partes.push(filtro_rango);
    }
    return partes.length > 0 ? { $and: partes } : {};
  }

  private _filtro_id(id: string): FilterQuery<Documento> {
    return { _id: { $in: candidatos_identificador(id) } };
  }

  async listar(consulta: ConsultaListado): Promise<PaginaResultados> {
    const filtro = this.construir_filtro(consulta.condiciones, consulta.busqueda, consulta.rango_fecha);
    const orden: Record<string, 1 | -1> = {};
    if (consulta.orden) orden[this._mapeador.campo_base(consulta.orden.campo)] = consulta.orden.direccion === 'asc' ? 1 : -1;
    orden._id = -1;
    const [documentos, total] = await Promise.all([
      this._modelo
        .find(filtro)
        .sort(orden)
        .skip((consulta.pagina - 1) * consulta.limite)
        .limit(consulta.limite)
        .lean<Documento[]>(),
      this._modelo.countDocuments(filtro),
    ]);
    return {
      elementos: documentos.map((documento) => this._mapeador.a_dominio(documento)),
      total,
      pagina: consulta.pagina,
      limite: consulta.limite,
      total_paginas: Math.max(1, Math.ceil(total / consulta.limite)),
    };
  }

  async listar_todos(condiciones: CondicionCampo[], limite = 5000): Promise<Registro[]> {
    const documentos = await this._modelo.find(this.construir_filtro(condiciones)).sort({ _id: -1 }).limit(limite).lean<Documento[]>();
    return documentos.map((documento) => this._mapeador.a_dominio(documento));
  }

  async obtener(id: string): Promise<Registro | null> {
    const documento = await this._modelo.findOne(this._filtro_id(id)).lean<Documento>();
    return documento ? this._mapeador.a_dominio(documento) : null;
  }

  async buscar_uno(condiciones: CondicionCampo[]): Promise<Registro | null> {
    const documento = await this._modelo.findOne(this.construir_filtro(condiciones)).lean<Documento>();
    return documento ? this._mapeador.a_dominio(documento) : null;
  }

  async contar(condiciones: CondicionCampo[]): Promise<number> {
    return this._modelo.countDocuments(this.construir_filtro(condiciones));
  }

  async crear(datos: Record<string, unknown>): Promise<Registro> {
    try {
      const creado = await this._modelo.create(this._mapeador.a_documento(datos));
      return this._mapeador.a_dominio(creado.toObject() as Documento);
    } catch (error) {
      if (es_error_duplicado(error)) throw new ErrorConflicto('Ya existe un registro con esos datos únicos.');
      throw error;
    }
  }

  async actualizar(id: string, cambios: Record<string, unknown>): Promise<Registro | null> {
    const documento = await this._modelo
      .findOneAndUpdate(this._filtro_id(id), { $set: this._mapeador.a_documento(cambios) }, { new: true })
      .lean<Documento>();
    return documento ? this._mapeador.a_dominio(documento) : null;
  }

  async actualizar_si(id: string, condiciones: CondicionCampo[], cambios: CambiosAtomicos): Promise<Registro | null> {
    const actualizacion: Record<string, unknown> = {};
    if (cambios.establecer) actualizacion.$set = this._mapeador.a_documento(cambios.establecer);
    if (cambios.incrementar) {
      actualizacion.$inc = Object.fromEntries(
        Object.entries(cambios.incrementar).map(([campo, valor]) => [this._mapeador.campo_base(campo), valor]),
      );
    }
    if (cambios.agregar_a_lista) {
      actualizacion.$addToSet = Object.fromEntries(
        Object.entries(cambios.agregar_a_lista).map(([campo, valor]) => [this._mapeador.campo_base(campo), valor]),
      );
    }
    const filtro = { $and: [this._filtro_id(id), this.construir_filtro(condiciones)] };
    const documento = await this._modelo.findOneAndUpdate(filtro, actualizacion, { new: true }).lean<Documento>();
    return documento ? this._mapeador.a_dominio(documento) : null;
  }

  async eliminar(id: string): Promise<boolean> {
    const resultado = await this._modelo.deleteOne(this._filtro_id(id));
    return resultado.deletedCount === 1;
  }

  async valores_distintos(campo: string): Promise<string[]> {
    const valores = await this._modelo.distinct(this._mapeador.campo_base(campo));
    return valores
      .filter((valor): valor is string => typeof valor === 'string' && valor.trim() !== '')
      .sort((primero, segundo) => primero.localeCompare(segundo, 'es'));
  }
}
