import mongoose from 'mongoose';
import { MENSAJE_MAGNITUD_TERREMOTO } from '../src/dominio/reglas/regla_magnitud';
import { ModeloEmergencia, ModeloPersona } from '../src/infraestructura/persistencia/modelos/modelos';
import {
  ClientePrueba,
  cerrar_entorno,
  cliente_con_rol,
  datos_emergencia,
  datos_zona,
  preparar_entorno,
  type EntornoPrueba,
} from './entorno_pruebas';

let entorno: EntornoPrueba;
let usuario: ClientePrueba;
let funcionario: ClientePrueba;
let administrador: ClientePrueba;

beforeAll(async () => {
  entorno = await preparar_entorno();
  usuario = (await cliente_con_rol(entorno.aplicacion, 'usuario')).cliente;
  funcionario = (await cliente_con_rol(entorno.aplicacion, 'funcionario')).cliente;
  administrador = (await cliente_con_rol(entorno.aplicacion, 'administrador')).cliente;
});
afterAll(cerrar_entorno);

describe('RF4 · Permisos verificados en el backend', () => {
  it('responde 401 sin sesión', async () => {
    const anonimo = new ClientePrueba(entorno.aplicacion);
    expect((await anonimo.get('/api/emergencias')).status).toBe(401);
    expect((await anonimo.get('/api/tablero/indicadores')).status).toBe(401);
  });

  it('el rol usuario puede consultar pero recibe 403 en cualquier escritura directa a la API', async () => {
    expect((await usuario.get('/api/emergencias')).status).toBe(200);
    expect((await usuario.get('/api/tablero/indicadores')).status).toBe(200);
    expect((await usuario.get('/api/mapa')).status).toBe(200);
    const intentos = await Promise.all([
      usuario.post('/api/emergencias', datos_emergencia()),
      usuario.put('/api/emergencias/abc123', datos_emergencia()),
      usuario.patch('/api/emergencias/abc123', { titulo: 'x' }),
      usuario.delete('/api/emergencias/abc123'),
      usuario.post('/api/emergencias/abc123/transiciones', { estado: 'en_atencion' }),
      usuario.post('/api/zonas', {}),
      usuario.post('/api/recursos', {}),
      usuario.post('/api/asignaciones', {}),
      usuario.post('/api/donaciones', {}),
      usuario.post('/api/fondos', {}),
      usuario.post('/api/centros-donacion', {}),
      usuario.post('/api/reportes-ciudadanos', {}),
      usuario.post('/api/necesidades', {}),
      usuario.patch('/api/usuarios/abc/rol', { rol: 'administrador' }),
      usuario.get('/api/geocodificacion?pais=Colombia&departamento=A&municipio=B&direccion=Calle 1'),
    ]);
    for (const intento of intentos) expect(intento.status).toBe(403);
  });

  it('el rol usuario no accede a directorios de cuentas ni a datos personales', async () => {
    expect((await usuario.get('/api/usuarios')).status).toBe(403);
    expect((await usuario.get('/api/personas-afectadas')).status).toBe(403);
    expect((await usuario.get('/api/familias')).status).toBe(403);
    expect((await usuario.get('/api/personas-afectadas/resumen')).status).toBe(200);
  });

  it('nunca expone hashes en el directorio de cuentas', async () => {
    const respuesta = await administrador.get('/api/usuarios?limite=100');
    expect(respuesta.status).toBe(200);
    expect(JSON.stringify(respuesta.body)).not.toMatch(/password|\$2[aby]\$|token/i);
  });

  it('un funcionario no puede otorgar el rol administrador', async () => {
    const objetivo = await cliente_con_rol(entorno.aplicacion, 'usuario');
    const respuesta = await funcionario.patch(`/api/usuarios/${objetivo.id}/rol`, { rol: 'administrador' });
    expect(respuesta.status).toBe(403);
    expect((await funcionario.patch(`/api/usuarios/${objetivo.id}/rol`, { rol: 'funcionario' })).status).toBe(200);
  });
});

describe('RF5–RF9 · Emergencias, Strategy y State', () => {
  let emergencia_id = '';

  it('funcionario crea una emergencia que inicia "activa" y se lista', async () => {
    const respuesta = await funcionario.post('/api/emergencias', datos_emergencia());
    expect(respuesta.status).toBe(201);
    expect(respuesta.body.datos.estado).toBe('activa');
    expect(respuesta.body.datos.estrategia).toBe('inundacion');
    emergencia_id = respuesta.body.datos.id;
    const listado = await usuario.get('/api/emergencias?busqueda=Atrato');
    expect(listado.body.datos.map((emergencia: { id: string }) => emergencia.id)).toContain(emergencia_id);
    expect(listado.body.datos[0].registrado_por).toBeUndefined();
  });

  it('no acepta el estado en el registro ni en PUT/PATCH genéricos', async () => {
    expect((await funcionario.post('/api/emergencias', datos_emergencia({ estado: 'finalizada' }))).status).toBe(400);
    expect((await funcionario.patch(`/api/emergencias/${emergencia_id}`, { estado: 'finalizada' })).status).toBe(400);
  });

  it('terremoto 4.9 rechazado; 5.0 y 5.1 aceptados', async () => {
    const rechazo = await funcionario.post('/api/emergencias', datos_emergencia({ tipo: 'Terremoto', magnitud: 4.9 }));
    expect(rechazo.status).toBe(400);
    expect(rechazo.body.errores.magnitud).toBe(MENSAJE_MAGNITUD_TERREMOTO);
    const aceptado = await funcionario.post('/api/emergencias', datos_emergencia({ tipo: 'Terremoto', magnitud: 5.0 }));
    expect(aceptado.status).toBe(201);
    // La clasificación de la estrategia se persiste completa (RF8).
    expect(aceptado.body.datos.clasificacion).toMatchObject({ nivel_sugerido: 'medio' });
    expect((await usuario.get(`/api/emergencias/${aceptado.body.datos.id}`)).body.datos.clasificacion.nivel_sugerido).toBe('medio');
    expect((await funcionario.post('/api/emergencias', datos_emergencia({ tipo: 'Terremoto', magnitud: 5.1 }))).status).toBe(201);
    expect((await funcionario.post('/api/emergencias', datos_emergencia({ tipo: 'Terremoto' }))).status).toBe(400);
    expect((await funcionario.post('/api/emergencias', datos_emergencia({ tipo: 'Terremoto', magnitud: 'abc' }))).status).toBe(400);
  });

  it('aplica la regla en PATCH parciales y en cambios de tipo', async () => {
    const terremoto = await funcionario.post('/api/emergencias', datos_emergencia({ tipo: 'Terremoto', magnitud: 6.2 }));
    const id = terremoto.body.datos.id;
    expect((await funcionario.patch(`/api/emergencias/${id}`, { magnitud: 4.9 })).status).toBe(400);
    expect((await funcionario.patch(`/api/emergencias/${id}`, { magnitud: 5.0 })).status).toBe(200);
    // Cambio de tipo de inundación a terremoto sin magnitud: rechazado.
    expect((await funcionario.patch(`/api/emergencias/${emergencia_id}`, { tipo: 'Terremoto' })).status).toBe(400);
    expect((await funcionario.patch(`/api/emergencias/${emergencia_id}`, { tipo: 'Terremoto', magnitud: 5.1 })).status).toBe(200);
    // Al volver a otro tipo, la magnitud deja de aplicar.
    const otro = await funcionario.patch(`/api/emergencias/${emergencia_id}`, { tipo: 'Inundación' });
    expect(otro.status).toBe(200);
    expect(otro.body.datos.magnitud).toBeNull();
  });

  it('identifica terremotos heredados sin magnitud como pendientes de validación (sin modificarlos)', async () => {
    const heredado = await ModeloEmergencia.collection.insertOne({
      _id: 'cat900' as unknown as mongoose.Types.ObjectId,
      titulo: 'Sismo histórico',
      tipo: 'Terremoto',
      descripcion: 'Registro antiguo sin magnitud',
      fechaInicio: '2025-01-10T00:00:00.000Z',
      estado: 'en_proceso',
      pais: 'Colombia',
      departamento: 'Cauca',
      municipio: 'Popayán',
      nivelEmergencia: 'alto',
      fuenteInformacion: 'Histórico',
    });
    const respuesta = await usuario.get(`/api/emergencias/${heredado.insertedId}`);
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.datos.pendiente_validacion).toBe(true);
    expect(respuesta.body.datos.estado_ciclo).toBe('en_atencion');
    expect(respuesta.body.datos.fecha_inicio).toBe('2025-01-10T00:00:00.000Z');
    const crudo = await ModeloEmergencia.collection.findOne({ _id: 'cat900' as unknown as mongoose.Types.ObjectId });
    expect(crudo?.estado).toBe('en_proceso');
    expect(typeof crudo?.fechaInicio).toBe('string');
  });

  it('filtra por rango de fechas aunque existan fechas guardadas como texto', async () => {
    const respuesta = await usuario.get('/api/emergencias?desde=2025-01-01&hasta=2025-01-31');
    expect(respuesta.body.datos.map((emergencia: { id: string }) => emergencia.id)).toContain('cat900');
    expect(respuesta.body.paginacion.total).toBe(1);
  });

  it('transiciones válidas registran historial y fechaFin; inválidas devuelven 409', async () => {
    expect((await funcionario.post(`/api/emergencias/${emergencia_id}/transiciones`, { estado: 'finalizada' })).status).toBe(409);
    expect((await funcionario.post(`/api/emergencias/${emergencia_id}/transiciones`, { estado: 'en_atencion' })).status).toBe(200);
    expect((await administrador.post(`/api/emergencias/${emergencia_id}/transiciones`, { estado: 'controlada' })).status).toBe(200);
    const final = await funcionario.post(`/api/emergencias/${emergencia_id}/transiciones`, { estado: 'finalizada', observacion: 'Cierre' });
    expect(final.status).toBe(200);
    expect(final.body.datos.fecha_fin).toBeTruthy();
    const historial = await usuario.get(`/api/emergencias/${emergencia_id}/historial`);
    expect(historial.body.datos).toHaveLength(3);
    expect(historial.body.datos[0]).toMatchObject({ estado_anterior: 'controlada', estado_nuevo: 'finalizada' });
    expect(historial.body.datos[0].usuario_nombre).toBeTruthy();
  });

  it('controla la concurrencia: dos transiciones simultáneas sólo aplican una', async () => {
    const nueva = await funcionario.post('/api/emergencias', datos_emergencia({ titulo: 'Concurrencia de estados' }));
    const id = nueva.body.datos.id;
    const resultados = await Promise.all([
      funcionario.post(`/api/emergencias/${id}/transiciones`, { estado: 'en_atencion' }),
      administrador.post(`/api/emergencias/${id}/transiciones`, { estado: 'en_atencion' }),
    ]);
    expect(resultados.map((resultado) => resultado.status).sort()).toEqual([200, 409]);
  });
});

describe('RF10–RF13 · Zonas, ubicación por dirección e integridad', () => {
  let emergencia_id = '';
  let zona_id = '';

  beforeAll(async () => {
    emergencia_id = (await funcionario.post('/api/emergencias', datos_emergencia({ titulo: 'Emergencia con zonas' }))).body.datos.id;
  });

  it('busca la dirección, guarda la ubicación confirmada y la recupera al recargar', async () => {
    entorno.geocodificador.resultados = [
      { direccion_encontrada: 'Calle 25, Bellavista, Quibdó', punto: { latitud: 5.6947, longitud: -76.6611 }, precision: 'direccion', tipo_lugar: 'road' },
      { direccion_encontrada: 'Calle 25, Centro, Quibdó', punto: { latitud: 5.69, longitud: -76.65 }, precision: 'direccion', tipo_lugar: 'road' },
    ];
    const busqueda = await funcionario.get('/api/geocodificacion?pais=Colombia&departamento=Chocó&municipio=Quibdó&barrio=Bellavista&direccion=Calle 25 %233-10');
    expect(busqueda.status).toBe(200);
    expect(busqueda.body.datos.coincidencias).toHaveLength(2);
    const elegida = busqueda.body.datos.coincidencias[0];
    const creada = await funcionario.post('/api/zonas', {
      ...datos_zona(emergencia_id),
      ubicacion: {
        estado: 'confirmada',
        // Ajuste manual del marcador después de seleccionar la coincidencia.
        punto: { latitud: elegida.punto.latitud + 0.0005, longitud: elegida.punto.longitud },
        direccion_consultada: 'Calle 25 #3-10, Bellavista, Quibdó, Chocó, Colombia',
        direccion_encontrada: elegida.direccion_encontrada,
        origen: 'ajuste_manual',
        precision: 'direccion',
      },
    });
    expect(creada.status).toBe(201);
    zona_id = creada.body.datos.id;
    expect(creada.body.datos.estado_atencion).toBe('sin_atender');
    const recargada = await usuario.get(`/api/zonas/${zona_id}`);
    expect(recargada.body.datos.ubicacion.estado).toBe('confirmada');
    expect(recargada.body.datos.ubicacion.punto.latitud).toBeCloseTo(5.6952, 4);
    expect(recargada.body.datos.direccion).toBe('Calle 25 #3-10');
    const mapa = await usuario.get('/api/mapa?capas=zonas');
    expect(mapa.body.datos.elementos.find((elemento: { id: string }) => elemento.id === zona_id).punto).not.toBeNull();
  });

  it('si cambia la dirección, la ubicación anterior queda pendiente y sale del mapa', async () => {
    const editada = await funcionario.patch(`/api/zonas/${zona_id}`, { direccion: 'Carrera 7 #20-15' });
    expect(editada.body.datos.ubicacion.estado).toBe('pendiente');
    const mapa = await usuario.get('/api/mapa?capas=zonas');
    const elemento = mapa.body.datos.elementos.find((item: { id: string }) => item.id === zona_id);
    expect(elemento.punto).toBeNull();
    expect(elemento.estado_ubicacion).toBe('pendiente');
  });

  it('una confirmación hecha con otra dirección no se acepta como confirmada', async () => {
    const respuesta = await funcionario.post('/api/zonas', {
      ...datos_zona(emergencia_id, { direccion: 'Calle 30 #1-1', barrio: 'Centro' }),
      ubicacion: { estado: 'confirmada', punto: { latitud: 5.7, longitud: -76.6 }, direccion_consultada: 'Otra dirección distinta' },
    });
    expect(respuesta.body.datos.ubicacion.estado).toBe('pendiente');
  });

  it('permite guardar sin ubicación (pendiente de georreferenciación) sin inventar un punto', async () => {
    entorno.geocodificador.resultados = [];
    const sin_resultados = await funcionario.get('/api/geocodificacion?pais=Colombia&departamento=Chocó&municipio=Quibdó&direccion=Dirección inexistente');
    expect(sin_resultados.body.datos.coincidencias).toHaveLength(0);
    const respuesta = await funcionario.post('/api/zonas', datos_zona(emergencia_id, { direccion: 'Vereda sin nomenclatura', barrio: '' }));
    expect(respuesta.status).toBe(201);
    expect(respuesta.body.datos.ubicacion).toMatchObject({ estado: 'sin_ubicacion', punto: null });
  });

  it('informa claramente un fallo del proveedor de geocodificación (502)', async () => {
    entorno.geocodificador.debe_fallar = true;
    const respuesta = await funcionario.get('/api/geocodificacion?pais=Colombia&departamento=Chocó&municipio=Quibdó&direccion=Calle 1');
    entorno.geocodificador.debe_fallar = false;
    expect(respuesta.status).toBe(502);
    expect(respuesta.body.mensaje).toMatch(/señalar el lugar en el mapa/);
  });

  it('valida porcentajes, relaciones y transiciones de atención', async () => {
    expect((await funcionario.post('/api/zonas', datos_zona(emergencia_id, { porcentaje_afectacion: 120 }))).status).toBe(400);
    expect((await funcionario.post('/api/zonas', datos_zona('noexiste123'))).status).toBe(400);
    expect((await funcionario.patch(`/api/zonas/${zona_id}/atencion`, { estado_atencion: 'atendida_completamente' })).status).toBe(409);
    expect((await funcionario.patch(`/api/zonas/${zona_id}/atencion`, { estado_atencion: 'en_atencion' })).status).toBe(200);
    expect((await funcionario.patch(`/api/zonas/${zona_id}/atencion`, { estado_atencion: 'atendida_parcialmente' })).status).toBe(200);
    const sugerencia = await usuario.get(`/api/zonas/${zona_id}/prioridad-sugerida`);
    expect(sugerencia.body.datos.prioridad).toBeDefined();
  });

  it('bloquea eliminar una emergencia con zonas asociadas y explica la causa (409)', async () => {
    const respuesta = await administrador.delete(`/api/emergencias/${emergencia_id}`);
    expect(respuesta.status).toBe(409);
    expect(respuesta.body.mensaje).toMatch(/zonas afectadas/);
  });

  it('población: valida coherencia, evita duplicados por zona y el dashboard no duplica personas', async () => {
    const valido = {
      catastrofe_id: emergencia_id,
      zona_id,
      personas_afectadas: 850,
      familias_afectadas: 230,
      ninos: 145,
      adolescentes: 60,
      adultos: 550,
      adultos_mayores: 95,
      personas_heridas: 25,
      personas_evacuadas: 420,
    };
    expect((await funcionario.post('/api/poblacion-afectada', { ...valido, ninos: 900 })).status).toBe(400);
    expect((await funcionario.post('/api/poblacion-afectada', valido)).status).toBe(201);
    expect((await funcionario.post('/api/poblacion-afectada', valido)).status).toBe(409);
    const tablero = await usuario.get(`/api/tablero/indicadores?municipio=Quibdó`);
    expect(tablero.body.datos.poblacion.personas_afectadas).toBe(850);
    expect(tablero.body.datos.poblacion.categorias.personas_heridas).toBe(25);
  });

  it('personas: clasificación automática, pendiente sin edad y datos sensibles cifrados', async () => {
    const con_edad = await funcionario.post('/api/personas-afectadas', {
      catastrofe_id: emergencia_id,
      zona_id,
      nombres: 'Ana',
      apellidos: 'Mosquera',
      edad: 67,
      documento: '1234567890',
      condiciones_vulnerabilidad: ['movilidad_reducida', 'enfermedad_cronica'],
    });
    expect(con_edad.status).toBe(201);
    expect(con_edad.body.datos.grupo_edad).toBe('adulto_mayor');
    expect(con_edad.body.datos.condiciones_vulnerabilidad).toEqual(['movilidad_reducida', 'enfermedad_cronica']);
    const sin_edad = await funcionario.post('/api/personas-afectadas', { catastrofe_id: emergencia_id, zona_id, nombres: 'Registro temporal' });
    expect(sin_edad.body.datos.grupo_edad).toBe('pendiente');
    const crudo = await ModeloPersona.collection.findOne({ nombres: 'Ana' });
    expect(String(crudo?.documentoCifrado)).toMatch(/^v1:/);
    expect(JSON.stringify(crudo)).not.toContain('1234567890');
    expect(JSON.stringify(crudo)).not.toContain('movilidad_reducida');
    const resumen = await usuario.get('/api/personas-afectadas/resumen');
    expect(resumen.body.datos.por_grupo_edad.adulto_mayor).toBe(1);
    expect(JSON.stringify(resumen.body)).not.toContain('Mosquera');
  });

  it('necesidades: exige destinatario según el ámbito y evita duplicados abiertos', async () => {
    const necesidad = {
      catastrofe_id: emergencia_id,
      ambito: 'zona',
      zona_id,
      tipo: 'Agua potable',
      descripcion: 'Agua para 12.000 litros diarios',
      cantidad_requerida: 12000,
      prioridad: 'critica',
      estado: 'pendiente',
    };
    expect((await funcionario.post('/api/necesidades', { ...necesidad, zona_id: undefined })).status).toBe(400);
    expect((await funcionario.post('/api/necesidades', necesidad)).status).toBe(201);
    expect((await funcionario.post('/api/necesidades', necesidad)).status).toBe(409);
  });
});

describe('Donaciones, centros y reportes ciudadanos', () => {
  let emergencia_id = '';
  beforeAll(async () => {
    emergencia_id = (await funcionario.post('/api/emergencias', datos_emergencia({ titulo: 'Emergencia para donaciones' }))).body.datos.id;
  });

  it('las donaciones inician "registrada", no se confirman solas y ocultan al donante para el rol usuario', async () => {
    const creada = await funcionario.post('/api/donaciones', {
      catastrofe_id: emergencia_id,
      tipo: 'Monetaria',
      metodo_pago: 'PSE',
      valor: 50000,
      fecha: '2026-09-25T10:00:00.000Z',
      donante_nombre: 'Persona Donante',
    });
    expect(creada.status).toBe(201);
    expect(creada.body.datos.estado).toBe('registrada');
    const id = creada.body.datos.id;
    expect((await funcionario.patch(`/api/donaciones/${id}/estado`, { estado: 'confirmada' })).status).toBe(409);
    expect((await funcionario.patch(`/api/donaciones/${id}/estado`, { estado: 'en_verificacion' })).status).toBe(200);
    expect((await funcionario.patch(`/api/donaciones/${id}/estado`, { estado: 'confirmada' })).status).toBe(200);
    expect((await funcionario.delete(`/api/donaciones/${id}`)).status).toBe(409);
    const vista_usuario = await usuario.get(`/api/donaciones/${id}`);
    expect(vista_usuario.body.datos.donante_nombre).toBeUndefined();
    expect((await funcionario.get(`/api/donaciones/${id}`)).body.datos.donante_nombre).toBe('Persona Donante');
  });

  it('el centro con donaciones no se elimina; un centro sin relaciones sí', async () => {
    const centro = await funcionario.post('/api/centros-donacion', {
      nombre: 'Centro de Acopio Quibdó',
      pais: 'Colombia',
      departamento: 'Chocó',
      municipio: 'Quibdó',
      direccion: 'Carrera 4 #26-30',
      tipos_donacion: ['Alimentos', 'Agua'],
      estado: 'activo',
    });
    expect(centro.status).toBe(201);
    await funcionario.post('/api/donaciones', {
      catastrofe_id: emergencia_id,
      centro_donacion_id: centro.body.datos.id,
      tipo: 'Alimentos',
      metodo_pago: 'Especie',
      valor: 0,
      fecha: '2026-09-25T10:00:00.000Z',
    });
    expect((await administrador.delete(`/api/centros-donacion/${centro.body.datos.id}`)).status).toBe(409);
  });

  it('los reportes ciudadanos siempre inician pendientes', async () => {
    const respuesta = await funcionario.post('/api/reportes-ciudadanos', {
      titulo: 'Deslizamiento en vía',
      tipo: 'Deslizamiento',
      descripcion: 'Un ciudadano reporta caída de material sobre la vía.',
      pais: 'Colombia',
      departamento: 'Nariño',
      municipio: 'Pasto',
      direccion: 'Vía a La Cruz km 3',
      fecha_reporte: '2026-09-21T15:37:00.000Z',
      fuente: 'Línea 123',
    });
    expect(respuesta.status).toBe(201);
    expect(respuesta.body.datos.estado).toBe('pendiente');
    const archivo = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
    const evidencia = await funcionario.agente
      .post(`/api/reportes-ciudadanos/${respuesta.body.datos.id}/evidencia`)
      .set('X-CSRF-Token', funcionario.token_csrf)
      .attach('evidencia', archivo, { filename: 'foto.png', contentType: 'image/png' });
    expect(evidencia.status).toBe(200);
    const falsa = await funcionario.agente
      .post(`/api/reportes-ciudadanos/${respuesta.body.datos.id}/evidencia`)
      .set('X-CSRF-Token', funcionario.token_csrf)
      .attach('evidencia', Buffer.from('no es imagen'), { filename: 'foto.png', contentType: 'image/png' });
    expect(falsa.status).toBe(400);
    expect((await usuario.get(`/api/reportes-ciudadanos/${respuesta.body.datos.id}/evidencia`)).status).toBe(403);
    expect((await funcionario.get(`/api/reportes-ciudadanos/${respuesta.body.datos.id}/evidencia`)).status).toBe(200);
  });
});

describe('Correspondencia MongoDB ↔ API ↔ dashboard ↔ listados', () => {
  it('los totales del dashboard coinciden con la base y con el listado', async () => {
    const [tablero, listado] = await Promise.all([usuario.get('/api/tablero/indicadores'), usuario.get('/api/emergencias?limite=1')]);
    const en_base = await ModeloEmergencia.countDocuments();
    expect(tablero.body.datos.emergencias.total).toBe(en_base);
    expect(listado.body.paginacion.total).toBe(en_base);
  });

  it('pagina y ordena con parámetros permitidos e ignora operadores inyectados', async () => {
    const pagina = await usuario.get('/api/emergencias?limite=2&pagina=2&orden=titulo');
    expect(pagina.body.paginacion.limite).toBe(2);
    expect(pagina.body.paginacion.pagina).toBe(2);
    const inyeccion = await usuario.get('/api/emergencias?estado[$ne]=activa');
    expect(inyeccion.status).toBe(200);
  });
});
