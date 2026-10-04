import type { Model } from 'mongoose';
import type { CredencialesAlmacenadas, IRepositorioUsuarios } from '../../../dominio/contratos/autenticacion';
import type { Registro } from '../../../dominio/contratos/repositorio';
import { ErrorConflicto } from '../../../dominio/errores';
import { candidatos_identificador } from '../identificadores';
import { MapeadorDocumento } from '../mapeadores/MapeadorDocumento';
import { MAPEO_USUARIO } from '../mapeadores/definiciones';
import { RepositorioMongo } from './RepositorioMongo';

type Documento = Record<string, unknown>;

/** Comparación de correos sin distinguir mayúsculas (los correos heredados pueden no estar normalizados). */
const COLACION_CORREO = { locale: 'es', strength: 2 } as const;

/**
 * El hash (campo heredado "password") sólo se lee en buscar_credenciales y nunca pasa por el mapeador,
 * por lo que no puede filtrarse en ninguna respuesta de la API.
 */
export class RepositorioUsuarios extends RepositorioMongo implements IRepositorioUsuarios {
  constructor(modelo: Model<Documento>) {
    super(modelo, new MapeadorDocumento(MAPEO_USUARIO));
  }

  async buscar_credenciales(correo: string): Promise<CredencialesAlmacenadas | null> {
    const documento = await this._modelo.findOne({ correo: correo.trim() }).collation(COLACION_CORREO).lean<Documento>();
    if (!documento || typeof documento.password !== 'string') return null;
    return { usuario: this._mapeador.a_dominio(documento), password_hash: documento.password };
  }

  async existe_correo(correo: string): Promise<boolean> {
    const cantidad = await this._modelo.countDocuments({ correo: correo.trim() }).collation(COLACION_CORREO);
    return cantidad > 0;
  }

  async crear_cuenta(datos: Record<string, unknown>, password_hash: string): Promise<Registro> {
    try {
      const creado = await this._modelo.create({ ...this._mapeador.a_documento(datos), password: password_hash });
      return this._mapeador.a_dominio(creado.toObject() as Documento);
    } catch (error) {
      if ((error as { code?: number }).code === 11000) throw new ErrorConflicto('Ya existe una cuenta con ese correo.');
      throw error;
    }
  }

  async actualizar_password(id: string, password_hash: string): Promise<void> {
    await this._modelo.updateOne({ _id: { $in: candidatos_identificador(id) } }, { $set: { password: password_hash } });
  }

  async registrar_ultima_sesion(id: string, fecha: Date): Promise<void> {
    await this._modelo.updateOne({ _id: { $in: candidatos_identificador(id) } }, { $set: { ultimaSesion: fecha } });
  }
}
