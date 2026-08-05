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
      generateInvoicePdf: (invoiceId: string) => Promise<string>;
      generateOfferPdf: (offerId: string) => Promise<string>;
      openPdf: (filePath: string) => Promise<void>;
      revealPdf: (filePath: string) => Promise<void>;
      exportCsv: (kind: 'invoices' | 'payments' | 'clients') => Promise<string | null>;
      pickLogo: () => Promise<string | null>;
      readDataUrl: (filePath: string) => Promise<string | null>;
    };
  }
}
