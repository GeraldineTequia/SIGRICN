/**
 * Verifica el contraste WCAG de los pares de colores usados en la interfaz.
 * Las transparencias se componen sobre su fondo real antes de medir.
 * Uso: node scripts/verificar_contraste.mjs   (termina con código 1 si algún par no cumple)
 */
const hex = (valor) => {
  const limpio = valor.replace('#', '');
  return [0, 2, 4].map((inicio) => parseInt(limpio.slice(inicio, inicio + 2), 16));
};
const componer = ([r, g, b, alfa], fondo) => fondo.map((canal, indice) => Math.round([r, g, b][indice] * alfa + canal * (1 - alfa)));
const luminancia = (rgb) =>
  rgb
    .map((canal) => canal / 255)
    .map((canal) => (canal <= 0.03928 ? canal / 12.92 : ((canal + 0.055) / 1.055) ** 2.4))
    .reduce((suma, canal, indice) => suma + canal * [0.2126, 0.7152, 0.0722][indice], 0);
const contraste = (primero, segundo) => {
  const [claro, oscuro] = [luminancia(primero), luminancia(segundo)].sort((a, b) => b - a);
  return (claro + 0.05) / (oscuro + 0.05);
};

const BLANCO = hex('#FFFFFF');
const FONDO = hex('#F2F2F2');
const SUPERFICIE_OSCURA = hex('#1E262B');
const primario_suave = componer([92, 179, 197, 0.14], BLANCO);
const advertencia_suave = componer([242, 183, 5, 0.16], BLANCO);
const peligro_suave = componer([218, 3, 37, 0.1], BLANCO);
const primario_suave_oscuro = componer([92, 179, 197, 0.16], SUPERFICIE_OSCURA);
const advertencia_suave_oscuro = componer([242, 183, 5, 0.14], SUPERFICIE_OSCURA);
const peligro_suave_oscuro = componer([218, 3, 37, 0.18], SUPERFICIE_OSCURA);

// [descripción, texto, fondo, mínimo]
const pares = [
  ['Texto principal sobre superficie', hex('#595959'), BLANCO, 4.5],
  ['Texto principal sobre fondo general', hex('#595959'), FONDO, 4.5],
  ['Texto suave sobre superficie', hex('#6B6B6B'), BLANCO, 4.5],
  ['Texto suave sobre fondo general', hex('#6B6B6B'), FONDO, 4.5],
  ['Blanco sobre botón primario intenso', BLANCO, hex('#287687'), 4.5],
  ['Primario texto sobre primario suave', hex('#1F5F6D'), primario_suave, 4.5],
  ['Advertencia texto sobre advertencia suave', hex('#6B4E00'), advertencia_suave, 4.5],
  ['Peligro texto sobre peligro suave', hex('#A8001B'), peligro_suave, 4.5],
  ['Blanco sobre botón de peligro', BLANCO, hex('#DA0325'), 4.5],
  ['Texto oscuro sobre amarillo', hex('#2E2A1E'), hex('#F2B705'), 4.5],
  ['Celeste sobre barra lateral', hex('#5CB3C5'), hex('#22313A'), 4.5],
  ['Texto lateral sobre barra lateral', hex('#DCE4E7'), hex('#22313A'), 4.5],
  ['Peligro (texto) sobre superficie', hex('#DA0325'), BLANCO, 4.5],
  ['Foco (#287687) sobre superficie (gráfico)', hex('#287687'), BLANCO, 3],
  ['Celeste (#5CB3C5) sobre blanco: NO se usa como texto', hex('#5CB3C5'), BLANCO, 0],
  ['Oscuro: texto sobre superficie', hex('#D9DDDF'), SUPERFICIE_OSCURA, 4.5],
  ['Oscuro: texto suave sobre superficie', hex('#A9B1B5'), SUPERFICIE_OSCURA, 4.5],
  ['Oscuro: primario texto sobre primario suave', hex('#8FD3E0'), primario_suave_oscuro, 4.5],
  ['Oscuro: advertencia texto sobre advertencia suave', hex('#F5C842'), advertencia_suave_oscuro, 4.5],
  ['Oscuro: peligro texto sobre peligro suave', hex('#FF8A9B'), peligro_suave_oscuro, 4.5],
  ['Oscuro: blanco sobre botón primario intenso', BLANCO, hex('#287687'), 4.5],
  ['Icono blanco sobre marcador de zona (#A56F00)', BLANCO, hex('#A56F00'), 3],
  ['Icono blanco sobre marcador de emergencia', BLANCO, hex('#DA0325'), 3],
  ['Icono blanco sobre marcador de centro', BLANCO, hex('#287687'), 3],
  ...['#287687', '#A56F00', '#595959', '#3E8C9C', '#7A5A00', '#1F5F6D', '#8A8A8A'].map((color) => [`Serie gráfico claro ${color} sobre #F7F8F8`, hex(color), hex('#F7F8F8'), 3]),
  ...['#5CB3C5', '#F2B705', '#D9DDDF', '#8FD3E0', '#F5C842', '#A9B1B5', '#7FC4D1'].map((color) => [`Serie gráfico oscuro ${color} sobre #232C32`, hex(color), hex('#232C32'), 3]),
];

let fallos = 0;
for (const [descripcion, texto, fondo, minimo] of pares) {
  const valor = contraste(texto, fondo);
  const cumple = valor >= minimo;
  if (!cumple) fallos += 1;
  console.log(`${cumple ? 'OK   ' : 'FALLA'} ${valor.toFixed(2)}:1 (mínimo ${minimo}:1) · ${descripcion}`);
}
console.log(fallos === 0 ? '\nTodos los pares cumplen.' : `\n${fallos} pares no cumplen.`);
process.exit(fallos === 0 ? 0 : 1);
