import { CheckCircle2, FileText, Save, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { EsquemaValidacion } from '@dominio/validacion/validador';
import { useFormularioEntidad } from '../../hooks/useFormularioEntidad';
import type { RegistroBase } from '../../tipos/api';
import { formatear_fecha } from '../../utilidades/formato';
import { EncabezadoPagina } from '../navegacion/DisenoPrincipal';
import { BarraProgreso } from '../tarjetas/Estados';
import { Insignia } from '../tarjetas/Insignia';
import { CamposFormulario, ResumenErrores } from './CamposFormulario';
import { BotonEnProceso } from './DialogoConfirmacion';
import type { DefinicionCampo } from './tipos_formulario';

interface PropiedadesPaginaFormulario<T extends RegistroBase> {
  titulo: string;
  descripcion: string;
  migas: { texto: string; ruta?: string }[];
  etiquetas?: ReactNode;
  campos: DefinicionCampo[];
  esquema_creacion: EsquemaValidacion;
  esquema_edicion: EsquemaValidacion;
  servicio: {
    crear: (datos: Record<string, unknown>) => Promise<{ registro: T; mensaje: string }>;
    reemplazar: (id: string, datos: Record<string, unknown>) => Promise<{ registro: T; mensaje: string }>;
  };
  registro?: T | null;
  valores_iniciales?: Record<string, unknown>;
  entidades: string[];
  ruta_destino: (registro: T) => string;
  ruta_cancelar: string;
  reglas_extra?: (envio: Record<string, unknown>) => Record<string, string>;
  clave_borrador?: string;
  panel_extra?: (datos: Record<string, unknown>) => ReactNode;
  prefijo_identificador?: string;
}

/**
 * Página de formulario del mockup ("Registrar / editar / clasificar emergencia"):
 * tarjeta "Campos del formulario" + "Panel de control" con errores de validación,
 * completitud, "Guardar y confirmar" y "Guardar borrador".
 */
export function PaginaFormulario<T extends RegistroBase>(propiedades: PropiedadesPaginaFormulario<T>) {
  const navegar = useNavigate();
  const formulario = useFormularioEntidad<T>(propiedades);
  const { registro } = propiedades;

  const al_enviar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    const guardado = await formulario.enviar();
    if (guardado) navegar(propiedades.ruta_destino(guardado));
    else document.getElementById('resumen-errores')?.focus();
  };

  return (
    <>
      <EncabezadoPagina titulo={propiedades.titulo} descripcion={propiedades.descripcion} migas={propiedades.migas} etiquetas={propiedades.etiquetas} />
      <form className="dos_columnas" onSubmit={al_enviar} noValidate>
        <section className="tarjeta" aria-labelledby="titulo-campos">
          <div className="tarjeta_encabezado">
            <h2 id="titulo-campos">Campos del formulario</h2>
            {formulario.borrador_guardado && <Insignia tono="primario" texto="Borrador guardado" />}
          </div>
          <p className="texto_suave texto_pequeno" style={{ marginBottom: 16 }}>
            Los campos marcados con * son obligatorios.
          </p>
          <CamposFormulario campos={propiedades.campos} datos={formulario.datos} errores={formulario.errores} al_cambiar={formulario.cambiar} es_edicion={formulario.es_edicion} />
        </section>
        <aside className="panel_control" aria-label="Panel de control">
          <div className="tarjeta pila">
            <h2>Panel de control</h2>
            <div id="resumen-errores" tabIndex={-1}>
              <ResumenErrores errores={formulario.errores} campos={propiedades.campos} />
            </div>
            <BarraProgreso etiqueta="Completitud del formulario" valor={formulario.completitud} />
            {propiedades.panel_extra?.(formulario.datos)}
            <BotonEnProceso type="submit" en_proceso={formulario.en_proceso} className="boton boton_primario boton_grande">
              {!formulario.en_proceso && <Save size={20} aria-hidden="true" />} Guardar y confirmar
            </BotonEnProceso>
            {propiedades.clave_borrador && !formulario.es_edicion && (
              <button type="button" className="boton boton_grande" onClick={formulario.guardar_borrador}>
                {formulario.borrador_guardado ? <CheckCircle2 size={20} aria-hidden="true" /> : <FileText size={20} aria-hidden="true" />} Guardar borrador
              </button>
            )}
            <Link to={propiedades.ruta_cancelar} className="boton">
              <X size={18} aria-hidden="true" /> Cancelar
            </Link>
            {registro && (
              <dl className="metadatos">
                <div>
                  <dt>Última actualización</dt>
                  <dd>{formatear_fecha(registro.actualizado_en, true)}</dd>
                </div>
                <div>
                  <dt>ID</dt>
                  <dd>
                    #{propiedades.prefijo_identificador ?? 'REG'}-{registro.id.slice(-6).toUpperCase()}
                  </dd>
                </div>
              </dl>
            )}
          </div>
        </aside>
      </form>
    </>
  );
}
