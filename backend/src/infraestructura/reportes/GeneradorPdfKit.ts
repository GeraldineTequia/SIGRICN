import PDFDocument from 'pdfkit';
import type { DocumentoReportePdf, IGeneradorPdf, SeccionReportePdf } from '../../dominio/contratos/servicios_externos';

const MARGEN = 40;
const COLOR_PRIMARIO = '#287687';
const COLOR_TEXTO = '#3a3a3a';
const COLOR_BORDE = '#cfcfcf';

/**
 * Generación de reportes PDF con PDFKit (RF24): título, fecha, filtros, tablas por categoría
 * y numeración "Página X de Y". Las filas ya llegan filtradas según los permisos del usuario.
 */
export class GeneradorPdfKit implements IGeneradorPdf {
  generar(documento: DocumentoReportePdf): Promise<Buffer> {
    return new Promise((resolver, rechazar) => {
      const pdf = new PDFDocument({ size: 'A4', layout: 'landscape', margin: MARGEN, bufferPages: true, info: { Title: documento.titulo, Author: 'SGRICN' } });
      const partes: Buffer[] = [];
      pdf.on('data', (parte: Buffer) => partes.push(parte));
      pdf.on('end', () => resolver(Buffer.concat(partes)));
      pdf.on('error', rechazar);

      this._escribir_encabezado(pdf, documento);
      if (documento.secciones.every((seccion) => seccion.filas.length === 0)) {
        pdf.moveDown().fontSize(12).fillColor(COLOR_TEXTO).text('No existen resultados para los filtros seleccionados.');
      }
      for (const seccion of documento.secciones) this._escribir_seccion(pdf, seccion);
      this._numerar_paginas(pdf);
      pdf.end();
    });
  }

  private _escribir_encabezado(pdf: PDFKit.PDFDocument, documento: DocumentoReportePdf): void {
    pdf.fillColor(COLOR_PRIMARIO).fontSize(20).font('Helvetica-Bold').text(documento.titulo);
    pdf.moveDown(0.3).font('Helvetica').fontSize(10).fillColor(COLOR_TEXTO);
    pdf.text(`Generado: ${documento.fecha_generacion} · Por: ${documento.generado_por}`);
    pdf.text(`Filtros: ${documento.filtros_aplicados.length > 0 ? documento.filtros_aplicados.join(' · ') : 'sin filtros'}`);
    pdf.moveDown(0.8);
  }

  private _escribir_seccion(pdf: PDFKit.PDFDocument, seccion: SeccionReportePdf): void {
    const ancho_util = pdf.page.width - MARGEN * 2;
    if (pdf.y > pdf.page.height - 140) pdf.addPage();
    pdf.font('Helvetica-Bold').fontSize(13).fillColor(COLOR_PRIMARIO).text(`${seccion.titulo} (${seccion.filas.length})`, MARGEN);
    if (seccion.nota) pdf.font('Helvetica-Oblique').fontSize(8.5).fillColor(COLOR_TEXTO).text(seccion.nota, MARGEN);
    pdf.moveDown(0.3);
    if (seccion.filas.length === 0) {
      pdf.font('Helvetica').fontSize(10).fillColor(COLOR_TEXTO).text('Sin registros para esta categoría.', MARGEN).moveDown();
      return;
    }
    const total_relativo = seccion.columnas.reduce((suma, columna) => suma + columna.ancho, 0);
    const anchos = seccion.columnas.map((columna) => (columna.ancho / total_relativo) * ancho_util);
    const dibujar_fila = (celdas: string[], es_encabezado: boolean) => {
      pdf.font(es_encabezado ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5);
      const alturas = celdas.map((celda, indice) => pdf.heightOfString(celda, { width: anchos[indice] - 6 }));
      const altura = Math.max(...alturas, 10) + 6;
      if (pdf.y + altura > pdf.page.height - MARGEN - 20) {
        pdf.addPage();
        if (!es_encabezado) dibujar_fila(seccion.columnas.map((columna) => columna.titulo), true);
      }
      const y_inicial = pdf.y;
      let x = MARGEN;
      if (es_encabezado) pdf.rect(MARGEN, y_inicial, ancho_util, altura).fill('#e8f4f7');
      celdas.forEach((celda, indice) => {
        pdf.fillColor(COLOR_TEXTO).text(celda, x + 3, y_inicial + 3, { width: anchos[indice] - 6 });
        x += anchos[indice];
      });
      pdf.moveTo(MARGEN, y_inicial + altura).lineTo(MARGEN + ancho_util, y_inicial + altura).strokeColor(COLOR_BORDE).stroke();
      pdf.y = y_inicial + altura;
    };
    dibujar_fila(seccion.columnas.map((columna) => columna.titulo), true);
    for (const fila of seccion.filas) dibujar_fila(fila, false);
    pdf.moveDown(1);
  }

  private _numerar_paginas(pdf: PDFKit.PDFDocument): void {
    const rango = pdf.bufferedPageRange();
    for (let indice = rango.start; indice < rango.start + rango.count; indice += 1) {
      pdf.switchToPage(indice);
      const margen_inferior = pdf.page.margins.bottom;
      pdf.page.margins.bottom = 0;
      pdf
        .font('Helvetica')
        .fontSize(8)
        .fillColor('#6b6b6b')
        .text(`SGRICN · Página ${indice + 1} de ${rango.count}`, MARGEN, pdf.page.height - 28, {
          width: pdf.page.width - MARGEN * 2,
          align: 'right',
        });
      pdf.page.margins.bottom = margen_inferior;
    }
  }
}
