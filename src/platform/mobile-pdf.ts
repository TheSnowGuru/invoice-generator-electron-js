import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { Client, CompanySettings, Invoice, Offer } from '../types';
import { calcTotals, formatDateUk, formatMoney, invoiceTotals } from '../types';

type InvoiceDocKind = 'invoice' | 'proforma' | 'receipt' | 'reminder';

const TITLES: Record<InvoiceDocKind, string> = {
  invoice: 'TAX INVOICE',
  proforma: 'PROFORMA INVOICE',
  receipt: 'RECEIPT',
  reminder: 'PAYMENT REMINDER',
};

function hexToRgb(hex: string) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

function addressBlock(c: {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  postcode: string;
  country: string;
}): string {
  return [c.addressLine1, c.addressLine2, c.city, c.postcode, c.country].filter(Boolean).join('\n');
}

export async function buildInvoicePdf(
  invoice: Invoice,
  client: Client,
  company: CompanySettings,
  kind: InvoiceDocKind
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const accent = hexToRgb(invoice.accentColor || company.accentColor || '#38bdf8');
  const margin = 50;
  let y = 800;

  page.drawRectangle({ x: 0, y: 832, width: 595, height: 10, color: accent });

  page.drawText(company.name || 'Company', { x: margin, y, size: 16, font: bold });
  page.drawText(TITLES[kind], {
    x: 380,
    y,
    size: 14,
    font: bold,
    color: accent,
  });
  y -= 22;
  page.drawText(invoice.number, { x: 380, y, size: 11, font });
  y -= 16;
  page.drawText(addressBlock(company), { x: margin, y, size: 9, font, lineHeight: 11 });
  y -= 70;

  page.drawText('Bill to', { x: margin, y, size: 10, font: bold });
  y -= 14;
  page.drawText(client.name, { x: margin, y, size: 11, font: bold });
  y -= 14;
  page.drawText(addressBlock(client), { x: margin, y, size: 9, font, lineHeight: 11 });
  y -= 50;

  page.drawText(`Issue: ${formatDateUk(invoice.issueDate)}`, { x: margin, y, size: 9, font });
  if (kind !== 'receipt') {
    page.drawText(`Due: ${formatDateUk(invoice.dueDate)}`, { x: 200, y, size: 9, font });
  }
  y -= 28;

  page.drawText('Description', { x: margin, y, size: 9, font: bold });
  page.drawText('Qty', { x: 320, y, size: 9, font: bold });
  page.drawText('Price', { x: 370, y, size: 9, font: bold });
  page.drawText('Total', { x: 470, y, size: 9, font: bold });
  y -= 8;
  page.drawLine({ start: { x: margin, y }, end: { x: 545, y }, thickness: 1, color: rgb(0.85, 0.85, 0.85) });
  y -= 16;

  const cur = invoice.currency;
  for (const item of invoice.items) {
    const line = item.description || '—';
    const lineTotal = item.quantity * item.unitPrice * (1 + item.vatRate);
    page.drawText(line.slice(0, 48), { x: margin, y, size: 9, font });
    page.drawText(String(item.quantity), { x: 325, y, size: 9, font });
    page.drawText(formatMoney(item.unitPrice, cur), { x: 370, y, size: 9, font });
    page.drawText(formatMoney(lineTotal, cur), { x: 470, y, size: 9, font });
    y -= 14;
    if (y < 120) break;
  }

  const { subtotal, vat, displayTotal } = invoiceTotals(invoice.items, invoice.roundTotals);
  y -= 10;
  page.drawText(`Subtotal: ${formatMoney(subtotal, cur)}`, { x: 400, y, size: 10, font });
  y -= 14;
  page.drawText(`VAT: ${formatMoney(vat, cur)}`, { x: 400, y, size: 10, font });
  y -= 16;
  page.drawText(`Total: ${formatMoney(displayTotal, cur)}`, { x: 400, y, size: 12, font: bold });

  if (kind !== 'receipt' && company.bankAccountNumber) {
    y -= 40;
    page.drawText('Payment details', { x: margin, y, size: 10, font: bold });
    y -= 14;
    const bank = [
      company.bankName && `Bank: ${company.bankName}`,
      company.bankBranch && `Branch: ${company.bankBranch}`,
      company.bankAccountName && `Account: ${company.bankAccountName}`,
      company.bankSortCode && `Sort: ${company.bankSortCode}`,
      company.bankAccountNumber && `Account No: ${company.bankAccountNumber}`,
      company.bankRouting && `Routing: ${company.bankRouting}`,
      company.bankIban && `IBAN: ${company.bankIban}`,
      company.bankBic && `BIC: ${company.bankBic}`,
    ]
      .filter(Boolean)
      .join('\n');
    page.drawText(bank, { x: margin, y, size: 8, font, lineHeight: 10 });
  }

  if (invoice.notes) {
    page.drawText(invoice.notes, { x: margin, y: 80, size: 8, font, maxWidth: 500 });
  }

  return doc.save();
}

export async function buildOfferPdf(
  offer: Offer,
  client: Client,
  company: CompanySettings,
  style: 'pricing' | 'quotation'
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const accent = hexToRgb(offer.accentColor || company.accentColor || '#38bdf8');
  const title = style === 'pricing' ? 'PRICING OFFER' : 'QUOTATION';
  let y = 800;

  page.drawRectangle({ x: 0, y: 832, width: 595, height: 10, color: accent });
  page.drawText(company.name || 'Company', { x: 50, y, size: 16, font: bold });
  page.drawText(title, { x: 380, y, size: 14, font: bold, color: accent });
  y -= 22;
  page.drawText(offer.number, { x: 380, y, size: 11, font });
  y -= 60;
  page.drawText(`Prepared for ${client.name}`, { x: 50, y, size: 11, font: bold });
  y -= 14;
  page.drawText(`Valid until ${formatDateUk(offer.validUntil)}`, { x: 50, y, size: 9, font });
  y -= 30;

  const cur = offer.currency;
  for (const item of offer.items) {
    const lineTotal = item.quantity * item.unitPrice * (1 + item.vatRate);
    page.drawText(`${item.description || '—'} — ${formatMoney(lineTotal, cur)}`, {
      x: 50,
      y,
      size: 10,
      font,
    });
    y -= 16;
  }

  const { total } = calcTotals(offer.items);
  y -= 10;
  page.drawText(`Total: ${formatMoney(total, cur)}`, { x: 400, y, size: 12, font: bold });

  if (offer.terms) {
    page.drawText(offer.terms, { x: 50, y: 100, size: 8, font, maxWidth: 500 });
  }

  return doc.save();
}
