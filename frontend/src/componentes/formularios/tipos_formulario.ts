import type { ParametrosListado } from '../../servicios/servicio_entidad';
import type { RegistroBase } from '../../tipos/api';

export type TipoControl =
  | 'texto'
  | 'area'
  | 'numero'
  | 'entero'
  | 'fecha'
  | 'fecha_hora'
  | 'seleccion'
  | 'opciones'
  | 'casillas'
  | 'referencia'
  | 'correo'
  | 'telefono'
  | 'ubicacion';

export interface OpcionCampo {
  valor: string;
  etiqueta: string;
}

export interface ReferenciaCampo {
  /** Servicio que lista los registros relacionados. */
  listar: (parametros: ParametrosListado) => Promise<{ elementos: RegistroBase[] }>;
  etiqueta: (registro: RegistroBase) => string;
  /** Filtros dependientes de otros campos (p. ej. zonas de la emergencia elegida). */
  filtros?: (datos: Record<string, unknown>) => ParametrosListado | null;
}

/** Definición declarativa de un campo de formulario (evita repetir JSX en cada módulo). */
export interface DefinicionCampo {
  nombre: string;
  etiqueta: string;
  tipo: TipoControl;
  requerido?: boolean;
  opciones?: readonly OpcionCampo[];
  referencia?: ReferenciaCampo;
  ayuda?: string;
  ancho?: 'completo' | 'medio';
  visible_si?: (datos: Record<string, unknown>) => boolean;
  /** Campo que sólo se envía al crear (p. ej. cantidad inicial de un recurso). */
  solo_creacion?: boolean;
  minimo?: number;
  maximo?: number;
  paso?: number;
  /** Para "ubicacion": nombre del campo que contiene la dirección o referencia. */
  campo_direccion?: string;
}

export function opciones_desde(valores: readonly string[], etiqueta: (valor: string) => string = (valor) => valor): OpcionCampo[] {
  return valores.map((valor) => ({ valor, etiqueta: etiqueta(valor) }));
}
