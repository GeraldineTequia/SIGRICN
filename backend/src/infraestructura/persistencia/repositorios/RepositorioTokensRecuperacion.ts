import type { IRepositorioTokensRecuperacion } from '../../../dominio/contratos/autenticacion';
import { candidatos_identificador, identificador_a_texto, identificador_para_guardar } from '../identificadores';
import { ModeloTokenRecuperacion } from '../modelos/modelos';

/** Sólo se guarda el hash SHA-256 del token y su vencimiento; el token en claro viaja únicamente en el correo. */
export class RepositorioTokensRecuperacion implements IRepositorioTokensRecuperacion {
  async guardar(usuario_id: string, token_hash: string, vence_en: Date): Promise<void> {
    await ModeloTokenRecuperacion.create({ usuarioId: identificador_para_guardar(usuario_id), tokenHash: token_hash, venceEn: vence_en, usadoEn: null });
  }

  async consumir(token_hash: string, ahora: Date): Promise<string | null> {
    // Operación atómica: dos solicitudes simultáneas con el mismo token no pueden usarlo ambas.
    const documento = await ModeloTokenRecuperacion.findOneAndUpdate(
      { tokenHash: token_hash, usadoEn: null, venceEn: { $gt: ahora } },
      { $set: { usadoEn: ahora } },
      { new: true },
    ).lean<Record<string, unknown>>();
    return documento ? identificador_a_texto(documento.usuarioId) : null;
  }

  async invalidar_de_usuario(usuario_id: string): Promise<void> {
    await ModeloTokenRecuperacion.updateMany(
      { usuarioId: { $in: candidatos_identificador(usuario_id) }, usadoEn: null },
      { $set: { usadoEn: new Date() } },
    );
  }
}
