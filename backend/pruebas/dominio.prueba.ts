import { GestorEmergencia } from '../src/dominio/estrategias/GestorEmergencia';
import { EstrategiaInundacion } from '../src/dominio/estrategias/EstrategiaInundacion';
import { EstrategiaTerremoto } from '../src/dominio/estrategias/EstrategiaTerremoto';
import { EstrategiaGeneral } from '../src/dominio/estrategias/EstrategiaGeneral';
import { obtener_estado_emergencia, transicionar_emergencia } from '../src/dominio/estados/EstadosEmergencia';
import { validar_transicion_atencion } from '../src/dominio/estados/estados_atencion_zona';
import { ErrorAplicacion, ErrorValidacion } from '../src/dominio/errores';
import { MENSAJE_MAGNITUD_TERREMOTO, validar_magnitud_terremoto } from '../src/dominio/reglas/regla_magnitud';
import { clasificar_grupo_edad, validar_estadistica_poblacion } from '../src/dominio/reglas/poblacion';
import { sugerir_prioridad_zona } from '../src/dominio/reglas/prioridad_zona';
import { calcular_disponibilidad, calcular_saldo_fondo } from '../src/dominio/reglas/recursos_y_fondos';
import { puede_gestionar_cuenta, tiene_permiso } from '../src/dominio/reglas/permisos';
import { resolver_ubicacion } from '../src/dominio/reglas/ubicacion';
import { validar_contrasena } from '../src/dominio/reglas/contrasena';
import { validar_datos } from '../src/dominio/validacion/validador';
import { ESQUEMA_REGISTRO } from '../src/dominio/validacion/esquemas';

const base = { tipo: 'Terremoto', nivel_emergencia: 'alto', fecha_inicio: '2026-09-01T00:00:00.000Z' };

describe('Regla de magnitud (sección 12)', () => {
  it.each([
    [4.9, MENSAJE_MAGNITUD_TERREMOTO],
    [5.0, null],
    [5.1, null],
    ['5.0', null],
    ['', MENSAJE_MAGNITUD_TERREMOTO],
    [null, MENSAJE_MAGNITUD_TERREMOTO],
    [undefined, MENSAJE_MAGNITUD_TERREMOTO],
    ['abc', MENSAJE_MAGNITUD_TERREMOTO],
    [Number.NaN, MENSAJE_MAGNITUD_TERREMOTO],
    [Number.POSITIVE_INFINITY, MENSAJE_MAGNITUD_TERREMOTO],
  ])('magnitud %s → %s', (magnitud, esperado) => {
    expect(validar_magnitud_terremoto(magnitud)).toBe(esperado);
  });
});

describe('Patrón Strategy', () => {
  const gestor = new GestorEmergencia();

  it('selecciona la estrategia según el tipo', () => {
    expect(gestor.seleccionar_estrategia('Terremoto')).toBeInstanceOf(EstrategiaTerremoto);
    expect(gestor.seleccionar_estrategia('sismo')).toBeInstanceOf(EstrategiaTerremoto);
    expect(gestor.seleccionar_estrategia('Inundación')).toBeInstanceOf(EstrategiaInundacion);
    expect(gestor.seleccionar_estrategia('Incendio forestal')).toBeInstanceOf(EstrategiaGeneral);
  });

  it('rechaza un terremoto de 4.9 con el mensaje oficial', () => {
    try {
      gestor.validar_y_preparar({ ...base, magnitud: 4.9 });
      throw new Error('debía fallar');
    } catch (error) {
      expect(error).toBeInstanceOf(ErrorValidacion);
      expect((error as ErrorValidacion).detalles?.magnitud).toBe(MENSAJE_MAGNITUD_TERREMOTO);
    }
  });

  it('acepta 5.0 y 5.1 y clasifica por magnitud', () => {
    expect(gestor.validar_y_preparar({ ...base, magnitud: 5.0 }).clasificacion.nivel_sugerido).toBe('medio');
    expect(gestor.validar_y_preparar({ ...base, magnitud: 5.1 }).datos.magnitud).toBe(5.1);
    expect(gestor.validar_y_preparar({ ...base, magnitud: 7.2 }).clasificacion.nivel_sugerido).toBe('critico');
  });

  it('no aplica la regla de magnitud a otros tipos y descarta el valor', () => {
    const resultado = gestor.validar_y_preparar({ ...base, tipo: 'Incendio forestal', magnitud: 2 });
    expect(resultado.datos.magnitud).toBeNull();
  });

  it('inundación de nivel alto exige referencia del sector', () => {
    expect(() => gestor.validar_y_preparar({ ...base, tipo: 'Inundación', direccion_referencia: '' })).toThrow(ErrorValidacion);
    expect(() => gestor.validar_y_preparar({ ...base, tipo: 'Inundación', nivel_emergencia: 'bajo' })).not.toThrow();
  });

  it('identifica terremotos históricos sin magnitud como pendientes de validación', () => {
    expect(gestor.es_pendiente_validacion({ tipo: 'Terremoto', magnitud: null })).toBe(true);
    expect(gestor.es_pendiente_validacion({ tipo: 'Inundación' })).toBe(false);
  });
});

describe('Patrón State', () => {
  it('permite activa → en_atencion → controlada → finalizada y fija fechaFin', () => {
    expect(transicionar_emergencia('activa', 'en_atencion', new Date()).estado_nuevo).toBe('en_atencion');
    expect(transicionar_emergencia('en_atencion', 'controlada', new Date()).estado_nuevo).toBe('controlada');
    const fecha = new Date('2026-09-30T10:00:00.000Z');
    const final = transicionar_emergencia('controlada', 'finalizada', fecha);
    expect(final.efectos.fecha_fin).toBe(fecha.toISOString());
  });

  it('rechaza transiciones inválidas', () => {
    expect(() => transicionar_emergencia('activa', 'finalizada', new Date())).toThrow(ErrorAplicacion);
    expect(() => transicionar_emergencia('finalizada', 'activa', new Date())).toThrow(ErrorAplicacion);
    expect(() => transicionar_emergencia('en_atencion', 'activa', new Date())).toThrow(ErrorAplicacion);
  });

  it('interpreta estados heredados documentados y rechaza desconocidos', () => {
    expect(obtener_estado_emergencia('en_proceso').nombre).toBe('en_atencion');
    expect(obtener_estado_emergencia('cerrada').nombre).toBe('finalizada');
    expect(() => obtener_estado_emergencia('valor_raro')).toThrow(ErrorAplicacion);
  });

  it('valida transiciones de atención de zonas', () => {
    expect(validar_transicion_atencion(undefined, 'en_atencion')).toBe('sin_atender');
    expect(() => validar_transicion_atencion('sin_atender', 'atendida_completamente')).toThrow(ErrorAplicacion);
  });
});

describe('Población, prioridad, recursos y fondos', () => {
  it('clasifica grupos de edad sin solapamientos y deja pendiente si falta la edad', () => {
    expect(clasificar_grupo_edad(11)).toBe('nino');
    expect(clasificar_grupo_edad(12)).toBe('adolescente');
    expect(clasificar_grupo_edad(17)).toBe('adolescente');
    expect(clasificar_grupo_edad(18)).toBe('adulto');
    expect(clasificar_grupo_edad(60)).toBe('adulto_mayor');
    expect(clasificar_grupo_edad(null)).toBe('pendiente');
  });

  it('valida coherencia de estadísticas sin sumar categorías solapables', () => {
    expect(validar_estadistica_poblacion({ personas_afectadas: 100, ninos: 50, adultos: 60 })).toHaveProperty('personas_afectadas');
    // Heridas + evacuadas superan el total, pero cada una por separado es válida: no se suman.
    expect(validar_estadistica_poblacion({ personas_afectadas: 100, personas_heridas: 80, personas_evacuadas: 90 })).toEqual({});
  });

  it('sugiere prioridad con criterios documentados', () => {
    const sugerencia = sugerir_prioridad_zona({
      nivel_afectacion: 'alto',
      porcentaje_afectacion: 86,
      nivel_emergencia: 'critico',
      personas_afectadas: 4320,
      necesidades_criticas_pendientes: 2,
      estado_atencion: 'sin_atender',
    });
    expect(sugerencia.prioridad).toBe('critica');
    expect(sugerencia.motivos.length).toBeGreaterThan(3);
  });

  it('calcula disponibilidad y saldo', () => {
    expect(calcular_disponibilidad(0, 10)).toBe('agotado');
    expect(calcular_disponibilidad(5, 10)).toBe('insuficiente');
    expect(calcular_disponibilidad(50, 10)).toBe('disponible');
    expect(calcular_saldo_fondo(2800, 1160, 820)).toBe(820);
  });
});

describe('Permisos, validación y ubicación', () => {
  it('aplica la matriz de permisos', () => {
    expect(tiene_permiso('usuario', 'consultar_informacion_operativa')).toBe(true);
    expect(tiene_permiso('usuario', 'crear_registros_operativos')).toBe(false);
    expect(tiene_permiso('funcionario', 'administrar_cuentas')).toBe(true);
    expect(puede_gestionar_cuenta('funcionario', 'usuario', 'administrador')).toBe(false);
    expect(puede_gestionar_cuenta('funcionario', 'administrador')).toBe(false);
    expect(puede_gestionar_cuenta('administrador', 'usuario', 'funcionario')).toBe(true);
  });

  it('rechaza campos no permitidos como "rol" en el registro', () => {
    const resultado = validar_datos({ nombre: 'Ana', rol: 'administrador' }, ESQUEMA_REGISTRO);
    expect(resultado.errores.rol).toMatch(/no está permitido/);
  });

  it('valida la política de contraseñas', () => {
    expect(validar_contrasena('corta1')).toHaveProperty('password');
    expect(validar_contrasena('sinnumeros')).toHaveProperty('password');
    expect(validar_contrasena('Clave segura 2026', 'otra')).toHaveProperty('confirmacion_password');
    expect(validar_contrasena('Clave segura 2026', 'Clave segura 2026')).toEqual({});
  });

  it('marca como pendiente una ubicación confirmada cuando cambia la dirección', () => {
    const confirmada = resolver_ubicacion(
      'Calle 1, Quibdó, Chocó, Colombia',
      {
        estado: 'confirmada',
        punto: { latitud: 5.69, longitud: -76.65 },
        direccion_consultada: 'Calle 1, Quibdó, Chocó, Colombia',
        direccion_encontrada: 'Calle 1',
        origen: 'geocodificacion',
        precision: 'direccion',
      },
      null,
      'usuario1',
      new Date(),
    );
    expect(confirmada.estado).toBe('confirmada');
    const despues = resolver_ubicacion('Calle 99, Quibdó, Chocó, Colombia', null, confirmada, 'usuario1', new Date());
    expect(despues.estado).toBe('pendiente');
  });
});
