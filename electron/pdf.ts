import PDFDocument from 'pdfkit';
import fs from 'fs';
import type { Client, CompanySettings, Invoice, Offer, LineItem, Payment } from './types';
import { calcTotals, formatDateUk, formatGbp, formatMoney, invoiceTotals, calcLineNet, calcLineVat, round2 } from './types';
import type { CurrencyCode } from './types';

export type InvoiceDocKind = 'invoice' | 'proforma' | 'receipt' | 'reminder';

interface InvoicePdfArgs {
  invoice: Invoice;
  client: Client;
  company: CompanySettings;
  outPath: string;
  kind: InvoiceDocKind;
  payments?: Payment[];
}

interface OfferPdfArgs {
  offer: Offer;
  client: Client;
  company: CompanySettings;
  outPath: string;
  style?: 'pricing' | 'quotation';
}

const DOC_META: Record<
  InvoiceDocKind,
  { title: string; banner?: string; showBank: boolean; showDue: boolean }
> = {
  invoice: {
    title: 'TAX INVOICE',
    showBank: true,
    showDue: true,
  },
  proforma: {
    title: 'PROFORMA INVOICE',
    banner: 'PROFORMA — THIS IS NOT A TAX INVOICE',
    showBank: true,
    showDue: true,
  },
  receipt: {
    title: 'RECEIPT',
    banner: 'PAYMENT RECEIVED — THANK YOU',
    showBank: false,
    showDue: false,
  },
  reminder: {
    title: 'PAYMENT REMINDER',
    banner: 'FRIENDLY REMINDER — PAYMENT OVERDUE OR DUE SOON',
    showBank: true,
    showDue: true,
  },
};

function drawHeader(
  doc: PDFKit.PDFDocument,
  company: CompanySettings,
  accent: string,
  title: string,
  number: string
) {
  const pageWidth = doc.page.width;
  const margin = 50;

  doc.rect(0, 0, pageWidth, 8).fill(accent);

  let logoBottom = 40;
  if (company.logoPath && fs.existsSync(company.logoPath)) {
    try {
      doc.image(company.logoPath, margin, 28, { fit: [90, 50] });
      logoBottom = 90;
    } catch {
      // ignore bad logo
    }
  }

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

  doc
    .font('Helvetica-Bold')
    .fontSize(18)
    .fillColor(accent)
    .text(title, pageWidth - margin - 220, 28, { width: 220, align: 'right' });

  doc
    .font('Helvetica')
    .fontSize(11)
    .fillColor('#0f172a')
    .text(number, pageWidth - margin - 220, 54, { width: 220, align: 'right' });

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

function drawBanner(doc: PDFKit.PDFDocument, y: number, text: string, accent: string): number {
  const margin = 50;
  const pageWidth = doc.page.width;
  doc.roundedRect(margin, y, pageWidth - margin * 2, 26, 4).fill(accent);
  doc
    .fillColor('#ffffff')
    .font('Helvetica-Bold')
    .fontSize(9)
    .text(text, margin, y + 8, { width: pageWidth - margin * 2, align: 'center' });
  return y + 36;
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
    doc.text(`${Number((item.vatRate * 100).toFixed(2))}%`, cols.vat, y + 8, {
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
  accent: string,
  currency: CurrencyCode,
  roundTotals = false,
  extraRows: Array<[string, string, boolean]> = []
): number {
  const pageWidth = doc.page.width;
  const margin = 50;
  const { subtotal, vat, displayTotal, roundingAdjustment } = invoiceTotals(items, roundTotals);
  const boxX = pageWidth - margin - 200;

  const rows: Array<[string, string, boolean]> = [
    ['Subtotal', formatMoney(subtotal, currency), false],
    ['VAT', formatMoney(vat, currency), false],
    ...extraRows,
  ];
  if (roundTotals && roundingAdjustment !== 0) {
    rows.push(['Rounding', formatMoney(roundingAdjustment, currency), false]);
  }
  rows.push([`Total (${currency})`, formatMoney(displayTotal, currency), true]);

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
  accent: string,
  showBank: boolean
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
      .text(notes, margin, y + 14, { width: showBank ? 250 : pageWidth - margin * 2 });
  }

  if (showBank) {
    const bankLines = [
      company.bankName && `Bank: ${company.bankName}`,
      company.bankBranch && `Branch: ${company.bankBranch}`,
      company.bankAccountName && `Account: ${company.bankAccountName}`,
      company.bankSortCode && `Sort Code: ${company.bankSortCode}`,
      company.bankAccountNumber && `Account No: ${company.bankAccountNumber}`,
      company.bankRouting && `Routing: ${company.bankRouting}`,
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
  }

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
    info: { Producer: 'MyFinance', Creator: 'MyFinance' },
  });
  doc.pipe(fs.createWriteStream(outPath));
  return doc;
}

export function generateInvoicePdf({
  invoice,
  client,
  company,
  outPath,
  kind,
  payments = [],
}: InvoicePdfArgs): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const meta = DOC_META[kind];
      const accent =
        kind === 'receipt'
          ? '#059669'
          : kind === 'proforma'
            ? '#7c3aed'
            : kind === 'reminder'
              ? '#d97706'
              : invoice.accentColor || company.accentColor || '#38bdf8';

      const doc = createDoc(outPath);
      let y = drawHeader(doc, company, accent, meta.title, invoice.number);

      if (meta.banner) {
        y = drawBanner(doc, y + 4, meta.banner, accent);
      }

      const billTo = [client.name, client.contactName, formatAddress(client), client.email]
        .filter(Boolean)
        .join('\n');

      const relatedPayments = payments.filter((p) => p.invoiceId === invoice.id);
      const paid = round2(relatedPayments.reduce((s, p) => s + p.amount, 0));
      const { total } = calcTotals(invoice.items);
      const outstanding = round2(Math.max(0, total - paid));

      const rightRows: Array<[string, string]> = [
        ['Issue Date', formatDateUk(invoice.issueDate)],
      ];
      if (meta.showDue) {
        rightRows.push(['Due Date', formatDateUk(invoice.dueDate)]);
      }
      if (kind === 'receipt') {
        const lastPay = relatedPayments.sort((a, b) => b.date.localeCompare(a.date))[0];
        rightRows.push(['Paid', formatGbp(paid)]);
        rightRows.push(['Payment date', lastPay ? formatDateUk(lastPay.date) : formatDateUk(invoice.issueDate)]);
        if (lastPay?.method) rightRows.push(['Method', lastPay.method]);
      } else {
        rightRows.push(['Status', invoice.status.toUpperCase()]);
        rightRows.push(['Currency', 'GBP (£)']);
        if (kind === 'reminder') {
          rightRows.push(['Amount due', formatGbp(outstanding)]);
        }
      }

      y = drawMeta(doc, y + 10, kind === 'receipt' ? 'RECEIVED FROM' : 'BILL TO', billTo, rightRows, accent);

      y = drawItemsTable(doc, y + 8, invoice.items, accent);

      const extra: Array<[string, string, boolean]> = [];
      if (kind === 'receipt' || kind === 'reminder') {
        extra.push(['Paid', formatGbp(paid), false]);
        if (kind === 'reminder') extra.push(['Outstanding', formatGbp(outstanding), false]);
      }

      y = drawTotals(doc, y + 4, invoice.items, accent, invoice.currency, invoice.roundTotals, extra);

      let notes = invoice.notes;
      if (kind === 'proforma') {
        notes = [
          'This proforma invoice is for informational purposes and is not a VAT tax invoice.',
          notes,
        ]
          .filter(Boolean)
          .join('\n\n');
      } else if (kind === 'receipt') {
        notes = [
          paid > 0
            ? `We acknowledge receipt of ${formatGbp(paid)} against ${invoice.number}.`
            : 'Receipt generated — no payments recorded yet.',
          notes,
        ]
          .filter(Boolean)
          .join('\n\n');
      } else if (kind === 'reminder') {
        notes = [
          outstanding > 0
            ? `Please settle the outstanding balance of ${formatGbp(outstanding)} at your earliest convenience.`
            : 'This invoice appears fully paid — thank you.',
          notes,
        ]
          .filter(Boolean)
          .join('\n\n');
      }

      drawBankAndNotes(doc, y + 16, company, notes, accent, meta.showBank);

      if (kind === 'proforma') {
        doc
          .font('Helvetica-Bold')
          .fontSize(8)
          .fillColor(accent)
          .text('PROFORMA INVOICE — NOT A TAX INVOICE', 50, doc.page.height - 55, {
            width: doc.page.width - 100,
            align: 'center',
          });
      }

      doc.end();
      doc.on('end', () => resolve(outPath));
      doc.on('error', reject);
    } catch (err) {
      reject(err);
    }
  });
}

/** Classic quotation layout */
export function generateOfferPdf(args: OfferPdfArgs): Promise<string> {
  if (args.style === 'pricing') return generatePricingOfferPdf(args);

  return new Promise((resolve, reject) => {
    try {
      const { offer, client, company, outPath } = args;
      const accent = offer.accentColor || company.accentColor || '#a78bfa';
      const doc = createDoc(outPath);

      let y = drawHeader(doc, company, accent, 'QUOTATION', offer.number);

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
      y = drawTotals(doc, y + 4, offer.items, accent, offer.currency, false);

      const notes = [offer.notes, offer.terms ? `\nTerms:\n${offer.terms}` : '']
        .filter(Boolean)
        .join('\n');
      drawBankAndNotes(doc, y + 16, company, notes, accent, false);

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

/** Premium pricing offer — hero layout with package-style line items */
export function generatePricingOfferPdf({
  offer,
  client,
  company,
  outPath,
}: OfferPdfArgs): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const accent = offer.accentColor || company.accentColor || '#0ea5e9';
      const dark = '#0f172a';
      const muted = '#64748b';
      const { subtotal, vat, total } = calcTotals(offer.items);
      const doc = createDoc(outPath);
      const pageWidth = doc.page.width;
      const margin = 42;

      // Full-bleed hero
      doc.rect(0, 0, pageWidth, 168).fill(dark);
      doc.rect(0, 160, pageWidth, 8).fill(accent);

      if (company.logoPath && fs.existsSync(company.logoPath)) {
        try {
          doc.image(company.logoPath, margin, 28, { fit: [70, 40] });
        } catch {
          // ignore
        }
      }

      doc
        .fillColor('#ffffff')
        .font('Helvetica-Bold')
        .fontSize(11)
        .text(company.name || 'Company', margin + (company.logoPath ? 86 : 0), 34);

      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor('#94a3b8')
        .text('PRICING OFFER', margin + (company.logoPath ? 86 : 0), 52);

      doc
        .font('Helvetica-Bold')
        .fontSize(28)
        .fillColor('#ffffff')
        .text('Your tailored proposal', margin, 88, { width: 340 });

      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor('#cbd5e1')
        .text(`Prepared for ${client.name}`, margin, 126, { width: 340 });

      // Offer number chip (right)
      doc.roundedRect(pageWidth - margin - 150, 36, 150, 54, 8).fill('#1e293b');
      doc
        .fillColor(accent)
        .font('Helvetica-Bold')
        .fontSize(9)
        .text('OFFER', pageWidth - margin - 138, 46);
      doc
        .fillColor('#ffffff')
        .font('Helvetica-Bold')
        .fontSize(14)
        .text(offer.number, pageWidth - margin - 138, 60);
      doc
        .fillColor('#94a3b8')
        .font('Helvetica')
        .fontSize(8)
        .text(`Valid until ${formatDateUk(offer.validUntil)}`, pageWidth - margin - 138, 78);

      let y = 196;

      // Two cards: client + meta
      const cardW = (pageWidth - margin * 2 - 14) / 2;
      doc.roundedRect(margin, y, cardW, 88, 10).fill('#f8fafc');
      doc.roundedRect(margin + cardW + 14, y, cardW, 88, 10).fill('#f8fafc');

      doc.fillColor(accent).font('Helvetica-Bold').fontSize(8).text('PREPARED FOR', margin + 14, y + 14);
      doc
        .fillColor(dark)
        .font('Helvetica-Bold')
        .fontSize(12)
        .text(client.name, margin + 14, y + 30, { width: cardW - 28 });
      doc
        .fillColor(muted)
        .font('Helvetica')
        .fontSize(9)
        .text(
          [client.contactName, client.email, client.city].filter(Boolean).join('\n'),
          margin + 14,
          y + 48,
          { width: cardW - 28 }
        );

      const rx = margin + cardW + 14;
      doc.fillColor(accent).font('Helvetica-Bold').fontSize(8).text('DETAILS', rx + 14, y + 14);
      const details = [
        `Issued  ${formatDateUk(offer.issueDate)}`,
        `Valid   ${formatDateUk(offer.validUntil)}`,
        `Currency  GBP (£)`,
      ];
      doc
        .fillColor(dark)
        .font('Helvetica')
        .fontSize(10)
        .text(details.join('\n'), rx + 14, y + 32, { width: cardW - 28, lineGap: 4 });

      y += 110;

      // Investment headline
      doc.fillColor(dark).font('Helvetica-Bold').fontSize(14).text('Investment breakdown', margin, y);
      doc
        .fillColor(muted)
        .font('Helvetica')
        .fontSize(9)
        .text('Transparent pricing with VAT shown separately', margin, y + 18);
      y += 40;

      // Package-style rows
      for (let i = 0; i < offer.items.length; i++) {
        const item = offer.items[i];
        const net = calcLineNet(item);
        const lineVat = calcLineVat(item);
        const gross = round2(net + lineVat);
        const rowH = Math.max(56, doc.heightOfString(item.description, { width: pageWidth - margin * 2 - 160 }) + 28);

        if (y + rowH > doc.page.height - 200) {
          doc.addPage();
          y = 50;
        }

        doc.roundedRect(margin, y, pageWidth - margin * 2, rowH, 10).lineWidth(1).strokeColor('#e2e8f0').stroke();
        // accent index pill
        doc.circle(margin + 22, y + rowH / 2, 12).fill(accent);
        doc
          .fillColor('#ffffff')
          .font('Helvetica-Bold')
          .fontSize(10)
          .text(String(i + 1), margin + 16, y + rowH / 2 - 5, { width: 12, align: 'center' });

        doc
          .fillColor(dark)
          .font('Helvetica-Bold')
          .fontSize(11)
          .text(item.description || 'Item', margin + 44, y + 14, {
            width: pageWidth - margin * 2 - 180,
          });
        doc
          .fillColor(muted)
          .font('Helvetica')
          .fontSize(9)
          .text(
            `${item.quantity} × ${formatGbp(item.unitPrice)}  ·  VAT ${Number((item.vatRate * 100).toFixed(2))}%`,
            margin + 44,
            y + 32
          );

        doc
          .fillColor(dark)
          .font('Helvetica-Bold')
          .fontSize(13)
          .text(formatGbp(gross), pageWidth - margin - 120, y + rowH / 2 - 8, {
            width: 100,
            align: 'right',
          });

        y += rowH + 10;
      }

      // Totals hero card
      if (y > doc.page.height - 180) {
        doc.addPage();
        y = 50;
      }

      doc.roundedRect(margin, y, pageWidth - margin * 2, 92, 12).fill(dark);
      doc
        .fillColor('#94a3b8')
        .font('Helvetica')
        .fontSize(9)
        .text(`Subtotal ${formatGbp(subtotal)}   ·   VAT ${formatGbp(vat)}`, margin + 20, y + 22);

      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(11).text('Total investment', margin + 20, y + 44);
      doc
        .fillColor(accent)
        .font('Helvetica-Bold')
        .fontSize(24)
        .text(formatGbp(total), margin + 20, y + 60);

      doc
        .roundedRect(pageWidth - margin - 160, y + 28, 140, 36, 8)
        .fill(accent);
      doc
        .fillColor('#ffffff')
        .font('Helvetica-Bold')
        .fontSize(10)
        .text('ACCEPT OFFER', pageWidth - margin - 160, y + 40, {
          width: 140,
          align: 'center',
        });

      y += 112;

      // Notes / terms
      if (offer.notes || offer.terms) {
        if (y > doc.page.height - 120) {
          doc.addPage();
          y = 50;
        }
        if (offer.notes) {
          doc.fillColor(accent).font('Helvetica-Bold').fontSize(9).text('NOTES', margin, y);
          doc
            .fillColor(muted)
            .font('Helvetica')
            .fontSize(9)
            .text(offer.notes, margin, y + 14, { width: pageWidth - margin * 2 });
          y += 14 + doc.heightOfString(offer.notes, { width: pageWidth - margin * 2 }) + 16;
        }
        if (offer.terms) {
          doc.fillColor(accent).font('Helvetica-Bold').fontSize(9).text('TERMS', margin, y);
          doc
            .fillColor(muted)
            .font('Helvetica')
            .fontSize(9)
            .text(offer.terms, margin, y + 14, { width: pageWidth - margin * 2 });
        }
      }

      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor('#94a3b8')
        .text(
          [
            'PRICING OFFER — NOT A TAX INVOICE',
            company.vatNumber && `VAT ${company.vatNumber}`,
            company.email,
          ]
            .filter(Boolean)
            .join('  ·  '),
          margin,
          doc.page.height - 40,
          { width: pageWidth - margin * 2, align: 'center' }
        );

      doc.end();
      doc.on('end', () => resolve(outPath));
      doc.on('error', reject);
    } catch (err) {
      reject(err);
    }
  });
}
