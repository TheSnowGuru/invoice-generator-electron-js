/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />
export {};

interface ImportMetaEnv {
  readonly VITE_PWA?: string;
  readonly VITE_HOSTED_AUTH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module 'virtual:pwa-register' {
  export function registerSW(options?: {
    immediate?: boolean;
    onNeedRefresh?: () => void;
    onOfflineReady?: () => void;
  }): (reloadPage?: boolean) => Promise<void>;
}

declare global {
  interface Window {
    flowstate: {
      getAll: () => Promise<import('./types').AppData>;
      getCompany: () => Promise<import('./types').CompanySettings>;
      saveCompany: (
        company: import('./types').CompanySettings
      ) => Promise<import('./types').CompanySettings>;
      listClients: () => Promise<import('./types').Client[]>;
      saveClient: (client: import('./types').Client) => Promise<import('./types').Client>;
      deleteClient: (id: string) => Promise<void>;
      listInvoices: () => Promise<import('./types').Invoice[]>;
      saveInvoice: (invoice: import('./types').Invoice) => Promise<import('./types').Invoice>;
      deleteInvoice: (id: string) => Promise<void>;
      listOffers: () => Promise<import('./types').Offer[]>;
      saveOffer: (offer: import('./types').Offer) => Promise<import('./types').Offer>;
      deleteOffer: (id: string) => Promise<void>;
      listPayments: () => Promise<import('./types').Payment[]>;
      savePayment: (payment: import('./types').Payment) => Promise<import('./types').Payment>;
      deletePayment: (id: string) => Promise<void>;
      generateInvoicePdf: (
        invoiceId: string,
        kind?: 'invoice' | 'proforma' | 'receipt' | 'reminder'
      ) => Promise<string>;
      generateOfferPdf: (
        offerId: string,
        style?: 'pricing' | 'quotation'
      ) => Promise<string>;
      openPdf: (filePath: string) => Promise<void>;
      revealPdf: (filePath: string) => Promise<void>;
      exportCsv: (kind: 'invoices' | 'payments' | 'clients') => Promise<string | null>;
      pickLogo: () => Promise<string | null>;
      pickInvoicesFolder: () => Promise<string | null>;
      getInvoicesRoot: () => Promise<string>;
      readDataUrl: (filePath: string) => Promise<string | null>;
      readFileForShare: (
        filePath: string
      ) => Promise<{ name: string; mime: string; data: Uint8Array }>;
      shareMac: (filePath: string, message?: string) => Promise<boolean>;
      shareWhatsApp: (filePath: string, message?: string) => Promise<boolean>;
      shareEmail: (filePath: string, subject: string, body: string) => Promise<boolean>;
    };
  }
}
