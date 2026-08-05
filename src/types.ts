export type InvoiceStatus = 'draft' | 'sent' | 'partial' | 'paid' | 'overdue';
export type OfferStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
}

export interface CompanySettings {
  name: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postcode: string;
  country: string;
  companyNumber: string;
  vatNumber: string;
  email: string;
  phone: string;
  website: string;
  bankName: string;
  bankAccountName: string;
  bankSortCode: string;
  bankAccountNumber: string;
  bankIban: string;
  bankBic: string;
  accentColor: string;
  theme: 'dark' | 'light';
  logoPath: string;
  invoicePrefix: string;
  offerPrefix: string;
  nextInvoiceNumber: number;
  nextOfferNumber: number;
  defaultNotes: string;
  defaultVatRate: number;
  pdfOutputDir: string;
}

export interface Client {
  id: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postcode: string;
  country: string;
  vatNumber: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface Invoice {
  id: string;
  number: string;
  clientId: string;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  currency: 'GBP';
  items: LineItem[];
  notes: string;
  accentColor?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Offer {
  id: string;
  number: string;
  clientId: string;
  status: OfferStatus;
  issueDate: string;
  validUntil: string;
  currency: 'GBP';
  items: LineItem[];
  notes: string;
  terms: string;
  accentColor?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  date: string;
  method: string;
  reference: string;
  notes: string;
  createdAt: string;
}

export interface AppData {
  company: CompanySettings;
  clients: Client[];
  invoices: Invoice[];
  offers: Offer[];
  payments: Payment[];
}

export const ACCENT_PRESETS = [
  '#38bdf8',
  '#22d3ee',
  '#34d399',
  '#a78bfa',
  '#f472b6',
  '#fb923c',
  '#f87171',
  '#e2e8f0',
];

export function calcLineNet(item: LineItem): number {
  return round2(item.quantity * item.unitPrice);
}

export function calcLineVat(item: LineItem): number {
  return round2(calcLineNet(item) * item.vatRate);
}

export function calcTotals(items: LineItem[]) {
  const subtotal = round2(items.reduce((s, i) => s + calcLineNet(i), 0));
  const vat = round2(items.reduce((s, i) => s + calcLineVat(i), 0));
  const total = round2(subtotal + vat);
  return { subtotal, vat, total };
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function formatGbp(n: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n);
}

export function formatDateUk(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('en-GB').format(d);
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysIso(days: number, from = todayIso()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function paidAmount(invoiceId: string, payments: Payment[]): number {
  return round2(payments.filter((p) => p.invoiceId === invoiceId).reduce((s, p) => s + p.amount, 0));
}

export function newId(): string {
  return crypto.randomUUID();
}

/** Normalize country names for comparison (UK aliases, casing, whitespace). */
export function normalizeCountry(country: string): string {
  const raw = (country || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!raw) return '';
  const aliases: Record<string, string> = {
    uk: 'united kingdom',
    'u.k.': 'united kingdom',
    'u.k': 'united kingdom',
    gb: 'united kingdom',
    'great britain': 'united kingdom',
    britain: 'united kingdom',
    england: 'united kingdom',
    scotland: 'united kingdom',
    wales: 'united kingdom',
    'northern ireland': 'united kingdom',
    usa: 'united states',
    us: 'united states',
    'u.s.': 'united states',
    'u.s.a.': 'united states',
    'united states of america': 'united states',
  };
  return aliases[raw] ?? raw;
}

export function isSameCountry(a: string, b: string): boolean {
  const na = normalizeCountry(a);
  const nb = normalizeCountry(b);
  if (!na || !nb) return true; // incomplete data — keep default VAT
  return na === nb;
}

/**
 * VAT for line items: company default when client is in the same country,
 * otherwise 0% (cross-border / export).
 */
export function resolveVatRate(
  companyCountry: string,
  clientCountry: string | undefined,
  defaultVatRate: number
): number {
  if (!clientCountry) return defaultVatRate;
  return isSameCountry(companyCountry, clientCountry) ? defaultVatRate : 0;
}

export function applyVatRateToItems(items: LineItem[], vatRate: number): LineItem[] {
  return items.map((item) => ({ ...item, vatRate }));
}

