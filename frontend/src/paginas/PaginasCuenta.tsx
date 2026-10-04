import { BookOpen, Lock, Mail, Search, Shield, ShieldCheck, User } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PERMISOS, type Permiso } from '@dominio/reglas/permisos';
import { BotonEnProceso } from '../componentes/formularios/DialogoConfirmacion';
import { EncabezadoPagina, useTituloPagina } from '../componentes/navegacion/DisenoPrincipal';
import { AvisoEnLinea, EstadoVacio, UltimaActualizacion } from '../componentes/tarjetas/Estados';
import { Insignia } from '../componentes/tarjetas/Insignia';
import { useAvisos } from '../contextos/ContextoAvisos';
import { useSesion, useUsuarioActual } from '../contextos/ContextoSesion';
import { useTema } from '../contextos/ContextoTema';
import { useTiempoReal } from '../contextos/ContextoTiempoReal';
import { servicio_autenticacion } from '../servicios/servicios';
import { guardar_preferencia, leer_preferencia } from '../utilidades/almacenamiento_local';
import { formatear_fecha, iniciales, obtener_etiqueta } from '../utilidades/formato';

const MODULOS_POR_PERMISO: Partial<Record<Permiso, string>> = {
  consultar_informacion_operativa: 'Consulta de emergencias, zonas, recursos y donaciones',
  editar_registros_operativos: 'Registro y edición operativa',
  cambiar_estados: 'Cambios de estado',
  gestionar_recursos_y_fondos: 'Recursos, asignaciones y fondos',
  administrar_cuentas: 'Usuarios y roles',
  consultar_datos_restringidos: 'Datos personales restringidos',
};

/**
 * Mi perfil. Es de sólo lectura: el rol "usuario" sólo puede realizar operaciones de su propia
 * autenticación; el cambio de contraseña usa el flujo seguro de recuperación por correo.
 */
export function PaginaPerfil() {
  useTituloPagina('Mi cuenta', 'Perfil');
  const usuario = useUsuarioActual();
  const { inactividad_minutos } = useSesion();
  const { mostrar_aviso } = useAvisos();
  const [enviando, establecer_enviando] = useState(false);
  const permisos = (Object.keys(PERMISOS) as Permiso[]).filter((permiso) => (PERMISOS[permiso] as readonly string[]).includes(usuario.rol) && MODULOS_POR_PERMISO[permiso]);

  const solicitar_cambio = async () => {
    establecer_enviando(true);
    try {
      const resultado = await servicio_autenticacion.solicitar_recuperacion(usuario.correo);
      mostrar_aviso({
        tipo: resultado.correo_configurado ? 'exito' : 'advertencia',
        titulo: resultado.correo_configurado ? 'Enlace solicitado' : 'Envío no verificado',
        mensaje: resultado.correo_configurado ? 'Revisa tu correo para cambiar la contraseña.' : 'El servidor no tiene correo configurado; comunícate con el administrador.',
        persistente: !resultado.correo_configurado,
      });
    } catch (causa) {
      mostrar_aviso({ tipo: 'error', titulo: 'No se pudo solicitar el cambio', mensaje: causa instanceof Error ? causa.message : undefined });
    } finally {
      establecer_enviando(false);
    }
  };

  return (
    <>
      <EncabezadoPagina titulo="Mi perfil" descripcion="Datos personales, rol y seguridad de tu cuenta." migas={[{ texto: 'Administración' }, { texto: 'Mi perfil' }]} />
      <div className="dos_columnas">
        <section className="tarjeta pila" aria-labelledby="titulo-informacion">
          <div className="tarjeta_encabezado" style={{ marginBottom: 0 }}>
            <h2 id="titulo-informacion">
              <User size={20} aria-hidden="true" /> Información personal
            </h2>
            <Insignia tono="primario" texto={`Cuenta ${obtener_etiqueta(usuario.estado).toLowerCase()}`} />
          </div>
          <div className="fila">
            <span className="avatar" aria-hidden="true" style={{ width: 56, height: 56, fontSize: '1.2rem' }}>
              {iniciales(usuario.nombre, usuario.apellido)}
            </span>
            <div>
              <span className="etiqueta_campo">Nombre completo</span>
              <p style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--color_titulo)' }}>
                {usuario.nombre} {usuario.apellido}
              </p>
            </div>
          </div>
          <dl className="metadatos" style={{ gap: 10 }}>
            <div>
              <dt>Correo</dt>
              <dd>{usuario.correo}</dd>
            </div>
            <div>
              <dt>Rol</dt>
              <dd>{obtener_etiqueta(usuario.rol)}</dd>
            </div>
            <div>
              <dt>Permisos</dt>
              <dd>{permisos.map((permiso) => MODULOS_POR_PERMISO[permiso]).join(' · ')}</dd>
            </div>
          </dl>
          <AvisoEnLinea tono="primario">
            <p>Para corregir tus datos personales o tu rol, solicita el cambio a un funcionario o administrador (queda auditado).</p>
          </AvisoEnLinea>
          <div className="tarjeta_lista">
            <span className="icono_indicador" data-tono="advertencia" aria-hidden="true">
              <Lock size={18} />
            </span>
            <div className="cuerpo">
              <strong>Seguridad</strong>
              <small>Cambio de contraseña mediante un enlace de un solo uso enviado a tu correo.</small>
            </div>
            <BotonEnProceso type="button" en_proceso={enviando} className="boton boton_pequeno" onClick={solicitar_cambio}>
              <Mail size={15} aria-hidden="true" /> Actualizar
            </BotonEnProceso>
          </div>
        </section>
        <aside className="panel_control">
          <div className="tarjeta pila">
            <h2 className="fila">
              <Shield size={20} aria-hidden="true" /> Panel de control
            </h2>
            <ul className="lista_resumen">
              <li>
                Rol vigente <strong>{obtener_etiqueta(usuario.rol)}</strong>
              </li>
              <li>
                Cierre por inactividad <strong>{inactividad_minutos} minutos</strong>
              </li>
              <li>
                Sesión <strong>Activa en este navegador</strong>
              </li>
            </ul>
            <Link to="/configuracion" className="boton">
              Preferencias de la interfaz
            </Link>
            <UltimaActualizacion fecha={new Date()} />
          </div>
        </aside>
      </div>
    </>
  );
}

function Interruptor({ etiqueta, activo, al_cambiar, descripcion }: { etiqueta: string; activo: boolean; al_cambiar: (valor: boolean) => void; descripcion?: string }) {
  return (
    <div className="tarjeta_lista">
      <div className="cuerpo">
        <strong id={`interruptor-${etiqueta}`}>{etiqueta}</strong>
        {descripcion && <small>{descripcion}</small>}
      </div>
      <button type="button" role="switch" className="interruptor" aria-checked={activo} aria-labelledby={`interruptor-${etiqueta}`} onClick={() => al_cambiar(!activo)} />
    </div>
  );
}

/** Configuración de la interfaz (RNF13): preferencias guardadas en este navegador. */
export function PaginaConfiguracion() {
  useTituloPagina('Configuración', 'Sistema y soporte');
  const { tema, establecer_tema } = useTema();
  const { estado_conexion, ultima_sincronizacion } = useTiempoReal();
  const { inactividad_minutos } = useSesion();
  const { mostrar_aviso } = useAvisos();
  const [lateral, establecer_lateral] = useState<boolean>(() => leer_preferencia('lateral_colapsada', false));
  return (
    <>
      <EncabezadoPagina titulo="Configuración" descripcion="Preferencias y continuidad del sistema." migas={[{ texto: 'E · Cuenta, sistema y soporte' }, { texto: 'Configuración' }]} />
      <div className="dos_columnas">
        <section className="tarjeta pila" aria-label="Preferencias">
          <h2>Modo claro / oscuro y accesibilidad</h2>
          <Interruptor etiqueta="Modo oscuro" activo={tema === 'oscuro'} al_cambiar={(activo) => establecer_tema(activo ? 'oscuro' : 'claro')} descripcion="Conserva la identidad y el contraste en ambos modos." />
          <Interruptor etiqueta="Barra lateral compacta" activo={lateral} al_cambiar={establecer_lateral} descripcion="Muestra sólo los iconos del menú (se aplica al recargar)." />
          <h2>Seguridad y sincronización</h2>
          <ul className="lista_resumen">
            <li>
              Cierre por inactividad <strong>{inactividad_minutos} minutos</strong>
            </li>
            <li>
              Tiempo real (SSE) <strong>{estado_conexion === 'conectado' ? 'Conectado' : 'Reconectando'}</strong>
            </li>
            <li>
              Último cambio recibido <strong>{ultima_sincronizacion ? formatear_fecha(ultima_sincronizacion, true) : 'Sin cambios desde que abriste la sesión'}</strong>
            </li>
            <li>
              Idioma · zona horaria · moneda <strong>Español (Colombia) · America/Bogota · COP</strong>
            </li>
          </ul>
        </section>
        <aside className="panel_control">
          <div className="tarjeta pila">
            <p>Las preferencias se guardan sólo en este navegador.</p>
            <button
              type="button"
              className="boton boton_primario boton_grande"
              onClick={() => {
                guardar_preferencia('lateral_colapsada', lateral);
                mostrar_aviso({ tipo: 'exito', titulo: 'Preferencias guardadas' });
              }}
            >
              Guardar preferencias
            </button>
            <UltimaActualizacion fecha={new Date()} />
          </div>
        </aside>
      </div>
    </>
  );
}

const ARTICULOS_AYUDA = [
  { titulo: 'Registrar una emergencia', texto: 'Emergencias → «Registrar emergencia». Completa los campos obligatorios; si el tipo es terremoto, indica la magnitud (mínimo 5.0). Busca la dirección y confirma el marcador.' },
  { titulo: 'Cambiar el estado de una emergencia', texto: 'En el detalle, usa «Cambiar estado». El ciclo es activa → en atención → controlada → finalizada; las demás transiciones se rechazan.' },
  { titulo: 'Ubicar un registro en el mapa', texto: 'Escribe país, departamento, municipio, barrio y dirección; pulsa «Buscar dirección», elige la coincidencia, ajusta el marcador si es necesario y «Confirmar ubicación». Si no hay resultados, señala el lugar o guarda como pendiente.' },
  { titulo: 'Clasificar población', texto: 'Zonas → pestaña «Población». Los grupos de edad no pueden superar el total; las personas sin edad quedan pendientes en «Población afectada».' },
  { titulo: 'Asignar recursos', texto: 'La gestión de recursos comprueba la disponibilidad antes de registrar una operación.' },
  { titulo: 'Registrar movimientos de fondos', texto: 'Fondos → selecciona el fondo → «Registrar movimiento». Un gasto puede ejecutar un compromiso sin descontarlo dos veces.' },
  { titulo: 'Generar reporte PDF', texto: 'Informes → Reportes PDF. Elige categorías y filtros. El reporte incluye sólo lo que tu rol puede consultar.' },
  { titulo: 'Glosario', texto: 'Afectación: porcentaje del área dañada. Atención: estado del trabajo en la zona. Disponibilidad: existencias frente al mínimo operativo. Prioridad: urgencia definida por el funcionario. Vulnerabilidad: condición que exige atención especial.' },
  { titulo: 'Documentación técnica', texto: 'Arquitectura, base de datos, configuración, integraciones, instalación y mantenimiento están en README.md y en la carpeta docs/ del proyecto.' },
];

export function PaginaAyuda() {
  useTituloPagina('Ayuda y documentación', 'E · Cuenta, sistema y soporte');
  const [busqueda, establecer_busqueda] = useState('');
  const resultados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return texto ? ARTICULOS_AYUDA.filter((articulo) => `${articulo.titulo} ${articulo.texto}`.toLowerCase().includes(texto)) : ARTICULOS_AYUDA;
  }, [busqueda]);
  return (
    <>
      <EncabezadoPagina titulo="Ayuda y documentación" descripcion="Guías y referencia operativa / técnica." migas={[{ texto: 'E · Cuenta, sistema y soporte' }, { texto: 'Ayuda' }]} />
      <section className="tarjeta pila">
        <div className="campo">
          <label htmlFor="buscar-ayuda">Buscador de ayuda</label>
          <div className="fila" style={{ flexWrap: 'nowrap' }}>
            <input id="buscar-ayuda" className="control" type="search" placeholder="Ejemplo: asignar recursos" value={busqueda} onChange={(evento) => establecer_busqueda(evento.target.value)} />
            <Search size={20} aria-hidden="true" />
          </div>
        </div>
        <p aria-live="polite" className="texto_suave">
          {resultados.length} guía(s) encontrada(s).
        </p>
        {resultados.length === 0 ? (
          <EstadoVacio texto="No encontramos guías con ese texto." />
        ) : (
          <ul className="lista_tarjetas">
            {resultados.map((articulo) => (
              <li key={articulo.titulo}>
                <details className="tarjeta_lista" style={{ display: 'block' }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 700, color: 'var(--color_titulo)' }}>
                    <BookOpen size={16} aria-hidden="true" style={{ display: 'inline', marginRight: 8 }} />
                    {articulo.titulo}
                  </summary>
                  <p style={{ marginTop: 8 }}>{articulo.texto}</p>
                </details>
              </li>
            ))}
          </ul>
        )}
        <Insignia tono="advertencia" texto="Centro de ayuda disponible" sin_icono />
      </section>
    </>
  );
}

export function PaginaEquipo() {
  useTituloPagina('Equipo de desarrollo', 'E · Cuenta, sistema y soporte');
  return (
    <>
      <EncabezadoPagina titulo="Equipo de desarrollo" descripcion="Politécnico Colombiano Jaime Isaza Cadavid · 2026" migas={[{ texto: 'E · Cuenta, sistema y soporte' }, { texto: 'Equipo' }]} />
      <div className="dos_columnas">
        <section className="tarjeta pila">
          <ul className="lista_resumen">
            {['Mateo Monsalve Pino', 'Nataly Iriarte Castillo', 'Jesber Nair Quinto Cordoba', 'Juan Andres Garcia Sepulveda', 'Maria Geraldine Tequia Rivera'].map((nombre) => (
              <li key={nombre}>{nombre}</li>
            ))}
          </ul>
          <Insignia tono="advertencia" texto="SGRICN · Proyecto académico 2026" sin_icono />
        </section>
        <aside className="panel_control">
          <div className="tarjeta pila">
            <h2 className="fila">
              <ShieldCheck size={20} aria-hidden="true" /> Tecnologías
            </h2>
            <p>MongoDB · Mongoose · Node.js · Express · TypeScript · React · Vite · Leaflet · OpenStreetMap · Chart.js · PDFKit</p>
            <p className="texto_suave">Arquitectura en capas · patrones Strategy y State · RF1–RF24 · RNF1–RNF15</p>
            <Link to="/ayuda" className="boton boton_primario">
              Ver documentación técnica
            </Link>
          </div>
        </aside>
      </div>
    </>
  );
}

export function PaginaNoEncontrada() {
  useTituloPagina('Página no encontrada');
  return (
    <section className="tarjeta pila" style={{ maxWidth: 560 }}>
      <h1>Página no encontrada</h1>
      <p>La dirección no existe o el registro fue eliminado.</p>
      <Link to="/" className="boton boton_primario">
        Volver al centro de mando
      </Link>
    </section>
  );
}
