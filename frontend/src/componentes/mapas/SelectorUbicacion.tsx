import { Crosshair, Loader2, MapPinned, Search, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import type { Marker as MarcadorLeaflet } from 'leaflet';
import { componer_direccion, normalizar_texto_comparacion } from '@dominio/validacion/validador';
import { ErrorApi } from '../../servicios/cliente_api';
import { servicio_geocodificacion } from '../../servicios/servicios';
import type { CoincidenciaGeocodificacion, Ubicacion } from '../../tipos/api';
import { Insignia } from '../tarjetas/Insignia';
import { AvisoEnLinea } from '../tarjetas/Estados';
import { ATRIBUCION_OSM, CENTRO_INICIAL, URL_TESELAS, ZOOM_INICIAL, crear_icono } from './iconos_mapa';

export interface PartesDireccion {
  pais?: unknown;
  departamento?: unknown;
  municipio?: unknown;
  barrio?: unknown;
  direccion?: unknown;
}

interface PropiedadesSelector {
  partes: PartesDireccion;
  valor: Ubicacion | null | undefined;
  al_cambiar: (ubicacion: Ubicacion) => void;
  error?: string;
}

const SIN_UBICACION: Ubicacion = { estado: 'sin_ubicacion', punto: null, direccion_consultada: null, direccion_encontrada: null, origen: null, precision: null };

function CentrarMapa({ punto }: { punto: { latitud: number; longitud: number } | null }) {
  const mapa = useMap();
  useEffect(() => {
    if (punto) mapa.flyTo([punto.latitud, punto.longitud], Math.max(mapa.getZoom(), 16), { duration: 0.6 });
  }, [punto, mapa]);
  return null;
}

function SenalarEnMapa({ activo, al_senalar }: { activo: boolean; al_senalar: (latitud: number, longitud: number) => void }) {
  useMapEvents({
    click(evento) {
      if (activo) al_senalar(evento.latlng.lat, evento.latlng.lng);
    },
  });
  return null;
}

/**
 * Ubicación mediante dirección (sección 14). Flujo:
 * 1) se escribe la dirección en el formulario → 2) "Buscar dirección" → 3) el backend geocodifica →
 * 4) se listan coincidencias → 5) se elige una por su dirección → 6) el marcador se muestra en el mapa →
 * 7) se puede arrastrar o señalar otro punto → 8) "Confirmar ubicación" la asocia al registro.
 * No se muestran ni se piden coordenadas: son un dato interno para dibujar el mapa.
 */
export function SelectorUbicacion({ partes, valor, al_cambiar, error }: PropiedadesSelector) {
  const ubicacion = valor ?? SIN_UBICACION;
  const direccion_actual = useMemo(() => componer_direccion(partes), [partes]);
  const [coincidencias, establecer_coincidencias] = useState<CoincidenciaGeocodificacion[] | null>(null);
  const [indice, establecer_indice] = useState<number | null>(null);
  const [buscando, establecer_buscando] = useState(false);
  const [mensaje, establecer_mensaje] = useState<{ tono: 'advertencia' | 'peligro' | 'primario'; texto: string } | null>(null);
  const [modo_senalar, establecer_modo_senalar] = useState(false);
  const [direccion_cercana, establecer_cercana] = useState<string | null>(null);
  const marcador = useRef<MarcadorLeaflet>(null);

  const direccion_cambio =
    ubicacion.estado === 'confirmada' &&
    Boolean(ubicacion.direccion_consultada) &&
    normalizar_texto_comparacion(ubicacion.direccion_consultada ?? '') !== normalizar_texto_comparacion(direccion_actual);

  // Si la dirección cambió después de confirmar, la ubicación anterior queda pendiente (no se conserva en silencio).
  useEffect(() => {
    if (direccion_cambio) {
      al_cambiar({ ...ubicacion, estado: 'pendiente' });
      establecer_mensaje({ tono: 'advertencia', texto: 'La dirección cambió: la ubicación anterior quedó pendiente de confirmación. Busca nuevamente y confirma el lugar.' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [direccion_cambio]);

  const buscar = async () => {
    const faltantes = (['pais', 'departamento', 'municipio', 'direccion'] as const).filter((campo) => !String(partes[campo] ?? '').trim());
    if (faltantes.length > 0) {
      establecer_mensaje({ tono: 'advertencia', texto: 'Completa país, departamento, municipio y dirección antes de buscar.' });
      return;
    }
    establecer_buscando(true);
    establecer_mensaje(null);
    establecer_indice(null);
    try {
      const resultado = await servicio_geocodificacion.buscar({
        pais: String(partes.pais),
        departamento: String(partes.departamento),
        municipio: String(partes.municipio),
        barrio: String(partes.barrio ?? ''),
        direccion: String(partes.direccion),
      });
      establecer_coincidencias(resultado.coincidencias);
      if (resultado.coincidencias.length === 0) {
        establecer_mensaje({ tono: 'advertencia', texto: 'No se encontró la dirección. Corrígela, señala el lugar directamente en el mapa o guarda el registro como pendiente de ubicación.' });
      } else if (resultado.coincidencias.length === 1) {
        seleccionar(resultado.coincidencias[0], 0);
      }
    } catch (causa) {
      establecer_coincidencias(null);
      establecer_mensaje({ tono: 'peligro', texto: causa instanceof ErrorApi ? causa.message : 'No fue posible consultar el servicio de geocodificación.' });
    } finally {
      establecer_buscando(false);
    }
  };

  const seleccionar = (coincidencia: CoincidenciaGeocodificacion, posicion: number) => {
    establecer_indice(posicion);
    establecer_cercana(null);
    // Queda pendiente hasta que el funcionario confirme visualmente el lugar.
    al_cambiar({
      estado: 'pendiente',
      punto: coincidencia.punto,
      direccion_consultada: direccion_actual,
      direccion_encontrada: coincidencia.direccion_encontrada,
      origen: 'geocodificacion',
      precision: coincidencia.precision,
    });
  };

  const mover_punto = async (latitud: number, longitud: number, origen: 'ajuste_manual' | 'seleccion_en_mapa') => {
    al_cambiar({
      estado: 'pendiente',
      punto: { latitud, longitud },
      direccion_consultada: direccion_actual,
      direccion_encontrada: ubicacion.direccion_encontrada,
      origen,
      precision: 'aproximada',
    });
    establecer_modo_senalar(false);
    try {
      establecer_cercana(await servicio_geocodificacion.inversa(latitud, longitud));
    } catch {
      establecer_cercana(null);
    }
  };

  const confirmar = () => {
    if (!ubicacion.punto) return;
    al_cambiar({ ...ubicacion, estado: 'confirmada', direccion_consultada: direccion_actual });
    establecer_mensaje({ tono: 'primario', texto: 'Ubicación confirmada. Se guardará junto con el registro.' });
  };

  const quitar = () => {
    al_cambiar(SIN_UBICACION);
    establecer_indice(null);
    establecer_mensaje({ tono: 'advertencia', texto: 'El registro se guardará como pendiente de ubicación.' });
  };

  const insignia_estado =
    ubicacion.estado === 'confirmada' ? (
      <Insignia tono="primario" texto={ubicacion.precision === 'aproximada' ? 'Confirmada (aproximada)' : 'Ubicación confirmada'} />
    ) : ubicacion.estado === 'pendiente' ? (
      <Insignia tono="advertencia" texto="Pendiente de confirmación" />
    ) : (
      <Insignia tono="advertencia" texto="Sin ubicación" />
    );

  return (
    <section className="campo" data-ancho="completo" aria-label="Ubicación en el mapa">
      <div className="fila separado">
        <span className="etiqueta_campo">Ubicación en el mapa</span>
        {insignia_estado}
      </div>
      <p className="ayuda_campo">
        Escribe la dirección arriba y pulsa «Buscar dirección». La geocodificación puede ser aproximada: revisa el marcador antes de confirmar.
      </p>
      <div className="grupo_botones">
        <button type="button" className="boton boton_suave" onClick={buscar} disabled={buscando}>
          {buscando ? <Loader2 className="giro" size={18} aria-hidden="true" /> : <Search size={18} aria-hidden="true" />}
          Buscar dirección
        </button>
        <button type="button" className="boton" aria-pressed={modo_senalar} onClick={() => establecer_modo_senalar((actual) => !actual)}>
          <Crosshair size={18} aria-hidden="true" /> {modo_senalar ? 'Haz clic en el mapa…' : 'Señalar en el mapa'}
        </button>
        {ubicacion.punto && ubicacion.estado !== 'confirmada' && (
          <button type="button" className="boton boton_primario" onClick={confirmar}>
            <MapPinned size={18} aria-hidden="true" /> Confirmar ubicación
          </button>
        )}
        {ubicacion.estado !== 'sin_ubicacion' && (
          <button type="button" className="boton boton_texto_peligro" onClick={quitar}>
            <Trash2 size={18} aria-hidden="true" /> Quitar ubicación
          </button>
        )}
      </div>

      <div aria-live="polite">
        {mensaje && <AvisoEnLinea tono={mensaje.tono}>{<p>{mensaje.texto}</p>}</AvisoEnLinea>}
        {error && <AvisoEnLinea tono="peligro">{<p>{error}</p>}</AvisoEnLinea>}
      </div>

      {coincidencias && coincidencias.length > 0 && (
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="etiqueta_campo" style={{ marginBottom: 6 }}>
            Coincidencias encontradas ({coincidencias.length}) — elige la correcta
          </legend>
          <ul className="coincidencias">
            {coincidencias.map((coincidencia, posicion) => (
              <li key={`${coincidencia.direccion_encontrada}-${posicion}`}>
                <label>
                  <input type="radio" name="coincidencia" checked={indice === posicion} onChange={() => seleccionar(coincidencia, posicion)} />
                  <span>
                    {coincidencia.direccion_encontrada}{' '}
                    {coincidencia.precision === 'aproximada' && <Insignia tono="advertencia" texto="Aproximada" />}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      )}

      <div className="contenedor_mapa" data-tamano="mediano">
        <MapContainer center={CENTRO_INICIAL} zoom={ZOOM_INICIAL} scrollWheelZoom aria-label="Mapa para confirmar la ubicación">
          <TileLayer attribution={ATRIBUCION_OSM} url={URL_TESELAS} />
          <SenalarEnMapa activo={modo_senalar} al_senalar={(latitud, longitud) => void mover_punto(latitud, longitud, 'seleccion_en_mapa')} />
          {ubicacion.punto && (
            <>
              <CentrarMapa punto={ubicacion.punto} />
              <Marker
                ref={marcador}
                position={[ubicacion.punto.latitud, ubicacion.punto.longitud]}
                icon={crear_icono('seleccion', 'Ubicación seleccionada')}
                draggable
                keyboard
                title="Ubicación seleccionada (arrastra para ajustar)"
                eventHandlers={{
                  dragend: () => {
                    const posicion = marcador.current?.getLatLng();
                    if (posicion) void mover_punto(posicion.lat, posicion.lng, 'ajuste_manual');
                  },
                }}
              />
            </>
          )}
        </MapContainer>
      </div>
      <p className="ayuda_campo">
        {ubicacion.direccion_encontrada ? `Lugar seleccionado: ${ubicacion.direccion_encontrada}.` : 'Aún no hay un lugar seleccionado.'}
        {direccion_cercana ? ` Punto ajustado cerca de: ${direccion_cercana}.` : ''} Datos de mapa © OpenStreetMap; búsqueda con Nominatim.
      </p>
    </section>
  );
}
