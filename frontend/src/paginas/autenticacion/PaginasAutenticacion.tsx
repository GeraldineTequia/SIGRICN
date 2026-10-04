import { LogIn, Mail, UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { validar_contrasena } from '@dominio/reglas/contrasena';
import { ESQUEMA_INICIO_SESION, ESQUEMA_REGISTRO, ESQUEMA_RESTABLECER, ESQUEMA_SOLICITUD_RECUPERACION } from '@dominio/validacion/esquemas';
import { validar_datos } from '@dominio/validacion/validador';
import { Campo } from '../../componentes/formularios/Campo';
import { BotonEnProceso } from '../../componentes/formularios/DialogoConfirmacion';
import type { DefinicionCampo } from '../../componentes/formularios/tipos_formulario';
import { AvisoEnLinea } from '../../componentes/tarjetas/Estados';
import { useAvisos } from '../../contextos/ContextoAvisos';
import { useSesion } from '../../contextos/ContextoSesion';
import { ErrorApi } from '../../servicios/cliente_api';
import { servicio_autenticacion } from '../../servicios/servicios';
import { DisenoAutenticacion } from './DisenoAutenticacion';

function useFormularioSimple(campos_iniciales: Record<string, unknown>) {
  const [datos, establecer] = useState<Record<string, unknown>>(campos_iniciales);
  const [errores, establecer_errores] = useState<Record<string, string>>({});
  const [en_proceso, establecer_en_proceso] = useState(false);
  const cambiar = (nombre: string, valor: unknown) => {
    establecer((actuales) => ({ ...actuales, [nombre]: valor }));
    establecer_errores((actuales) => ({ ...actuales, [nombre]: '' }));
  };
  const ejecutar = async (validar: () => Record<string, string>, operacion: () => Promise<void>) => {
    const encontrados = Object.fromEntries(Object.entries(validar()).filter(([, mensaje]) => mensaje));
    establecer_errores(encontrados);
    if (Object.keys(encontrados).length > 0) return;
    establecer_en_proceso(true);
    try {
      await operacion();
    } catch (causa) {
      if (causa instanceof ErrorApi) establecer_errores({ ...causa.errores, general: causa.message });
      else establecer_errores({ general: 'No fue posible completar la solicitud.' });
    } finally {
      establecer_en_proceso(false);
    }
  };
  return { datos, cambiar, errores, en_proceso, ejecutar };
}

const CAMPO_CORREO: DefinicionCampo = { nombre: 'correo', etiqueta: 'Correo electrónico', tipo: 'correo', requerido: true };

function CampoContrasena({ nombre, etiqueta, valor, error, al_cambiar, autocompletar }: { nombre: string; etiqueta: string; valor: unknown; error?: string; al_cambiar: (nombre: string, valor: unknown) => void; autocompletar: string }) {
  const [visible, establecer_visible] = useState(false);
  const id = `campo-${nombre}`;
  return (
    <div className="campo">
      <label htmlFor={id}>
        {etiqueta} <span className="requerido">*</span>
      </label>
      <div className="fila" style={{ flexWrap: 'nowrap' }}>
        <input
          id={id}
          className="control"
          type={visible ? 'text' : 'password'}
          autoComplete={autocompletar}
          value={String(valor ?? '')}
          onChange={(evento) => al_cambiar(nombre, evento.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <button type="button" className="boton boton_pequeno" onClick={() => establecer_visible((actual) => !actual)} aria-pressed={visible} aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
          {visible ? 'Ocultar' : 'Mostrar'}
        </button>
      </div>
      {error && (
        <span id={`${id}-error`} className="error_campo" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

export function PaginaInicioSesion() {
  const { usuario, iniciar_sesion } = useSesion();
  const ubicacion = useLocation();
  const formulario = useFormularioSimple({ correo: '', password: '' });
  if (usuario) return <Navigate to={(ubicacion.state as { desde?: string } | null)?.desde ?? '/'} replace />;
  return (
    <DisenoAutenticacion titulo="Iniciar sesión" descripcion="Ingresa con tu correo y contraseña.">
      <form
        className="pila"
        noValidate
        onSubmit={(evento) => {
          evento.preventDefault();
          void formulario.ejecutar(
            () => validar_datos(formulario.datos, ESQUEMA_INICIO_SESION).errores,
            () => iniciar_sesion(String(formulario.datos.correo), String(formulario.datos.password)),
          );
        }}
      >
        {formulario.errores.general && <AvisoEnLinea tono="peligro" rol="alert">{<p>{formulario.errores.general}</p>}</AvisoEnLinea>}
        <Campo definicion={CAMPO_CORREO} valor={formulario.datos.correo} error={formulario.errores.correo} datos={formulario.datos} al_cambiar={formulario.cambiar} />
        <CampoContrasena nombre="password" etiqueta="Contraseña" valor={formulario.datos.password} error={formulario.errores.password} al_cambiar={formulario.cambiar} autocompletar="current-password" />
        <BotonEnProceso type="submit" en_proceso={formulario.en_proceso} className="boton boton_primario boton_grande">
          {!formulario.en_proceso && <LogIn size={20} aria-hidden="true" />} Iniciar sesión
        </BotonEnProceso>
        <div className="fila separado texto_pequeno">
          <Link to="/recuperar-contrasena">¿Olvidaste tu contraseña?</Link>
          <Link to="/registro">Crear una cuenta</Link>
        </div>
      </form>
    </DisenoAutenticacion>
  );
}

const CAMPOS_REGISTRO: DefinicionCampo[] = [
  { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'texto', requerido: true },
  { nombre: 'apellido', etiqueta: 'Apellido', tipo: 'texto', requerido: true },
  CAMPO_CORREO,
  { nombre: 'telefono', etiqueta: 'Teléfono', tipo: 'telefono', requerido: true, ayuda: 'Entre 7 y 20 dígitos.' },
];

export function PaginaRegistro() {
  const { usuario } = useSesion();
  const navegar = useNavigate();
  const { mostrar_aviso } = useAvisos();
  const formulario = useFormularioSimple({ nombre: '', apellido: '', correo: '', telefono: '', password: '', confirmacion_password: '' });
  if (usuario) return <Navigate to="/" replace />;
  return (
    <DisenoAutenticacion titulo="Crear cuenta" descripcion="Las cuentas nuevas tienen rol «usuario» (consulta). Un funcionario o administrador puede asignar otros permisos.">
      <form
        className="pila"
        noValidate
        onSubmit={(evento) => {
          evento.preventDefault();
          void formulario.ejecutar(
            () => ({ ...validar_datos(formulario.datos, ESQUEMA_REGISTRO).errores, ...validar_contrasena(formulario.datos.password, formulario.datos.confirmacion_password) }),
            async () => {
              const mensaje = await servicio_autenticacion.registrar(formulario.datos);
              mostrar_aviso({ tipo: 'exito', titulo: mensaje });
              navegar('/iniciar-sesion');
            },
          );
        }}
      >
        {formulario.errores.general && <AvisoEnLinea tono="peligro" rol="alert">{<p>{formulario.errores.general}</p>}</AvisoEnLinea>}
        <div className="formulario_rejilla">
          {CAMPOS_REGISTRO.map((campo) => (
            <Campo key={campo.nombre} definicion={campo} valor={formulario.datos[campo.nombre]} error={formulario.errores[campo.nombre]} datos={formulario.datos} al_cambiar={formulario.cambiar} />
          ))}
        </div>
        <CampoContrasena nombre="password" etiqueta="Contraseña" valor={formulario.datos.password} error={formulario.errores.password} al_cambiar={formulario.cambiar} autocompletar="new-password" />
        <p className="ayuda_campo">Mínimo 8 caracteres, con al menos una letra y un número.</p>
        <CampoContrasena nombre="confirmacion_password" etiqueta="Confirmar contraseña" valor={formulario.datos.confirmacion_password} error={formulario.errores.confirmacion_password} al_cambiar={formulario.cambiar} autocompletar="new-password" />
        <BotonEnProceso type="submit" en_proceso={formulario.en_proceso} className="boton boton_primario boton_grande">
          {!formulario.en_proceso && <UserPlus size={20} aria-hidden="true" />} Crear cuenta
        </BotonEnProceso>
        <p className="texto_pequeno">
          ¿Ya tienes cuenta? <Link to="/iniciar-sesion">Inicia sesión</Link>
        </p>
      </form>
    </DisenoAutenticacion>
  );
}

export function PaginaRecuperarContrasena() {
  const formulario = useFormularioSimple({ correo: '' });
  const [resultado, establecer_resultado] = useState<{ mensaje: string; correo_configurado: boolean } | null>(null);
  return (
    <DisenoAutenticacion titulo="¿Olvidaste tu contraseña?" descripcion="Te enviaremos un enlace de un solo uso, válido durante 30 minutos.">
      {resultado ? (
        <div className="pila">
          <AvisoEnLinea tono="primario" titulo="Solicitud recibida" rol="status">
            <p>{resultado.mensaje}</p>
          </AvisoEnLinea>
          {!resultado.correo_configurado && (
            <AvisoEnLinea tono="advertencia" titulo="Envío no verificado">
              <p>El servidor no tiene un servicio de correo configurado, por lo que el enlace no pudo enviarse. Comunícate con el administrador del sistema.</p>
            </AvisoEnLinea>
          )}
          <Link to="/iniciar-sesion" className="boton">
            Volver a iniciar sesión
          </Link>
        </div>
      ) : (
        <form
          className="pila"
          noValidate
          onSubmit={(evento) => {
            evento.preventDefault();
            void formulario.ejecutar(
              () => validar_datos(formulario.datos, ESQUEMA_SOLICITUD_RECUPERACION).errores,
              async () => establecer_resultado(await servicio_autenticacion.solicitar_recuperacion(String(formulario.datos.correo))),
            );
          }}
        >
          {formulario.errores.general && <AvisoEnLinea tono="peligro" rol="alert">{<p>{formulario.errores.general}</p>}</AvisoEnLinea>}
          <Campo definicion={CAMPO_CORREO} valor={formulario.datos.correo} error={formulario.errores.correo} datos={formulario.datos} al_cambiar={formulario.cambiar} />
          <BotonEnProceso type="submit" en_proceso={formulario.en_proceso} className="boton boton_primario boton_grande">
            {!formulario.en_proceso && <Mail size={20} aria-hidden="true" />} Enviar enlace
          </BotonEnProceso>
          <Link to="/iniciar-sesion" className="texto_pequeno">
            Volver a iniciar sesión
          </Link>
        </form>
      )}
    </DisenoAutenticacion>
  );
}

export function PaginaRestablecerContrasena() {
  const [parametros] = useSearchParams();
  const navegar = useNavigate();
  const { mostrar_aviso } = useAvisos();
  // Se conserva en memoria: después se retira de la barra de direcciones.
  const [token] = useState(() => parametros.get('token') ?? '');
  const formulario = useFormularioSimple({ password: '', confirmacion_password: '' });
  useEffect(() => {
    // El token no debe quedar visible en el historial ni en la barra de direcciones.
    if (token) window.history.replaceState(null, '', '/restablecer-contrasena');
  }, [token]);
  return (
    <DisenoAutenticacion titulo="Restablecer contraseña" descripcion="Escribe tu nueva contraseña. El enlace sólo puede usarse una vez.">
      {!token ? (
        <AvisoEnLinea tono="advertencia" titulo="Enlace incompleto">
          <p>
            Abre el enlace completo que recibiste por correo o <Link to="/recuperar-contrasena">solicita uno nuevo</Link>.
          </p>
        </AvisoEnLinea>
      ) : (
        <form
          className="pila"
          noValidate
          onSubmit={(evento) => {
            evento.preventDefault();
            const cuerpo = { token, ...formulario.datos };
            void formulario.ejecutar(
              () => ({ ...validar_datos(cuerpo, ESQUEMA_RESTABLECER).errores, ...validar_contrasena(formulario.datos.password, formulario.datos.confirmacion_password) }),
              async () => {
                mostrar_aviso({ tipo: 'exito', titulo: await servicio_autenticacion.restablecer(cuerpo) });
                navegar('/iniciar-sesion');
              },
            );
          }}
        >
          {(formulario.errores.general || formulario.errores.token) && (
            <AvisoEnLinea tono="peligro" rol="alert">
              <p>{formulario.errores.token || formulario.errores.general}</p>
              <p>
                <Link to="/recuperar-contrasena">Solicitar un enlace nuevo</Link>
              </p>
            </AvisoEnLinea>
          )}
          <CampoContrasena nombre="password" etiqueta="Nueva contraseña" valor={formulario.datos.password} error={formulario.errores.password} al_cambiar={formulario.cambiar} autocompletar="new-password" />
          <CampoContrasena nombre="confirmacion_password" etiqueta="Confirmar contraseña" valor={formulario.datos.confirmacion_password} error={formulario.errores.confirmacion_password} al_cambiar={formulario.cambiar} autocompletar="new-password" />
          <BotonEnProceso type="submit" en_proceso={formulario.en_proceso} className="boton boton_primario boton_grande">
            Guardar nueva contraseña
          </BotonEnProceso>
        </form>
      )}
    </DisenoAutenticacion>
  );
}
