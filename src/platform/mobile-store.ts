import type { AppData, Client, CompanySettings, Invoice, Offer, Payment } from '../types';

const DEFAULT_COMPANY: CompanySettings = {
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
  defaultNotes: 'Thank you for your business.',
  defaultVatRate: 0.2,
  pdfOutputDir: '',
};

function calcTotalsSafe(invoice: Invoice) {
  const subtotal = invoice.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const vat = invoice.items.reduce((s, i) => s + i.quantity * i.unitPrice * i.vatRate, 0);
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    vat: Math.round(vat * 100) / 100,
    total: Math.round((subtotal + vat) * 100) / 100,
  };
}

export class MobileDataStore {
  private data: AppData = {
    company: { ...DEFAULT_COMPANY },
    clients: [],
    invoices: [],
    offers: [],
    payments: [],
  };

  private writeTimer: ReturnType<typeof setTimeout> | null = null;
  private persistFn: (data: AppData) => Promise<void>;

  constructor(persistFn: (data: AppData) => Promise<void>) {
    this.persistFn = persistFn;
  }

  hydrate(parsed: AppData) {
    this.data = {
      company: { ...DEFAULT_COMPANY, ...parsed.company },
      clients: parsed.clients ?? [],
      invoices: parsed.invoices ?? [],
      offers: parsed.offers ?? [],
      payments: parsed.payments ?? [],
    };
  }

  private persist() {
    if (this.writeTimer) clearTimeout(this.writeTimer);
    this.writeTimer = setTimeout(() => {
      this.writeTimer = null;
      void this.persistFn(structuredClone(this.data));
    }, 200);
  }

  async flush() {
    if (this.writeTimer) {
      clearTimeout(this.writeTimer);
      this.writeTimer = null;
    }
    await this.persistFn(structuredClone(this.data));
  }

  getAll(): AppData {
    return structuredClone(this.data);
  }

  getCompany(): CompanySettings {
    return { ...this.data.company };
  }

  saveCompany(company: CompanySettings): CompanySettings {
    this.data.company = { ...company };
    this.persist();
    return this.getCompany();
  }

  listClients(): Client[] {
    return structuredClone(this.data.clients);
  }

  saveClient(client: Client): Client {
    const idx = this.data.clients.findIndex((c) => c.id === client.id);
    if (idx >= 0) this.data.clients[idx] = client;
    else this.data.clients.push(client);
    this.persist();
    return structuredClone(client);
  }

  deleteClient(id: string): void {
    this.data.clients = this.data.clients.filter((c) => c.id !== id);
    this.persist();
  }

  listInvoices(): Invoice[] {
    return structuredClone(this.data.invoices);
  }

  saveInvoice(invoice: Invoice): Invoice {
    const idx = this.data.invoices.findIndex((i) => i.id === invoice.id);
    const isNew = idx < 0;
    if (isNew) {
      this.data.invoices.push(invoice);
      const num = parseInt(invoice.number.replace(/\D/g, ''), 10);
      if (!Number.isNaN(num) && num >= this.data.company.nextInvoiceNumber) {
        this.data.company.nextInvoiceNumber = num + 1;
      }
    } else {
      this.data.invoices[idx] = invoice;
    }
    this.persist();
    return structuredClone(invoice);
  }

  deleteInvoice(id: string): void {
    this.data.invoices = this.data.invoices.filter((i) => i.id !== id);
    this.data.payments = this.data.payments.filter((p) => p.invoiceId !== id);
    this.persist();
  }

  listOffers(): Offer[] {
    return structuredClone(this.data.offers);
  }

  saveOffer(offer: Offer): Offer {
    const idx = this.data.offers.findIndex((o) => o.id === offer.id);
    const isNew = idx < 0;
    if (isNew) {
      this.data.offers.push(offer);
      const num = parseInt(offer.number.replace(/\D/g, ''), 10);
      if (!Number.isNaN(num) && num >= this.data.company.nextOfferNumber) {
        this.data.company.nextOfferNumber = num + 1;
      }
    } else {
      this.data.offers[idx] = offer;
    }
    this.persist();
    return structuredClone(offer);
  }

  deleteOffer(id: string): void {
    this.data.offers = this.data.offers.filter((o) => o.id !== id);
    this.persist();
  }

  listPayments(): Payment[] {
    return structuredClone(this.data.payments);
  }

  savePayment(payment: Payment): Payment {
    const idx = this.data.payments.findIndex((p) => p.id === payment.id);
    if (idx >= 0) this.data.payments[idx] = payment;
    else this.data.payments.push(payment);
    this.recomputeInvoiceStatus(payment.invoiceId);
    this.persist();
    return structuredClone(payment);
  }

  deletePayment(id: string): void {
    const payment = this.data.payments.find((p) => p.id === id);
    this.data.payments = this.data.payments.filter((p) => p.id !== id);
    if (payment) this.recomputeInvoiceStatus(payment.invoiceId);
    this.persist();
  }

  private recomputeInvoiceStatus(invoiceId: string) {
    const invoice = this.data.invoices.find((i) => i.id === invoiceId);
    if (!invoice || invoice.status === 'draft') return;

    const { total } = calcTotalsSafe(invoice);
    const paid = this.data.payments
      .filter((p) => p.invoiceId === invoiceId)
      .reduce((s, p) => s + p.amount, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(invoice.dueDate);
    due.setHours(0, 0, 0, 0);

    if (paid >= total - 0.001) invoice.status = 'paid';
    else if (paid > 0) invoice.status = 'partial';
    else if (due < today) invoice.status = 'overdue';
    else invoice.status = 'sent';

    invoice.updatedAt = new Date().toISOString();
  }
}
