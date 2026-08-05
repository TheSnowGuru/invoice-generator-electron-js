import fs from 'fs';
import type { Client, Invoice, Payment } from './types';
import { calcTotals, formatDateUk } from './types';

function escapeCsv(value: string | number): string {
  const s = String(value ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function writeCsv(filePath: string, headers: string[], rows: Array<Array<string | number>>) {
  const lines = [
    headers.map(escapeCsv).join(','),
    ...rows.map((r) => r.map(escapeCsv).join(',')),
  ];
  fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
}

export function exportInvoicesCsv(
  filePath: string,
  invoices: Invoice[],
  clients: Client[],
  payments: Payment[]
) {
  const clientMap = new Map(clients.map((c) => [c.id, c]));
  const rows = invoices.map((inv) => {
    const { subtotal, vat, total } = calcTotals(inv.items);
    const paid = payments
      .filter((p) => p.invoiceId === inv.id)
      .reduce((s, p) => s + p.amount, 0);
    const client = clientMap.get(inv.clientId);
    return [
      inv.number,
      client?.name ?? '',
      inv.status,
      formatDateUk(inv.issueDate),
      formatDateUk(inv.dueDate),
      subtotal.toFixed(2),
      vat.toFixed(2),
      total.toFixed(2),
      paid.toFixed(2),
      (total - paid).toFixed(2),
    ];
  });

  writeCsv(
    filePath,
    [
      'Invoice Number',
      'Client',
      'Status',
      'Issue Date',
      'Due Date',
      'Subtotal',
      'VAT',
      'Total',
      'Paid',
      'Outstanding',
    ],
    rows
  );
}

export function exportPaymentsCsv(filePath: string, payments: Payment[], invoices: Invoice[]) {
  const invMap = new Map(invoices.map((i) => [i.id, i]));
  const rows = payments.map((p) => {
    const inv = invMap.get(p.invoiceId);
    return [
      formatDateUk(p.date),
      inv?.number ?? '',
      p.amount.toFixed(2),
      p.method,
      p.reference,
      p.notes,
    ];
  });
  writeCsv(filePath, ['Date', 'Invoice', 'Amount', 'Method', 'Reference', 'Notes'], rows);
}

export function exportClientsCsv(
  filePath: string,
  clients: Client[],
  invoices: Invoice[],
  payments: Payment[]
) {
  const rows = clients.map((c) => {
    const clientInvoices = invoices.filter((i) => i.clientId === c.id);
    const revenue = clientInvoices.reduce((s, inv) => {
      const paid = payments
        .filter((p) => p.invoiceId === inv.id)
        .reduce((ps, p) => ps + p.amount, 0);
      return s + paid;
    }, 0);
    const invoiced = clientInvoices.reduce((s, inv) => s + calcTotals(inv.items).total, 0);
    return [
      c.name,
      c.contactName,
      c.email,
      c.phone,
      c.city,
      c.postcode,
      clientInvoices.length,
      invoiced.toFixed(2),
      revenue.toFixed(2),
    ];
  });
  writeCsv(
    filePath,
    [
      'Name',
      'Contact',
      'Email',
      'Phone',
      'City',
      'Postcode',
      'Invoices',
      'Total Invoiced',
      'Total Paid',
    ],
    rows
  );
}
