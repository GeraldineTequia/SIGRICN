import { obtener_etiqueta } from '@dominio/reglas/catalogos';

export { obtener_etiqueta };

const ZONA_HORARIA = 'America/Bogota';

export function formatear_fecha(valor: unknown, con_hora = false): string {
  if (!valor) return '—';
  const fecha = new Date(String(valor));
  if (Number.isNaN(fecha.getTime())) return String(valor);
  return fecha.toLocaleString('es-CO', {
    timeZone: ZONA_HORARIA,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(con_hora ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

export function formatear_numero(valor: unknown): string {
  return typeof valor === 'number' && Number.isFinite(valor) ? valor.toLocaleString('es-CO') : '—';
}

/** Montos en pesos colombianos enteros (COP). */
export function formatear_moneda(valor: unknown, compacto = false): string {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return '—';
  if (compacto && Math.abs(valor) >= 1_000_000) return `$${(valor / 1_000_000).toLocaleString('es-CO', { maximumFractionDigits: 1 })} M`;
  return `$${valor.toLocaleString('es-CO')}`;
}

export function iniciales(nombre: string, apellido = ''): string {
  return `${nombre.trim().charAt(0)}${apellido.trim().charAt(0)}`.toUpperCase() || 'SG';
}

/** Para campos de fecha y hora local (<input type="datetime-local">). */
export function a_fecha_local(valor: unknown): string {
  if (!valor) return '';
  const fecha = new Date(String(valor));
  if (Number.isNaN(fecha.getTime())) return '';
  const desfase = fecha.getTimezoneOffset() * 60_000;
  return new Date(fecha.getTime() - desfase).toISOString().slice(0, 16);
}

export function desde_fecha_local(valor: string): string | null {
  if (!valor) return null;
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha.toISOString();
}

export function identificador_corto(id: string, prefijo: string): string {
  return `${prefijo}-${id.slice(-6).toUpperCase()}`;
}

/** Clave única por operación: evita duplicar movimientos si se reintenta un envío (idempotencia). */
export function nueva_clave_idempotencia(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function descargar_archivo(contenido: Blob, nombre: string): void {
  const url = URL.createObjectURL(contenido);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Marca de orden de bytes: permite que Excel abra el CSV en UTF-8 con tildes correctas. */
const MARCA_BOM = String.fromCharCode(0xfeff);

/** Exporta filas a CSV (para "Exportar" en tablas). Escapa comillas y evita inyección de fórmulas. */
export function exportar_csv(nombre: string, columnas: { titulo: string; valor: (fila: Record<string, unknown>) => unknown }[], filas: Record<string, unknown>[]): void {
  const escapar = (valor: unknown) => {
    let texto = valor === null || valor === undefined ? '' : String(valor);
    if (/^[=+\-@]/.test(texto)) texto = `'${texto}`;
    return `"${texto.replace(/"/g, '""')}"`;
  };
  const lineas = [columnas.map((columna) => escapar(columna.titulo)).join(';'), ...filas.map((fila) => columnas.map((columna) => escapar(columna.valor(fila))).join(';'))];
  descargar_archivo(new Blob([MARCA_BOM, lineas.join('\r\n')], { type: 'text/csv;charset=utf-8' }), nombre);
}
