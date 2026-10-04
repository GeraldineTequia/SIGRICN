import { validar_datos, type EsquemaValidacion } from '@dominio/validacion/validador';
import type { DefinicionCampo } from '../componentes/formularios/tipos_formulario';

export function es_visible(campo: DefinicionCampo, datos: Record<string, unknown>): boolean {
  return campo.visible_si ? campo.visible_si(datos) : true;
}

/**
 * Construye el cuerpo que se envía a la API: sólo campos visibles del formulario,
 * texto vacío convertido en null y números convertidos desde el texto del control.
 */
export function preparar_envio(datos: Record<string, unknown>, campos: DefinicionCampo[], es_edicion: boolean): Record<string, unknown> {
  const envio: Record<string, unknown> = {};
  for (const campo of campos) {
    if (!es_visible(campo, datos) || (es_edicion && campo.solo_creacion)) continue;
    let valor = datos[campo.nombre];
    if (typeof valor === 'string') valor = valor.trim() === '' ? null : valor.trim();
    if ((campo.tipo === 'numero' || campo.tipo === 'entero') && typeof valor === 'string') valor = Number(valor.replace(',', '.'));
    if (campo.tipo === 'ubicacion') {
      if (!valor) continue;
      // Sólo los campos que acepta la API; confirmada_por/confirmada_en los asigna el servidor.
      const { estado, punto, direccion_consultada, direccion_encontrada, origen, precision } = valor as Record<string, unknown>;
      valor = { estado, punto, direccion_consultada, direccion_encontrada, origen, precision };
    }
    envio[campo.nombre] = valor === undefined ? null : valor;
  }
  return envio;
}

/**
 * Valida en el navegador con el MISMO esquema del dominio que usa el backend.
 * El esquema se limita a los campos presentes en el formulario.
 */
export function validar_formulario(
  envio: Record<string, unknown>,
  esquema: EsquemaValidacion,
  campos: DefinicionCampo[],
  datos: Record<string, unknown>,
  reglas_extra?: (envio: Record<string, unknown>) => Record<string, string>,
): Record<string, string> {
  const nombres_visibles = campos.filter((campo) => es_visible(campo, datos)).map((campo) => campo.nombre);
  const esquema_formulario = Object.fromEntries(Object.entries(esquema).filter(([nombre]) => nombres_visibles.includes(nombre)));
  const resultado = validar_datos(envio, esquema_formulario);
  return { ...resultado.errores, ...(reglas_extra ? reglas_extra(envio) : {}) };
}

/** Porcentaje de campos obligatorios visibles que ya tienen valor (barra "Completitud del formulario"). */
export function calcular_completitud(datos: Record<string, unknown>, campos: DefinicionCampo[]): number {
  const obligatorios = campos.filter((campo) => campo.requerido && es_visible(campo, datos));
  if (obligatorios.length === 0) return 100;
  const completos = obligatorios.filter((campo) => {
    const valor = datos[campo.nombre];
    return valor !== null && valor !== undefined && String(valor).trim() !== '' && !(Array.isArray(valor) && valor.length === 0);
  });
  return Math.round((completos.length / obligatorios.length) * 100);
}
