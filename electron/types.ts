export type InvoiceStatus = 'draft' | 'sent' | 'partial' | 'paid' | 'overdue';
export type OfferStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number; // 0.20 = 20%
}

export type CurrencyCode = 'GBP' | 'EUR' | 'USD' | 'ILS' | 'CHF' | 'AUD' | 'CAD' | 'JPY';
export type VatMode = 'with' | 'without';

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
  bankBranch: string;
  bankAccountName: string;
  bankSortCode: string;
  bankAccountNumber: string;
  bankRouting: string;
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
  defaultCurrency: CurrencyCode;
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
  currency: CurrencyCode;
  roundTotals?: boolean;
  vatMode?: VatMode;
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
  currency: CurrencyCode;
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

export const DEFAULT_COMPANY: CompanySettings = {
  name: 'Your Company Ltd',
  addressLine1: '1 Example Street',
  addressLine2: '',
  city: 'London',
  postcode: 'EC1A 1BB',
  country: 'United Kingdom',
  companyNumber: '',
  vatNumber: '',
  email: 'hello@example.com',
  phone: '',
  website: '',
  bankName: '',
  bankBranch: '',
  bankAccountName: '',
  bankSortCode: '',
  bankAccountNumber: '',
  bankRouting: '',
  bankIban: '',
  bankBic: '',
  accentColor: '#38bdf8',
  theme: 'dark',
  logoPath: '',
  invoicePrefix: 'INV-',
  offerPrefix: 'OFF-',
  nextInvoiceNumber: 1001,
  nextOfferNumber: 1001,
  defaultNotes: 'Payment due within 30 days. Thank you for your business.',
  defaultVatRate: 0.2,
  defaultCurrency: 'GBP',
  pdfOutputDir: '',
};

export function calcLineNet(item: LineItem): number {
  return round2(item.quantity * item.unitPrice);
}

export function calcLineVat(item: LineItem): number {
  return round2(calcLineNet(item) * item.vatRate);
}

export function calcLineGross(item: LineItem): number {
  return round2(calcLineNet(item) + calcLineVat(item));
}

export function calcTotals(items: LineItem[]) {
  const subtotal = round2(items.reduce((s, i) => s + calcLineNet(i), 0));
  const vat = round2(items.reduce((s, i) => s + calcLineVat(i), 0));
  const total = round2(subtotal + vat);
  return { subtotal, vat, total };
}

export function invoiceTotals(items: LineItem[], roundTotals = false) {
  const { subtotal, vat, total } = calcTotals(items);
  if (!roundTotals) {
    return { subtotal, vat, total, displayTotal: total, roundingAdjustment: 0 };
  }
  const displayTotal = Math.round(total);
  return {
    subtotal,
    vat,
    total,
    displayTotal,
    roundingAdjustment: round2(displayTotal - total),
  };
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function formatMoney(n: number, currency: CurrencyCode = 'GBP'): string {
  const digits = currency === 'JPY' ? 0 : 2;
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);
}

export function formatGbp(n: number): string {
  return formatMoney(n, 'GBP');
}

export function formatDateUk(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('en-GB').format(d);
}
