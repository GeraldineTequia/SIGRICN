import { ESQUEMA_POBLACION } from '@dominio/validacion/esquemas';
import { validar_estadistica_poblacion, type EstadisticaPoblacion } from '@dominio/reglas/poblacion';
import { EncabezadoPagina, useTituloPagina } from '../../componentes/navegacion/DisenoPrincipal';
import { ListaDetalle, ModuloCrud } from '../../componentes/tablas/ModuloCrud';
import { AvisoEnLinea } from '../../componentes/tarjetas/Estados';
import { servicio_poblacion } from '../../servicios/servicios';
import type { RegistroBase } from '../../tipos/api';
import { formatear_numero, identificador_corto } from '../../utilidades/formato';
import { CAMPOS_POBLACION } from '../zonas/definicion_zonas';

const DETALLE_POBLACION: ReadonlyArray<[string, keyof RegistroBase]> = [
  ['Personas afectadas', 'personas_afectadas'],
  ['Familias afectadas', 'familias_afectadas'],
  ['Niños y niñas', 'ninos'],
  ['Adultos', 'adultos'],
  ['Adultos mayores', 'adultos_mayores'],
  ['Personas con discapacidad', 'personas_discapacidad'],
  ['Personas heridas', 'personas_heridas'],
  ['Personas fallecidas', 'personas_fallecidas'],
  ['Personas desaparecidas', 'personas_desaparecidas'],
  ['Personas evacuadas', 'personas_evacuadas'],
  ['Personas albergadas', 'personas_albergadas'],
  ['Personas pendientes de atención', 'personas_pendientes_atencion'],
];

function DetallePoblacion({ fila }: { fila: RegistroBase }) {
  return (
    <section className="tarjeta">
      <div className="tarjeta_encabezado">
        <div>
          <h2>Registro general de población</h2>
          <p className="texto_suave">Información consolidada para una emergencia y una zona.</p>
        </div>
      </div>
      <ListaDetalle
        elementos={[
          { etiqueta: 'Emergencia', valor: identificador_corto(String(fila.catastrofe_id), 'EM') },
          { etiqueta: 'Zona', valor: identificador_corto(String(fila.zona_id), 'ZN') },
          ...DETALLE_POBLACION.map(([etiqueta, campo]) => ({
            etiqueta,
            valor: formatear_numero(fila[campo]),
          })),
        ]}
      />
    </section>
  );
}

/**
 * Población afectada es una estadística agregada.
 * Cada registro representa exactamente una combinación emergencia + zona.
 * No se crean familias ni personas individuales desde esta ventana.
 */
export function PaginaPersonas() {
  useTituloPagina('Población afectada', 'Gestión de crisis');

  return (
    <>
      <EncabezadoPagina
        titulo="Población afectada"
        descripcion="Registro general de población afectada por emergencia y zona."
        migas={[{ texto: 'Gestión de crisis' }, { texto: 'Población afectada' }]}
      />

      <AvisoEnLinea tono="primario" titulo="Registro general">
        <p>
          Cada registro corresponde a una emergencia y una zona. Toda la información de población se guarda junta
          en <strong>Poblacion_afectada</strong>, exactamente con sus cantidades de personas, familias y categorías de afectación.
        </p>
      </AvisoEnLinea>
      <div style={{ height: 14 }} />

      <ModuloCrud<RegistroBase>
        ocultar_encabezado
        titulo="Población afectada"
        descripcion=""
        servicio={servicio_poblacion}
        entidades={['poblacion']}
        filtros={[]}
        texto_busqueda="Buscar por registro…"
        orden_inicial="-personas_afectadas"
        formulario={{
          campos: CAMPOS_POBLACION,
          esquema_creacion: ESQUEMA_POBLACION,
          esquema_edicion: ESQUEMA_POBLACION,
          titulo_nuevo: 'Registrar población afectada',
          titulo_edicion: 'Editar población afectada',
          texto_boton_nuevo: 'Registrar población',
          reglas_extra: (envio) => validar_estadistica_poblacion(envio as EstadisticaPoblacion),
        }}
        detalle={(fila) => <DetallePoblacion fila={fila} />}
        columnas={[
          {
            clave: 'emergencia',
            titulo: 'Emergencia',
            render: (fila) => <span className="identificador">{identificador_corto(String(fila.catastrofe_id), 'EM')}</span>,
          },
          {
            clave: 'zona',
            titulo: 'Zona',
            render: (fila) => <span className="identificador">{identificador_corto(String(fila.zona_id), 'ZN')}</span>,
          },
          {
            clave: 'personas_afectadas',
            titulo: 'Población afectada',
            orden: 'personas_afectadas',
            alineacion: 'derecha',
            render: (fila) => formatear_numero(fila.personas_afectadas),
          },
          {
            clave: 'familias_afectadas',
            titulo: 'Familias afectadas',
            alineacion: 'derecha',
            render: (fila) => formatear_numero(fila.familias_afectadas),
          },
          {
            clave: 'pendientes',
            titulo: 'Pendientes de atención',
            alineacion: 'derecha',
            render: (fila) => formatear_numero(fila.personas_pendientes_atencion),
          },
        ]}
      />
    </>
  );
}
