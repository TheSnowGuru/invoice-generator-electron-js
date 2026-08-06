import { create } from 'zustand';
import type { AppData, Client, CompanySettings, Invoice, Offer, Payment } from './types';
import { getMyFinanceApi } from './platform/api';

interface AppState extends AppData {
  loaded: boolean;
  toast: string | null;
  load: () => Promise<void>;
  setToast: (msg: string | null) => void;
  refresh: () => Promise<void>;
  saveCompany: (company: CompanySettings) => Promise<void>;
  saveClient: (client: Client) => Promise<void>;
  deleteClient: (id: string) => Promise<void>;
  saveInvoice: (invoice: Invoice) => Promise<void>;
  deleteInvoice: (id: string) => Promise<void>;
  saveOffer: (offer: Offer) => Promise<void>;
  deleteOffer: (id: string) => Promise<void>;
  savePayment: (payment: Payment) => Promise<void>;
  deletePayment: (id: string) => Promise<void>;
}

const empty: AppData = {
  company: {
    name: '',
    addressLine1: '',
    addressLine2: '',
    city: 'London',
    postcode: '',
    country: 'United Kingdom',
    companyNumber: '',
    vatNumber: '',
    email: '',
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
    defaultNotes: '',
    defaultVatRate: 0.2,
    pdfOutputDir: '',
  },
  clients: [],
  invoices: [],
  offers: [],
  payments: [],
};

export const useAppStore = create<AppState>((set, get) => ({
  ...empty,
  loaded: false,
  toast: null,

  setToast: (msg) => {
    set({ toast: msg });
    if (msg) setTimeout(() => set({ toast: null }), 2800);
  },

  load: async () => {
    const data = await getMyFinanceApi().getAll();
    set({ ...data, loaded: true });
  },

  refresh: async () => {
    const data = await getMyFinanceApi().getAll();
    set({ ...data });
  },

  saveCompany: async (company) => {
    const saved = await getMyFinanceApi().saveCompany(company);
    set({ company: saved });
    get().setToast('Company settings saved');
  },

  saveClient: async (client) => {
    const saved = await getMyFinanceApi().saveClient(client);
    const clients = [...get().clients];
    const idx = clients.findIndex((c) => c.id === saved.id);
    if (idx >= 0) clients[idx] = saved;
    else clients.push(saved);
    set({ clients });
    get().setToast('Client saved');
  },

  deleteClient: async (id) => {
    await getMyFinanceApi().deleteClient(id);
    set({ clients: get().clients.filter((c) => c.id !== id) });
    get().setToast('Client deleted');
  },

  saveInvoice: async (invoice) => {
    const saved = await getMyFinanceApi().saveInvoice(invoice);
    await get().refresh();
    void saved;
    get().setToast('Invoice saved');
  },

  deleteInvoice: async (id) => {
    await getMyFinanceApi().deleteInvoice(id);
    await get().refresh();
    get().setToast('Invoice deleted');
  },

  saveOffer: async (offer) => {
    await getMyFinanceApi().saveOffer(offer);
    await get().refresh();
    get().setToast('Offer saved');
  },

  deleteOffer: async (id) => {
    await getMyFinanceApi().deleteOffer(id);
    set({ offers: get().offers.filter((o) => o.id !== id) });
    get().setToast('Offer deleted');
  },

  savePayment: async (payment) => {
    await getMyFinanceApi().savePayment(payment);
    await get().refresh();
    get().setToast('Payment recorded');
  },

  deletePayment: async (id) => {
    await getMyFinanceApi().deletePayment(id);
    await get().refresh();
    get().setToast('Payment removed');
  },
}));
