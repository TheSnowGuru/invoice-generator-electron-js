export {};

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
      shareMac: (filePath: string) => Promise<boolean>;
      shareWhatsApp: (filePath: string) => Promise<boolean>;
    };
  }
}
