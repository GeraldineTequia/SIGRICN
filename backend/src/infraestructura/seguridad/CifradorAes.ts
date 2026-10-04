import crypto from 'node:crypto';
import type { ICifrador } from '../../dominio/contratos/servicios_externos';

/**
 * Cifrado autenticado AES-256-GCM para datos sensibles almacenados (RNF5): documento de identidad,
 * condiciones de vulnerabilidad y observaciones de personas afectadas.
 * Formato guardado: v1:<iv base64>:<etiqueta base64>:<texto cifrado base64>.
 * La clave vive sólo en la variable de entorno CLAVE_CIFRADO_DATOS (fuera del código y de la base).
 */
export class CifradorAes implements ICifrador {
  private readonly _clave: Buffer;

  constructor(clave_base64: string) {
    const clave = Buffer.from(clave_base64, 'base64');
    if (clave.length !== 32) throw new Error('CLAVE_CIFRADO_DATOS debe contener 32 bytes en base64.');
    this._clave = clave;
  }

  cifrar(texto: string): string {
    const vector_inicial = crypto.randomBytes(12);
    const cifrador = crypto.createCipheriv('aes-256-gcm', this._clave, vector_inicial);
    const cifrado = Buffer.concat([cifrador.update(texto, 'utf8'), cifrador.final()]);
    const etiqueta = cifrador.getAuthTag();
    return ['v1', vector_inicial.toString('base64'), etiqueta.toString('base64'), cifrado.toString('base64')].join(':');
  }

  descifrar(texto_cifrado: string): string {
    const [version, vector_inicial, etiqueta, cifrado] = texto_cifrado.split(':');
    if (version !== 'v1' || !vector_inicial || !etiqueta || !cifrado) throw new Error('Formato de dato cifrado no reconocido.');
    const descifrador = crypto.createDecipheriv('aes-256-gcm', this._clave, Buffer.from(vector_inicial, 'base64'));
    descifrador.setAuthTag(Buffer.from(etiqueta, 'base64'));
    return Buffer.concat([descifrador.update(Buffer.from(cifrado, 'base64')), descifrador.final()]).toString('utf8');
  }
}
