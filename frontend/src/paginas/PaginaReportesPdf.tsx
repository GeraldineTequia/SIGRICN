import { FileDown, Lock } from 'lucide-react';
import { useState } from 'react';
import { CATEGORIAS_REPORTE_PDF } from '@dominio/validacion/esquemas';
import { Campo } from '../componentes/formularios/Campo';
import { BotonEnProceso } from '../componentes/formularios/DialogoConfirmacion';
import { EncabezadoPagina, useTituloPagina } from '../componentes/navegacion/DisenoPrincipal';
import { BarraFiltros } from '../componentes/tablas/Filtros';
import { AvisoEnLinea } from '../componentes/tarjetas/Estados';
import { Insignia } from '../componentes/tarjetas/Insignia';
import { useAvisos } from '../contextos/ContextoAvisos';
import { useSesion } from '../contextos/ContextoSesion';
import { ErrorApi } from '../servicios/cliente_api';
import { servicio_reportes_pdf } from '../servicios/servicios';
import { descargar_archivo } from '../utilidades/formato';
import { CAMPO_EMERGENCIA } from './campos_comunes';

const NOMBRES_CATEGORIA: Record<string, string> = {
  emergencias: 'Emergencias',
  zonas: 'Zonas afectadas',
  poblacion: 'Población (agregada)',
  necesidades: 'Necesidades',
  recursos: 'Recursos materiales',
  asignaciones: 'Asignaciones y entregas',
  donaciones: 'Donaciones',
  fondos: 'Fondos financieros',
  centros: 'Centros de donación',
};

/** Reportes PDF (RF24): categorías y filtros, datos reales y contenido según permisos. */
export function PaginaReportesPdf() {
  useTituloPagina('Reportes PDF', 'D · Comunicación, control y reportes');
  const { puede } = useSesion();
  const { mostrar_aviso } = useAvisos();
  const [categorias, establecer_categorias] = useState<string[]>(['emergencias', 'zonas', 'recursos']);
  const [filtros, establecer_filtros] = useState<Record<string, string>>({});
  const [emergencia, establecer_emergencia] = useState<Record<string, unknown>>({ catastrofe_id: '' });
  const [generando, establecer_generando] = useState(false);
  const [resultado, establecer_resultado] = useState<string | null>(null);

  const alternar = (categoria: string) =>
    establecer_categorias((actuales) => (actuales.includes(categoria) ? actuales.filter((actual) => actual !== categoria) : [...actuales, categoria]));

  const generar = async () => {
    if (categorias.length === 0) {
      mostrar_aviso({ tipo: 'advertencia', titulo: 'Selecciona al menos una categoría.' });
      return;
    }
    establecer_generando(true);
    establecer_resultado(null);
    const inicio = performance.now();
    try {
      const archivo = await servicio_reportes_pdf.generar({
        categorias: categorias.join(','),
        ...Object.fromEntries(Object.entries(filtros).filter(([, valor]) => valor)),
        ...(emergencia.catastrofe_id ? { catastrofe_id: String(emergencia.catastrofe_id) } : {}),
      });
      descargar_archivo(archivo.contenido, archivo.nombre);
      const segundos = ((performance.now() - inicio) / 1000).toFixed(1);
      const mensaje = archivo.filas === 0 ? 'El reporte se generó, pero no existen resultados para los filtros seleccionados.' : `${archivo.filas} registros incluidos · generado en ${segundos} s.`;
      establecer_resultado(mensaje);
      mostrar_aviso({ tipo: archivo.filas === 0 ? 'advertencia' : 'exito', titulo: 'Reporte PDF descargado', mensaje });
    } catch (causa) {
      mostrar_aviso({ tipo: 'error', titulo: 'No se pudo generar el reporte', mensaje: causa instanceof ErrorApi ? causa.message : undefined });
    } finally {
      establecer_generando(false);
    }
  };

  return (
    <>
      <EncabezadoPagina
        titulo="Reportes PDF"
        descripcion="Consolida información real según categorías y filtros. Incluye título, fecha, filtros y numeración de páginas."
        migas={[{ texto: 'Informes y análisis' }, { texto: 'Reportes PDF' }]}
        etiquetas={<Insignia tono="primario" texto="RF24" sin_icono />}
      />
      <div className="dos_columnas">
        <section className="tarjeta pila" aria-labelledby="titulo-categorias">
          <h2 id="titulo-categorias">Categorías</h2>
          <div className="lista_casillas" role="group" aria-labelledby="titulo-categorias">
            {CATEGORIAS_REPORTE_PDF.map((categoria) => (
              <label key={categoria} className="casilla">
                <input type="checkbox" checked={categorias.includes(categoria)} onChange={() => alternar(categoria)} />
                {NOMBRES_CATEGORIA[categoria]}
              </label>
            ))}
          </div>
          <h2>Filtros</h2>
          <Campo definicion={{ ...CAMPO_EMERGENCIA, requerido: false, etiqueta: 'Emergencia (opcional)' }} valor={emergencia.catastrofe_id} datos={emergencia} al_cambiar={(nombre, valor) => establecer_emergencia({ [nombre]: valor })} />
          <BarraFiltros
            con_busqueda={false}
            valores={filtros}
            al_cambiar={establecer_filtros}
            filtros={[
              { nombre: 'departamento', etiqueta: 'Departamento', tipo: 'departamento' },
              { nombre: 'municipio', etiqueta: 'Municipio', tipo: 'municipio' },
              { nombre: 'desde', etiqueta: 'Desde', tipo: 'fecha' },
              { nombre: 'hasta', etiqueta: 'Hasta', tipo: 'fecha' },
            ]}
          />
        </section>
        <aside className="panel_control">
          <div className="tarjeta pila">
            <h2>Generar</h2>
            <p className="texto_suave">{categorias.length} categorías seleccionadas. Volumen máximo: 2.000 filas por categoría.</p>
            {!puede('consultar_datos_restringidos') && (
              <AvisoEnLinea tono="primario" icono={<Lock size={20} />}>
                <p>Tu reporte incluye sólo información que puedes consultar: se omiten los datos de donantes y los registros individuales de personas.</p>
              </AvisoEnLinea>
            )}
            <BotonEnProceso type="button" en_proceso={generando} className="boton boton_primario boton_grande" onClick={generar}>
              {!generando && <FileDown size={20} aria-hidden="true" />} {generando ? 'Generando…' : 'Generar y descargar PDF'}
            </BotonEnProceso>
            <div aria-live="polite">{resultado && <AvisoEnLinea tono="primario">{<p>{resultado}</p>}</AvisoEnLinea>}</div>
          </div>
        </aside>
      </div>
    </>
  );
}
