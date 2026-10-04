import { render, screen } from '@testing-library/react';
import { ESQUEMA_EMERGENCIA } from '@dominio/validacion/esquemas';
import { MENSAJE_MAGNITUD_TERREMOTO } from '@dominio/reglas/regla_magnitud';
import { PilaAvisos } from '../componentes/alertas/PilaAvisos';
import { Insignia } from '../componentes/tarjetas/Insignia';
import { CAMPOS_EMERGENCIA, reglas_estrategia } from '../paginas/emergencias/definicion_emergencias';
import { calcular_completitud, preparar_envio, validar_formulario } from '../validadores/validar_formulario';

const BASE = {
  titulo: 'Sismo en zona norte',
  tipo: 'Terremoto',
  descripcion: 'Sismo que afecta infraestructura de la zona norte.',
  fecha_inicio: '2026-09-23T10:42:00.000Z',
  nivel_emergencia: 'alto',
  fuente_informacion: 'Servicio Geológico',
  pais: 'Colombia',
  departamento: 'Antioquia',
  municipio: 'Medellín',
};

describe('Validación del formulario de emergencias (misma regla que el backend)', () => {
  it('rechaza un terremoto de magnitud 4.9 con el mensaje oficial', () => {
    const datos = { ...BASE, magnitud: '4.9' };
    const envio = preparar_envio(datos, CAMPOS_EMERGENCIA, false);
    const errores = validar_formulario(envio, ESQUEMA_EMERGENCIA, CAMPOS_EMERGENCIA, datos, reglas_estrategia);
    expect(errores.magnitud).toBe(MENSAJE_MAGNITUD_TERREMOTO);
  });

  it('acepta 5.0 y 5.1', () => {
    for (const magnitud of ['5.0', '5.1']) {
      const datos = { ...BASE, magnitud };
      const envio = preparar_envio(datos, CAMPOS_EMERGENCIA, false);
      expect(validar_formulario(envio, ESQUEMA_EMERGENCIA, CAMPOS_EMERGENCIA, datos, reglas_estrategia)).toEqual({});
    }
  });

  it('no muestra ni envía la magnitud para otros tipos', () => {
    const datos = { ...BASE, tipo: 'Incendio forestal', magnitud: '3' };
    const envio = preparar_envio(datos, CAMPOS_EMERGENCIA, false);
    expect(envio).not.toHaveProperty('magnitud');
    expect(validar_formulario(envio, ESQUEMA_EMERGENCIA, CAMPOS_EMERGENCIA, datos, reglas_estrategia)).toEqual({});
  });

  it('nunca solicita coordenadas: no hay campos de latitud ni longitud', () => {
    const nombres = CAMPOS_EMERGENCIA.map((campo) => campo.nombre.toLowerCase());
    expect(nombres.some((nombre) => nombre.includes('latitud') || nombre.includes('longitud'))).toBe(false);
  });

  it('al editar envía la ubicación sin los campos que asigna el servidor', () => {
    const ubicacion = { estado: 'pendiente', punto: { latitud: 2.4, longitud: -76.6 }, direccion_consultada: 'x', direccion_encontrada: 'y', origen: 'geocodificacion', precision: 'aproximada', confirmada_por: 'abc', confirmada_en: '2026-10-01T00:00:00.000Z' };
    const envio = preparar_envio({ ...BASE, magnitud: 5.2, ubicacion }, CAMPOS_EMERGENCIA, true);
    expect(envio.ubicacion).not.toHaveProperty('confirmada_por');
    expect(validar_formulario(envio, ESQUEMA_EMERGENCIA, CAMPOS_EMERGENCIA, { ...BASE, magnitud: 5.2 }, reglas_estrategia)).toEqual({});
  });

  it('calcula la completitud sobre los campos obligatorios visibles', () => {
    expect(calcular_completitud({}, CAMPOS_EMERGENCIA)).toBe(0);
    expect(calcular_completitud({ ...BASE, magnitud: 5 }, CAMPOS_EMERGENCIA)).toBe(100);
  });
});

describe('Accesibilidad de componentes', () => {
  it('los errores usan role="alert" y el éxito role="status"', () => {
    render(
      <PilaAvisos
        avisos={[
          { id: 1, tipo: 'error', titulo: 'Fallo', persistente: true },
          { id: 2, tipo: 'exito', titulo: 'Guardado', persistente: false },
        ]}
        al_cerrar={() => undefined}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Fallo');
    expect(screen.getByRole('status')).toHaveTextContent('Guardado');
    expect(screen.getAllByRole('button', { name: /Cerrar aviso/ })).toHaveLength(2);
  });

  it('las insignias muestran texto e icono, no sólo color', () => {
    const { container } = render(<Insignia valor="critico" />);
    expect(container).toHaveTextContent('Crítico');
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('el texto de los avisos se muestra como texto (no se interpreta HTML)', () => {
    render(<PilaAvisos avisos={[{ id: 3, tipo: 'informacion', titulo: '<img src=x onerror=alert(1)>', persistente: false }]} al_cerrar={() => undefined} />);
    expect(screen.getByRole('status')).toHaveTextContent('<img src=x onerror=alert(1)>');
    expect(document.querySelector('img')).toBeNull();
  });
});
