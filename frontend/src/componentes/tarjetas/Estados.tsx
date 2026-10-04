import { AlertTriangle, Clock, Inbox, Info, Loader2, RotateCcw, ShieldAlert, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { formatear_fecha } from '../../utilidades/formato';

export function Cargando({ texto = 'Cargando información…' }: { texto?: string }) {
  return (
    <div className="estado_carga" role="status" aria-live="polite">
      <Loader2 className="giro" size={20} aria-hidden="true" />
      <span>{texto}</span>
    </div>
  );
}

export function EstadoVacio({ texto, accion, centrado = false }: { texto: string; accion?: ReactNode; centrado?: boolean }) {
  return (
    <div className={`estado_vacio${centrado ? ' estado_vacio_centrado' : ''}`}>
      {centrado ? <Inbox size={36} aria-hidden="true" /> : <Info size={18} aria-hidden="true" />}
      <span>{texto}</span>
      {accion}
    </div>
  );
}

/** Error de carga con explicación clara y opción de reintentar. */
export function ErrorCarga({ mensaje, codigo, al_reintentar }: { mensaje: string; codigo?: number | null; al_reintentar?: () => void }) {
  const es_permiso = codigo === 403;
  return (
    <AvisoEnLinea tono={es_permiso ? 'advertencia' : 'peligro'} titulo={es_permiso ? 'Error · Permiso no autorizado' : 'No se pudo cargar la información'} icono={es_permiso ? <ShieldAlert size={20} /> : <XCircle size={20} />}>
      <p>{es_permiso ? 'No tienes permisos para consultar esta información. Contacta a un funcionario o administrador.' : mensaje}</p>
      {al_reintentar && !es_permiso && (
        <button type="button" className="boton boton_pequeno" onClick={al_reintentar} style={{ marginTop: 8 }}>
          <RotateCcw size={16} aria-hidden="true" /> Reintentar
        </button>
      )}
    </AvisoEnLinea>
  );
}

interface PropiedadesAviso {
  tono?: 'primario' | 'advertencia' | 'peligro' | 'neutro';
  titulo?: string;
  icono?: ReactNode;
  children?: ReactNode;
  rol?: 'alert' | 'status';
}

/** Aviso dentro de la página (mockup: "Advertencia · Agua insuficiente", "Errores de validación"). */
export function AvisoEnLinea({ tono = 'primario', titulo, icono, children, rol }: PropiedadesAviso) {
  const icono_final = icono ?? (tono === 'peligro' ? <XCircle size={20} /> : tono === 'advertencia' ? <AlertTriangle size={20} /> : <Info size={20} />);
  return (
    <div className="aviso" data-tono={tono} role={rol}>
      <span aria-hidden="true">{icono_final}</span>
      <div>
        {titulo && <strong>{titulo}</strong>}
        {children}
      </div>
    </div>
  );
}

export function BarraProgreso({ etiqueta, valor, maximo = 100, tono, texto_valor }: { etiqueta: string; valor: number; maximo?: number; tono?: 'peligro' | 'advertencia'; texto_valor?: string }) {
  const porcentaje = maximo > 0 ? Math.max(0, Math.min(100, Math.round((valor / maximo) * 100))) : 0;
  return (
    <div className="progreso" data-tono={tono}>
      <div className="progreso_encabezado">
        <span>{etiqueta}</span>
        <strong>{texto_valor ?? `${porcentaje}%`}</strong>
      </div>
      <div className="progreso_barra" role="progressbar" aria-label={etiqueta} aria-valuemin={0} aria-valuemax={100} aria-valuenow={porcentaje}>
        <span style={{ width: `${porcentaje}%` }} />
      </div>
    </div>
  );
}

export function UltimaActualizacion({ fecha }: { fecha: unknown }) {
  return (
    <p className="ultima_actualizacion">
      <Clock size={15} aria-hidden="true" /> Última actualización: {formatear_fecha(fecha ?? new Date(), true)}
    </p>
  );
}
