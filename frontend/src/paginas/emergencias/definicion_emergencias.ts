import { ErrorValidacion } from '@dominio/errores';
import { GestorEmergencia } from '@dominio/estrategias/GestorEmergencia';
import type { DatosReglaEmergencia } from '@dominio/estrategias/IEstrategiaEmergencia';
import { es_tipo_terremoto, MAGNITUD_MINIMA_TERREMOTO } from '@dominio/reglas/regla_magnitud';
import type { DefinicionCampo } from '../../componentes/formularios/tipos_formulario';
import { CAMPOS_DIRECCION, OPCIONES, campo_ubicacion } from '../campos_comunes';

/** La misma clase del dominio que usa el backend: la regla se aplica igual en ambos lados. */
export const gestor_emergencia = new GestorEmergencia();

export const CAMPOS_EMERGENCIA: DefinicionCampo[] = [
  { nombre: 'titulo', etiqueta: 'Título', tipo: 'texto', requerido: true, ancho: 'completo' },
  { nombre: 'tipo', etiqueta: 'Tipo', tipo: 'seleccion', requerido: true, opciones: OPCIONES.tipos_emergencia },
  { nombre: 'nivel_emergencia', etiqueta: 'Nivel de gravedad', tipo: 'seleccion', requerido: true, opciones: OPCIONES.niveles },
  {
    nombre: 'magnitud',
    etiqueta: 'Magnitud',
    tipo: 'numero',
    requerido: true,
    minimo: MAGNITUD_MINIMA_TERREMOTO,
    maximo: 10,
    paso: 0.1,
    ayuda: 'Regla funcional de SGRICN: un terremoto se registra con magnitud mayor o igual a 5.0.',
    visible_si: (datos) => es_tipo_terremoto(datos.tipo),
  },
  { nombre: 'descripcion', etiqueta: 'Descripción', tipo: 'area', requerido: true, ancho: 'completo' },
  { nombre: 'fecha_inicio', etiqueta: 'Fecha y hora de inicio', tipo: 'fecha_hora', requerido: true },
  { nombre: 'fuente_informacion', etiqueta: 'Fuente de información', tipo: 'texto', requerido: true },
  ...CAMPOS_DIRECCION,
  { nombre: 'direccion_referencia', etiqueta: 'Dirección completa o referencia', tipo: 'texto', ancho: 'completo', ayuda: 'Ejemplo: Carrera 45 #50-20 o «sector cercano al Parque Popular».' },
  campo_ubicacion('direccion_referencia'),
];

/** Strategy en el navegador: mismos mensajes que devolvería el backend. */
export function reglas_estrategia(envio: Record<string, unknown>): Record<string, string> {
  try {
    gestor_emergencia.validar_y_preparar(envio as DatosReglaEmergencia);
    return {};
  } catch (error) {
    return error instanceof ErrorValidacion ? (error.detalles ?? {}) : {};
  }
}
