import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import type { AppData } from '../types';
import type { MyFinanceApi } from './myfinance-api';
import { MobileDataStore } from './mobile-store';
import { buildInvoicePdf, buildOfferPdf } from './mobile-pdf';
import { clientsCsv, invoicesCsv, paymentsCsv } from '../lib/csv-export';

const DATA_FILE = 'myfinance-data.json';
const PDF_ROOT = 'MyFinance';

let store: MobileDataStore | null = null;
let initPromise: Promise<void> | null = null;

function safeSegment(name: string): string {
  const cleaned = (name || 'Unknown')
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  return cleaned || 'Unknown';
}

async function readJsonFile(): Promise<AppData | null> {
  try {
    const result = await Filesystem.readFile({
      path: DATA_FILE,
      directory: Directory.Data,
      encoding: Encoding.UTF8,
    });
    return JSON.parse(result.data as string) as AppData;
  } catch {
    return null;
  }
}

async function writeJsonFile(data: AppData): Promise<void> {
  await Filesystem.writeFile({
    path: DATA_FILE,
    directory: Directory.Data,
    data: JSON.stringify(data, null, 2),
    encoding: Encoding.UTF8,
  });
}

async function ensureStore(): Promise<MobileDataStore> {
  if (store) return store;
  if (!initPromise) {
    initPromise = (async () => {
      const mobile = new MobileDataStore(writeJsonFile);
      const existing = await readJsonFile();
      if (existing) mobile.hydrate(existing);
      else await writeJsonFile(mobile.getAll());
      store = mobile;
    })();
  }
  await initPromise;
  return store!;
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

async function writePdf(relativePath: string, bytes: Uint8Array): Promise<string> {
  const path = `${PDF_ROOT}/${relativePath}`;
  const dir = path.split('/').slice(0, -1).join('/');
  try {
    await Filesystem.mkdir({ path: dir, directory: Directory.Documents, recursive: true });
  } catch {
    // exists
  }
  await Filesystem.writeFile({
    path,
    directory: Directory.Documents,
    data: bytesToBase64(bytes),
  });
  return path;
}

async function readPdfBytes(relativePath: string): Promise<Uint8Array> {
  const result = await Filesystem.readFile({
    path: relativePath.startsWith(PDF_ROOT) ? relativePath : `${PDF_ROOT}/${relativePath}`,
    directory: Directory.Documents,
  });
  return base64ToBytes(result.data as string);
}

async function getFileUri(relativePath: string): Promise<string> {
  const path = relativePath.startsWith(PDF_ROOT)
    ? relativePath
    : `${PDF_ROOT}/${relativePath}`;
  const { uri } = await Filesystem.getUri({ path, directory: Directory.Documents });
  return uri;
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

export function createCapacitorApi(): MyFinanceApi {
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
      const fileName = `${safeSegment(invoice.number)}${suffix}.pdf`;
      const rel = `invoices/${safeSegment(client.name)}/${fileName}`;
      return writePdf(rel, bytes);
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
      const fileName = `${safeSegment(offer.number)}${suffix}.pdf`;
      const rel = `offers/${safeSegment(client.name)}/${fileName}`;
      return writePdf(rel, bytes);
    },

    async openPdf(filePath) {
      const uri = await getFileUri(filePath);
      await Share.share({ title: 'PDF', url: uri });
    },

    async revealPdf(filePath) {
      await this.openPdf(filePath);
    },

    async exportCsv(kind) {
      const s = await ensureStore();
      const data = s.getAll();
      let content = '';
      if (kind === 'invoices') {
        content = invoicesCsv(data.invoices, data.clients, data.payments);
      } else if (kind === 'payments') {
        content = paymentsCsv(data.payments, data.invoices);
      } else {
        content = clientsCsv(data.clients, data.invoices, data.payments);
      }
      const path = `exports/myfinance-${kind}.csv`;
      await Filesystem.mkdir({
        path: `${PDF_ROOT}/exports`,
        directory: Directory.Documents,
        recursive: true,
      });
      await Filesystem.writeFile({
        path: `${PDF_ROOT}/${path}`,
        directory: Directory.Documents,
        data: content,
        encoding: Encoding.UTF8,
      });
      return path;
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
      return 'Documents/MyFinance/invoices';
    },

    async readDataUrl(filePath) {
      if (!filePath) return null;
      if (filePath.startsWith('data:')) return filePath;
      try {
        const bytes = await readPdfBytes(filePath);
        return `data:application/octet-stream;base64,${bytesToBase64(bytes)}`;
      } catch {
        return null;
      }
    },

    async readFileForShare(filePath) {
      const bytes = await readPdfBytes(filePath);
      const name = filePath.split('/').pop() || 'document.pdf';
      return { name, mime: 'application/pdf', data: bytes };
    },

    async shareMac(filePath, message) {
      const uri = await getFileUri(filePath);
      await Share.share({
        title: filePath.split('/').pop(),
        text: message,
        url: uri,
        dialogTitle: 'Share document',
      });
      return true;
    },

    async shareWhatsApp(filePath, message) {
      return this.shareMac(filePath, message);
    },

    async shareEmail(filePath, subject, body) {
      const uri = await getFileUri(filePath);
      await Share.share({
        title: subject,
        text: `${body}\n\n${uri}`,
        dialogTitle: 'Share via email',
      });
      return true;
    },
  };
}
