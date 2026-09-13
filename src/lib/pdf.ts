import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/**
 * Android's WebView (used by Capacitor) does not implement window.print()
 * at all — tapping a "print" button there just does nothing, silently.
 * So instead we render the element to an image and build a real PDF file
 * client-side, then:
 *  - on Android/iOS: save it to the device and open the native Share sheet
 *    so the user can save it to Downloads, send it via WhatsApp, etc.
 *  - on web: trigger a normal browser download.
 */
export async function exportElementAsPdf(elementId: string, filename: string): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) throw new Error('Could not find the content to export.');

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);

  const canvas = await html2canvas(element, {
    scale: 2,
    backgroundColor: '#ffffff',
    useCORS: true,
  });

  const imgData = canvas.toDataURL('image/jpeg', 0.92);
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  // If content is taller than one page, scale it down to fit a single page
  // rather than cutting it off — report cards should stay on one sheet.
  const finalHeight = Math.min(imgHeight, pageHeight);
  const finalWidth = finalHeight === imgHeight ? imgWidth : (canvas.width * finalHeight) / canvas.height;
  const xOffset = (pageWidth - finalWidth) / 2;

  pdf.addImage(imgData, 'JPEG', xOffset, 0, finalWidth, finalHeight);

  if (Capacitor.isNativePlatform()) {
    const base64 = pdf.output('datauristring').split(',')[1];
    const result = await Filesystem.writeFile({
      path: `${filename}.pdf`,
      data: base64,
      directory: Directory.Cache,
    });
    await Share.share({
      title: filename,
      url: result.uri,
    });
  } else {
    pdf.save(`${filename}.pdf`);
  }
}
