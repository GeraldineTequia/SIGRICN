export interface FiltroTablero {
  departamento?: string;
  municipio?: string;
  tipo?: string;
  nivel_emergencia?: string;
  estado?: string;
  desde?: string;
  hasta?: string;
}

export interface ConteoAgrupado {
  clave: string;
  cantidad: number;
  valor_total?: number;
}

export interface IndicadoresTablero {
  emergencias: { total: number; por_estado: ConteoAgrupado[]; por_nivel: ConteoAgrupado[]; criticas_abiertas: number };
  zonas: { total: number; sin_atender: number; criticas: number; por_estado_atencion: ConteoAgrupado[] };
  poblacion: {
    personas_afectadas: number;
    familias_afectadas: number;
    registros_considerados: number;
    categorias: Record<string, number>;
  };
  necesidades: { pendientes: number; criticas_pendientes: { id: string; tipo: string; prioridad: string; descripcion: string }[] };
  recursos: { unidades_disponibles: number; unidades_asignadas: number; unidades_entregadas: number; insuficientes: number; agotados: number };
  recursos_humanos: ConteoAgrupado[];
  centros_activos: number;
  donaciones: ConteoAgrupado[];
  fondos: { asignado: number; comprometido: number; gastado: number; disponible: number };
}

export interface SerieMensual {
  anio: number;
  meses: string[];
  series: { tipo: string; valores: number[] }[];
}

export interface IRepositorioEstadisticas {
  obtener_indicadores(filtro: FiltroTablero): Promise<IndicadoresTablero>;
  obtener_serie_mensual(anio: number, filtro: FiltroTablero): Promise<SerieMensual>;
}
