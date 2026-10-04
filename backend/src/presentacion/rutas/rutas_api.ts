import { Router } from 'express';
import multer from 'multer';
import type { Contenedor } from '../../composicion/contenedor';
import * as catalogo from '../../dominio/reglas/catalogos';
import { PERMISOS } from '../../dominio/reglas/permisos';
import { MAGNITUD_MINIMA_TERREMOTO, MENSAJE_MAGNITUD_TERREMOTO } from '../../dominio/reglas/regla_magnitud';
import { RANGOS_EDAD } from '../../dominio/reglas/poblacion';
import { TRANSICIONES_ATENCION_ZONA } from '../../dominio/estados/estados_atencion_zona';
import { TIPOS_EVIDENCIA_PERMITIDOS } from '../../infraestructura/almacenamiento/AlmacenEvidenciasDisco';
import { verificar_mongodb } from '../../infraestructura/persistencia/conexion';
import { crear_rutas_autenticacion } from '../controladores/controlador_autenticacion';
import { crear_rutas_entidad } from '../controladores/controlador_entidad';
import { crear_controlador_eventos } from '../controladores/controlador_eventos';
import { asincrono, leer_identificador, leer_parametros, responder, responder_listado } from '../controladores/utilidades_http';
import { CABECERA_AUTOMATICA, obtener_contexto, requerir_autenticacion, requerir_permiso } from '../middlewares/autenticacion';
import { crear_limites } from '../middlewares/limites';
import { ErrorValidacion } from '../../dominio/errores';

/** Ensambla todas las rutas de la API REST bajo /api. */
export function crear_rutas_api(contenedor: Contenedor): Router {
  const api = Router();
  const { configuracion } = contenedor;
  const limites = crear_limites(configuracion.es_prueba);
  const autenticado = requerir_autenticacion(contenedor.autenticacion, configuracion.sesion_inactividad_ms);
  const consulta = requerir_permiso('consultar_informacion_operativa');

  /* ------------------------------ Públicas ------------------------------ */
  api.get(
    '/salud',
    asincrono(async (_solicitud, respuesta) => {
      const mongodb = await verificar_mongodb();
      respuesta.status(mongodb.conectado ? 200 : 503).json({
        exito: mongodb.conectado,
        datos: { servidor: 'activo', mongodb, correo_configurado: contenedor.correo.esta_configurado(), fecha: new Date().toISOString() },
      });
    }),
  );
  api.use('/auth', crear_rutas_autenticacion(contenedor, limites));

  /* --------------------------- Desde aquí: 401 --------------------------- */
  api.use(autenticado);

  api.get('/eventos', (solicitud, _respuesta, siguiente) => {
    // El canal SSE es automático: no debe contar como actividad del usuario.
    solicitud.headers[CABECERA_AUTOMATICA] = '1';
    siguiente();
  }, crear_controlador_eventos(contenedor.publicador, contenedor.autenticacion, configuracion.sesion_inactividad_ms));

  api.get('/catalogos/valores', consulta, (_solicitud, respuesta) => {
    responder(respuesta, {
      roles: catalogo.ROLES,
      tipos_emergencia: catalogo.TIPOS_EMERGENCIA,
      niveles: catalogo.NIVELES_EMERGENCIA,
      estados_emergencia: catalogo.ESTADOS_EMERGENCIA,
      equivalencias_estado_heredado: catalogo.EQUIVALENCIAS_ESTADO_HEREDADO,
      transiciones_atencion_zona: TRANSICIONES_ATENCION_ZONA,
      rangos_edad: RANGOS_EDAD,
      magnitud_minima_terremoto: MAGNITUD_MINIMA_TERREMOTO,
      mensaje_magnitud: MENSAJE_MAGNITUD_TERREMOTO,
      permisos: PERMISOS,
      tipos_evidencia: TIPOS_EVIDENCIA_PERMITIDOS,
      moneda: catalogo.MONEDA,
    });
  });
  api.get(
    '/catalogos/ubicaciones',
    asincrono(async (solicitud, respuesta) => responder(respuesta, await contenedor.busqueda.ubicaciones(obtener_contexto(solicitud)))),
  );
  api.get(
    '/busqueda',
    asincrono(async (solicitud, respuesta) => responder(respuesta, await contenedor.busqueda.buscar(leer_parametros(solicitud), obtener_contexto(solicitud)))),
  );

  /* ------------------------- Dashboard y mapa ------------------------- */
  api.get(
    '/tablero/indicadores',
    requerir_permiso('consultar_mapa_y_dashboard'),
    asincrono(async (solicitud, respuesta) => responder(respuesta, await contenedor.tablero.indicadores(leer_parametros(solicitud), obtener_contexto(solicitud)))),
  );
  api.get(
    '/tablero/serie-mensual',
    requerir_permiso('consultar_mapa_y_dashboard'),
    asincrono(async (solicitud, respuesta) => responder(respuesta, await contenedor.tablero.serie_mensual(leer_parametros(solicitud), obtener_contexto(solicitud)))),
  );
  api.get(
    '/mapa',
    requerir_permiso('consultar_mapa_y_dashboard'),
    asincrono(async (solicitud, respuesta) => responder(respuesta, await contenedor.mapa.consultar(leer_parametros(solicitud), obtener_contexto(solicitud)))),
  );

  /* --------------------------- Geocodificación --------------------------- */
  api.get(
    '/geocodificacion',
    requerir_permiso('editar_registros_operativos'),
    limites.geocodificacion,
    asincrono(async (solicitud, respuesta) => {
      const coincidencias = await contenedor.geocodificacion.buscar(leer_parametros(solicitud), obtener_contexto(solicitud));
      responder(respuesta, { coincidencias, atribucion: '© OpenStreetMap contributors · Nominatim' });
    }),
  );
  api.get(
    '/geocodificacion/inversa',
    requerir_permiso('editar_registros_operativos'),
    limites.geocodificacion,
    asincrono(async (solicitud, respuesta) => responder(respuesta, await contenedor.geocodificacion.inversa(leer_parametros(solicitud), obtener_contexto(solicitud)))),
  );

  /* ------------------------------ Usuarios ------------------------------ */
  const usuarios = Router();
  usuarios.use(requerir_permiso('administrar_cuentas'));
  usuarios.get('/', asincrono(async (solicitud, respuesta) => responder_listado(respuesta, await contenedor.cuentas.listar(leer_parametros(solicitud), obtener_contexto(solicitud)))));
  usuarios.get('/:identificador', asincrono(async (solicitud, respuesta) => responder(respuesta, await contenedor.cuentas.obtener(leer_identificador(solicitud), obtener_contexto(solicitud)))));
  usuarios.patch(
    '/:identificador',
    asincrono(async (solicitud, respuesta) =>
      responder(respuesta, await contenedor.cuentas.editar_datos(leer_identificador(solicitud), solicitud.body, obtener_contexto(solicitud)), 200, 'Datos de la cuenta actualizados.'),
    ),
  );
  usuarios.patch(
    '/:identificador/rol',
    asincrono(async (solicitud, respuesta) =>
      responder(respuesta, await contenedor.cuentas.cambiar_rol(leer_identificador(solicitud), solicitud.body, obtener_contexto(solicitud)), 200, 'Rol actualizado.'),
    ),
  );
  usuarios.patch(
    '/:identificador/estado',
    asincrono(async (solicitud, respuesta) =>
      responder(respuesta, await contenedor.cuentas.cambiar_estado(leer_identificador(solicitud), solicitud.body, obtener_contexto(solicitud)), 200, 'Estado de la cuenta actualizado.'),
    ),
  );
  api.use('/usuarios', usuarios);

  /* ----------------------------- Emergencias ----------------------------- */
  api.use(
    '/emergencias',
    crear_rutas_entidad(contenedor.emergencias, {
      mensajes: { creado: 'Emergencia registrada.', actualizado: 'Emergencia actualizada.', eliminado: 'Emergencia eliminada.' },
      rutas_adicionales: (enrutador) => {
        enrutador.post(
          '/:identificador/transiciones',
          requerir_permiso('cambiar_estados'),
          asincrono(async (solicitud, respuesta) =>
            responder(respuesta, await contenedor.emergencias.cambiar_estado(leer_identificador(solicitud), solicitud.body, obtener_contexto(solicitud)), 200, 'Estado de la emergencia actualizado.'),
          ),
        );
        enrutador.get(
          '/:identificador/historial',
          consulta,
          asincrono(async (solicitud, respuesta) => responder(respuesta, await contenedor.emergencias.historial(leer_identificador(solicitud), obtener_contexto(solicitud)))),
        );
      },
    }),
  );

  /* -------------------------------- Zonas -------------------------------- */
  api.use(
    '/zonas',
    crear_rutas_entidad(contenedor.zonas, {
      mensajes: { creado: 'Zona registrada.', actualizado: 'Zona actualizada.', eliminado: 'Zona eliminada.' },
      rutas_adicionales: (enrutador) => {
        enrutador.patch(
          '/:identificador/atencion',
          requerir_permiso('cambiar_estados'),
          asincrono(async (solicitud, respuesta) =>
            responder(respuesta, await contenedor.zonas.cambiar_estado_atencion(leer_identificador(solicitud), solicitud.body, obtener_contexto(solicitud)), 200, 'Estado de atención actualizado.'),
          ),
        );
        enrutador.get(
          '/:identificador/historial',
          consulta,
          asincrono(async (solicitud, respuesta) => responder(respuesta, await contenedor.zonas.historial(leer_identificador(solicitud), obtener_contexto(solicitud)))),
        );
        enrutador.get(
          '/:identificador/prioridad-sugerida',
          consulta,
          asincrono(async (solicitud, respuesta) => responder(respuesta, await contenedor.zonas.sugerir_prioridad(leer_identificador(solicitud), obtener_contexto(solicitud)))),
        );
      },
    }),
  );

  /* ---------------------- Población, familias, personas ---------------------- */
  api.use('/poblacion-afectada', crear_rutas_entidad(contenedor.poblacion));
  api.use('/familias', crear_rutas_entidad(contenedor.familias));
  api.use(
    '/personas-afectadas',
    crear_rutas_entidad(contenedor.personas, {
      rutas_previas: (enrutador) => {
        // El resumen es agregado (sin datos personales): disponible para cualquier rol autenticado.
        enrutador.get(
          '/resumen',
          consulta,
          asincrono(async (solicitud, respuesta) => {
            const parametros = leer_parametros(solicitud);
            responder(respuesta, await contenedor.personas.resumen(obtener_contexto(solicitud), parametros.catastrofe_id));
          }),
        );
      },
    }),
  );
  api.use('/necesidades', crear_rutas_entidad(contenedor.necesidades));

  /* ------------------------ Centros y donaciones ------------------------ */
  api.use('/centros-donacion', crear_rutas_entidad(contenedor.centros));
  api.use(
    '/donaciones',
    crear_rutas_entidad(contenedor.donaciones, {
      mensajes: { creado: 'Donación registrada (pendiente de verificación).' },
      rutas_adicionales: (enrutador) => {
        enrutador.patch(
          '/:identificador/estado',
          requerir_permiso('registrar_donaciones'),
          asincrono(async (solicitud, respuesta) =>
            responder(respuesta, await contenedor.donaciones.cambiar_estado(leer_identificador(solicitud), solicitud.body, obtener_contexto(solicitud)), 200, 'Estado de la donación actualizado.'),
          ),
        );
      },
    }),
  );

  /* ------------------------- Reportes ciudadanos ------------------------- */
  const carga_evidencia = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: configuracion.evidencia_tamano_maximo_bytes, files: 1 },
    fileFilter: (_solicitud, archivo, aceptar) => aceptar(null, TIPOS_EVIDENCIA_PERMITIDOS.includes(archivo.mimetype)),
  });
  api.use(
    '/reportes-ciudadanos',
    crear_rutas_entidad(contenedor.reportes_ciudadanos, {
      mensajes: { creado: 'Reporte ciudadano registrado como pendiente.' },
      rutas_adicionales: (enrutador) => {
        enrutador.patch(
          '/:identificador/estado',
          requerir_permiso('gestionar_reportes_ciudadanos'),
          asincrono(async (solicitud, respuesta) =>
            responder(respuesta, await contenedor.reportes_ciudadanos.cambiar_estado(leer_identificador(solicitud), solicitud.body, obtener_contexto(solicitud)), 200, 'Estado del reporte actualizado.'),
          ),
        );
        enrutador.post(
          '/:identificador/evidencia',
          requerir_permiso('gestionar_reportes_ciudadanos'),
          carga_evidencia.single('evidencia'),
          asincrono(async (solicitud, respuesta) => {
            if (!solicitud.file) throw new ErrorValidacion({ evidencia: 'Adjunta una imagen JPG, PNG o un PDF de máximo 5 MB.' });
            const actualizado = await contenedor.reportes_ciudadanos.guardar_evidencia(
              leer_identificador(solicitud),
              { nombre_original: solicitud.file.originalname, tipo_mime: solicitud.file.mimetype, contenido: solicitud.file.buffer },
              obtener_contexto(solicitud),
            );
            responder(respuesta, actualizado, 200, 'Evidencia adjuntada.');
          }),
        );
        enrutador.get(
          '/:identificador/evidencia',
          requerir_permiso('consultar_datos_restringidos'),
          asincrono(async (solicitud, respuesta) => {
            const evidencia = await contenedor.reportes_ciudadanos.leer_evidencia(leer_identificador(solicitud), obtener_contexto(solicitud));
            respuesta.setHeader('Content-Type', evidencia.tipo_mime);
            respuesta.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(evidencia.nombre)}"`);
            respuesta.setHeader('X-Content-Type-Options', 'nosniff');
            respuesta.send(Buffer.from(evidencia.contenido));
          }),
        );
      },
    }),
  );

  /* --------------------- Recursos y asignaciones --------------------- */
  api.use(
    '/recursos',
    crear_rutas_entidad(contenedor.recursos, {
      rutas_adicionales: (enrutador) => {
        enrutador.post(
          '/:identificador/movimientos',
          requerir_permiso('gestionar_recursos_y_fondos'),
          asincrono(async (solicitud, respuesta) => {
            const resultado = await contenedor.recursos.registrar_movimiento(leer_identificador(solicitud), solicitud.body, obtener_contexto(solicitud));
            responder(respuesta, resultado, resultado.es_repeticion ? 200 : 201, resultado.es_repeticion ? 'El movimiento ya estaba registrado.' : 'Movimiento registrado.');
          }),
        );
        enrutador.get(
          '/:identificador/movimientos',
          consulta,
          asincrono(async (solicitud, respuesta) => responder(respuesta, await contenedor.recursos.listar_movimientos(leer_identificador(solicitud), obtener_contexto(solicitud)))),
        );
      },
    }),
  );
  api.use(
    '/asignaciones',
    crear_rutas_entidad(contenedor.asignaciones, {
      mensajes: { creado: 'Asignación confirmada.', eliminado: 'Asignación anulada; lo pendiente volvió al inventario.' },
      rutas_adicionales: (enrutador) => {
        enrutador.post(
          '/:identificador/movimientos',
          requerir_permiso('gestionar_recursos_y_fondos'),
          asincrono(async (solicitud, respuesta) => {
            const resultado = await contenedor.asignaciones.registrar_movimiento(leer_identificador(solicitud), solicitud.body, obtener_contexto(solicitud));
            responder(respuesta, resultado, resultado.es_repeticion ? 200 : 201, resultado.es_repeticion ? 'El movimiento ya estaba registrado.' : 'Movimiento registrado.');
          }),
        );
      },
    }),
  );
  api.use(
    '/recursos-humanos',
    crear_rutas_entidad(contenedor.recursos_humanos, {
      rutas_adicionales: (enrutador) => {
        enrutador.put(
          '/:identificador/asignacion',
          requerir_permiso('gestionar_recursos_y_fondos'),
          asincrono(async (solicitud, respuesta) =>
            responder(respuesta, await contenedor.recursos_humanos.asignar(leer_identificador(solicitud), solicitud.body, obtener_contexto(solicitud)), 200, 'Equipo asignado.'),
          ),
        );
        enrutador.delete(
          '/:identificador/asignacion',
          requerir_permiso('gestionar_recursos_y_fondos'),
          asincrono(async (solicitud, respuesta) =>
            responder(respuesta, await contenedor.recursos_humanos.liberar(leer_identificador(solicitud), obtener_contexto(solicitud)), 200, 'Equipo liberado.'),
          ),
        );
      },
    }),
  );

  /* -------------------------------- Fondos -------------------------------- */
  api.use(
    '/fondos',
    crear_rutas_entidad(contenedor.fondos, {
      rutas_adicionales: (enrutador) => {
        enrutador.post(
          '/:identificador/movimientos',
          requerir_permiso('gestionar_recursos_y_fondos'),
          asincrono(async (solicitud, respuesta) => {
            const resultado = await contenedor.fondos.registrar_movimiento(leer_identificador(solicitud), solicitud.body, obtener_contexto(solicitud));
            responder(respuesta, resultado, resultado.es_repeticion ? 200 : 201, resultado.es_repeticion ? 'El movimiento ya estaba registrado.' : 'Movimiento registrado.');
          }),
        );
        enrutador.get(
          '/:identificador/movimientos',
          consulta,
          asincrono(async (solicitud, respuesta) => responder(respuesta, await contenedor.fondos.listar_movimientos(leer_identificador(solicitud), obtener_contexto(solicitud)))),
        );
      },
    }),
  );

  /* ------------------------ Alertas y notificaciones ------------------------ */
  api.get(
    '/alertas',
    consulta,
    asincrono(async (solicitud, respuesta) => {
      const parametros = leer_parametros(solicitud);
      responder(
        respuesta,
        await contenedor.alertas.listar_para_usuario(obtener_contexto(solicitud), {
          solo_no_leidas: parametros.solo_no_leidas === 'true',
          severidad: catalogo.SEVERIDADES_ALERTA.includes(parametros.severidad as catalogo.SeveridadAlerta) ? parametros.severidad : undefined,
        }),
      );
    }),
  );
  api.post(
    '/alertas/lectura-masiva',
    consulta,
    asincrono(async (solicitud, respuesta) => {
      const cantidad = await contenedor.alertas.marcar_todas_leidas(obtener_contexto(solicitud));
      responder(respuesta, { marcadas: cantidad }, 200, `${cantidad} alertas marcadas como leídas.`);
    }),
  );
  api.patch(
    '/alertas/:identificador/lectura',
    consulta,
    asincrono(async (solicitud, respuesta) => {
      await contenedor.alertas.marcar_leida(leer_identificador(solicitud), obtener_contexto(solicitud));
      responder(respuesta, null, 200, 'Alerta marcada como leída.');
    }),
  );
  api.get(
    '/alertas/resumen-entrega',
    requerir_permiso('administrar_cuentas'),
    asincrono(async (_solicitud, respuesta) => responder(respuesta, await contenedor.alertas.resumen_entrega())),
  );

  /* ------------------------------ Reportes PDF ------------------------------ */
  api.get(
    '/reportes-pdf',
    requerir_permiso('exportar_informacion'),
    limites.reportes_pdf,
    asincrono(async (solicitud, respuesta) => {
      const reporte = await contenedor.reportes_pdf.generar(leer_parametros(solicitud), obtener_contexto(solicitud));
      respuesta.setHeader('Content-Type', 'application/pdf');
      respuesta.setHeader('Content-Disposition', `attachment; filename="${reporte.nombre_archivo}"`);
      respuesta.setHeader('X-Total-Filas', String(reporte.filas));
      respuesta.send(Buffer.from(reporte.contenido));
    }),
  );

  return api;
}
