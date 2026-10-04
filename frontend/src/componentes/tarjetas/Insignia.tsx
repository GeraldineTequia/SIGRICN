import { AlertOctagon, AlertTriangle, CheckCircle2, Circle } from 'lucide-react';
import { obtener_etiqueta } from '../../utilidades/formato';
import { tono_de, type Tono } from '../../utilidades/tonos';

const ICONOS: Record<Tono, typeof Circle> = { peligro: AlertOctagon, advertencia: AlertTriangle, primario: CheckCircle2, neutro: Circle };

interface PropiedadesInsignia {
  valor?: string | null;
  texto?: string;
  tono?: Tono | 'solido_peligro' | 'solido_advertencia';
  sin_icono?: boolean;
  prefijo?: string;
}

/** Etiqueta de estado con icono y texto: el estado nunca depende sólo del color. */
export function Insignia({ valor, texto, tono, sin_icono = false, prefijo }: PropiedadesInsignia) {
  const tono_final = tono ?? tono_de(valor);
  const tono_icono: Tono = tono_final === 'solido_peligro' ? 'peligro' : tono_final === 'solido_advertencia' ? 'advertencia' : tono_final;
  const Icono = ICONOS[tono_icono];
  const etiqueta = texto ?? obtener_etiqueta(valor ?? '');
  return (
    <span className="insignia" data-tono={tono_final}>
      {!sin_icono && <Icono size={14} aria-hidden="true" />}
      {prefijo ? `${prefijo} ` : ''}
      {etiqueta}
    </span>
  );
}
