import { useEffect, useState } from 'react';
import { getMyFinanceApi } from '../platform/api';
import type { Client, CompanySettings, Invoice, LineItem, Offer, Payment } from '../types';
import {
  calcLineNet,
  calcLineVat,
  calcTotals,
  formatDateUk,
  formatGbp,
  formatMoney,
  invoiceTotals,
  paidAmount,
  round2,
} from '../types';
import type { CurrencyCode } from '../types';

export type InvoiceDocKind = 'invoice' | 'proforma' | 'receipt' | 'reminder';
export type OfferDocStyle = 'pricing' | 'quotation';

function addr(c: {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  postcode: string;
  country: string;
}) {
  return [c.addressLine1, c.addressLine2, c.city, c.postcode, c.country].filter(Boolean);
}

function ItemsTable({ items, accent }: { items: LineItem[]; accent: string }) {
  return (
    <table className="dp-table">
      <thead>
        <tr style={{ background: accent }}>
          <th>Description</th>
          <th>Qty</th>
          <th>Unit</th>
          <th>VAT</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => {
          const gross = round2(calcLineNet(item) + calcLineVat(item));
          return (
            <tr key={item.id}>
              <td>{item.description || '—'}</td>
              <td>{item.quantity}</td>
              <td>{formatGbp(item.unitPrice)}</td>
              <td>{Number((item.vatRate * 100).toFixed(2))}%</td>
              <td>{formatGbp(gross)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function TotalsBlock({
  items,
  accent,
  currency = 'GBP',
  roundTotals = false,
  extras = [],
}: {
  items: LineItem[];
  accent: string;
  currency?: CurrencyCode;
  roundTotals?: boolean;
  extras?: Array<{ label: string; value: string }>;
}) {
  const { subtotal, vat, displayTotal, roundingAdjustment } = invoiceTotals(items, roundTotals);
  return (
    <div className="dp-totals">
      <div className="dp-totals-row">
        <span>Subtotal</span>
        <strong>{formatMoney(subtotal, currency)}</strong>
      </div>
      <div className="dp-totals-row">
        <span>VAT</span>
        <strong>{formatMoney(vat, currency)}</strong>
      </div>
      {extras.map((e) => (
        <div className="dp-totals-row" key={e.label}>
          <span>{e.label}</span>
          <strong>{e.value}</strong>
        </div>
      ))}
      {roundTotals && roundingAdjustment !== 0 && (
        <div className="dp-totals-row">
          <span>Rounding</span>
          <strong>{formatMoney(roundingAdjustment, currency)}</strong>
        </div>
      )}
      <div className="dp-totals-grand" style={{ background: accent }}>
        <span>Total ({currency})</span>
        <strong>{formatMoney(displayTotal, currency)}</strong>
      </div>
    </div>
  );
}

function BankBlock({ company, accent }: { company: CompanySettings; accent: string }) {
  const lines = [
    company.bankName && `Bank: ${company.bankName}`,
    company.bankBranch && `Branch: ${company.bankBranch}`,
    company.bankAccountName && `Account: ${company.bankAccountName}`,
    company.bankSortCode && `Sort Code: ${company.bankSortCode}`,
    company.bankAccountNumber && `Account No: ${company.bankAccountNumber}`,
    company.bankRouting && `Routing: ${company.bankRouting}`,
    company.bankIban && `IBAN: ${company.bankIban}`,
    company.bankBic && `BIC: ${company.bankBic}`,
  ].filter(Boolean) as string[];
  if (!lines.length) return null;
  return (
    <div className="dp-bank">
      <div className="dp-label" style={{ color: accent }}>
        Payment details
      </div>
      {lines.map((l) => (
        <div key={l}>{l}</div>
      ))}
    </div>
  );
}

interface InvoicePreviewProps {
  invoice: Invoice;
  client: Client;
  company: CompanySettings;
  kind: InvoiceDocKind;
  payments: Payment[];
  logoUrl: string | null;
}

export function InvoiceDocumentPreview({
  invoice,
  client,
  company,
  kind,
  payments,
  logoUrl,
}: InvoicePreviewProps) {
  const accent =
    kind === 'receipt'
      ? '#059669'
      : kind === 'proforma'
        ? '#7c3aed'
        : kind === 'reminder'
          ? '#d97706'
          : invoice.accentColor || company.accentColor || '#38bdf8';

  const titles: Record<InvoiceDocKind, string> = {
    invoice: 'TAX INVOICE',
    proforma: 'PROFORMA INVOICE',
    receipt: 'RECEIPT',
    reminder: 'PAYMENT REMINDER',
  };
  const banners: Partial<Record<InvoiceDocKind, string>> = {
    proforma: 'PROFORMA — THIS IS NOT A TAX INVOICE',
    receipt: 'PAYMENT RECEIVED — THANK YOU',
    reminder: 'FRIENDLY REMINDER — PAYMENT OVERDUE OR DUE SOON',
  };

  const paid = paidAmount(invoice.id, payments);
  const { displayTotal } = invoiceTotals(invoice.items, invoice.roundTotals);
  const outstanding = round2(Math.max(0, displayTotal - paid));
  const lastPay = [...payments]
    .filter((p) => p.invoiceId === invoice.id)
    .sort((a, b) => b.date.localeCompare(a.date))[0];

  const metaRows: Array<[string, string]> = [['Issue Date', formatDateUk(invoice.issueDate)]];
  if (kind !== 'receipt') metaRows.push(['Due Date', formatDateUk(invoice.dueDate)]);
  if (kind === 'receipt') {
    metaRows.push(['Paid', formatMoney(paid, invoice.currency)]);
    metaRows.push(['Payment date', formatDateUk(lastPay?.date || invoice.issueDate)]);
    if (lastPay?.method) metaRows.push(['Method', lastPay.method]);
  } else {
    metaRows.push(['Status', invoice.status.toUpperCase()]);
    metaRows.push(['Currency', invoice.currency]);
    if (kind === 'reminder') metaRows.push(['Amount due', formatMoney(outstanding, invoice.currency)]);
  }

  const extras =
    kind === 'receipt' || kind === 'reminder'
      ? [
          { label: 'Paid', value: formatMoney(paid, invoice.currency) },
          ...(kind === 'reminder'
            ? [{ label: 'Outstanding', value: formatMoney(outstanding, invoice.currency) }]
            : []),
        ]
      : [];

  let notes = invoice.notes;
  if (kind === 'proforma') {
    notes = [
      'This proforma invoice is for informational purposes and is not a VAT tax invoice.',
      notes,
    ]
      .filter(Boolean)
      .join('\n\n');
  } else if (kind === 'receipt') {
    notes = [
      paid > 0
        ? `We acknowledge receipt of ${formatMoney(paid, invoice.currency)} against ${invoice.number}.`
        : 'Receipt generated — no payments recorded yet.',
      notes,
    ]
      .filter(Boolean)
      .join('\n\n');
  } else if (kind === 'reminder') {
    notes = [
      outstanding > 0
        ? `Please settle the outstanding balance of ${formatMoney(outstanding, invoice.currency)} at your earliest convenience.`
        : 'This invoice appears fully paid — thank you.',
      notes,
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  return (
    <div className="doc-preview-page">
      <div className="dp-accent-bar" style={{ background: accent }} />
      <div className="dp-header">
        <div className="dp-brand">
          {logoUrl && <img src={logoUrl} alt="" className="dp-logo" />}
          <div>
            <div className="dp-company">{company.name}</div>
            <div className="dp-muted">
              {addr(company).map((l) => (
                <div key={l}>{l}</div>
              ))}
            </div>
          </div>
        </div>
        <div className="dp-title-block">
          <div className="dp-doc-title" style={{ color: accent }}>
            {titles[kind]}
          </div>
          <div className="dp-doc-number">{invoice.number}</div>
        </div>
      </div>

      {banners[kind] && (
        <div className="dp-banner" style={{ background: accent }}>
          {banners[kind]}
        </div>
      )}

      <div className="dp-meta-grid">
        <div>
          <div className="dp-label" style={{ color: accent }}>
            {kind === 'receipt' ? 'Received from' : 'Bill to'}
          </div>
          <div className="dp-strong">{client.name}</div>
          <div className="dp-muted">
            {[client.contactName, ...addr(client), client.email].filter(Boolean).map((l) => (
              <div key={l}>{l}</div>
            ))}
          </div>
        </div>
        <div className="dp-meta-right">
          {metaRows.map(([k, v]) => (
            <div className="dp-meta-row" key={k}>
              <span>{k}</span>
              <strong>{v}</strong>
            </div>
          ))}
        </div>
      </div>

      <ItemsTable items={invoice.items} accent={accent} />
      <TotalsBlock
        items={invoice.items}
        accent={accent}
        currency={invoice.currency}
        roundTotals={invoice.roundTotals}
        extras={extras}
      />

      <div className="dp-footer-grid">
        {notes && (
          <div>
            <div className="dp-label" style={{ color: accent }}>
              Notes
            </div>
            <div className="dp-muted dp-pre">{notes}</div>
          </div>
        )}
        {kind !== 'receipt' && <BankBlock company={company} accent={accent} />}
      </div>

      <div className="dp-legal">
        {[
          company.companyNumber && `Company No: ${company.companyNumber}`,
          company.vatNumber && `VAT No: ${company.vatNumber}`,
          company.email,
        ]
          .filter(Boolean)
          .join('  ·  ')}
      </div>
    </div>
  );
}

interface OfferPreviewProps {
  offer: Offer;
  client: Client;
  company: CompanySettings;
  style: OfferDocStyle;
  logoUrl: string | null;
}

export function OfferDocumentPreview({
  offer,
  client,
  company,
  style,
  logoUrl,
}: OfferPreviewProps) {
  const accent = offer.accentColor || company.accentColor || '#0ea5e9';
  const { subtotal, vat, total } = calcTotals(offer.items);

  if (style === 'pricing') {
    return (
      <div className="doc-preview-page pricing">
        <div className="dp-hero">
          <div className="dp-hero-left">
            <div className="dp-hero-brand">
              {logoUrl && <img src={logoUrl} alt="" className="dp-logo light" />}
              <div>
                <div className="dp-company light">{company.name}</div>
                <div className="dp-eyebrow">PRICING OFFER</div>
              </div>
            </div>
            <h2 className="dp-hero-title">Your tailored proposal</h2>
            <p className="dp-hero-sub">Prepared for {client.name}</p>
          </div>
          <div className="dp-hero-chip">
            <div className="dp-eyebrow" style={{ color: accent }}>
              OFFER
            </div>
            <div className="dp-chip-number">{offer.number}</div>
            <div className="dp-chip-valid">Valid until {formatDateUk(offer.validUntil)}</div>
          </div>
        </div>
        <div className="dp-accent-bar" style={{ background: accent, height: 8 }} />

        <div className="dp-cards">
          <div className="dp-card">
            <div className="dp-label" style={{ color: accent }}>
              Prepared for
            </div>
            <div className="dp-strong">{client.name}</div>
            <div className="dp-muted">
              {[client.contactName, client.email, client.city].filter(Boolean).map((l) => (
                <div key={l}>{l}</div>
              ))}
            </div>
          </div>
          <div className="dp-card">
            <div className="dp-label" style={{ color: accent }}>
              Details
            </div>
            <div className="dp-muted">
              <div>Issued {formatDateUk(offer.issueDate)}</div>
              <div>Valid {formatDateUk(offer.validUntil)}</div>
              <div>Currency GBP (£)</div>
            </div>
          </div>
        </div>

        <div className="dp-section-title">Investment breakdown</div>
        <div className="dp-section-sub">Transparent pricing with VAT shown separately</div>

        <div className="dp-packages">
          {offer.items.map((item, i) => {
            const gross = round2(calcLineNet(item) + calcLineVat(item));
            return (
              <div className="dp-package" key={item.id}>
                <div className="dp-package-index" style={{ background: accent }}>
                  {i + 1}
                </div>
                <div className="dp-package-body">
                  <div className="dp-strong">{item.description || 'Item'}</div>
                  <div className="dp-muted">
                    {item.quantity} × {formatGbp(item.unitPrice)} · VAT{' '}
                    {Number((item.vatRate * 100).toFixed(2))}%
                  </div>
                </div>
                <div className="dp-package-price">{formatGbp(gross)}</div>
              </div>
            );
          })}
        </div>

        <div className="dp-invest">
          <div>
            <div className="dp-muted">
              Subtotal {formatGbp(subtotal)} · VAT {formatGbp(vat)}
            </div>
            <div className="dp-invest-label">Total investment</div>
            <div className="dp-invest-total" style={{ color: accent }}>
              {formatGbp(total)}
            </div>
          </div>
          <div className="dp-accept" style={{ background: accent }}>
            ACCEPT OFFER
          </div>
        </div>

        {(offer.notes || offer.terms) && (
          <div className="dp-notes-block">
            {offer.notes && (
              <>
                <div className="dp-label" style={{ color: accent }}>
                  Notes
                </div>
                <div className="dp-muted dp-pre">{offer.notes}</div>
              </>
            )}
            {offer.terms && (
              <>
                <div className="dp-label" style={{ color: accent, marginTop: 12 }}>
                  Terms
                </div>
                <div className="dp-muted dp-pre">{offer.terms}</div>
              </>
            )}
          </div>
        )}

        <div className="dp-legal">
          {[
            'PRICING OFFER — NOT A TAX INVOICE',
            company.vatNumber && `VAT ${company.vatNumber}`,
            company.email,
          ]
            .filter(Boolean)
            .join('  ·  ')}
        </div>
      </div>
    );
  }

  // Classic quotation
  return (
    <div className="doc-preview-page">
      <div className="dp-accent-bar" style={{ background: accent }} />
      <div className="dp-header">
        <div className="dp-brand">
          {logoUrl && <img src={logoUrl} alt="" className="dp-logo" />}
          <div>
            <div className="dp-company">{company.name}</div>
            <div className="dp-muted">
              {addr(company).map((l) => (
                <div key={l}>{l}</div>
              ))}
            </div>
          </div>
        </div>
        <div className="dp-title-block">
          <div className="dp-doc-title" style={{ color: accent }}>
            QUOTATION
          </div>
          <div className="dp-doc-number">{offer.number}</div>
        </div>
      </div>

      <div className="dp-meta-grid">
        <div>
          <div className="dp-label" style={{ color: accent }}>
            Prepared for
          </div>
          <div className="dp-strong">{client.name}</div>
          <div className="dp-muted">
            {[client.contactName, ...addr(client), client.email].filter(Boolean).map((l) => (
              <div key={l}>{l}</div>
            ))}
          </div>
        </div>
        <div className="dp-meta-right">
          {(
            [
              ['Issue Date', formatDateUk(offer.issueDate)],
              ['Valid Until', formatDateUk(offer.validUntil)],
              ['Status', offer.status.toUpperCase()],
              ['Currency', 'GBP (£)'],
            ] as Array<[string, string]>
          ).map(([k, v]) => (
            <div className="dp-meta-row" key={k}>
              <span>{k}</span>
              <strong>{v}</strong>
            </div>
          ))}
        </div>
      </div>

      <ItemsTable items={offer.items} accent={accent} />
      <TotalsBlock items={offer.items} accent={accent} currency={offer.currency} />

      <div className="dp-footer-grid">
        {(offer.notes || offer.terms) && (
          <div>
            {offer.notes && (
              <>
                <div className="dp-label" style={{ color: accent }}>
                  Notes
                </div>
                <div className="dp-muted dp-pre">{offer.notes}</div>
              </>
            )}
            {offer.terms && (
              <>
                <div className="dp-label" style={{ color: accent, marginTop: 10 }}>
                  Terms
                </div>
                <div className="dp-muted dp-pre">{offer.terms}</div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="dp-legal">QUOTATION — NOT A TAX INVOICE</div>
    </div>
  );
}

/** Keep hooks export helper for logo loading used by studio */
export function useLogoUrl(logoPath: string) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!logoPath) {
        setLogoUrl(null);
        return;
      }
      const url = await getMyFinanceApi().readDataUrl(logoPath);
      if (!cancelled) setLogoUrl(url);
    })();
    return () => {
      cancelled = true;
    };
  }, [logoPath]);
  return logoUrl;
}
