import { ExternalLink, Maximize2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { COLORES_CAPA, MuestraLeyenda, NOMBRES_CAPA } from '../componentes/mapas/iconos_mapa';
import { MapaGeneral } from '../componentes/mapas/MapaGeneral';
import { EncabezadoPagina, useTituloPagina } from '../componentes/navegacion/DisenoPrincipal';
import { BarraFiltros } from '../componentes/tablas/Filtros';
import { AvisoEnLinea, Cargando, ErrorCarga, EstadoVacio, UltimaActualizacion } from '../componentes/tarjetas/Estados';
import { Insignia } from '../componentes/tarjetas/Insignia';
import { useConsulta } from '../hooks/useConsulta';
import { useParametrosUrl } from '../hooks/useParametrosUrl';
import { servicio_mapa } from '../servicios/servicios';
import type { ElementoMapa } from '../tipos/api';
import { obtener_etiqueta } from '../utilidades/formato';
import { OPCIONES } from './campos_comunes';

const CAPAS: ElementoMapa['capa'][] = ['emergencias', 'zonas', 'centros'];
const RUTAS: Record<ElementoMapa['capa'], string> = { emergencias: '/emergencias', zonas: '/zonas', centros: '/centros-donacion' };

/** Mapa general (RF11): filtros, marcadores y listado sincronizados por la URL y actualizados en tiempo real. */
export function PaginaMapa() {
  useTituloPagina('Mapa en tiempo real', 'Centro de control');
  const [valores, establecer] = useParametrosUrl();
  const [seleccionado, establecer_seleccionado] = useState<string | null>(null);
  const [ajuste, establecer_ajuste] = useState(1);
  const capas = (valores.capas ?? 'emergencias,zonas,centros').split(',').filter((capa) => CAPAS.includes(capa as ElementoMapa['capa']));
  const parametros = { capas: capas.join(','), departamento: valores.departamento, municipio: valores.municipio, nivel: valores.nivel, estado: valores.estado };
  const consulta = useConsulta((automatica) => servicio_mapa.consultar(parametros, automatica), [JSON.stringify(parametros)], ['emergencias', 'zonas', 'centros']);
  const elementos = consulta.datos?.elementos ?? [];
  const con_ubicacion = elementos.filter((elemento) => elemento.punto);
  const pendientes = elementos.filter((elemento) => !elemento.punto);
  const elegido = elementos.find((elemento) => elemento.id === seleccionado) ?? null;

  const alternar_capa = (capa: string) => {
    const nuevas = capas.includes(capa) ? capas.filter((actual) => actual !== capa) : [...capas, capa];
    establecer({ ...valores, capas: nuevas.join(',') || 'emergencias' });
  };

  return (
    <>
      <EncabezadoPagina titulo="Mapa de zonas afectadas" descripcion="Marcadores, capas, leyenda y selección territorial." />
      <div className="dos_columnas">
        <section className="tarjeta pila" aria-label="Mapa">
          <div className="opciones_chip" role="group" aria-label="Capas visibles">
            {CAPAS.map((capa) => (
              <button key={capa} type="button" className="chip" aria-pressed={capas.includes(capa)} onClick={() => alternar_capa(capa)}>
                <MuestraLeyenda capa={capa} /> {NOMBRES_CAPA[capa]}s
              </button>
            ))}
            <button type="button" className="chip" onClick={() => establecer_ajuste((valor) => valor + 1)}>
              <Maximize2 size={15} aria-hidden="true" /> Ajustar vista
            </button>
          </div>
          <BarraFiltros
            con_busqueda={false}
            valores={valores}
            al_cambiar={(nuevos) => establecer({ ...nuevos, capas: valores.capas ?? '' })}
            filtros={[
              { nombre: 'departamento', etiqueta: 'Departamento', tipo: 'departamento' },
              { nombre: 'municipio', etiqueta: 'Municipio', tipo: 'municipio' },
              { nombre: 'nivel', etiqueta: 'Nivel', tipo: 'seleccion', opciones: OPCIONES.niveles },
              {
                nombre: 'estado',
                etiqueta: 'Estado',
                tipo: 'seleccion',
                // "en_atencion" existe en emergencias y en zonas: se deja una sola opción (filtra ambas capas).
                opciones: [...OPCIONES.estados_emergencia, ...OPCIONES.estados_atencion, ...OPCIONES.estados_centro].filter(
                  (opcion, indice, lista) => lista.findIndex((otra) => otra.valor === opcion.valor) === indice,
                ),
              },
            ]}
          />
          <div className="leyenda" aria-label="Leyenda">
            <strong>Leyenda:</strong>
            {CAPAS.map((capa) => (
              <span key={capa}>
                <MuestraLeyenda capa={capa} /> {NOMBRES_CAPA[capa]}
              </span>
            ))}
            <span>Los números agrupan marcadores cercanos.</span>
          </div>
          {consulta.error ? (
            <ErrorCarga mensaje={consulta.error} codigo={consulta.codigo_error} al_reintentar={consulta.recargar} />
          ) : !consulta.datos ? (
            <Cargando texto="Cargando el mapa…" />
          ) : (
            <MapaGeneral elementos={elementos} seleccionado={seleccionado} al_seleccionar={establecer_seleccionado} ajuste_vista={ajuste} />
          )}
          {pendientes.length > 0 && (
            <AvisoEnLinea tono="advertencia" titulo={`Pendientes de ubicación: ${pendientes.length}`}>
              <p>Estos registros no se dibujan porque no tienen una ubicación confirmada; siguen disponibles en el listado.</p>
            </AvisoEnLinea>
          )}
          <h2>Listado sincronizado ({elementos.length})</h2>
          {elementos.length === 0 && consulta.datos ? (
            <EstadoVacio texto="No hay registros con los filtros seleccionados." />
          ) : (
            <ul className="lista_mapa">
              {elementos.map((elemento) => (
                <li key={`${elemento.capa}-${elemento.id}`}>
                  <button type="button" aria-pressed={seleccionado === elemento.id} onClick={() => establecer_seleccionado(elemento.id)}>
                    <span className="fila" style={{ gap: 8 }}>
                      <MuestraLeyenda capa={elemento.capa} />
                      <strong style={{ color: 'var(--color_titulo)' }}>{elemento.titulo}</strong>
                    </span>
                    <span className="texto_pequeno">
                      {NOMBRES_CAPA[elemento.capa]} · {elemento.direccion || 'Sin dirección'} · {elemento.municipio}
                    </span>
                    <span className="fila" style={{ gap: 6 }}>
                      <Insignia valor={elemento.estado} />
                      {elemento.nivel && <Insignia valor={elemento.nivel} />}
                      {!elemento.punto && <Insignia tono="advertencia" texto={elemento.estado_ubicacion === 'pendiente' ? 'Ubicación pendiente' : 'Sin ubicación'} />}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <aside className="panel_control">
          <div className="tarjeta pila">
            <span className="etiqueta_seccion">{elegido ? `${NOMBRES_CAPA[elegido.capa]} seleccionada` : 'Selección'}</span>
            {elegido ? (
              <>
                <h2>{elegido.titulo}</h2>
                <p className="texto_suave">
                  {elegido.direccion} · {elegido.municipio}, {elegido.departamento}
                </p>
                <div className="fila">
                  <Insignia valor={elegido.estado} prefijo="Estado:" />
                  {elegido.nivel && <Insignia valor={elegido.nivel} prefijo="Nivel:" />}
                </div>
                {elegido.capa === 'zonas' && (
                  <ul className="lista_resumen">
                    <li>
                      Afectación <strong>{String(elegido.detalle.porcentaje_afectacion ?? '—')}%</strong>
                    </li>
                    <li>
                      Prioridad <strong>{obtener_etiqueta(String(elegido.detalle.prioridad ?? ''))}</strong>
                    </li>
                    <li>
                      Necesidades <strong>{((elegido.detalle.necesidades_pendientes as string[]) ?? []).join(', ') || 'Ninguna pendiente'}</strong>
                    </li>
                  </ul>
                )}
                {elegido.capa === 'centros' && (
                  <ul className="lista_resumen">
                    <li>
                      Horario <strong>{String(elegido.detalle.horario ?? '—')}</strong>
                    </li>
                    <li>
                      Recibe <strong>{((elegido.detalle.tipos_donacion as string[]) ?? []).join(', ') || '—'}</strong>
                    </li>
                  </ul>
                )}
                {!elegido.punto && (
                  <AvisoEnLinea tono="advertencia" titulo="Sin ubicación confirmada">
                    <p>Este registro no aparece en el mapa hasta que un funcionario confirme su ubicación.</p>
                  </AvisoEnLinea>
                )}
                <Link to={`${RUTAS[elegido.capa]}/${elegido.id}`} className="boton boton_primario boton_grande">
                  <ExternalLink size={18} aria-hidden="true" /> Abrir detalle
                </Link>
              </>
            ) : (
              <EstadoVacio texto="Selecciona un marcador o un elemento del listado para ver su información." />
            )}
            <ul className="lista_resumen">
              {CAPAS.filter((capa) => capas.includes(capa)).map((capa) => (
                <li key={capa}>
                  <span className="fila" style={{ gap: 6 }}>
                    <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 3, background: COLORES_CAPA[capa], display: 'inline-block' }} />
                    {NOMBRES_CAPA[capa]}s en el mapa
                  </span>
                  <strong>{con_ubicacion.filter((elemento) => elemento.capa === capa).length}</strong>
                </li>
              ))}
            </ul>
            <UltimaActualizacion fecha={new Date()} />
          </div>
        </aside>
      </div>
    </>
  );
}
