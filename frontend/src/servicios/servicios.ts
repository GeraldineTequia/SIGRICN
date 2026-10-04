import type {
  Alerta,
  CoincidenciaGeocodificacion,
  CuentaDirectorio,
  ElementoMapa,
  Emergencia,
  HistorialEstado,
  IndicadoresTablero,
  RegistroBase,
  SerieMensual,
  Usuario,
  Zona,
} from '../tipos/api';
import { descargar, establecer_token_csrf, solicitar } from './cliente_api';
import { crear_servicio_entidad, type ParametrosListado } from './servicio_entidad';

/* ------------------------------ Autenticación ------------------------------ */
export interface DatosSesion {
  usuario: Usuario;
  token_csrf: string;
  inactividad_minutos: number;
}

export const servicio_autenticacion = {
  async consultar_sesion(): Promise<DatosSesion> {
    const respuesta = await solicitar<DatosSesion>('/auth/sesion', { silenciar_expiracion: true, automatica: true });
    establecer_token_csrf(respuesta.datos.token_csrf);
    return respuesta.datos;
  },
  async iniciar_sesion(correo: string, password: string): Promise<{ datos: DatosSesion; mensaje: string }> {
    const respuesta = await solicitar<DatosSesion>('/auth/inicio-sesion', { metodo: 'POST', cuerpo: { correo, password }, silenciar_expiracion: true });
    establecer_token_csrf(respuesta.datos.token_csrf);
    return { datos: respuesta.datos, mensaje: respuesta.mensaje ?? 'Sesión iniciada.' };
  },
  async cerrar_sesion(): Promise<void> {
    await solicitar('/auth/cierre-sesion', { metodo: 'POST', silenciar_expiracion: true });
    establecer_token_csrf('');
  },
  async registrar(datos: Record<string, unknown>): Promise<string> {
    return (await solicitar('/auth/registro', { metodo: 'POST', cuerpo: datos, silenciar_expiracion: true })).mensaje ?? 'Cuenta creada.';
  },
  async solicitar_recuperacion(correo: string): Promise<{ mensaje: string; correo_configurado: boolean }> {
    const respuesta = await solicitar<{ correo_configurado: boolean }>('/auth/recuperar-contrasena', { metodo: 'POST', cuerpo: { correo }, silenciar_expiracion: true });
    return { mensaje: respuesta.mensaje ?? '', correo_configurado: respuesta.datos.correo_configurado };
  },
  async restablecer(datos: Record<string, unknown>): Promise<string> {
    return (await solicitar('/auth/restablecer-contrasena', { metodo: 'POST', cuerpo: datos, silenciar_expiracion: true })).mensaje ?? 'Contraseña actualizada.';
  },
  /** Registra actividad del usuario cuando trabaja sin generar solicitudes (por ejemplo, llenando un formulario). */
  async registrar_actividad(): Promise<void> {
    await solicitar('/auth/actividad', { metodo: 'POST' });
  },
};

/* ------------------------------ Entidades ------------------------------ */
export const servicio_emergencias = {
  ...crear_servicio_entidad<Emergencia>('/emergencias'),
  async cambiar_estado(id: string, estado: string, observacion?: string) {
    const respuesta = await solicitar<Emergencia>(`/emergencias/${id}/transiciones`, { metodo: 'POST', cuerpo: { estado, ...(observacion ? { observacion } : {}) } });
    return { registro: respuesta.datos, mensaje: respuesta.mensaje ?? 'Estado actualizado.' };
  },
  async historial(id: string): Promise<HistorialEstado[]> {
    return (await solicitar<HistorialEstado[]>(`/emergencias/${id}/historial`)).datos;
  },
};

export const servicio_zonas = {
  ...crear_servicio_entidad<Zona>('/zonas'),
  async cambiar_atencion(id: string, estado_atencion: string, observacion?: string) {
    const respuesta = await solicitar<Zona>(`/zonas/${id}/atencion`, { metodo: 'PATCH', cuerpo: { estado_atencion, ...(observacion ? { observacion } : {}) } });
    return { registro: respuesta.datos, mensaje: respuesta.mensaje ?? 'Estado de atención actualizado.' };
  },
  async historial(id: string): Promise<HistorialEstado[]> {
    return (await solicitar<HistorialEstado[]>(`/zonas/${id}/historial`)).datos;
  },
  async prioridad_sugerida(id: string): Promise<{ prioridad: string; motivos: string[] }> {
    return (await solicitar<{ prioridad: string; motivos: string[] }>(`/zonas/${id}/prioridad-sugerida`)).datos;
  },
};

export const servicio_poblacion = crear_servicio_entidad<RegistroBase>('/poblacion-afectada');
export const servicio_familias = crear_servicio_entidad<RegistroBase>('/familias');
export const servicio_personas = {
  ...crear_servicio_entidad<RegistroBase>('/personas-afectadas'),
  async resumen(catastrofe_id?: string): Promise<{ total_registradas: number; por_grupo_edad: Record<string, number>; por_condicion_vulnerabilidad: Record<string, number> }> {
    return (await solicitar<{ total_registradas: number; por_grupo_edad: Record<string, number>; por_condicion_vulnerabilidad: Record<string, number> }>('/personas-afectadas/resumen', { parametros: { catastrofe_id } })).datos;
  },
};
export const servicio_necesidades = crear_servicio_entidad<RegistroBase>('/necesidades');
export const servicio_centros = crear_servicio_entidad<RegistroBase>('/centros-donacion');

export const servicio_donaciones = {
  ...crear_servicio_entidad<RegistroBase>('/donaciones'),
  async cambiar_estado(id: string, estado: string) {
    const respuesta = await solicitar<RegistroBase>(`/donaciones/${id}/estado`, { metodo: 'PATCH', cuerpo: { estado } });
    return { registro: respuesta.datos, mensaje: respuesta.mensaje ?? 'Estado actualizado.' };
  },
};

/* ------------------------------ Cuentas ------------------------------ */
export const servicio_cuentas = {
  ...crear_servicio_entidad<CuentaDirectorio>('/usuarios'),
  async cambiar_rol(id: string, rol: string) {
    return (await solicitar<CuentaDirectorio>(`/usuarios/${id}/rol`, { metodo: 'PATCH', cuerpo: { rol } })).mensaje ?? 'Rol actualizado.';
  },
  async cambiar_estado(id: string, estado: string) {
    return (await solicitar<CuentaDirectorio>(`/usuarios/${id}/estado`, { metodo: 'PATCH', cuerpo: { estado } })).mensaje ?? 'Estado actualizado.';
  },
};

/* --------------------------- Consultas generales --------------------------- */
export const servicio_tablero = {
  async indicadores(parametros: ParametrosListado = {}, automatica = false): Promise<IndicadoresTablero> {
    return (await solicitar<IndicadoresTablero>('/tablero/indicadores', { parametros, automatica })).datos;
  },
  async serie_mensual(parametros: ParametrosListado = {}, automatica = false): Promise<SerieMensual> {
    return (await solicitar<SerieMensual>('/tablero/serie-mensual', { parametros, automatica })).datos;
  },
};

export const servicio_mapa = {
  async consultar(parametros: ParametrosListado = {}, automatica = false): Promise<{ elementos: ElementoMapa[]; pendientes_ubicacion: number }> {
    return (await solicitar<{ elementos: ElementoMapa[]; pendientes_ubicacion: number }>('/mapa', { parametros, automatica })).datos;
  },
};

export const servicio_geocodificacion = {
  async buscar(parametros: Record<string, string>): Promise<{ coincidencias: CoincidenciaGeocodificacion[]; atribucion: string }> {
    return (await solicitar<{ coincidencias: CoincidenciaGeocodificacion[]; atribucion: string }>('/geocodificacion', { parametros })).datos;
  },
  async inversa(latitud: number, longitud: number): Promise<string | null> {
    return (await solicitar<{ direccion_aproximada: string | null }>('/geocodificacion/inversa', { parametros: { latitud, longitud } })).datos.direccion_aproximada;
  },
};

export const servicio_alertas = {
  async listar(parametros: ParametrosListado = {}, automatica = false): Promise<{ elementos: Alerta[]; no_leidas: number }> {
    return (await solicitar<{ elementos: Alerta[]; no_leidas: number }>('/alertas', { parametros, automatica })).datos;
  },
  async marcar_leida(id: string): Promise<void> {
    await solicitar(`/alertas/${id}/lectura`, { metodo: 'PATCH' });
  },
  async marcar_todas(): Promise<string> {
    return (await solicitar('/alertas/lectura-masiva', { metodo: 'POST' })).mensaje ?? 'Alertas marcadas como leídas.';
  },
  async resumen_entrega(): Promise<{ total_alertas: number; lecturas_registradas: number; leidas: number }> {
    return (await solicitar<{ total_alertas: number; lecturas_registradas: number; leidas: number }>('/alertas/resumen-entrega', { automatica: true })).datos;
  },
};

export const servicio_catalogos = {
  async ubicaciones(): Promise<{ departamentos: string[]; municipios: { departamento: string; municipio: string }[] }> {
    return (await solicitar<{ departamentos: string[]; municipios: { departamento: string; municipio: string }[] }>('/catalogos/ubicaciones', { automatica: true })).datos;
  },
  async buscar(texto: string): Promise<{ tipo: string; id: string; titulo: string; subtitulo: string }[]> {
    return (await solicitar<{ tipo: string; id: string; titulo: string; subtitulo: string }[]>('/busqueda', { parametros: { q: texto } })).datos;
  },
};

export const servicio_reportes_pdf = {
  generar: (parametros: Record<string, string>) => descargar('/reportes-pdf', parametros),
};
