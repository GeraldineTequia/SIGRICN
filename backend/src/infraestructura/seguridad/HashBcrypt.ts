import bcrypt from 'bcrypt';
import type { IHashContrasenas } from '../../dominio/contratos/autenticacion';

/**
 * Hash de contraseñas con bcrypt. compare() acepta los prefijos $2a$, $2b$ y $2y$,
 * por lo que los hashes existentes en la colección Usuarios siguen funcionando.
 */
export class HashBcrypt implements IHashContrasenas {
  private readonly _costo: number;

  constructor(costo = 12) {
    this._costo = costo;
  }

  generar(contrasena: string): Promise<string> {
    return bcrypt.hash(contrasena, this._costo);
  }

  async comparar(contrasena: string, hash: string): Promise<boolean> {
    if (!/^\$2[aby]\$\d{2}\$/.test(hash)) return false;
    return bcrypt.compare(contrasena, hash);
  }
}
