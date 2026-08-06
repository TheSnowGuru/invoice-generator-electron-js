import type {
  AppData,
  Client,
  CompanySettings,
  Invoice,
  Offer,
  Payment,
} from '../types';

export interface MyFinanceApi {
  getAll(): Promise<AppData>;
  getCompany(): Promise<CompanySettings>;
  saveCompany(company: CompanySettings): Promise<CompanySettings>;
  listClients(): Promise<Client[]>;
  saveClient(client: Client): Promise<Client>;
  deleteClient(id: string): Promise<void>;
  listInvoices(): Promise<Invoice[]>;
  saveInvoice(invoice: Invoice): Promise<Invoice>;
  deleteInvoice(id: string): Promise<void>;
  listOffers(): Promise<Offer[]>;
  saveOffer(offer: Offer): Promise<Offer>;
  deleteOffer(id: string): Promise<void>;
  listPayments(): Promise<Payment[]>;
  savePayment(payment: Payment): Promise<Payment>;
  deletePayment(id: string): Promise<void>;
  generateInvoicePdf(
    invoiceId: string,
    kind?: 'invoice' | 'proforma' | 'receipt' | 'reminder'
  ): Promise<string>;
  generateOfferPdf(offerId: string, style?: 'pricing' | 'quotation'): Promise<string>;
  openPdf(filePath: string): Promise<void>;
  revealPdf(filePath: string): Promise<void>;
  exportCsv(kind: 'invoices' | 'payments' | 'clients'): Promise<string | null>;
  pickLogo(): Promise<string | null>;
  pickInvoicesFolder(): Promise<string | null>;
  getInvoicesRoot(): Promise<string>;
  readDataUrl(filePath: string): Promise<string | null>;
  readFileForShare(filePath: string): Promise<{ name: string; mime: string; data: Uint8Array }>;
  shareMac(filePath: string, message?: string): Promise<boolean>;
  shareWhatsApp(filePath: string, message?: string): Promise<boolean>;
  shareEmail(filePath: string, subject: string, body: string): Promise<boolean>;
}
