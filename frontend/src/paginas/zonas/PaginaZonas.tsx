import { Link } from 'react-router-dom';
import { validar_estadistica_poblacion, type EstadisticaPoblacion } from '@dominio/reglas/poblacion';
import { ESQUEMA_POBLACION } from '@dominio/validacion/esquemas';
import { EncabezadoPagina, useTituloPagina } from '../../componentes/navegacion/DisenoPrincipal';
import { ListaDetalle, ModuloCrud } from '../../componentes/tablas/ModuloCrud';
import { AvisoEnLinea, BarraProgreso } from '../../componentes/tarjetas/Estados';
import { Insignia } from '../../componentes/tarjetas/Insignia';
import { useParametrosUrl } from '../../hooks/useParametrosUrl';
import { servicio_poblacion, servicio_zonas } from '../../servicios/servicios';
import type { RegistroBase, Zona } from '../../tipos/api';
import { formatear_numero, identificador_corto } from '../../utilidades/formato';
import { OPCIONES } from '../campos_comunes';
import { CAMPOS_POBLACION } from './definicion_zonas';

function ListadoZonas() {
  return (
    <ModuloCrud<Zona>
      ocultar_encabezado
      titulo="Zonas afectadas"
      descripcion=""
      servicio={servicio_zonas}
      entidades={['zonas']}
      texto_busqueda="Buscar dirección, barrio o municipio…"
      ruta_nuevo="/zonas/nueva"
      texto_boton_nuevo="Registrar zona"
      ruta_detalle={(fila) => `/zonas/${fila.id}`}
      ruta_edicion={(fila) => `/zonas/${fila.id}/editar`}
      mensaje_eliminar={() => 'Si la zona tiene población, necesidades, familias, personas o asignaciones registradas, la eliminación se bloqueará para proteger la integridad.'}
      filtros={[
        { nombre: 'nivel_afectacion', etiqueta: 'Afectación', tipo: 'seleccion', opciones: OPCIONES.niveles },
        { nombre: 'prioridad', etiqueta: 'Prioridad', tipo: 'seleccion', opciones: OPCIONES.prioridades },
        { nombre: 'estado_atencion', etiqueta: 'Atención', tipo: 'seleccion', opciones: OPCIONES.estados_atencion },
        { nombre: 'departamento', etiqueta: 'Departamento', tipo: 'departamento' },
        { nombre: 'municipio', etiqueta: 'Municipio', tipo: 'municipio' },
      ]}
      columnas={[
        { clave: 'id', titulo: 'ID', render: (fila) => <Link className="identificador" to={`/zonas/${fila.id}`}>{identificador_corto(fila.id, 'ZN')}</Link> },
        {
          clave: 'direccion',
          titulo: 'Zona',
          render: (fila) => (
            <>
              <span className="principal_celda">{fila.barrio || fila.direccion}</span>
              <span className="secundario_celda">
                {fila.direccion} · {fila.municipio}, {fila.departamento}
                {fila.ubicacion.estado !== 'confirmada' ? ' · Pendiente de ubicación' : ''}
              </span>
            </>
          ),
        },
        { clave: 'afectacion', titulo: 'Afectación', orden: 'porcentaje_afectacion', render: (fila) => <><Insignia valor={fila.nivel_afectacion} /> <span className="secundario_celda">{fila.porcentaje_afectacion}%</span></> },
        { clave: 'prioridad', titulo: 'Prioridad', orden: 'prioridad', render: (fila) => <Insignia valor={fila.prioridad ?? ''} /> },
        { clave: 'atencion', titulo: 'Atención', render: (fila) => <Insignia valor={fila.estado_atencion} /> },
      ]}
    />
  );
}

function ListadoPoblacion() {
  return (
    <>
      <AvisoEnLinea tono="primario" titulo="Estadísticas agregadas">
        <p>Un registro por zona. Los grupos de edad no pueden superar el total; heridas, evacuadas o albergadas se informan por separado porque pueden solaparse.</p>
      </AvisoEnLinea>
      <div style={{ height: 14 }} />
      <ModuloCrud<RegistroBase>
        ocultar_encabezado
        titulo="Población afectada"
        descripcion=""
        servicio={servicio_poblacion}
        entidades={['poblacion']}
        filtros={[]}
        texto_busqueda="Buscar…"
        orden_inicial="-personas_afectadas"
        formulario={{
          campos: CAMPOS_POBLACION,
          esquema_creacion: ESQUEMA_POBLACION,
          esquema_edicion: ESQUEMA_POBLACION,
          titulo_nuevo: 'Registrar población afectada',
          titulo_edicion: 'Actualizar población afectada',
          texto_boton_nuevo: 'Registrar población',
          reglas_extra: (envio) => validar_estadistica_poblacion(envio as EstadisticaPoblacion),
        }}
        detalle={(fila) => (
          <ListaDetalle
            elementos={CAMPOS_POBLACION.filter((campo) => campo.tipo === 'entero').map((campo) => ({
              etiqueta: campo.etiqueta,
              valor: fila[campo.nombre] === null || fila[campo.nombre] === undefined ? 'No registrado' : formatear_numero(fila[campo.nombre]),
            }))}
          />
        )}
        columnas={[
          { clave: 'zona', titulo: 'Zona', render: (fila) => <Link to={`/zonas/${String(fila.zona_id)}`}>{identificador_corto(String(fila.zona_id), 'ZN')}</Link> },
          { clave: 'afectadas', titulo: 'Personas', orden: 'personas_afectadas', alineacion: 'derecha', render: (fila) => formatear_numero(fila.personas_afectadas) },
          { clave: 'familias', titulo: 'Familias', alineacion: 'derecha', render: (fila) => formatear_numero(fila.familias_afectadas) },
          {
            clave: 'edades',
            titulo: 'Grupos de edad',
            render: (fila) => {
              const total = Number(fila.personas_afectadas ?? 0);
              const clasificadas = ['ninos', 'adultos', 'adultos_mayores'].reduce((suma, campo) => suma + Number(fila[campo] ?? 0), 0);
              return <BarraProgreso etiqueta="Clasificadas" valor={clasificadas} maximo={total || 1} tono={clasificadas < total ? 'advertencia' : undefined} texto_valor={`${formatear_numero(clasificadas)} de ${formatear_numero(total)}`} />;
            },
          },
          { clave: 'evacuadas', titulo: 'Evacuadas', alineacion: 'derecha', render: (fila) => formatear_numero(fila.personas_evacuadas) },
          { clave: 'pendientes', titulo: 'Pend. atención', alineacion: 'derecha', render: (fila) => formatear_numero(fila.personas_pendientes_atencion) },
        ]}
      />
    </>
  );
}

/** Zonas afectadas y población (RF10–RF14). */
export function PaginaZonas() {
  useTituloPagina('Zonas Afectadas', 'Gestión de crisis');
  const [valores, establecer] = useParametrosUrl();
  const pestana = valores.pestana === 'poblacion' ? 'poblacion' : 'zonas';
  const cambiar_pestana = (nueva: string) => establecer({ pestana: nueva });
  return (
    <>
      <EncabezadoPagina
        titulo={pestana === 'zonas' ? 'Zonas afectadas' : 'Población afectada'}
        descripcion="Registro, clasificación, atención y estadísticas de población."
        migas={[{ texto: 'Gestión de crisis' }, { texto: 'Zonas' }]}
        acciones={
          <Link to="/mapa?capas=zonas" className="boton">
            Ver en el mapa
          </Link>
        }
      />
      <div className="pestanas" role="tablist" aria-label="Secciones">
        {[
          ['zonas', 'Zonas afectadas'],
          ['poblacion', 'Población (estadísticas)'],
        ].map(([clave, texto]) => (
          <button key={clave} type="button" role="tab" className="pestana" aria-selected={pestana === clave} onClick={() => cambiar_pestana(clave)}>
            {texto}
          </button>
        ))}
      </div>
      <div role="tabpanel">{pestana === 'zonas' ? <ListadoZonas /> : <ListadoPoblacion />}</div>
    </>
  );
}
