import path from 'node:path';
import { existsSync } from 'node:fs';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import type { Contenedor } from './composicion/contenedor';
import { crear_middleware_sesion } from './infraestructura/sesiones/configurar_sesiones';
import { proteger_csrf } from './presentacion/middlewares/csrf';
import { manejador_errores, ruta_no_encontrada } from './presentacion/middlewares/manejador_errores';
import { crear_rutas_api } from './presentacion/rutas/rutas_api';

/**
 * Construye la aplicación Express (sin abrir el puerto), para poder reutilizarla en las pruebas.
 * Orden: seguridad (helmet, CORS) → JSON → sesión → CSRF → rutas → 404 → errores.
 */
export function crear_aplicacion(contenedor: Contenedor): Express {
  const { configuracion } = contenedor;
  const aplicacion = express();
  aplicacion.disable('x-powered-by');
  if (configuracion.es_produccion) aplicacion.set('trust proxy', 1);

  aplicacion.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'blob:', 'https://*.tile.openstreetmap.org'],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          connectSrc: ["'self'"],
        },
      },
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );
  aplicacion.use(
    cors({
      origin: (origen, responder) => {
        // Las solicitudes del mismo origen (sin cabecera Origin) se permiten; las demás sólo si están en la lista.
        if (!origen || configuracion.cors_origenes.includes(origen)) responder(null, true);
        else responder(null, false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'X-Solicitud-Automatica'],
      exposedHeaders: ['X-Total-Filas', 'Content-Disposition'],
    }),
  );
  aplicacion.use(express.json({ limit: '200kb' }));
  aplicacion.use(crear_middleware_sesion(configuracion));
  aplicacion.use('/api', proteger_csrf, crear_rutas_api(contenedor));
  aplicacion.use('/api', ruta_no_encontrada);

  // En producción el backend puede servir el frontend compilado (mismo origen, cookies sencillas).
  const carpeta_frontend = path.resolve(__dirname, '../../frontend/dist');
  const carpeta_frontend_compilado = path.resolve(__dirname, '../../../../frontend/dist');
  const carpeta = existsSync(carpeta_frontend) ? carpeta_frontend : carpeta_frontend_compilado;
  if (configuracion.servir_frontend && existsSync(carpeta)) {
    aplicacion.use(express.static(carpeta, { index: false, maxAge: '1h' }));
    aplicacion.get(/^\/(?!api).*/, (_solicitud, respuesta) => respuesta.sendFile(path.join(carpeta, 'index.html')));
  }

  aplicacion.use(manejador_errores);
  return aplicacion;
}
