import PDFDocument from 'pdfkit';
import fs from 'fs';
import type { Client, CompanySettings, Invoice, Offer, LineItem } from './types';
import { calcTotals, formatGbp, formatDateUk, calcLineNet, calcLineVat } from './types';

interface InvoicePdfArgs {
  invoice: Invoice;
  client: Client;
  company: CompanySettings;
  outPath: string;
}

interface OfferPdfArgs {
  offer: Offer;
  client: Client;
  company: CompanySettings;
  outPath: string;
}

function drawHeader(
  doc: PDFKit.PDFDocument,
  company: CompanySettings,
  accent: string,
  title: string,
  number: string
) {
  const pageWidth = doc.page.width;
  const margin = 50;

  // Accent bar
  doc.rect(0, 0, pageWidth, 8).fill(accent);

  // Logo
  let logoBottom = 40;
  if (company.logoPath && fs.existsSync(company.logoPath)) {
    try {
      doc.image(company.logoPath, margin, 28, { fit: [90, 50] });
      logoBottom = 90;
    } catch {
      // ignore bad logo
    }
  }

  // Company name
  doc
    .fillColor('#0f172a')
    .font('Helvetica-Bold')
    .fontSize(18)
    .text(company.name || 'Company', margin + (company.logoPath ? 100 : 0), 32, {
      width: 260,
    });

  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor('#475569')
    .text(formatAddress(company), margin + (company.logoPath ? 100 : 0), 56, { width: 260 });

  // Document title block (right)
  doc
    .font('Helvetica-Bold')
    .fontSize(22)
    .fillColor(accent)
    .text(title, pageWidth - margin - 200, 32, { width: 200, align: 'right' });

  doc
    .font('Helvetica')
    .fontSize(11)
    .fillColor('#0f172a')
    .text(number, pageWidth - margin - 200, 58, { width: 200, align: 'right' });

  return Math.max(logoBottom, 100);
}

function formatAddress(c: {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  postcode: string;
  country: string;
}): string {
  return [c.addressLine1, c.addressLine2, c.city, c.postcode, c.country].filter(Boolean).join('\n');
}

function drawMeta(
  doc: PDFKit.PDFDocument,
  y: number,
  leftTitle: string,
  leftBody: string,
  rightRows: Array<[string, string]>,
  accent: string
) {
  const margin = 50;
  const pageWidth = doc.page.width;

  doc.font('Helvetica-Bold').fontSize(9).fillColor(accent).text(leftTitle, margin, y);
  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor('#0f172a')
    .text(leftBody, margin, y + 14, { width: 240 });

  let ry = y;
  for (const [label, value] of rightRows) {
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#64748b')
      .text(label, pageWidth - margin - 200, ry, { width: 90, align: 'right' });
    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor('#0f172a')
      .text(value, pageWidth - margin - 100, ry, { width: 100, align: 'right' });
    ry += 14;
  }

  return Math.max(y + 14 + leftBody.split('\n').length * 12 + 20, ry + 20);
}

function drawItemsTable(
  doc: PDFKit.PDFDocument,
  y: number,
  items: LineItem[],
  accent: string
): number {
  const margin = 50;
  const pageWidth = doc.page.width;
  const usable = pageWidth - margin * 2;

  const cols = {
    desc: margin,
    qty: margin + usable * 0.48,
    price: margin + usable * 0.58,
    vat: margin + usable * 0.72,
    total: margin + usable * 0.85,
  };

  // Header row
  doc.rect(margin, y, usable, 22).fill(accent);
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8);
  doc.text('DESCRIPTION', cols.desc + 8, y + 7, { width: usable * 0.45 });
  doc.text('QTY', cols.qty, y + 7, { width: usable * 0.1, align: 'right' });
  doc.text('UNIT', cols.price, y + 7, { width: usable * 0.12, align: 'right' });
  doc.text('VAT', cols.vat, y + 7, { width: usable * 0.12, align: 'right' });
  doc.text('TOTAL', cols.total, y + 7, { width: usable * 0.14, align: 'right' });

  y += 22;
  let alt = false;

  for (const item of items) {
    const net = calcLineNet(item);
    const vat = calcLineVat(item);
    const rowH = Math.max(28, doc.heightOfString(item.description, { width: usable * 0.45 }) + 14);

    if (y + rowH > doc.page.height - 120) {
      doc.addPage();
      y = 50;
    }

    if (alt) doc.rect(margin, y, usable, rowH).fill('#f1f5f9');
    alt = !alt;

    doc.fillColor('#0f172a').font('Helvetica').fontSize(9);
    doc.text(item.description, cols.desc + 8, y + 8, { width: usable * 0.45 });
    doc.text(String(item.quantity), cols.qty, y + 8, { width: usable * 0.1, align: 'right' });
    doc.text(formatGbp(item.unitPrice), cols.price, y + 8, {
      width: usable * 0.12,
      align: 'right',
    });
    doc.text(`${Math.round(item.vatRate * 100)}%`, cols.vat, y + 8, {
      width: usable * 0.12,
      align: 'right',
    });
    doc.text(formatGbp(net + vat), cols.total, y + 8, {
      width: usable * 0.14,
      align: 'right',
    });

    y += rowH;
  }

  return y + 10;
}

function drawTotals(
  doc: PDFKit.PDFDocument,
  y: number,
  items: LineItem[],
  accent: string
): number {
  const margin = 50;
  const pageWidth = doc.page.width;
  const { subtotal, vat, total } = calcTotals(items);
  const boxX = pageWidth - margin - 200;

  const rows: Array<[string, string, boolean]> = [
    ['Subtotal', formatGbp(subtotal), false],
    ['VAT', formatGbp(vat), false],
    ['Total (GBP)', formatGbp(total), true],
  ];

  for (const [label, value, bold] of rows) {
    if (bold) {
      doc.rect(boxX, y - 4, 200, 24).fill(accent);
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(10);
      doc.text(label, boxX + 10, y + 2, { width: 90 });
      doc.text(value, boxX + 90, y + 2, { width: 100, align: 'right' });
      y += 28;
    } else {
      doc.fillColor('#64748b').font('Helvetica').fontSize(9).text(label, boxX + 10, y, { width: 90 });
      doc.fillColor('#0f172a').font('Helvetica-Bold').text(value, boxX + 90, y, {
        width: 100,
        align: 'right',
      });
      y += 16;
    }
  }
  return y;
}

function drawBankAndNotes(
  doc: PDFKit.PDFDocument,
  y: number,
  company: CompanySettings,
  notes: string,
  accent: string
) {
  const margin = 50;
  const pageWidth = doc.page.width;

  if (y > doc.page.height - 160) {
    doc.addPage();
    y = 50;
  }

  doc
    .moveTo(margin, y)
    .lineTo(pageWidth - margin, y)
    .strokeColor('#e2e8f0')
    .stroke();

  y += 16;

  if (notes) {
    doc.font('Helvetica-Bold').fontSize(9).fillColor(accent).text('NOTES', margin, y);
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#334155')
      .text(notes, margin, y + 14, { width: 250 });
  }

  const bankLines = [
    company.bankAccountName && `Account: ${company.bankAccountName}`,
    company.bankSortCode && `Sort Code: ${company.bankSortCode}`,
    company.bankAccountNumber && `Account No: ${company.bankAccountNumber}`,
    company.bankIban && `IBAN: ${company.bankIban}`,
    company.bankBic && `BIC: ${company.bankBic}`,
  ].filter(Boolean) as string[];

  if (bankLines.length) {
    const bx = pageWidth - margin - 220;
    doc.font('Helvetica-Bold').fontSize(9).fillColor(accent).text('PAYMENT DETAILS', bx, y);
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#334155')
      .text(bankLines.join('\n'), bx, y + 14, { width: 220 });
  }

  // Footer
  const footerY = doc.page.height - 40;
  const legal = [
    company.companyNumber && `Company No: ${company.companyNumber}`,
    company.vatNumber && `VAT No: ${company.vatNumber}`,
    company.email,
  ]
    .filter(Boolean)
    .join('  ·  ');

  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor('#94a3b8')
    .text(legal, margin, footerY, { width: pageWidth - margin * 2, align: 'center' });
}

function createDoc(outPath: string): PDFKit.PDFDocument {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 40, bottom: 40, left: 50, right: 50 },
    info: { Producer: 'FlowState Finance', Creator: 'FlowState Finance' },
  });
  doc.pipe(fs.createWriteStream(outPath));
  return doc;
}

export function generateInvoicePdf({
  invoice,
  client,
  company,
  outPath,
}: InvoicePdfArgs): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const accent = invoice.accentColor || company.accentColor || '#38bdf8';
      const doc = createDoc(outPath);

      let y = drawHeader(doc, company, accent, 'INVOICE', invoice.number);

      const billTo = [client.name, client.contactName, formatAddress(client), client.email]
        .filter(Boolean)
        .join('\n');

      y = drawMeta(
        doc,
        y + 10,
        'BILL TO',
        billTo,
        [
          ['Issue Date', formatDateUk(invoice.issueDate)],
          ['Due Date', formatDateUk(invoice.dueDate)],
          ['Status', invoice.status.toUpperCase()],
          ['Currency', 'GBP (£)'],
        ],
        accent
      );

      y = drawItemsTable(doc, y + 8, invoice.items, accent);
      y = drawTotals(doc, y + 4, invoice.items, accent);
      drawBankAndNotes(doc, y + 16, company, invoice.notes, accent);

      doc.end();
      doc.on('end', () => resolve(outPath));
      doc.on('error', reject);
    } catch (err) {
      reject(err);
    }
  });
}

export function generateOfferPdf({
  offer,
  client,
  company,
  outPath,
}: OfferPdfArgs): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const accent = offer.accentColor || company.accentColor || '#a78bfa';
      const doc = createDoc(outPath);

      let y = drawHeader(doc, company, accent, 'OFFER', offer.number);

      const billTo = [client.name, client.contactName, formatAddress(client), client.email]
        .filter(Boolean)
        .join('\n');

      y = drawMeta(
        doc,
        y + 10,
        'PREPARED FOR',
        billTo,
        [
          ['Issue Date', formatDateUk(offer.issueDate)],
          ['Valid Until', formatDateUk(offer.validUntil)],
          ['Status', offer.status.toUpperCase()],
          ['Currency', 'GBP (£)'],
        ],
        accent
      );

      y = drawItemsTable(doc, y + 8, offer.items, accent);
      y = drawTotals(doc, y + 4, offer.items, accent);

      const notes = [offer.notes, offer.terms ? `\nTerms:\n${offer.terms}` : '']
        .filter(Boolean)
        .join('\n');
      drawBankAndNotes(doc, y + 16, company, notes, accent);

      // Watermark-style badge for offers
      doc
        .font('Helvetica-Bold')
        .fontSize(8)
        .fillColor(accent)
        .text('QUOTATION — NOT A TAX INVOICE', 50, doc.page.height - 55, {
          width: doc.page.width - 100,
          align: 'center',
        });

      doc.end();
      doc.on('end', () => resolve(outPath));
      doc.on('error', reject);
    } catch (err) {
      reject(err);
    }
  });
}
