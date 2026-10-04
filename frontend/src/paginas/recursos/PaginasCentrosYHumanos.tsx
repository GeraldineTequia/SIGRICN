import { ESQUEMA_CENTRO_DONACION } from '@dominio/validacion/esquemas';
import type { DefinicionCampo } from '../../componentes/formularios/tipos_formulario';
import { MapaGeneral } from '../../componentes/mapas/MapaGeneral';
import { ListaDetalle, ModuloCrud } from '../../componentes/tablas/ModuloCrud';
import { AvisoEnLinea } from '../../componentes/tarjetas/Estados';
import { Insignia } from '../../componentes/tarjetas/Insignia';
import { servicio_centros } from '../../servicios/servicios';
import type { RegistroBase, Ubicacion } from '../../tipos/api';
import { CAMPOS_DIRECCION, OPCIONES, campo_ubicacion } from '../campos_comunes';

const CAMPOS_CENTRO: DefinicionCampo[] = [
  { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'texto', requerido: true, ancho: 'completo' },
  ...CAMPOS_DIRECCION,
  { nombre: 'direccion', etiqueta: 'Dirección', tipo: 'texto', requerido: true, ancho: 'completo' },
  { nombre: 'telefono', etiqueta: 'Teléfono', tipo: 'telefono' },
  { nombre: 'correo', etiqueta: 'Correo', tipo: 'correo' },
  { nombre: 'horario', etiqueta: 'Horario', tipo: 'texto' },
  { nombre: 'estado', etiqueta: 'Estado', tipo: 'opciones', requerido: true, opciones: OPCIONES.estados_centro },
  { nombre: 'tipos_donacion', etiqueta: 'Tipos de donación que recibe', tipo: 'casillas', opciones: OPCIONES.tipos_centro },
  campo_ubicacion('direccion'),
];

/** Centros de donación: CRUD con ubicación por dirección. */
export function PaginaCentros() {
  return (
    <ModuloCrud<RegistroBase>
      titulo="Centros de donación"
      descripcion="Centros de acopio, horarios y tipos de donación que reciben."
      seccion="Recursos y logística"
      servicio={servicio_centros}
      entidades={['centros']}
      texto_busqueda="Buscar por nombre, dirección o municipio…"
      orden_inicial="nombre"
      formulario={{
        campos: CAMPOS_CENTRO,
        esquema_creacion: ESQUEMA_CENTRO_DONACION,
        esquema_edicion: ESQUEMA_CENTRO_DONACION,
        titulo_nuevo: 'Registrar centro de donación',
        titulo_edicion: 'Editar centro de donación',
        texto_boton_nuevo: 'Registrar centro',
        valores_iniciales: { pais: 'Colombia', estado: 'activo', tipos_donacion: [] },
      }}
      detalle={(fila) => {
        const ubicacion = fila.ubicacion as Ubicacion;
        return (
          <div className="pila">
            <ListaDetalle
              elementos={[
                { etiqueta: 'Nombre', valor: String(fila.nombre) },
                { etiqueta: 'Dirección', valor: `${String(fila.direccion)}${fila.barrio ? `, ${String(fila.barrio)}` : ''}, ${String(fila.municipio)}, ${String(fila.departamento)}` },
                { etiqueta: 'Teléfono', valor: String(fila.telefono ?? '—') },
                { etiqueta: 'Correo', valor: String(fila.correo ?? '—') },
                { etiqueta: 'Horario', valor: String(fila.horario ?? '—') },
                { etiqueta: 'Recibe', valor: ((fila.tipos_donacion as string[]) ?? []).join(', ') || '—' },
                { etiqueta: 'Estado', valor: <Insignia valor={String(fila.estado)} /> },
              ]}
            />
            {ubicacion?.estado === 'confirmada' && ubicacion.punto ? (
              <MapaGeneral
                tamano="mediano"
                ajuste_vista={1}
                elementos={[
                  {
                    capa: 'centros',
                    id: fila.id,
                    titulo: String(fila.nombre),
                    direccion: String(fila.direccion),
                    departamento: String(fila.departamento),
                    municipio: String(fila.municipio),
                    estado: String(fila.estado),
                    nivel: null,
                    estado_ubicacion: 'confirmada',
                    precision: ubicacion.precision,
                    punto: ubicacion.punto,
                    detalle: {},
                    geometria: null,
                  },
                ]}
              />
            ) : (
              <AvisoEnLinea tono="advertencia" titulo="Pendiente de ubicación">
                <p>Este centro aún no tiene una ubicación confirmada en el mapa.</p>
              </AvisoEnLinea>
            )}
          </div>
        );
      }}
      mensaje_eliminar={() => 'Si el centro tiene donaciones asociadas, no se podrá eliminar; puedes marcarlo como inactivo.'}
      filtros={[
        { nombre: 'estado', etiqueta: 'Estado', tipo: 'seleccion', opciones: OPCIONES.estados_centro },
        { nombre: 'departamento', etiqueta: 'Departamento', tipo: 'departamento' },
        { nombre: 'municipio', etiqueta: 'Municipio', tipo: 'municipio' },
      ]}
      columnas={[
        { clave: 'nombre', titulo: 'Nombre', orden: 'nombre', render: (fila) => <><span className="principal_celda">{String(fila.nombre)}</span><span className="secundario_celda">{String(fila.horario ?? '')}</span></> },
        {
          clave: 'direccion',
          titulo: 'Dirección',
          orden: 'municipio',
          render: (fila) => (
            <>
              {String(fila.direccion)}
              <span className="secundario_celda">
                {String(fila.municipio)}, {String(fila.departamento)}
                {(fila.ubicacion as Ubicacion)?.estado !== 'confirmada' ? ' · Pendiente de ubicación' : ''}
              </span>
            </>
          ),
        },
        { clave: 'tipos', titulo: 'Recibe', render: (fila) => ((fila.tipos_donacion as string[]) ?? []).join(', ') || '—' },
        { clave: 'estado', titulo: 'Estado', orden: 'estado', render: (fila) => <Insignia valor={String(fila.estado)} /> },
      ]}
    />
  );
}

