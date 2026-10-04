import type { IRepositorioEntidad, Registro } from '../../dominio/contratos/repositorio';
import { ErrorValidacion } from '../../dominio/errores';

/**
 * Comprueba que un registro referenciado pertenezca a la misma emergencia.
 * Evita referencias inconsistentes (por ejemplo, una necesidad de la emergencia A
 * apuntando a una zona de la emergencia B).
 */
export async function exigir_misma_emergencia(
  repositorio: IRepositorioEntidad,
  identificador: unknown,
  catastrofe_id: unknown,
  campo: string,
  nombre: string,
): Promise<Registro | null> {
  if (identificador === null || identificador === undefined || identificador === '') return null;
  const registro = await repositorio.obtener(String(identificador));
  if (!registro) throw new ErrorValidacion({ [campo]: `${nombre} seleccionada no existe.` });
  if (String(registro.catastrofe_id ?? '') !== String(catastrofe_id ?? '')) {
    throw new ErrorValidacion({ [campo]: `${nombre} pertenece a otra emergencia.` });
  }
  return registro;
}
