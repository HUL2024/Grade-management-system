import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import type jsPDFType from 'jspdf';

/**
 * Renders a DOM element to a canvas. Captures the FULL element regardless
 * of viewport/scroll — used both for single exports and bulk (one capture
 * per student).
 */
export async function captureElementCanvas(elementId: string): Promise<HTMLCanvasElement> {
  const element = document.getElementById(elementId);
  if (!element) throw new Error('Could not find the content to export.');
  const { default: html2canvas } = await import('html2canvas');
  return html2canvas(element, {
    scale: 2,
    backgroundColor: '#ffffff',
    useCORS: true,
  });
}

/**
 * Adds a (possibly very tall) canvas to a jsPDF document as one or more
 * pages, so long content is paginated rather than shrunk-to-fit or cropped.
 */
export function addCanvasAsPages(pdf: jsPDFType, canvas: HTMLCanvasElement, addPageBefore: boolean) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgData = canvas.toDataURL('image/jpeg', 0.92);
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  if (addPageBefore) pdf.addPage();

  if (imgHeight <= pageHeight) {
    pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);
    return;
  }

  // Content is taller than one page — slice it across multiple pages by
  // shifting the same full-height image upward on each new page. Nothing
  // is cropped; it just continues onto the next sheet.
  let heightLeft = imgHeight;
  let position = 0;
  pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;
  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }
}

async function outputPdf(pdf: jsPDFType, filename: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const base64 = pdf.output('datauristring').split(',')[1];
    const result = await Filesystem.writeFile({
      path: `${filename}.pdf`,
      data: base64,
      directory: Directory.Cache,
    });
    await Share.share({ title: filename, url: result.uri });
  } else {
    pdf.save(`${filename}.pdf`);
  }
}

/** Exports a single element (e.g. one report card) as its own PDF. */
export async function exportElementAsPdf(elementId: string, filename: string): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const canvas = await captureElementCanvas(elementId);
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  addCanvasAsPages(pdf, canvas, false);
  await outputPdf(pdf, filename);
}

/**
 * Builds one combined PDF from a sequence of captures — used for "download
 * all report cards for this class". The caller is responsible for updating
 * whatever state makes `elementId` render the next student between calls.
 */
export async function exportManyAsPdf(
  elementId: string,
  count: number,
  prepareNext: (index: number) => Promise<void>,
  filename: string
): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  for (let i = 0; i < count; i++) {
    await prepareNext(i);
    const canvas = await captureElementCanvas(elementId);
    addCanvasAsPages(pdf, canvas, i > 0);
  }
  await outputPdf(pdf, filename);
}
