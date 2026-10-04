import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react';
import { ErrorApi } from '../servicios/cliente_api';
import { useVersionEntidades } from '../contextos/ContextoTiempoReal';

export interface EstadoConsulta<T> {
  datos: T | null;
  cargando: boolean;
  error: string | null;
  codigo_error: number | null;
  recargar: () => void;
}

/**
 * Carga datos de la API con estados de carga y error.
 * Se vuelve a ejecutar cuando cambian las dependencias o cuando el servidor publica cambios
 * de las entidades indicadas (en ese caso la consulta se marca como automática).
 */
export function useConsulta<T>(cargar: (automatica: boolean) => Promise<T>, dependencias: DependencyList, entidades: readonly string[] = []): EstadoConsulta<T> {
  const [datos, establecer_datos] = useState<T | null>(null);
  const [cargando, establecer_cargando] = useState(true);
  const [error, establecer_error] = useState<string | null>(null);
  const [codigo_error, establecer_codigo] = useState<number | null>(null);
  const [recargas, establecer_recargas] = useState(0);
  const version = useVersionEntidades(entidades);
  const version_anterior = useRef(version);
  const solicitud_vigente = useRef(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const cargar_estable = useCallback(cargar, dependencias);

  useEffect(() => {
    const es_automatica = version !== version_anterior.current;
    version_anterior.current = version;
    const numero = ++solicitud_vigente.current;
    if (!es_automatica) establecer_cargando(true);
    cargar_estable(es_automatica)
      .then((resultado) => {
        if (numero !== solicitud_vigente.current) return;
        establecer_datos(resultado);
        establecer_error(null);
        establecer_codigo(null);
      })
      .catch((causa: unknown) => {
        if (numero !== solicitud_vigente.current) return;
        establecer_error(causa instanceof Error ? causa.message : 'No fue posible cargar la información.');
        establecer_codigo(causa instanceof ErrorApi ? causa.estado : null);
      })
      .finally(() => {
        if (numero === solicitud_vigente.current) establecer_cargando(false);
      });
  }, [cargar_estable, version, recargas]);

  const recargar = useCallback(() => establecer_recargas((valor) => valor + 1), []);
  return { datos, cargando, error, codigo_error, recargar };
}
