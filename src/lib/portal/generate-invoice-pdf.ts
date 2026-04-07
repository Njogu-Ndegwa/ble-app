import type { OrderEntity } from './types';
import { formatCurrency } from './order-api';

const fmt = (amount: number): string => formatCurrency(amount);

interface LoadedImage {
  dataUrl: string;
  width: number;
  height: number;
}

async function loadImage(src: string): Promise<LoadedImage | null> {
  try {
    return await new Promise<LoadedImage>((resolve, reject) => {
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        resolve({
          dataUrl: canvas.toDataURL('image/png'),
          width: img.naturalWidth,
          height: img.naturalHeight,
        });
      };
      img.onerror = reject;
      img.src = src;
    });
  } catch {
    return null;
  }
}

export async function generateInvoicePdf(
  order: OrderEntity,
  type: 'proforma' | 'invoice',
  logoSrc?: string,
) {
  const [{ jsPDF }, autoTableModule] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const autoTable = (autoTableModule as any).default;

  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = 210;
  const margin = 15;
  let y = margin;

  let logo: LoadedImage | null = null;
  if (logoSrc) {
    logo = await loadImage(logoSrc);
  }

  const logoMaxH = 18;
  let logoW = 0;
  let logoH = 0;

  if (logo) {
    const aspect = logo.width / logo.height;
    logoH = logoMaxH;
    logoW = logoMaxH * aspect;
    try {
      pdf.addImage(logo.dataUrl, 'PNG', pageWidth - margin - logoW, y - 1, logoW, logoH);
    } catch {
      logo = null;
    }
  }

  if (!logo) {
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(0, 0, 0);
    pdf.text('OVES Energy', pageWidth - margin, y + 6, { align: 'right' });
  }

  pdf.setFontSize(18);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(30, 30, 30);
  pdf.text(type === 'proforma' ? 'PROFORMA INVOICE' : 'INVOICE', margin, y + 6);

  const ref =
    type === 'proforma'
      ? `PI-${order.name.replace('SO-', '')}`
      : (order.invoices[0]?.name ?? `INV-${order.name.replace(/^S\/?\/?/, '')}`);

  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(100, 100, 100);
  pdf.text(ref, margin, y + 12);

  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(120, 120, 120);
  const companyInfoX = logo ? pageWidth - margin - logoW : pageWidth - margin;
  pdf.text('Mombasa Road, Nairobi', companyInfoX, y + logoMaxH + 3, {
    align: logo ? 'left' : 'right',
  });
  pdf.text('sales@oves.energy', companyInfoX, y + logoMaxH + 7, {
    align: logo ? 'left' : 'right',
  });

  y += logoMaxH + 14;

  pdf.setDrawColor(200, 200, 200);
  pdf.setLineWidth(0.3);
  pdf.line(margin, y, pageWidth - margin, y);
  y += 8;

  const billToStartY = y;

  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(160, 160, 160);
  pdf.text('BILL TO', margin, y);
  y += 5;

  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(30, 30, 30);
  pdf.text(order.partnerName, margin, y);
  y += 5;

  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(80, 80, 80);
  if (order.contactPerson) {
    pdf.text(`Attn: ${order.contactPerson}`, margin, y);
    y += 4;
  }
  if (order.partnerEmail) {
    pdf.text(order.partnerEmail, margin, y);
    y += 4;
  }
  if (order.partnerPhone) {
    pdf.text(order.partnerPhone, margin, y);
    y += 4;
  }

  let dy = billToStartY;
  const addDetail = (label: string, value: string) => {
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(160, 160, 160);
    pdf.text(label, pageWidth - margin - 55, dy);
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(30, 30, 30);
    pdf.text(value, pageWidth - margin - 55 + 22, dy);
    dy += 5;
  };

  const invoiceDate =
    type === 'proforma'
      ? order.createdAt
      : (order.invoices[0]?.createdAt ?? order.createdAt);

  addDetail(
    'DATE',
    invoiceDate
      ? new Date(invoiceDate).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : '—',
  );
  addDetail('SO', order.name);
  if (order.salesOutlet) addDetail('OUTLET', order.salesOutlet);
  if (order.salesRepName) addDetail('REP', order.salesRepName);
  if (type === 'invoice') {
    addDetail(
      'STATUS',
      order.paymentStatus === 'paid'
        ? 'PAID'
        : order.paymentStatus === 'partial'
          ? 'PARTIAL'
          : 'UNPAID',
    );
  }

  y = Math.max(y, dy) + 6;

  const tableHead = [['#', 'Product-Unit', 'Category', 'Metric', 'Unit Price', 'Qty', 'Subtotal']];
  const tableBody = order.lines.map((line, idx) => [
    String(idx + 1),
    line.productName + (line.sku ? `\n${line.sku}` : ''),
    line.puCategory === 'physical' ? 'Physical' : 'Contract',
    (line.puMetric ?? '') + (line.durationMonths ? `\n${line.durationMonths} mo` : ''),
    fmt(line.priceUnit),
    String(line.quantity),
    fmt(line.priceSubtotal),
  ]);

  autoTable(pdf, {
    startY: y,
    head: tableHead,
    body: tableBody,
    margin: { left: margin, right: margin },
    styles: { fontSize: 8, cellPadding: 2.5, textColor: [50, 50, 50] },
    headStyles: {
      fillColor: [245, 245, 245],
      textColor: [100, 100, 100],
      fontStyle: 'bold',
      fontSize: 7,
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      4: { halign: 'right' },
      5: { halign: 'right', cellWidth: 12 },
      6: { halign: 'right', fontStyle: 'bold' },
    },
    theme: 'grid',
    tableLineColor: [220, 220, 220],
    tableLineWidth: 0.1,
  });

  y = (pdf as any).lastAutoTable.finalY + 8;

  const summaryX = pageWidth - margin - 55;
  const physicalSub = order.lines
    .filter((l) => l.puCategory === 'physical')
    .reduce((s, l) => s + l.priceSubtotal, 0);
  const contractSub = order.lines
    .filter((l) => l.puCategory !== 'physical')
    .reduce((s, l) => s + l.priceSubtotal, 0);

  if (physicalSub > 0) {
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(100, 100, 100);
    pdf.text('Physical', summaryX, y);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(30, 30, 30);
    pdf.text(fmt(physicalSub), pageWidth - margin, y, { align: 'right' });
    y += 5;
  }

  if (contractSub > 0) {
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(100, 100, 100);
    pdf.text('Contract', summaryX, y);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(30, 30, 30);
    pdf.text(fmt(contractSub), pageWidth - margin, y, { align: 'right' });
    y += 5;
  }

  pdf.setDrawColor(220, 220, 220);
  pdf.setLineWidth(0.2);
  pdf.line(summaryX, y, pageWidth - margin, y);
  y += 5;

  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(100, 100, 100);
  pdf.text('Subtotal', summaryX, y);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(30, 30, 30);
  pdf.text(fmt(order.amountTotal), pageWidth - margin, y, { align: 'right' });
  y += 3;

  pdf.setDrawColor(30, 30, 30);
  pdf.setLineWidth(0.5);
  pdf.line(summaryX, y, pageWidth - margin, y);
  y += 6;

  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(30, 30, 30);
  pdf.text('Total', summaryX, y);
  pdf.setTextColor(22, 163, 74);
  pdf.text(fmt(order.amountTotal), pageWidth - margin, y, { align: 'right' });

  if (type === 'invoice' && order.paymentStatus === 'paid') {
    y += 8;
    pdf.setFontSize(9);
    pdf.setTextColor(22, 163, 74);
    pdf.setFont('helvetica', 'bold');
    const payMethod = order.payments[0]?.paymentMethod
      ? ` (${order.payments[0].paymentMethod})`
      : '';
    pdf.text(`Paid${payMethod}: -${fmt(order.paidAmount)}`, pageWidth - margin, y, {
      align: 'right',
    });
    y += 5;
    pdf.setFontSize(10);
    pdf.text(`Amount Due: ${fmt(0)}`, pageWidth - margin, y, { align: 'right' });
  }

  pdf.save(`${ref}.pdf`);
}
