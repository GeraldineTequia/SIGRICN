import { useParams } from 'react-router-dom';
import { ESQUEMA_EMERGENCIA } from '@dominio/validacion/esquemas';
import type { DatosReglaEmergencia } from '@dominio/estrategias/IEstrategiaEmergencia';
import { PaginaFormulario } from '../../componentes/formularios/PaginaFormulario';
import { RequierePermiso, useTituloPagina } from '../../componentes/navegacion/DisenoPrincipal';
import { AvisoEnLinea, Cargando, ErrorCarga } from '../../componentes/tarjetas/Estados';
import { Insignia } from '../../componentes/tarjetas/Insignia';
import { useConsulta } from '../../hooks/useConsulta';
import { servicio_emergencias } from '../../servicios/servicios';
import type { Emergencia } from '../../tipos/api';
import { obtener_etiqueta } from '../../utilidades/formato';
import { CAMPOS_EMERGENCIA, gestor_emergencia, reglas_estrategia } from './definicion_emergencias';

/** Panel lateral: muestra qué estrategia se aplica y la clasificación sugerida en vivo (RF8). */
function PanelEstrategia({ datos, registro }: { datos: Record<string, unknown>; registro: Emergencia | null }) {
  const tipo = String(datos.tipo ?? '');
  if (!tipo) return null;
  const estrategia = gestor_emergencia.seleccionar_estrategia(tipo);
  const magnitud = datos.magnitud === null || datos.magnitud === undefined || datos.magnitud === '' ? null : Number(datos.magnitud);
  const clasificacion = estrategia.clasificar(estrategia.preparar({ ...(datos as DatosReglaEmergencia), magnitud }));
  return (
    <div className="pila" style={{ gap: 10 }}>
      <AvisoEnLinea tono="primario" titulo={`Reglas aplicadas: ${estrategia.nombre}`}>
        <p>
          Gravedad sugerida: <strong style={{ display: 'inline' }}>{obtener_etiqueta(clasificacion.nivel_sugerido)}</strong>. {clasificacion.criterio}
        </p>
      </AvisoEnLinea>
      {registro && (
        <AvisoEnLinea tono="advertencia" titulo={`Estado actual: ${obtener_etiqueta(registro.estado_ciclo ?? registro.estado)}`}>
          <p>El estado sólo cambia desde el detalle, siguiendo el ciclo activa → en atención → controlada → finalizada.</p>
        </AvisoEnLinea>
      )}
    </div>
  );
}

/** Registrar / editar / clasificar emergencia (mockup). */
export function PaginaFormularioEmergencia() {
  const { identificador } = useParams();
  const es_edicion = Boolean(identificador);
  useTituloPagina(es_edicion ? 'Editar emergencia' : 'Registrar emergencia', 'Gestión de crisis');
  const consulta = useConsulta(() => (identificador ? servicio_emergencias.obtener(identificador) : Promise.resolve(null)), [identificador]);
  if (es_edicion && consulta.error) return <ErrorCarga mensaje={consulta.error} codigo={consulta.codigo_error} al_reintentar={consulta.recargar} />;
  if (es_edicion && !consulta.datos) return <Cargando />;
  const registro = consulta.datos;
  return (
    <RequierePermiso permiso={es_edicion ? 'editar_registros_operativos' : 'crear_registros_operativos'}>
      <PaginaFormulario<Emergencia>
        titulo="Registrar / editar / clasificar emergencia"
        descripcion="Formulario validado y prevención de errores."
        migas={[{ texto: 'Gestión de crisis' }, { texto: 'Emergencias', ruta: '/emergencias' }, { texto: es_edicion ? 'Editar' : 'Registrar' }]}
        etiquetas={registro ? <Insignia valor={registro.estado_ciclo ?? registro.estado} prefijo="Emergencia" /> : <Insignia tono="advertencia" texto="Nueva emergencia · inicia activa" />}
        campos={CAMPOS_EMERGENCIA}
        esquema_creacion={ESQUEMA_EMERGENCIA}
        esquema_edicion={ESQUEMA_EMERGENCIA}
        servicio={servicio_emergencias}
        registro={registro}
        valores_iniciales={{ pais: 'Colombia', fecha_inicio: new Date().toISOString(), nivel_emergencia: 'medio' }}
        entidades={['emergencias', 'alertas']}
        reglas_extra={reglas_estrategia}
        ruta_destino={(guardado) => `/emergencias/${guardado.id}`}
        ruta_cancelar={registro ? `/emergencias/${registro.id}` : '/emergencias'}
        clave_borrador="emergencia_nueva"
        prefijo_identificador="EM"
        panel_extra={(datos) => <PanelEstrategia datos={datos} registro={registro} />}
      />
    </RequierePermiso>
  );
}
