import L from 'leaflet';
import { useEffect, useMemo, useRef } from 'react';
import { GeoJSON, MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import { Link } from 'react-router-dom';
import type { GeoJsonObject } from 'geojson';
import type { ElementoMapa } from '../../tipos/api';
import { obtener_etiqueta } from '../../utilidades/formato';
import { ATRIBUCION_OSM, CENTRO_INICIAL, COLORES_CAPA, NOMBRES_CAPA, URL_TESELAS, ZOOM_INICIAL, crear_icono } from './iconos_mapa';

const RUTAS_DETALLE: Record<ElementoMapa['capa'], string> = { emergencias: '/emergencias', zonas: '/zonas', centros: '/centros-donacion' };

interface PropiedadesMapa {
  elementos: ElementoMapa[];
  seleccionado?: string | null;
  al_seleccionar?: (id: string) => void;
  /** Cambia cuando se pulsa "Ajustar vista". */
  ajuste_vista?: number;
  tamano?: 'normal' | 'mediano';
}

function AjustarVista({ elementos, ajuste }: { elementos: ElementoMapa[]; ajuste: number }) {
  const mapa = useMap();
  useEffect(() => {
    const puntos = elementos.filter((elemento) => elemento.punto).map((elemento) => [elemento.punto!.latitud, elemento.punto!.longitud] as [number, number]);
    if (puntos.length === 1) mapa.setView(puntos[0], 14);
    else if (puntos.length > 1) mapa.fitBounds(L.latLngBounds(puntos), { padding: [40, 40], maxZoom: 15 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ajuste, mapa]);
  return null;
}

function EnfocarSeleccion({ elemento, marcadores }: { elemento: ElementoMapa | null; marcadores: Map<string, L.Marker> }) {
  const mapa = useMap();
  useEffect(() => {
    if (!elemento?.punto) return;
    mapa.flyTo([elemento.punto.latitud, elemento.punto.longitud], Math.max(mapa.getZoom(), 15), { duration: 0.6 });
    const marcador = marcadores.get(`${elemento.capa}:${elemento.id}`);
    window.setTimeout(() => marcador?.openPopup(), 650);
  }, [elemento, mapa, marcadores]);
  return null;
}

/**
 * Mapa general (RF11). Lee elementos reales de la API, agrupa marcadores cercanos y muestra
 * título, dirección, estado, nivel y enlace al detalle. Las áreas se dibujan SÓLO si existe una
 * geometría registrada y validada (nunca se inventan a partir de una dirección).
 */
export function MapaGeneral({ elementos, seleccionado, al_seleccionar, ajuste_vista = 0, tamano = 'normal' }: PropiedadesMapa) {
  const marcadores = useRef(new Map<string, L.Marker>());
  const iconos = useMemo(
    () => ({ emergencias: crear_icono('emergencias', 'Emergencia'), zonas: crear_icono('zonas', 'Zona afectada'), centros: crear_icono('centros', 'Centro de donación') }),
    [],
  );
  const con_punto = elementos.filter((elemento) => elemento.punto);
  const elemento_seleccionado = elementos.find((elemento) => elemento.id === seleccionado) ?? null;

  return (
    <div className="contenedor_mapa" data-tamano={tamano}>
      <MapContainer center={CENTRO_INICIAL} zoom={ZOOM_INICIAL} scrollWheelZoom aria-label="Mapa de emergencias, zonas afectadas y centros de donación">
        <TileLayer attribution={ATRIBUCION_OSM} url={URL_TESELAS} />
        <AjustarVista elementos={con_punto} ajuste={ajuste_vista} />
        <EnfocarSeleccion elemento={elemento_seleccionado} marcadores={marcadores.current} />
        {elementos
          .filter((elemento) => elemento.capa === 'zonas' && elemento.geometria)
          .map((elemento) => (
            <GeoJSON
              key={`geometria-${elemento.id}`}
              data={elemento.geometria as GeoJsonObject}
              style={{ color: COLORES_CAPA.zonas, weight: 2, fillColor: COLORES_CAPA.zonas, fillOpacity: 0.18 }}
            />
          ))}
        <MarkerClusterGroup chunkedLoading showCoverageOnHover={false}>
          {con_punto.map((elemento) => (
            <Marker
              key={`${elemento.capa}:${elemento.id}`}
              position={[elemento.punto!.latitud, elemento.punto!.longitud]}
              icon={iconos[elemento.capa]}
              title={`${NOMBRES_CAPA[elemento.capa]}: ${elemento.titulo}`}
              keyboard
              ref={(instancia) => {
                if (instancia) marcadores.current.set(`${elemento.capa}:${elemento.id}`, instancia);
              }}
              eventHandlers={{ click: () => al_seleccionar?.(elemento.id) }}
            >
              <Popup>
                <div className="ventana_mapa">
                  <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>{NOMBRES_CAPA[elemento.capa]}</span>
                  <strong>{elemento.titulo}</strong>
                  <span>{elemento.direccion || 'Sin dirección registrada'}</span>
                  <span>
                    {elemento.municipio}, {elemento.departamento}
                  </span>
                  <span>
                    Estado: <b>{obtener_etiqueta(elemento.estado)}</b>
                    {elemento.nivel ? (
                      <>
                        {' '}
                        · Nivel: <b>{obtener_etiqueta(elemento.nivel)}</b>
                      </>
                    ) : null}
                  </span>
                  {elemento.capa === 'zonas' && (
                    <span>
                      Afectación: <b>{String(elemento.detalle.porcentaje_afectacion ?? '—')}%</b>
                      {Array.isArray(elemento.detalle.necesidades_pendientes) && elemento.detalle.necesidades_pendientes.length > 0
                        ? ` · Necesidades: ${(elemento.detalle.necesidades_pendientes as string[]).join(', ')}`
                        : ''}
                    </span>
                  )}
                  {elemento.precision === 'aproximada' && <span>Ubicación aproximada confirmada por un funcionario.</span>}
                  <Link to={`${RUTAS_DETALLE[elemento.capa]}/${elemento.id}`}>Ver detalle</Link>
                </div>
              </Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>
      </MapContainer>
    </div>
  );
}
