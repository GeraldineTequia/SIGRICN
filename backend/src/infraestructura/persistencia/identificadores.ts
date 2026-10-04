import { Types } from 'mongoose';

/**
 * Capa de compatibilidad de identificadores. En la base existente, _id, catastrofeId, zonaId o
 * usuarioId pueden ser ObjectId o textos como "cat001". No se convierten ni se asume su tipo:
 * al consultar se buscan ambas representaciones posibles.
 */
const EXPRESION_OBJECT_ID = /^[0-9a-fA-F]{24}$/;

export function es_object_id_textual(valor: string): boolean {
  return EXPRESION_OBJECT_ID.test(valor);
}

/** Representaciones con las que un identificador puede estar guardado. */
export function candidatos_identificador(valor: string): unknown[] {
  return es_object_id_textual(valor) ? [new Types.ObjectId(valor), valor] : [valor];
}

/** Valor que se escribe en referencias nuevas: ObjectId si tiene ese formato; si no, el texto heredado. */
export function identificador_para_guardar(valor: string): unknown {
  return es_object_id_textual(valor) ? new Types.ObjectId(valor) : valor;
}

export function identificador_a_texto(valor: unknown): string | null {
  if (valor === null || valor === undefined || valor === '') return null;
  if (valor instanceof Types.ObjectId) return valor.toHexString();
  return String(valor);
}
