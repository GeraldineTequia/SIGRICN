import * as catalogo from '@dominio/reglas/catalogos';
import { opciones_desde, type DefinicionCampo } from '../componentes/formularios/tipos_formulario';
import { servicio_centros, servicio_emergencias, servicio_familias, servicio_personas, servicio_zonas } from '../servicios/servicios';
import type { RegistroBase } from '../tipos/api';
import { obtener_etiqueta } from '../utilidades/formato';

export const opciones_catalogo = (valores: readonly string[]) => opciones_desde(valores, obtener_etiqueta);

/** Selección de emergencia (lista las más recientes). */
export const CAMPO_EMERGENCIA: DefinicionCampo = {
  nombre: 'catastrofe_id',
  etiqueta: 'Emergencia asociada',
  tipo: 'referencia',
  requerido: true,
  referencia: {
    listar: (parametros) => servicio_emergencias.listar({ ...parametros, orden: '-fecha_inicio' }),
    etiqueta: (registro: RegistroBase) => `${String(registro.titulo)} · ${String(registro.municipio)}`,
  },
};

/** Zona de la emergencia elegida: evita relacionar registros de emergencias distintas. */
export function campo_zona(requerido = true, etiqueta = 'Zona afectada'): DefinicionCampo {
  return {
    nombre: 'zona_id',
    etiqueta,
    tipo: 'referencia',
    requerido,
    referencia: {
      listar: (parametros) => servicio_zonas.listar(parametros),
      etiqueta: (registro: RegistroBase) => `${String(registro.barrio || registro.direccion)} · ${String(registro.municipio)}`,
      filtros: (datos) => (datos.catastrofe_id ? { catastrofe_id: String(datos.catastrofe_id) } : null),
    },
  };
}

export const CAMPO_FAMILIA: DefinicionCampo = {
  nombre: 'familia_id',
  etiqueta: 'Familia',
  tipo: 'referencia',
  referencia: {
    listar: (parametros) => servicio_familias.listar(parametros),
    etiqueta: (registro: RegistroBase) => String(registro.nombre_referencia),
    filtros: (datos) => (datos.catastrofe_id ? { catastrofe_id: String(datos.catastrofe_id) } : null),
  },
};

export const CAMPO_PERSONA: DefinicionCampo = {
  nombre: 'persona_id',
  etiqueta: 'Persona',
  tipo: 'referencia',
  referencia: {
    listar: (parametros) => servicio_personas.listar(parametros),
    etiqueta: (registro: RegistroBase) => `${String(registro.nombres)} ${String(registro.apellidos ?? '')}`.trim(),
    filtros: (datos) => (datos.catastrofe_id ? { catastrofe_id: String(datos.catastrofe_id) } : null),
  },
};

export const CAMPO_CENTRO: DefinicionCampo = {
  nombre: 'centro_donacion_id',
  etiqueta: 'Centro de donación',
  tipo: 'referencia',
  referencia: { listar: (parametros) => servicio_centros.listar({ ...parametros, estado: 'activo' }), etiqueta: (registro: RegistroBase) => String(registro.nombre) },
};

/** País, departamento, municipio y barrio (sección 14). Nunca se piden coordenadas. */
export const CAMPOS_DIRECCION: DefinicionCampo[] = [
  { nombre: 'pais', etiqueta: 'País', tipo: 'texto', requerido: true },
  { nombre: 'departamento', etiqueta: 'Departamento', tipo: 'texto', requerido: true },
  { nombre: 'municipio', etiqueta: 'Municipio', tipo: 'texto', requerido: true },
  { nombre: 'barrio', etiqueta: 'Barrio', tipo: 'texto' },
];

export function campo_ubicacion(campo_direccion: string): DefinicionCampo {
  return { nombre: 'ubicacion', etiqueta: 'Ubicación', tipo: 'ubicacion', ancho: 'completo', campo_direccion };
}

export const OPCIONES = {
  tipos_emergencia: opciones_desde(catalogo.TIPOS_EMERGENCIA),
  niveles: opciones_catalogo(catalogo.NIVELES_EMERGENCIA),
  estados_emergencia: opciones_catalogo(catalogo.ESTADOS_EMERGENCIA),
  prioridades: opciones_catalogo(catalogo.PRIORIDADES),
  estados_zona: opciones_catalogo(catalogo.ESTADOS_ZONA),
  estados_atencion: opciones_catalogo(catalogo.ESTADOS_ATENCION_ZONA),
  tipos_necesidad: opciones_desde(catalogo.TIPOS_NECESIDAD),
  estados_necesidad: opciones_catalogo(catalogo.ESTADOS_NECESIDAD),
  ambitos: opciones_catalogo(catalogo.AMBITOS_NECESIDAD),
  tipos_donacion: opciones_desde(catalogo.TIPOS_DONACION),
  metodos: opciones_desde(catalogo.METODOS_DONACION),
  estados_donacion: opciones_catalogo(catalogo.ESTADOS_DONACION),
  estados_centro: opciones_catalogo(catalogo.ESTADOS_CENTRO),
  tipos_centro: opciones_desde(catalogo.TIPOS_DONACION_CENTRO),
  vulnerabilidades: opciones_catalogo(catalogo.CONDICIONES_VULNERABILIDAD),
  grupos_edad: opciones_catalogo(catalogo.GRUPOS_EDAD),
  roles: opciones_catalogo(catalogo.ROLES),
  estados_cuenta: opciones_catalogo(catalogo.ESTADOS_CUENTA),
};
