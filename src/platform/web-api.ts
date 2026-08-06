import type { AppData } from '../types';
import type { MyFinanceApi } from './myfinance-api';
import { MobileDataStore } from './mobile-store';
import { buildInvoicePdf, buildOfferPdf } from './mobile-pdf';
import { clientsCsv, invoicesCsv, paymentsCsv } from '../lib/csv-export';

const STORAGE_KEY = 'myfinance-data-v1';
const pdfFiles = new Map<string, Uint8Array>();

let store: MobileDataStore | null = null;
let initPromise: Promise<void> | null = null;

function readJsonFile(): AppData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AppData) : null;
  } catch {
    return null;
  }
}

async function writeJsonFile(data: AppData): Promise<void> {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

async function ensureStore(): Promise<MobileDataStore> {
  if (store) return store;
  if (!initPromise) {
    initPromise = (async () => {
      const mobile = new MobileDataStore(writeJsonFile);
      const existing = readJsonFile();
      if (existing) mobile.hydrate(existing);
      else await writeJsonFile(mobile.getAll());
      store = mobile;
    })();
  }
  await initPromise;
  return store!;
}

function pickImageFile(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/webp';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    };
    input.click();
  });
}

function downloadBlob(bytes: Uint8Array, name: string, mime: string) {
      const blob = new Blob([new Uint8Array(bytes)], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function createWebApi(): MyFinanceApi {
  return {
    async getAll() {
      return (await ensureStore()).getAll();
    },
    async getCompany() {
      return (await ensureStore()).getCompany();
    },
    async saveCompany(company) {
      return (await ensureStore()).saveCompany(company);
    },
    async listClients() {
      return (await ensureStore()).listClients();
    },
    async saveClient(client) {
      return (await ensureStore()).saveClient(client);
    },
    async deleteClient(id) {
      (await ensureStore()).deleteClient(id);
    },
    async listInvoices() {
      return (await ensureStore()).listInvoices();
    },
    async saveInvoice(invoice) {
      return (await ensureStore()).saveInvoice(invoice);
    },
    async deleteInvoice(id) {
      (await ensureStore()).deleteInvoice(id);
    },
    async listOffers() {
      return (await ensureStore()).listOffers();
    },
    async saveOffer(offer) {
      return (await ensureStore()).saveOffer(offer);
    },
    async deleteOffer(id) {
      (await ensureStore()).deleteOffer(id);
    },
    async listPayments() {
      return (await ensureStore()).listPayments();
    },
    async savePayment(payment) {
      return (await ensureStore()).savePayment(payment);
    },
    async deletePayment(id) {
      (await ensureStore()).deletePayment(id);
    },

    async generateInvoicePdf(invoiceId, kind = 'invoice') {
      const s = await ensureStore();
      const invoice = s.listInvoices().find((i) => i.id === invoiceId);
      if (!invoice) throw new Error('Invoice not found');
      const client = s.listClients().find((c) => c.id === invoice.clientId);
      if (!client) throw new Error('Client not found');
      const company = s.getCompany();
      const bytes = await buildInvoicePdf(invoice, client, company, kind);
      const suffix = kind === 'invoice' ? '' : `-${kind}`;
      const path = `pdf/${invoice.number}${suffix}.pdf`;
      pdfFiles.set(path, bytes);
      return path;
    },

    async generateOfferPdf(offerId, style = 'pricing') {
      const s = await ensureStore();
      const offer = s.listOffers().find((o) => o.id === offerId);
      if (!offer) throw new Error('Offer not found');
      const client = s.listClients().find((c) => c.id === offer.clientId);
      if (!client) throw new Error('Client not found');
      const company = s.getCompany();
      const bytes = await buildOfferPdf(offer, client, company, style);
      const suffix = style === 'pricing' ? '-pricing' : '-quotation';
      const path = `pdf/${offer.number}${suffix}.pdf`;
      pdfFiles.set(path, bytes);
      return path;
    },

    async openPdf(filePath) {
      const bytes = pdfFiles.get(filePath);
      if (!bytes) throw new Error('PDF not found');
      const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }));
      window.open(url, '_blank');
    },

    async revealPdf(filePath) {
      const bytes = pdfFiles.get(filePath);
      if (!bytes) throw new Error('PDF not found');
      downloadBlob(bytes, filePath.split('/').pop() || 'document.pdf', 'application/pdf');
    },

    async exportCsv(kind) {
      const s = await ensureStore();
      const data = s.getAll();
      let content = '';
      if (kind === 'invoices') content = invoicesCsv(data.invoices, data.clients, data.payments);
      else if (kind === 'payments') content = paymentsCsv(data.payments, data.invoices);
      else content = clientsCsv(data.clients, data.invoices, data.payments);
      const name = `myfinance-${kind}.csv`;
      downloadBlob(new TextEncoder().encode(content), name, 'text/csv');
      return name;
    },

    async pickLogo() {
      const dataUrl = await pickImageFile();
      if (!dataUrl) return null;
      const s = await ensureStore();
      const company = s.getCompany();
      company.logoPath = dataUrl;
      s.saveCompany(company);
      return dataUrl;
    },

    async pickInvoicesFolder() {
      return null;
    },

    async getInvoicesRoot() {
      return 'Browser storage (PWA)';
    },

    async readDataUrl(filePath) {
      if (!filePath) return null;
      if (filePath.startsWith('data:')) return filePath;
      return null;
    },

    async readFileForShare(filePath) {
      const bytes = pdfFiles.get(filePath);
      if (!bytes) throw new Error('PDF not found');
      return {
        name: filePath.split('/').pop() || 'document.pdf',
        mime: 'application/pdf',
        data: bytes,
      };
    },

    async shareMac(filePath, message) {
      const file = await this.readFileForShare(filePath);
      const blob = new Blob([new Uint8Array(file.data)], { type: file.mime });
      const shareFile = new File([blob], file.name, { type: file.mime });
      if (navigator.share) {
        await navigator.share({
          files: [shareFile],
          text: message,
          title: file.name,
        });
        return true;
      }
      await this.revealPdf(filePath);
      return false;
    },

    async shareWhatsApp(filePath, message) {
      return this.shareMac(filePath, message);
    },

    async shareEmail(filePath, subject, body) {
      const file = await this.readFileForShare(filePath);
      const blob = new Blob([new Uint8Array(file.data)], { type: file.mime });
      const shareFile = new File([blob], file.name, { type: file.mime });
      if (navigator.canShare?.({ files: [shareFile] })) {
        await navigator.share({ files: [shareFile], title: subject, text: body });
        return true;
      }
      window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      await this.revealPdf(filePath);
      return false;
    },
  };
}
