import crypto from 'node:crypto';
import { promises as sistema_archivos } from 'node:fs';
import path from 'node:path';
import { ErrorValidacion } from '../../dominio/errores';
import type { ArchivoEvidencia, IAlmacenEvidencias } from '../../dominio/contratos/servicios_externos';

/** Firmas binarias permitidas: se valida el contenido real, no sólo la extensión o el tipo declarado. */
const FIRMAS: Record<string, { extension: string; comprobar: (contenido: Buffer) => boolean }> = {
  'image/jpeg': { extension: '.jpg', comprobar: (contenido) => contenido.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) },
  'image/png': {
    extension: '.png',
    comprobar: (contenido) => contenido.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  'application/pdf': { extension: '.pdf', comprobar: (contenido) => contenido.subarray(0, 5).toString('latin1') === '%PDF-' },
};

export const TIPOS_EVIDENCIA_PERMITIDOS = Object.keys(FIRMAS);

/**
 * Evidencias de reportes ciudadanos en disco, fuera de cualquier carpeta pública.
 * Se descargan sólo mediante un endpoint autenticado y autorizado.
 */
export class AlmacenEvidenciasDisco implements IAlmacenEvidencias {
  private readonly _directorio: string;

  constructor(directorio: string) {
    this._directorio = directorio;
  }

  async guardar(archivo: ArchivoEvidencia): Promise<string> {
    const firma = FIRMAS[archivo.tipo_mime];
    const contenido = Buffer.from(archivo.contenido);
    if (!firma || !firma.comprobar(contenido)) {
      throw new ErrorValidacion({ evidencia: 'La evidencia debe ser una imagen JPG o PNG, o un documento PDF válido.' });
    }
    await sistema_archivos.mkdir(this._directorio, { recursive: true });
    const nombre_almacenado = `${crypto.randomUUID()}${firma.extension}`;
    await sistema_archivos.writeFile(path.join(this._directorio, nombre_almacenado), contenido, { flag: 'wx' });
    return nombre_almacenado;
  }

  async leer(nombre_almacenado: string): Promise<Buffer> {
    return sistema_archivos.readFile(this._ruta_segura(nombre_almacenado));
  }

  async eliminar(nombre_almacenado: string): Promise<void> {
    await sistema_archivos.rm(this._ruta_segura(nombre_almacenado), { force: true });
  }

  /** Evita recorridos de directorio: sólo se aceptan nombres generados por el sistema. */
  private _ruta_segura(nombre: string): string {
    if (!/^[0-9a-f-]{36}\.(jpg|png|pdf)$/.test(nombre)) throw new ErrorValidacion({ evidencia: 'Nombre de evidencia inválido.' });
    return path.join(this._directorio, nombre);
  }
}
