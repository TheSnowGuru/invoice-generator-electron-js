import type { Client, CompanySettings, Invoice, Offer } from '../types';
import { addDaysIso, newId, resolveVatRate, todayIso } from '../types';

/** Fresh invoice draft; VAT respects the client's country when provided. */
export function newInvoiceDraft(company: CompanySettings, client?: Client): Invoice {
  const now = new Date().toISOString();
  const vatRate = resolveVatRate(company.country, client?.country, company.defaultVatRate);
  return {
    id: newId(),
    number: `${company.invoicePrefix}${company.nextInvoiceNumber}`,
    clientId: client?.id ?? '',
    status: 'draft',
    issueDate: todayIso(),
    dueDate: addDaysIso(30),
    currency: 'GBP',
    items: [
      {
        id: newId(),
        description: '',
        quantity: 1,
        unitPrice: 0,
        vatRate,
      },
    ],
    notes: company.defaultNotes,
    createdAt: now,
    updatedAt: now,
  };
}

/** Copy of an existing invoice as a fresh draft: new id, next number, today's dates. */
export function duplicateInvoice(source: Invoice, company: CompanySettings): Invoice {
  const now = new Date().toISOString();
  return {
    ...source,
    id: newId(),
    number: `${company.invoicePrefix}${company.nextInvoiceNumber}`,
    status: 'draft',
    issueDate: todayIso(),
    dueDate: addDaysIso(30),
    items: source.items.map((item) => ({ ...item, id: newId() })),
    createdAt: now,
    updatedAt: now,
  };
}

/** Copy of an existing offer as a fresh draft: new id, next number, today's dates. */
export function duplicateOffer(source: Offer, company: CompanySettings): Offer {
  const now = new Date().toISOString();
  return {
    ...source,
    id: newId(),
    number: `${company.offerPrefix}${company.nextOfferNumber}`,
    status: 'draft',
    issueDate: todayIso(),
    validUntil: addDaysIso(14),
    items: source.items.map((item) => ({ ...item, id: newId() })),
    createdAt: now,
    updatedAt: now,
  };
}

/** Fresh offer draft; VAT respects the client's country when provided. */
export function newOfferDraft(company: CompanySettings, client?: Client): Offer {
  const now = new Date().toISOString();
  const vatRate = resolveVatRate(company.country, client?.country, company.defaultVatRate);
  return {
    id: newId(),
    number: `${company.offerPrefix}${company.nextOfferNumber}`,
    clientId: client?.id ?? '',
    status: 'draft',
    issueDate: todayIso(),
    validUntil: addDaysIso(14),
    currency: 'GBP',
    items: [
      {
        id: newId(),
        description: '',
        quantity: 1,
        unitPrice: 0,
        vatRate,
      },
    ],
    notes: 'This quotation is valid until the date shown above.',
    terms: 'Prices exclude expenses unless stated. Work begins upon written acceptance.',
    createdAt: now,
    updatedAt: now,
  };
}
