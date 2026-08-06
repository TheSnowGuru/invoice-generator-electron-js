import type { Client, Invoice, Payment } from '../types';
import { calcTotals, formatDateUk } from '../types';

function escapeCsv(value: string | number): string {
  const s = String(value ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(headers: string[], rows: Array<Array<string | number>>): string {
  const lines = [
    headers.map(escapeCsv).join(','),
    ...rows.map((r) => r.map(escapeCsv).join(',')),
  ];
  return lines.join('\n');
}

export function invoicesCsv(
  invoices: Invoice[],
  clients: Client[],
  payments: Payment[]
): string {
  const clientMap = new Map(clients.map((c) => [c.id, c]));
  const rows = invoices.map((inv) => {
    const { subtotal, vat, total } = calcTotals(inv.items);
    const paid = payments.filter((p) => p.invoiceId === inv.id).reduce((s, p) => s + p.amount, 0);
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
  return toCsv(
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

export function paymentsCsv(payments: Payment[], invoices: Invoice[]): string {
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
  return toCsv(['Date', 'Invoice', 'Amount', 'Method', 'Reference', 'Notes'], rows);
}

export function clientsCsv(
  clients: Client[],
  invoices: Invoice[],
  payments: Payment[]
): string {
  const rows = clients.map((c) => {
    const invs = invoices.filter((i) => i.clientId === c.id);
    const invoiced = invs.reduce((s, i) => s + calcTotals(i.items).total, 0);
    const paid = invs.reduce(
      (s, i) => s + payments.filter((p) => p.invoiceId === i.id).reduce((a, p) => a + p.amount, 0),
      0
    );
    return [c.name, c.email, c.city, c.country, invoiced.toFixed(2), paid.toFixed(2)];
  });
  return toCsv(['Name', 'Email', 'City', 'Country', 'Invoiced', 'Paid'], rows);
}
