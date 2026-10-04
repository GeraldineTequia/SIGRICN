import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Filtros, orden y página guardados en la URL: se conservan al recargar, se pueden compartir
 * y mantienen sincronizados los listados, el mapa y los indicadores.
 */
export function useParametrosUrl(): [Record<string, string>, (valores: Record<string, string>, reiniciar_pagina?: boolean) => void] {
  const [parametros, establecer_parametros] = useSearchParams();
  const valores = useMemo(() => Object.fromEntries(parametros.entries()), [parametros]);
  const establecer = useCallback(
    (nuevos: Record<string, string>, reiniciar_pagina = true) => {
      const limpios = Object.fromEntries(Object.entries(nuevos).filter(([, valor]) => valor !== '' && valor !== undefined));
      if (reiniciar_pagina) delete limpios.pagina;
      establecer_parametros(limpios, { replace: true });
    },
    [establecer_parametros],
  );
  return [valores, establecer];
}
