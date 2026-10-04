import { CategoryScale, Chart, Filler, Legend, LinearScale, LineElement, PointElement, Tooltip, type ChartOptions, type PointStyle } from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useTema } from '../../contextos/ContextoTema';
import type { SerieMensual } from '../../tipos/api';

Chart.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

/**
 * Colores derivados de la paleta con contraste ≥ 3:1 sobre el fondo real del gráfico (claro y oscuro),
 * y formas de punto distintas por serie: las series no dependen sólo del color.
 * El rojo se reserva para estados críticos, por eso no se usa como color de serie.
 */
const COLORES_CLARO = ['#287687', '#A56F00', '#595959', '#3E8C9C', '#7A5A00', '#1F5F6D', '#8A8A8A'];
const COLORES_OSCURO = ['#5CB3C5', '#F2B705', '#D9DDDF', '#8FD3E0', '#F5C842', '#A9B1B5', '#7FC4D1'];
const FORMAS: PointStyle[] = ['circle', 'rect', 'triangle', 'rectRot', 'star', 'crossRot', 'line'];

/**
 * Gráfico "Catástrofes por mes" del mockup (inspirado en el dashboard de codepen.io/themustafaomar/pen/jLMPKm).
 * Incluye una tabla equivalente para lectores de pantalla y para consultar sin cursor.
 */
export function GraficoEmergencias({ serie }: { serie: SerieMensual }) {
  const { tema } = useTema();
  const color_texto = tema === 'oscuro' ? '#D9DDDF' : '#595959';
  const color_reticula = tema === 'oscuro' ? 'rgba(217,221,223,0.12)' : 'rgba(89,89,89,0.12)';
  const COLORES = tema === 'oscuro' ? COLORES_OSCURO : COLORES_CLARO;
  const datos = {
    labels: serie.meses,
    datasets: serie.series.map((linea, indice) => ({
      label: linea.tipo,
      data: linea.valores,
      borderColor: COLORES[indice % COLORES.length],
      backgroundColor: `${COLORES[indice % COLORES.length]}22`,
      pointStyle: FORMAS[indice % FORMAS.length],
      pointRadius: 5,
      pointHoverRadius: 7,
      pointBackgroundColor: tema === 'oscuro' ? '#1E262B' : '#FFFFFF',
      borderWidth: 2.5,
      tension: 0.4,
      fill: true,
    })),
  };
  const opciones: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? false : { duration: 600 },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'top', align: 'end', labels: { color: color_texto, usePointStyle: true, boxWidth: 8, font: { family: 'Inter Variable, Inter, sans-serif' } } },
      tooltip: { callbacks: { label: (contexto) => ` ${contexto.dataset.label}: ${contexto.formattedValue} emergencias` } },
    },
    scales: {
      x: { ticks: { color: color_texto }, grid: { color: color_reticula } },
      y: { beginAtZero: true, ticks: { color: color_texto, precision: 0 }, grid: { color: color_reticula }, title: { display: true, text: 'Emergencias registradas', color: color_texto } },
    },
  };
  const total = serie.series.reduce((suma, linea) => suma + linea.valores.reduce((parcial, valor) => parcial + valor, 0), 0);
  return (
    <>
      <div className="grafico" role="img" aria-label={`Emergencias por mes y tipo en ${serie.anio}: ${total} en total. La tabla siguiente contiene los mismos datos.`}>
        <Line data={datos} options={opciones} />
      </div>
      <details className="tabla_grafico">
        <summary>Ver los datos del gráfico en una tabla</summary>
        <div className="contenedor_tabla">
          <table className="tabla">
            <caption className="solo_lectores">Emergencias por mes y tipo, {serie.anio}</caption>
            <thead>
              <tr>
                <th scope="col">Tipo</th>
                {serie.meses.map((mes) => (
                  <th key={mes} scope="col" className="numero">
                    {mes.slice(0, 3)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {serie.series.map((linea) => (
                <tr key={linea.tipo}>
                  <th scope="row">{linea.tipo}</th>
                  {linea.valores.map((valor, indice) => (
                    <td key={indice} className="numero">
                      {valor}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}
