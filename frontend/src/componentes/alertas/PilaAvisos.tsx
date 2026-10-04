import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import type { Aviso, TipoAviso } from '../../contextos/ContextoAvisos';

const ICONOS: Record<TipoAviso, typeof Info> = { exito: CheckCircle2, informacion: Info, advertencia: AlertTriangle, error: XCircle };
const NOMBRES: Record<TipoAviso, string> = { exito: 'Éxito', informacion: 'Información', advertencia: 'Advertencia', error: 'Error' };

/**
 * Pila de avisos flotantes. Las regiones vivas separan urgencia:
 * errores y advertencias usan role="alert"; éxito e información role="status".
 * El texto se renderiza como texto de React (nunca HTML), por lo que es seguro.
 */
export function PilaAvisos({ avisos, al_cerrar }: { avisos: Aviso[]; al_cerrar: (id: number) => void }) {
  return (
    <div className="pila_avisos" aria-label="Avisos">
      {avisos.map((aviso) => {
        const Icono = ICONOS[aviso.tipo];
        const es_urgente = aviso.tipo === 'error' || aviso.tipo === 'advertencia';
        return (
          <div key={aviso.id} className="aviso_flotante" data-tipo={aviso.tipo} role={es_urgente ? 'alert' : 'status'} aria-live={es_urgente ? 'assertive' : 'polite'}>
            <Icono className="icono_aviso" data-tipo={aviso.tipo} size={22} aria-hidden="true" />
            <div>
              <strong>
                <span className="solo_lectores">{NOMBRES[aviso.tipo]}: </span>
                {aviso.titulo}
              </strong>
              {aviso.mensaje && <p>{aviso.mensaje}</p>}
            </div>
            <button type="button" className="cerrar_aviso" onClick={() => al_cerrar(aviso.id)} aria-label={`Cerrar aviso: ${aviso.titulo}`}>
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
