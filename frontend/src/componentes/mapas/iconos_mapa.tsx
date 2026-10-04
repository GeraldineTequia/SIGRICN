import L from 'leaflet';
import { AlertTriangle, MapPin, Package, Waves } from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';

export type CapaMapa = 'emergencias' | 'zonas' | 'centros' | 'seleccion';

const ICONOS_CAPA = { emergencias: AlertTriangle, zonas: Waves, centros: Package, seleccion: MapPin };
export const NOMBRES_CAPA: Record<Exclude<CapaMapa, 'seleccion'>, string> = {
  emergencias: 'Emergencia',
  zonas: 'Zona afectada',
  centros: 'Centro de donación',
};
export const COLORES_CAPA: Record<Exclude<CapaMapa, 'seleccion'>, string> = {
  emergencias: '#DA0325',
  zonas: '#A56F00',
  centros: '#287687',
};

/** Cada capa se distingue por icono, forma, color y etiqueta en la leyenda (no sólo por color). */
export function crear_icono(capa: CapaMapa, etiqueta?: string): L.DivIcon {
  const Icono = ICONOS_CAPA[capa];
  const html = renderToStaticMarkup(
    <span className="marcador_mapa" data-capa={capa} title={etiqueta}>
      <Icono size={capa === 'seleccion' ? 20 : 16} strokeWidth={2.4} aria-hidden="true" />
    </span>,
  );
  const tamano = capa === 'seleccion' ? 40 : 34;
  return L.divIcon({ html, className: '', iconSize: [tamano, tamano], iconAnchor: [tamano / 2, tamano], popupAnchor: [0, -tamano] });
}

export function MuestraLeyenda({ capa }: { capa: Exclude<CapaMapa, 'seleccion'> }) {
  const Icono = ICONOS_CAPA[capa];
  return (
    <span className="muestra_leyenda" style={{ background: COLORES_CAPA[capa] }} aria-hidden="true">
      <Icono size={12} strokeWidth={2.6} />
    </span>
  );
}

/** Vista inicial del mapa (Colombia). Es sólo el encuadre: no representa ninguna ubicación registrada. */
export const CENTRO_INICIAL: [number, number] = [4.6, -74.1];
export const ZOOM_INICIAL = 5;
export const ATRIBUCION_OSM = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
export const URL_TESELAS = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
