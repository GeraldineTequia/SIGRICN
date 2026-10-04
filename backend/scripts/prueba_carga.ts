/**
 * Prueba de rendimiento reproducible (RNF1, RNF2, RNF4, RNF15) sobre una base AISLADA.
 * Uso:  npm run prueba-carga [-- --usuarios 500 --concurrencia 100 --segundos 20]
 *
 * Definiciones:
 * - Usuario conectado: sesión autenticada con un canal SSE abierto (recibe cambios en tiempo real).
 * - Solicitudes concurrentes: conexiones HTTP que envían consultas al mismo tiempo.
 * Mezcla de operaciones: listado de emergencias (filtros y paginación), dashboard, mapa, alertas,
 * detalle de zona y recursos. Las asignaciones y el PDF se miden aparte.
 * La base de pruebas se crea con datos sintéticos de volumen y se ELIMINA al terminar.
 */
import { spawn } from 'node:child_process';
import http from 'node:http';
import { mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import autocannon from 'autocannon';
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import {
  crear_indices_colecciones_nuevas,
  ModeloEmergencia,
  ModeloRecurso,
  ModeloUsuario,
  ModeloZona,
} from '../src/infraestructura/persistencia/modelos/modelos';
import { leer_argumentos } from './utilidades_script';

const BASE = 'SGRICN_carga_pruebas';

function percentil(valores: number[], porcentaje: number): number {
  const ordenados = [...valores].sort((primero, segundo) => primero - segundo);
  return ordenados[Math.min(ordenados.length - 1, Math.floor((porcentaje / 100) * ordenados.length))];
}

async function principal(): Promise<void> {
  const argumentos = leer_argumentos();
  const cantidad_usuarios = Number(argumentos.usuarios ?? 500);
  const concurrencia = Number(argumentos.concurrencia ?? 100);
  const segundos = Number(argumentos.segundos ?? 20);
  process.env.NODE_ENV = 'test';
  const uri = process.env.MONGODB_URI_PRUEBAS ?? 'mongodb://127.0.0.1:27017';
  await mongoose.connect(uri, { dbName: BASE, maxPoolSize: 100 });
  await mongoose.connection.dropDatabase();
  await crear_indices_colecciones_nuevas();

  console.log('Generando volumen de datos sintéticos...');
  const tipos = ['Inundación', 'Deslizamiento', 'Incendio forestal', 'Vendaval'];
  const niveles = ['bajo', 'medio', 'alto', 'critico'];
  const emergencias = Array.from({ length: 2000 }, (_, indice) => ({
    titulo: `Emergencia sintética ${indice}`,
    tipo: tipos[indice % tipos.length],
    descripcion: 'Registro sintético para prueba de rendimiento.',
    fechaInicio: new Date(Date.UTC(2026, indice % 9, (indice % 27) + 1)),
    estado: 'activa',
    pais: 'Colombia',
    departamento: `Departamento ${indice % 10}`,
    municipio: `Municipio ${indice % 50}`,
    nivelEmergencia: niveles[indice % 4],
    fuenteInformacion: 'Sintético',
    fechaRegistro: new Date(),
    ubicacion: { estado: 'confirmada', punto: { type: 'Point', coordinates: [-75 - (indice % 100) / 50, 4 + (indice % 100) / 50] } },
  }));
  const creadas = await ModeloEmergencia.insertMany(emergencias);
  await ModeloZona.insertMany(
    Array.from({ length: 1000 }, (_, indice) => ({
      catastrofeId: creadas[indice % creadas.length]._id,
      pais: 'Colombia',
      departamento: `Departamento ${indice % 10}`,
      municipio: `Municipio ${indice % 50}`,
      direccion: `Calle ${indice}`,
      nivelAfectacion: niveles[indice % 4],
      porcentajeAfectacion: indice % 100,
      prioridad: 'media',
      estado: 'activa',
      estadoAtencion: 'sin_atender',
    })),
  );
  const recurso = await ModeloRecurso.create({
    tipo: 'Agua',
    descripcion: 'Agua (carga)',
    unidad: 'litros',
    cantidadDisponible: 1_000_000,
    cantidadAsignada: 0,
    cantidadEntregada: 0,
    cantidadMinima: 10,
    ubicacionAlmacen: 'Bodega carga',
    departamento: 'Departamento 0',
    municipio: 'Municipio 0',
    organizacionResponsable: 'Prueba',
    estado: 'activo',
  });
  const hash = await bcrypt.hash('Clave carga 2026', 4);
  await ModeloUsuario.insertMany(
    Array.from({ length: cantidad_usuarios }, (_, indice) => ({
      nombre: `Carga${indice}`,
      apellido: 'Prueba',
      correo: `carga${indice}@prueba.test`,
      password: hash,
      rol: indice === 0 ? 'funcionario' : 'usuario',
      estado: 'activo',
    })),
  );

  // El servidor corre en un proceso hijo: el generador de carga no le resta CPU.
  const proceso_servidor = spawn(
    process.execPath,
    [path.resolve(__dirname, '../node_modules/tsx/dist/cli.mjs'), path.resolve(__dirname, 'servidor_carga.ts')],
    { env: { ...process.env, BASE_CARGA: BASE, MONGODB_URI_PRUEBAS: uri }, stdio: ['ignore', 'pipe', 'inherit'] },
  );
  const puerto = await new Promise<number>((resolver, rechazar) => {
    proceso_servidor.stdout.on('data', (parte: Buffer) => {
      const coincidencia = parte.toString().match(/LISTO (\d+)/);
      if (coincidencia) resolver(Number(coincidencia[1]));
    });
    proceso_servidor.on('exit', (codigo) => rechazar(new Error(`El servidor terminó con código ${codigo}`)));
  });
  const base_url = `http://127.0.0.1:${puerto}`;
  const agente = new http.Agent({ keepAlive: true, maxSockets: 1000 });

  console.log(`Iniciando ${cantidad_usuarios} sesiones...`);
  const sesiones: { cookie: string; token: string }[] = [];
  for (let indice = 0; indice < cantidad_usuarios; indice += 1) {
    const csrf = await fetch(`${base_url}/api/auth/csrf`);
    const cookie_anonima = String(csrf.headers.get('set-cookie')).split(';')[0];
    const token = ((await csrf.json()) as { datos: { token_csrf: string } }).datos.token_csrf;
    const inicio = await fetch(`${base_url}/api/auth/inicio-sesion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie_anonima, 'X-CSRF-Token': token },
      body: JSON.stringify({ correo: `carga${indice}@prueba.test`, password: 'Clave carga 2026' }),
    });
    const datos = (await inicio.json()) as { datos: { token_csrf: string } };
    sesiones.push({ cookie: String(inicio.headers.get('set-cookie')).split(';')[0], token: datos.datos.token_csrf });
  }

  console.log(`Abriendo ${cantidad_usuarios} canales SSE (usuarios conectados)...`);
  const canales: http.ClientRequest[] = [];
  let eventos_recibidos = 0;
  await Promise.all(
    sesiones.map(
      (sesion) =>
        new Promise<void>((resolver) => {
          const solicitud = http.get({ host: '127.0.0.1', port: puerto, path: '/api/eventos', agent: agente, headers: { Cookie: sesion.cookie } }, (respuesta) => {
            respuesta.on('data', (parte: Buffer) => {
              if (parte.toString().includes('datos_actualizados')) eventos_recibidos += 1;
            });
            resolver();
          });
          solicitud.on('error', () => resolver());
          canales.push(solicitud);
        }),
    ),
  );

  const rutas = [
    '/api/emergencias?pagina=3&limite=10&orden=-fecha_inicio',
    '/api/emergencias?departamento=Departamento%203&nivel_emergencia=alto',
    '/api/emergencias?busqueda=sint%C3%A9tica%2015',
    '/api/tablero/indicadores',
    '/api/mapa?capas=emergencias,zonas',
    '/api/alertas',
    '/api/zonas?pagina=2',
    '/api/recursos',
  ];
  console.log(`Carga: ${concurrencia} conexiones concurrentes durante ${segundos} s...`);
  const tiempos_por_ruta: Record<string, number[]> = {};
  const resultado = await autocannon({
    url: base_url,
    connections: concurrencia,
    duration: segundos,
    // Cada conexión usa la sesión de un usuario distinto. La cookie se agrega en CADA solicitud
    // (setupClient de autocannon sólo la aplicaría a la primera de la secuencia).
    requests: rutas.map((ruta): autocannon.Request => ({
      method: 'GET',
      path: ruta,
      setupRequest: (solicitud, contexto) => {
        const contexto_conexion = contexto as { cookie?: string };
        contexto_conexion.cookie ??= sesiones[Math.floor(Math.random() * sesiones.length)].cookie;
        return { ...solicitud, headers: { ...solicitud.headers, Cookie: contexto_conexion.cookie, 'X-Solicitud-Automatica': '1' } };
      },
    })),
  });

  console.log('Midiendo tiempo por tipo de consulta (muestras secuenciales con carga SSE activa)...');
  for (const ruta of rutas) {
    tiempos_por_ruta[ruta] = [];
    for (let repeticion = 0; repeticion < 20; repeticion += 1) {
      const inicio = performance.now();
      const respuesta = await fetch(`${base_url}${ruta}`, { headers: { Cookie: sesiones[1].cookie, 'X-Solicitud-Automatica': '1' } });
      await respuesta.arrayBuffer();
      if (respuesta.status !== 200) throw new Error(`${ruta} respondió ${respuesta.status}`);
      tiempos_por_ruta[ruta].push(performance.now() - inicio);
    }
  }

  console.log('Midiendo asignaciones de recursos (RNF2) y propagación SSE (RNF3)...');
  const funcionario = sesiones[0];
  const zona = await ModeloZona.findOne({}).lean<Record<string, unknown>>();
  const tiempos_asignacion: number[] = [];
  eventos_recibidos = 0;
  await Promise.all(
    Array.from({ length: 30 }, async (_, indice) => {
      const inicio = performance.now();
      await fetch(`${base_url}/api/asignaciones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: funcionario.cookie, 'X-CSRF-Token': funcionario.token },
        body: JSON.stringify({
          recurso_id: String(recurso._id),
          cantidad: 10,
          catastrofe_id: String(zona?.catastrofeId),
          zona_id: String(zona?._id),
          responsable: 'Equipo de carga',
          fecha: new Date().toISOString(),
          clave_idempotencia: `carga-${indice}-${Date.now()}`,
        }),
      });
      tiempos_asignacion.push(performance.now() - inicio);
    }),
  );
  await new Promise((resolver) => setTimeout(resolver, 1000));

  console.log('Midiendo generación de PDF con 2000 emergencias (RNF15)...');
  const inicio_pdf = performance.now();
  const pdf = await fetch(`${base_url}/api/reportes-pdf?categorias=emergencias,zonas`, { headers: { Cookie: sesiones[2].cookie } });
  const bytes_pdf = (await pdf.arrayBuffer()).byteLength;
  const tiempo_pdf = performance.now() - inicio_pdf;

  const informe = {
    fecha: new Date().toISOString(),
    entorno: {
      sistema: `${os.type()} ${os.release()}`,
      cpu: os.cpus()[0]?.model,
      nucleos: os.cpus().length,
      memoria_gb: Math.round(os.totalmem() / 1024 ** 3),
      node: process.version,
      mongodb: 'local (127.0.0.1) en el mismo equipo',
      procesos: 'backend en un proceso hijo; autocannon y los canales SSE en otro proceso del mismo equipo',
    },
    volumen: { emergencias: 2000, zonas: 1000, usuarios: cantidad_usuarios },
    usuarios_conectados_sse: canales.length,
    carga_concurrente: {
      conexiones: concurrencia,
      segundos,
      solicitudes_totales: resultado.requests.total,
      solicitudes_por_segundo: resultado.requests.average,
      latencia_ms: { p50: resultado.latency.p50, p90: resultado.latency.p90, p99: resultado.latency.p99, maxima: resultado.latency.max },
      errores: resultado.errors,
      respuestas_no_2xx: resultado.non2xx,
      codigos_http: resultado.statusCodeStats,
      tiempos_agotados: resultado.timeouts,
    },
    consultas_secuenciales_ms: Object.fromEntries(
      Object.entries(tiempos_por_ruta).map(([ruta, tiempos]) => [ruta, { p50: Math.round(percentil(tiempos, 50)), p95: Math.round(percentil(tiempos, 95)) }]),
    ),
    asignaciones_concurrentes_30: { p50_ms: Math.round(percentil(tiempos_asignacion, 50)), p95_ms: Math.round(percentil(tiempos_asignacion, 95)), maxima_ms: Math.round(Math.max(...tiempos_asignacion)) },
    eventos_sse_recibidos_tras_asignaciones: eventos_recibidos,
    pdf: { filas: Number(pdf.headers.get('x-total-filas')), bytes: bytes_pdf, ms: Math.round(tiempo_pdf) },
  };
  console.log(JSON.stringify(informe, null, 2));
  const carpeta = path.resolve(__dirname, '../pruebas/resultados');
  mkdirSync(carpeta, { recursive: true });
  writeFileSync(path.join(carpeta, 'prueba_carga.json'), JSON.stringify(informe, null, 2));

  for (const canal of canales) canal.destroy();
  agente.destroy();
  proceso_servidor.kill('SIGTERM');
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  process.exit(0);
}

principal().catch(async (error: Error) => {
  console.error('Error en la prueba de carga:', error.message);
  await mongoose.disconnect();
  process.exit(1);
});
