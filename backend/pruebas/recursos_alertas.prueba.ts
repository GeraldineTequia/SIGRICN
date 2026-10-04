import http from 'node:http';
import type { AddressInfo } from 'node:net';
import mongoose from 'mongoose';
import { ModeloFondo, ModeloRecurso, ModeloZona } from '../src/infraestructura/persistencia/modelos/modelos';
import {
  ClientePrueba,
  CONTRASENA_PRUEBA,
  cerrar_entorno,
  cliente_con_rol,
  crear_cuenta,
  datos_emergencia,
  datos_zona,
  preparar_entorno,
  type EntornoPrueba,
} from './entorno_pruebas';

let entorno: EntornoPrueba;
let usuario: ClientePrueba;
let funcionario: ClientePrueba;
let emergencia_id = '';
let zona_id = '';
let recurso_id = '';
let clave = 0;
const nueva_clave = () => `prueba-${Date.now()}-${(clave += 1)}`;

beforeAll(async () => {
  entorno = await preparar_entorno();
  usuario = (await cliente_con_rol(entorno.aplicacion, 'usuario')).cliente;
  funcionario = (await cliente_con_rol(entorno.aplicacion, 'funcionario')).cliente;
  emergencia_id = (await funcionario.post('/api/emergencias', datos_emergencia())).body.datos.id;
  zona_id = (await funcionario.post('/api/zonas', datos_zona(emergencia_id))).body.datos.id;
});
afterAll(cerrar_entorno);

const asignacion = (cantidad: number, clave_idempotencia = nueva_clave()) => ({
  recurso_id,
  cantidad,
  catastrofe_id: emergencia_id,
  zona_id,
  responsable: 'Cruz Roja · Equipo 07',
  fecha: '2026-09-23T11:30:00.000Z',
  clave_idempotencia,
});

describe('RF17, RF20, RF21 · Recursos y asignaciones', () => {
  it('registra un recurso y sólo cambia existencias mediante movimientos', async () => {
    const creado = await funcionario.post('/api/recursos', {
      tipo: 'Agua',
      descripcion: 'Agua potable en bolsa',
      unidad: 'litros',
      cantidad_disponible: 10,
      cantidad_minima: 3,
      ubicacion_almacen: 'Bodega Quibdó',
      departamento: 'Chocó',
      municipio: 'Quibdó',
      organizacion_responsable: 'Cruz Roja',
      estado: 'activo',
    });
    expect(creado.status).toBe(201);
    recurso_id = creado.body.datos.id;
    expect(creado.body.datos.disponibilidad).toBe('disponible');
    expect((await funcionario.patch(`/api/recursos/${recurso_id}`, { cantidad_disponible: 999 })).status).toBe(400);
  });

  it('impide la sobreasignación con 15 solicitudes SIMULTÁNEAS sobre 10 unidades', async () => {
    const respuestas = await Promise.all(Array.from({ length: 15 }, () => funcionario.post('/api/asignaciones', asignacion(1))));
    const exitosas = respuestas.filter((respuesta) => respuesta.status === 201).length;
    const rechazadas = respuestas.filter((respuesta) => respuesta.status === 409).length;
    expect(exitosas).toBe(10);
    expect(rechazadas).toBe(5);
    const recurso = await ModeloRecurso.findOne({}).lean<Record<string, number>>();
    expect(recurso?.cantidadDisponible).toBe(0);
    expect(recurso?.cantidadAsignada).toBe(10);
  });

  it('rechaza asignar más de lo disponible con un mensaje claro', async () => {
    const respuesta = await funcionario.post('/api/asignaciones', asignacion(7000));
    expect(respuesta.status).toBe(409);
    expect(respuesta.body.mensaje).toMatch(/solicitado 7000, disponible 0/);
  });

  it('un reintento con la misma clave no duplica el movimiento (idempotencia)', async () => {
    const ingreso_clave = nueva_clave();
    const ingreso = { tipo: 'ingreso', cantidad: 20, motivo: 'Donación recibida', clave_idempotencia: ingreso_clave };
    const primero = await funcionario.post(`/api/recursos/${recurso_id}/movimientos`, ingreso);
    const repetido = await funcionario.post(`/api/recursos/${recurso_id}/movimientos`, ingreso);
    expect(primero.status).toBe(201);
    expect(repetido.status).toBe(200);
    expect(repetido.body.datos.es_repeticion).toBe(true);
    expect((await ModeloRecurso.findOne({}).lean<Record<string, number>>())?.cantidadDisponible).toBe(20);
  });

  it('entrega y devuelve sin cantidades negativas; anular devuelve lo pendiente', async () => {
    const creada = await funcionario.post('/api/asignaciones', asignacion(8));
    const id = creada.body.datos.id;
    expect((await funcionario.post(`/api/asignaciones/${id}/movimientos`, { tipo: 'entrega', cantidad: 9, clave_idempotencia: nueva_clave() })).status).toBe(409);
    const entrega = await funcionario.post(`/api/asignaciones/${id}/movimientos`, { tipo: 'entrega', cantidad: 5, clave_idempotencia: nueva_clave() });
    expect(entrega.body.datos.asignacion.estado).toBe('entregada_parcialmente');
    const devolucion = await funcionario.post(`/api/asignaciones/${id}/movimientos`, { tipo: 'devolucion', cantidad: 3, clave_idempotencia: nueva_clave() });
    expect(devolucion.body.datos.asignacion.estado).toBe('entregada');
    const recurso = await ModeloRecurso.findOne({}).lean<Record<string, number>>();
    expect(recurso?.cantidadDisponible).toBe(15);
    expect(recurso?.cantidadEntregada).toBe(5);
    const otra = await funcionario.post('/api/asignaciones', asignacion(4));
    expect((await funcionario.delete(`/api/asignaciones/${otra.body.datos.id}`)).status).toBe(200);
    expect((await ModeloRecurso.findOne({}).lean<Record<string, number>>())?.cantidadDisponible).toBe(15);
    expect((await funcionario.delete(`/api/recursos/${recurso_id}`)).status).toBe(409);
  });

  it('filtra por disponibilidad calculada (RF21)', async () => {
    const respuesta = await usuario.get('/api/recursos?disponibilidad=disponible');
    expect(respuesta.body.datos).toHaveLength(1);
    expect((await usuario.get('/api/recursos?disponibilidad=agotado')).body.datos).toHaveLength(0);
  });

  it('recursos humanos: un equipo disponible no se asigna dos veces', async () => {
    const equipo = await funcionario.post('/api/recursos-humanos', {
      nombre: 'Brigada de rescate 1',
      funcion: 'Rescate',
      entidad: 'Defensa Civil',
      integrantes: 6,
      disponibilidad: 'disponible',
    });
    const id = equipo.body.datos.id;
    const resultados = await Promise.all([
      funcionario.put(`/api/recursos-humanos/${id}/asignacion`, { catastrofe_id: emergencia_id, zona_id }),
      funcionario.put(`/api/recursos-humanos/${id}/asignacion`, { catastrofe_id: emergencia_id, zona_id }),
    ]);
    expect(resultados.map((resultado) => resultado.status).sort()).toEqual([200, 409]);
    expect((await funcionario.delete(`/api/recursos-humanos/${id}/asignacion`)).status).toBe(200);
  });
});

describe('RF19 · Fondos: saldos, compromisos, gastos y concurrencia', () => {
  let fondo_id = '';

  it('crea el fondo y compromete sin superar el saldo, incluso con solicitudes simultáneas', async () => {
    const fondo = await funcionario.post('/api/fondos', {
      catastrofe_id: emergencia_id,
      origen: 'Nacional (UNGRD)',
      entidad: 'UNGRD',
      concepto: 'Operación y logística',
      monto_asignado: 1000,
    });
    expect(fondo.status).toBe(201);
    fondo_id = fondo.body.datos.id;
    const respuestas = await Promise.all(
      Array.from({ length: 5 }, () => funcionario.post(`/api/fondos/${fondo_id}/movimientos`, { tipo: 'compromiso', monto: 300, concepto: 'Transporte', clave_idempotencia: nueva_clave() })),
    );
    expect(respuestas.filter((respuesta) => respuesta.status === 201)).toHaveLength(3);
    const documento = await ModeloFondo.findOne({}).lean<Record<string, number>>();
    expect(documento).toMatchObject({ montoComprometido: 900, montoDisponible: 100, montoGastado: 0 });
  });

  it('convertir un compromiso en gasto no descuenta dos veces y no se puede ejecutar de nuevo', async () => {
    const movimientos = await funcionario.get(`/api/fondos/${fondo_id}/movimientos`);
    const compromiso = movimientos.body.datos.find((movimiento: { tipo: string; estado: string }) => movimiento.tipo === 'compromiso' && movimiento.estado === 'vigente');
    const gasto = await funcionario.post(`/api/fondos/${fondo_id}/movimientos`, {
      tipo: 'gasto',
      concepto: 'Pago transporte',
      movimiento_relacionado_id: compromiso.id,
      clave_idempotencia: nueva_clave(),
    });
    expect(gasto.status).toBe(201);
    expect(gasto.body.datos.fondo).toMatchObject({ monto_comprometido: 600, monto_gastado: 300, monto_disponible: 100 });
    const repetido = await funcionario.post(`/api/fondos/${fondo_id}/movimientos`, {
      tipo: 'gasto',
      concepto: 'Pago duplicado',
      movimiento_relacionado_id: compromiso.id,
      clave_idempotencia: nueva_clave(),
    });
    expect(repetido.status).toBe(409);
  });

  it('rechaza gastos superiores al saldo y conserva el historial (no se elimina el fondo)', async () => {
    const respuesta = await funcionario.post(`/api/fondos/${fondo_id}/movimientos`, { tipo: 'gasto', monto: 2100, concepto: 'Exceso', clave_idempotencia: nueva_clave() });
    expect(respuesta.status).toBe(409);
    expect(respuesta.body.mensaje).toMatch(/supera el saldo disponible/);
    expect((await funcionario.delete(`/api/fondos/${fondo_id}`)).status).toBe(409);
    const documento = await ModeloFondo.findOne({}).lean<Record<string, number>>();
    expect(documento!.montoAsignado - documento!.montoComprometido - documento!.montoGastado).toBe(documento!.montoDisponible);
  });
});

describe('RF22, RF23 · Alertas persistentes y notificaciones', () => {
  it('genera alertas persistentes y un usuario desconectado las recibe al iniciar sesión', async () => {
    const cuenta = await crear_cuenta('usuario');
    await funcionario.post('/api/emergencias', datos_emergencia({ titulo: 'Emergencia crítica nueva', nivel_emergencia: 'critico' }));
    const tarde = new ClientePrueba(entorno.aplicacion);
    await tarde.iniciar_sesion(cuenta.correo, CONTRASENA_PRUEBA);
    const alertas = await tarde.get('/api/alertas');
    const titulos = alertas.body.datos.elementos.map((alerta: { titulo: string }) => alerta.titulo);
    expect(titulos).toContain('Caso crítico: Emergencia crítica nueva');
    expect(alertas.body.datos.no_leidas).toBeGreaterThan(0);
    // Las alertas operativas (recurso agotado, asignaciones) no llegan al rol usuario.
    expect(alertas.body.datos.elementos.every((alerta: { tipo: string }) => alerta.tipo !== 'asignacion_recurso')).toBe(true);
    const primera = alertas.body.datos.elementos[0];
    expect((await tarde.patch(`/api/alertas/${primera.id}/lectura`)).status).toBe(200);
    const despues = await tarde.get('/api/alertas');
    expect(despues.body.datos.no_leidas).toBe(alertas.body.datos.no_leidas - 1);
    expect((await tarde.post('/api/alertas/lectura-masiva')).status).toBe(200);
    expect((await tarde.get('/api/alertas')).body.datos.no_leidas).toBe(0);
  });

  it('el personal operativo recibe la alerta de recurso agotado (deduplicada)', async () => {
    const alertas = await funcionario.get('/api/alertas');
    const agotados = alertas.body.datos.elementos.filter((alerta: { tipo: string }) => alerta.tipo === 'recurso_insuficiente');
    expect(agotados.length).toBeGreaterThanOrEqual(1);
    expect(new Set(agotados.map((alerta: { titulo: string }) => alerta.titulo)).size).toBe(agotados.length);
  });

  it('la verificación periódica alerta zonas prioritarias sin atención por más de 24 h (sin duplicar)', async () => {
    const creada = await funcionario.post('/api/zonas', datos_zona(emergencia_id, { direccion: 'Calle antigua 1', prioridad: 'critica' }));
    // Mongoose protege createdAt (inmutable): se "envejece" la zona directamente en la colección.
    await ModeloZona.collection.updateOne({ _id: new mongoose.Types.ObjectId(String(creada.body.datos.id)) }, { $set: { createdAt: new Date(Date.now() - 25 * 3_600_000) } });
    // Una zona heredada sin estadoAtencion también cuenta como sin atender.
    await ModeloZona.collection.insertOne({ catastrofeId: emergencia_id, direccion: 'Heredada', municipio: 'Quibdó', prioridad: 'alta', nivelAfectacion: 'alto', porcentajeAfectacion: 50, createdAt: new Date(Date.now() - 48 * 3_600_000) });
    const encontradas = await entorno.contenedor.zonas.verificar_zonas_desatendidas();
    expect(encontradas).toBe(2);
    await entorno.contenedor.zonas.verificar_zonas_desatendidas();
    const alertas = (await funcionario.get('/api/alertas')).body.datos.elementos.filter((alerta: { tipo: string }) => alerta.tipo === 'zona_sin_atencion');
    expect(new Set(alertas.map((alerta: { entidad_id: string }) => alerta.entidad_id)).size).toBe(alertas.length);
    expect(alertas.length).toBeGreaterThanOrEqual(2);
  });

  it('RNF3: otro usuario conectado recibe el cambio por SSE en menos de 5 segundos', async () => {
    const servidor = http.createServer(entorno.aplicacion).listen(0);
    const puerto = (servidor.address() as AddressInfo).port;
    try {
      // Sesión independiente del observador, obtenida como lo haría un navegador.
      const cuenta = await crear_cuenta('usuario');
      const base = `http://127.0.0.1:${puerto}`;
      const csrf = await fetch(`${base}/api/auth/csrf`);
      const cookie_anonima = String(csrf.headers.get('set-cookie')).split(';')[0];
      const token = ((await csrf.json()) as { datos: { token_csrf: string } }).datos.token_csrf;
      const inicio_sesion = await fetch(`${base}/api/auth/inicio-sesion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie_anonima, 'X-CSRF-Token': token },
        body: JSON.stringify({ correo: cuenta.correo, password: CONTRASENA_PRUEBA }),
      });
      expect(inicio_sesion.status).toBe(200);
      const cabecera_cookie = String(inicio_sesion.headers.get('set-cookie')).split(';')[0];
      const inicio = Date.now();
      const recibido = new Promise<number>((resolver, rechazar) => {
        const solicitud = http.get({ host: '127.0.0.1', port: puerto, path: '/api/eventos', headers: { Cookie: cabecera_cookie } }, (respuesta) => {
          let acumulado = '';
          respuesta.on('data', (parte: Buffer) => {
            acumulado += parte.toString();
            if (acumulado.includes('event: conectado') && !acumulado.includes('creando')) {
              acumulado += 'creando';
              // Supertest sólo envía la solicitud al invocar then().
              funcionario.post('/api/emergencias', datos_emergencia({ titulo: 'Evento en tiempo real' })).then(() => undefined);
            }
            if (acumulado.includes('event: datos_actualizados')) {
              resolver(Date.now() - inicio);
              solicitud.destroy();
            }
          });
        });
        solicitud.on('error', () => undefined);
        setTimeout(() => rechazar(new Error('No llegó el evento en 5 s')), 5000);
      });
      expect(await recibido).toBeLessThan(5000);
    } finally {
      servidor.close();
    }
  });
});

describe('RF24 · Reportes PDF', () => {
  it('genera un PDF real con filtros', async () => {
    const respuesta = await usuario
      .get(`/api/reportes-pdf?categorias=emergencias,zonas,recursos,donaciones,fondos&catastrofe_id=${emergencia_id}`)
      .buffer(true)
      .parse((respuesta_http, terminar) => {
        const partes: Buffer[] = [];
        respuesta_http.on('data', (parte: Buffer) => partes.push(parte));
        respuesta_http.on('end', () => terminar(null, Buffer.concat(partes)));
      });
    expect(respuesta.status).toBe(200);
    expect(respuesta.headers['content-type']).toBe('application/pdf');
    expect((respuesta.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
    expect(Number(respuesta.headers['x-total-filas'])).toBeGreaterThan(0);
  });

  it('respeta permisos: el rol usuario no recibe la columna de donantes', async () => {
    const documentos: string[] = [];
    const generador_original = (entorno.contenedor.reportes_pdf as unknown as { _generador: { generar: (documento: unknown) => Promise<Buffer> } })._generador;
    const generar = generador_original.generar.bind(generador_original);
    generador_original.generar = async (documento) => {
      documentos.push(JSON.stringify(documento));
      return generar(documento);
    };
    await usuario.get('/api/reportes-pdf?categorias=donaciones');
    await funcionario.get('/api/reportes-pdf?categorias=donaciones');
    generador_original.generar = generar;
    expect(documentos[0]).not.toContain('Donante');
    expect(documentos[1]).toContain('Donante');
  });

  it('exige al menos una categoría', async () => {
    expect((await usuario.get('/api/reportes-pdf?categorias=')).status).toBe(400);
  });
});
