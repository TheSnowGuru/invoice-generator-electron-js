import fs from 'fs';
import path from 'path';
import {
  AppData,
  Client,
  CompanySettings,
  DEFAULT_COMPANY,
  Invoice,
  Offer,
  Payment,
} from './types';

const FILE = 'flowstate-data.json';

export class DataStore {
  private filePath: string;
  private data: AppData;

  constructor(dataDir: string) {
    this.filePath = path.join(dataDir, FILE);
    this.data = this.load();
  }

  private load(): AppData {
    if (!fs.existsSync(this.filePath)) {
      const initial: AppData = {
        company: { ...DEFAULT_COMPANY },
        clients: [],
        invoices: [],
        offers: [],
        payments: [],
      };
      this.write(initial);
      return initial;
    }
    try {
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      const parsed = JSON.parse(raw) as AppData;
      return {
        company: { ...DEFAULT_COMPANY, ...parsed.company },
        clients: parsed.clients ?? [],
        invoices: parsed.invoices ?? [],
        offers: parsed.offers ?? [],
        payments: parsed.payments ?? [],
      };
    } catch {
      return {
        company: { ...DEFAULT_COMPANY },
        clients: [],
        invoices: [],
        offers: [],
        payments: [],
      };
    }
  }

  private write(data: AppData = this.data) {
    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  private persist() {
    this.write(this.data);
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
      // bump next number if this used the current counter
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

    // Auto-update invoice status based on payments
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

    if (paid >= total - 0.001) {
      invoice.status = 'paid';
    } else if (paid > 0) {
      invoice.status = 'partial';
    } else if (due < today && invoice.status !== 'draft') {
      invoice.status = 'overdue';
    } else if (invoice.status === 'overdue' || invoice.status === 'partial' || invoice.status === 'paid') {
      invoice.status = 'sent';
    }
    invoice.updatedAt = new Date().toISOString();
  }
}

function calcTotalsSafe(invoice: Invoice) {
  const subtotal = invoice.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const vat = invoice.items.reduce((s, i) => s + i.quantity * i.unitPrice * i.vatRate, 0);
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    vat: Math.round(vat * 100) / 100,
    total: Math.round((subtotal + vat) * 100) / 100,
  };
}
