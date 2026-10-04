import { useConfirmacion } from '../../componentes/formularios/DialogoConfirmacion';
import type { DefinicionCampo } from '../../componentes/formularios/tipos_formulario';
import { EncabezadoPagina, useTituloPagina } from '../../componentes/navegacion/DisenoPrincipal';
import { ModuloCrud } from '../../componentes/tablas/ModuloCrud';
import { Insignia } from '../../componentes/tarjetas/Insignia';
import { useSesion } from '../../contextos/ContextoSesion';
import { useOperacion } from '../../hooks/useOperacion';
import { servicio_donaciones } from '../../servicios/servicios';
import type { RegistroBase } from '../../tipos/api';
import { formatear_fecha, formatear_moneda, obtener_etiqueta } from '../../utilidades/formato';
import { CAMPO_CENTRO, CAMPO_EMERGENCIA, OPCIONES } from '../campos_comunes';
import { ESQUEMA_DONACION } from '@dominio/validacion/esquemas';

const CAMPOS_DONACION: DefinicionCampo[] = [
  CAMPO_EMERGENCIA,
  CAMPO_CENTRO,
  { nombre: 'tipo', etiqueta: 'Tipo', tipo: 'seleccion', requerido: true, opciones: OPCIONES.tipos_donacion },
  { nombre: 'metodo_pago', etiqueta: 'Método', tipo: 'seleccion', requerido: true, opciones: OPCIONES.metodos, ayuda: 'Las donaciones en bienes usan «Especie».' },
  { nombre: 'valor', etiqueta: 'Valor (COP)', tipo: 'entero', requerido: true, minimo: 0, ayuda: 'En bienes, valor estimado.' },
  { nombre: 'fecha', etiqueta: 'Fecha', tipo: 'fecha_hora', requerido: true },
  { nombre: 'donante_nombre', etiqueta: 'Nombre del donante', tipo: 'texto' },
  { nombre: 'descripcion', etiqueta: 'Descripción', tipo: 'area', ancho: 'completo' },
];

function SeccionDonaciones() {
  const { puede } = useSesion();
  const { ejecutar } = useOperacion();
  const confirmar = useConfirmacion();

  const cambiar_estado = async (fila: RegistroBase, estado: string) => {
    if (
      !(await confirmar({
        titulo: `Marcar como «${obtener_etiqueta(estado)}»`,
        mensaje: 'Registrar una donación no equivale a un pago: confirma sólo si verificaste el soporte administrativo.',
      }))
    ) return;

    await ejecutar(() => servicio_donaciones.cambiar_estado(fila.id, estado), {
      entidades: ['donaciones'],
      mensaje_exito: (respuesta) => respuesta.mensaje,
    });
  };

  const siguientes: Record<string, string[]> = {
    registrada: ['en_verificacion', 'anulada'],
    en_verificacion: ['confirmada', 'rechazada', 'anulada'],
    confirmada: ['anulada'],
  };

  return (
    <ModuloCrud<RegistroBase>
      ocultar_encabezado
      titulo="Donaciones"
      descripcion=""
      servicio={servicio_donaciones}
      entidades={['donaciones']}
      orden_inicial="-fecha"
      texto_busqueda="Buscar por tipo, método o descripción…"
      formulario={{
        campos: CAMPOS_DONACION,
        esquema_creacion: ESQUEMA_DONACION,
        esquema_edicion: ESQUEMA_DONACION,
        titulo_nuevo: 'Registrar donación',
        titulo_edicion: 'Editar donación',
        texto_boton_nuevo: 'Registrar donación',
        valores_iniciales: { fecha: new Date().toISOString(), metodo_pago: 'Transferencia', tipo: 'Monetaria' },
        clase_modal: 'modal_donaciones',
      }}
      puede_editar_fila={(fila) => ['registrada', 'en_verificacion'].includes(String(fila.estado))}
      mensaje_eliminar={() => 'Sólo se eliminan donaciones recién registradas; las verificadas o confirmadas se anulan para conservar la trazabilidad.'}
      acciones_extra={(fila) =>
        puede('registrar_donaciones')
          ? (siguientes[String(fila.estado)] ?? []).map((estado) => (
              <button key={estado} type="button" className="boton boton_pequeno" onClick={() => void cambiar_estado(fila, estado)}>
                {obtener_etiqueta(estado)}
              </button>
            ))
          : null
      }
      filtros={[
        { nombre: 'tipo', etiqueta: 'Tipo', tipo: 'seleccion', opciones: OPCIONES.tipos_donacion },
        { nombre: 'estado', etiqueta: 'Estado', tipo: 'seleccion', opciones: OPCIONES.estados_donacion },
        { nombre: 'metodo_pago', etiqueta: 'Método', tipo: 'seleccion', opciones: OPCIONES.metodos },
        { nombre: 'desde', etiqueta: 'Desde', tipo: 'fecha' },
        { nombre: 'hasta', etiqueta: 'Hasta', tipo: 'fecha' },
      ]}
      columnas={[
        { clave: 'fecha', titulo: 'Fecha', orden: 'fecha', render: (fila) => formatear_fecha(fila.fecha, true) },
        { clave: 'tipo', titulo: 'Tipo', orden: 'tipo', render: (fila) => <>{String(fila.tipo)}<span className="secundario_celda">{String(fila.metodo_pago)}</span></> },
        { clave: 'valor', titulo: 'Valor', orden: 'valor', alineacion: 'derecha', render: (fila) => formatear_moneda(fila.valor) },
        ...(puede('consultar_datos_restringidos') ? [{ clave: 'donante', titulo: 'Donante', render: (fila: RegistroBase) => String(fila.donante_nombre ?? '—') }] : []),
        { clave: 'estado', titulo: 'Estado', orden: 'estado', render: (fila) => <Insignia valor={String(fila.estado)} /> },
      ]}
    />
  );
}

export function PaginaFondos() {
  useTituloPagina('Donaciones', 'C · Donaciones');
  return (
    <>
      <EncabezadoPagina
        titulo="Donaciones"
        descripcion="Registro administrativo de donaciones."
        migas={[{ texto: 'Recursos y Logística' }, { texto: 'Donaciones' }]}
        etiquetas={<Insignia tono="primario" texto="Donaciones" sin_icono />}
      />
      <div role="tabpanel">
        <SeccionDonaciones />
      </div>
    </>
  );
}
