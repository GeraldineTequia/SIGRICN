import { Save } from 'lucide-react';
import type { EsquemaValidacion } from '@dominio/validacion/validador';
import { useFormularioEntidad } from '../../hooks/useFormularioEntidad';
import type { RegistroBase } from '../../tipos/api';
import { CamposFormulario, ResumenErrores } from './CamposFormulario';
import { BotonEnProceso } from './DialogoConfirmacion';
import { Modal } from './Modal';
import type { DefinicionCampo } from './tipos_formulario';

interface PropiedadesFormularioModal<T extends RegistroBase> {
  titulo: string;
  abierto: boolean;
  al_cerrar: () => void;
  al_guardar?: (registro: T) => void;
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
  reglas_extra?: (envio: Record<string, unknown>) => Record<string, string>;
  clase_modal?: string;
}

function ContenidoFormularioModal<T extends RegistroBase>(propiedades: PropiedadesFormularioModal<T>) {
  const formulario = useFormularioEntidad<T>(propiedades);
  const tiene_mapa = propiedades.campos.some((campo) => campo.tipo === 'ubicacion');
  return (
    <Modal
      abierto
      titulo={propiedades.titulo}
      descripcion="Los campos marcados con * son obligatorios."
      al_cerrar={propiedades.al_cerrar}
      tamano={tiene_mapa || propiedades.campos.length > 6 ? 'grande' : 'normal'}
      clase={propiedades.clase_modal}
      pie={
        <>
          <button type="button" className="boton" onClick={propiedades.al_cerrar}>
            Cancelar
          </button>
          <BotonEnProceso
            type="button"
            en_proceso={formulario.en_proceso}
            onClick={async () => {
              const guardado = await formulario.enviar();
              if (guardado) {
                propiedades.al_guardar?.(guardado);
                propiedades.al_cerrar();
              }
            }}
          >
            {!formulario.en_proceso && <Save size={18} aria-hidden="true" />} Guardar y confirmar
          </BotonEnProceso>
        </>
      }
    >
      <div className="pila">
        <ResumenErrores errores={formulario.errores} campos={propiedades.campos} />
        <CamposFormulario campos={propiedades.campos} datos={formulario.datos} errores={formulario.errores} al_cambiar={formulario.cambiar} es_edicion={formulario.es_edicion} />
      </div>
    </Modal>
  );
}

/** Formulario en ventana modal para módulos de registro rápido (centros, donaciones, población...). */
export function FormularioModal<T extends RegistroBase>(propiedades: PropiedadesFormularioModal<T>) {
  if (!propiedades.abierto) return null;
  return <ContenidoFormularioModal key={propiedades.registro?.id ?? 'nuevo'} {...propiedades} />;
}
