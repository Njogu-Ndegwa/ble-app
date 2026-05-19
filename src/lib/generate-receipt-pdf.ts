import type { ReceiptRow } from '@/components/shared/SuccessReceipt';
import { isAndroidWebView, saveFileViaAndroid } from './android-bridge';

/**
 * Generate a PDF receipt from SuccessReceipt data and trigger download/share.
 *
 * Download strategy (in order):
 * 1. Android WebView  → save via JSBridge saveFile handler
 * 2. Web Share API    → native share sheet (supported mobile browsers)
 * 3. Anchor download  → standard browser fallback
 */
export async function generateReceiptPdf(
  title: string,
  rows: ReceiptRow[],
  receiptId?: string,
  logoSrc?: string,
): Promise<void> {
  const { jsPDF } = await import('jspdf');

  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = 210;
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // ── Logo ──────────────────────────────────────────────────────────────────
  const resolvedLogo = logoSrc ?? '/assets/Logo-Oves.png';
  let logoLoaded = false;
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const el = new window.Image();
      el.crossOrigin = 'anonymous';
      el.onload = () => res(el);
      el.onerror = rej;
      el.src = resolvedLogo;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext('2d')!.drawImage(img, 0, 0);
    const logoH = 14;
    const logoW = logoH * (img.naturalWidth / img.naturalHeight);
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', pageWidth - margin - logoW, y, logoW, logoH);
    logoLoaded = true;
  } catch {
    // logo unavailable — fall back to text
  }

  if (!logoLoaded) {
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(0, 0, 0);
    pdf.text('OVES Energy', pageWidth - margin, y + 5, { align: 'right' });
  }

  // ── Title ─────────────────────────────────────────────────────────────────
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(30, 30, 30);
  pdf.text(title.toUpperCase(), margin, y + 6);

  if (receiptId) {
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(100, 100, 100);
    pdf.text(`#${receiptId}`, margin, y + 12);
  }

  y += 20;

  // ── Divider ───────────────────────────────────────────────────────────────
  pdf.setDrawColor(200, 200, 200);
  pdf.setLineWidth(0.3);
  pdf.line(margin, y, pageWidth - margin, y);
  y += 8;

  // ── Receipt rows ──────────────────────────────────────────────────────────
  const labelW = contentWidth * 0.42;
  const valueX = margin + labelW + 4;

  for (const row of rows) {
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(110, 110, 110);
    pdf.text(row.label, margin, y);

    pdf.setFont(row.mono ? 'courier' : 'helvetica', 'bold');
    pdf.setTextColor(30, 30, 30);

    // Wrap long values
    const lines = pdf.splitTextToSize(row.value, pageWidth - margin - valueX);
    pdf.text(lines, valueX, y);

    y += Math.max(lines.length * 5, 6);

    pdf.setDrawColor(235, 235, 235);
    pdf.setLineWidth(0.1);
    pdf.line(margin, y, pageWidth - margin, y);
    y += 3;
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  y += 6;
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(160, 160, 160);
  pdf.text('OVES Energy · Mombasa Road, Nairobi · sales@oves.energy', pageWidth / 2, y, { align: 'center' });
  pdf.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, y + 4, { align: 'center' });

  // ── Download / Share ──────────────────────────────────────────────────────
  const safeId = (receiptId ?? Date.now().toString()).replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `receipt_${safeId}.pdf`;

  // 1. Android WebView — use JSBridge saveFile
  if (isAndroidWebView()) {
    const base64 = pdf.output('datauristring');
    await saveFileViaAndroid(base64, filename);
    return;
  }

  const blob = pdf.output('blob');
  const file = new File([blob], filename, { type: 'application/pdf' });

  // 2. Web Share API (native share sheet on supported mobile browsers)
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return;
    } catch (err: unknown) {
      if ((err as { name?: string })?.name === 'AbortError') return;
    }
  }

  // 3. Anchor download (desktop / browser fallback)
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 250);
}
