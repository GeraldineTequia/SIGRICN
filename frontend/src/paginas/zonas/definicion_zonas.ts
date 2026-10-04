import type { DefinicionCampo } from '../../componentes/formularios/tipos_formulario';
import { CAMPO_EMERGENCIA, CAMPOS_DIRECCION, OPCIONES, campo_ubicacion, campo_zona } from '../campos_comunes';

export const CAMPOS_ZONA: DefinicionCampo[] = [
  { ...CAMPO_EMERGENCIA, ancho: 'completo' },
  ...CAMPOS_DIRECCION,
  { nombre: 'direccion', etiqueta: 'Dirección completa o referencia', tipo: 'texto', requerido: true, ancho: 'completo' },
  { nombre: 'nivel_afectacion', etiqueta: 'Nivel de afectación', tipo: 'seleccion', requerido: true, opciones: OPCIONES.niveles },
  { nombre: 'porcentaje_afectacion', etiqueta: 'Porcentaje de afectación', tipo: 'numero', requerido: true, minimo: 0, maximo: 100, paso: 1, ayuda: 'Entre 0 y 100.' },
  { nombre: 'prioridad', etiqueta: 'Prioridad', tipo: 'seleccion', requerido: true, opciones: OPCIONES.prioridades, ayuda: 'En el detalle de la zona hay una sugerencia basada en criterios documentados.' },
  { nombre: 'estado', etiqueta: 'Estado general', tipo: 'opciones', requerido: true, opciones: OPCIONES.estados_zona },
  { nombre: 'danos', etiqueta: 'Daños registrados', tipo: 'area', ancho: 'completo' },
  { nombre: 'descripcion', etiqueta: 'Descripción', tipo: 'area', ancho: 'completo' },
  campo_ubicacion('direccion'),
];

const CONTEO = (nombre: string, etiqueta: string, requerido = false): DefinicionCampo => ({ nombre, etiqueta, tipo: 'entero', requerido, minimo: 0 });

export const CAMPOS_POBLACION: DefinicionCampo[] = [
  CAMPO_EMERGENCIA,
  campo_zona(),
  CONTEO('personas_afectadas', 'Personas afectadas', true),
  CONTEO('familias_afectadas', 'Familias afectadas'),
  CONTEO('ninos', 'Niños y niñas (0–11)'),
  CONTEO('adultos', 'Adultos (18–59)'),
  CONTEO('adultos_mayores', 'Adultos mayores (60+)'),
  CONTEO('personas_discapacidad', 'Con discapacidad'),
  CONTEO('personas_heridas', 'Heridas'),
  CONTEO('personas_fallecidas', 'Fallecidas'),
  CONTEO('personas_desaparecidas', 'Desaparecidas'),
  CONTEO('personas_evacuadas', 'Evacuadas'),
  CONTEO('personas_albergadas', 'Albergadas'),
  CONTEO('personas_pendientes_atencion', 'Pendientes de atención'),
];
