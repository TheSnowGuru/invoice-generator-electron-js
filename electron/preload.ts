import { contextBridge, ipcRenderer } from 'electron';
import type { CompanySettings, Client, Invoice, Offer, Payment, AppData } from './types';

const api = {
  getAll: (): Promise<AppData> => ipcRenderer.invoke('data:getAll'),

  getCompany: (): Promise<CompanySettings> => ipcRenderer.invoke('company:get'),
  saveCompany: (company: CompanySettings): Promise<CompanySettings> =>
    ipcRenderer.invoke('company:save', company),

  listClients: (): Promise<Client[]> => ipcRenderer.invoke('clients:list'),
  saveClient: (client: Client): Promise<Client> => ipcRenderer.invoke('clients:save', client),
  deleteClient: (id: string): Promise<void> => ipcRenderer.invoke('clients:delete', id),

  listInvoices: (): Promise<Invoice[]> => ipcRenderer.invoke('invoices:list'),
  saveInvoice: (invoice: Invoice): Promise<Invoice> => ipcRenderer.invoke('invoices:save', invoice),
  deleteInvoice: (id: string): Promise<void> => ipcRenderer.invoke('invoices:delete', id),

  listOffers: (): Promise<Offer[]> => ipcRenderer.invoke('offers:list'),
  saveOffer: (offer: Offer): Promise<Offer> => ipcRenderer.invoke('offers:save', offer),
  deleteOffer: (id: string): Promise<void> => ipcRenderer.invoke('offers:delete', id),

  listPayments: (): Promise<Payment[]> => ipcRenderer.invoke('payments:list'),
  savePayment: (payment: Payment): Promise<Payment> => ipcRenderer.invoke('payments:save', payment),
  deletePayment: (id: string): Promise<void> => ipcRenderer.invoke('payments:delete', id),

  generateInvoicePdf: (
    invoiceId: string,
    kind?: 'invoice' | 'proforma' | 'receipt' | 'reminder'
  ): Promise<string> => ipcRenderer.invoke('pdf:invoice', invoiceId, kind ?? 'invoice'),
  generateOfferPdf: (
    offerId: string,
    style?: 'pricing' | 'quotation'
  ): Promise<string> => ipcRenderer.invoke('pdf:offer', offerId, style ?? 'pricing'),
  openPdf: (filePath: string): Promise<void> => ipcRenderer.invoke('pdf:open', filePath),
  revealPdf: (filePath: string): Promise<void> => ipcRenderer.invoke('pdf:reveal', filePath),

  exportCsv: (kind: 'invoices' | 'payments' | 'clients'): Promise<string | null> =>
    ipcRenderer.invoke('csv:export', kind),

  pickLogo: (): Promise<string | null> => ipcRenderer.invoke('dialog:pickLogo'),
  readDataUrl: (filePath: string): Promise<string | null> =>
    ipcRenderer.invoke('fs:readDataUrl', filePath),
};

contextBridge.exposeInMainWorld('flowstate', api);

export type FlowStateApi = typeof api;
