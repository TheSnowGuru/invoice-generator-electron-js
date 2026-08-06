import { useMemo, useState } from 'react';
import { getMyFinanceApi } from '../platform/api';
import { useAppStore } from '../store';
import LineItemsEditor from './LineItemsEditor';
import {
  InvoiceDocumentPreview,
  OfferDocumentPreview,
  useLogoUrl,
  type InvoiceDocKind,
  type OfferDocStyle,
} from './DocumentPreview';
import type { Client, Invoice, Offer } from '../types';
import {
  ACCENT_PRESETS,
  applyVatRateToItems,
  calcTotals,
  formatDateUk,
  formatGbp,
  isSameCountry,
  resolveVatRate,
} from '../types';

export type StudioSession =
  | { kind: 'invoice'; invoice: Invoice; docKind: InvoiceDocKind }
  | { kind: 'offer'; offer: Offer; style: OfferDocStyle };

interface Props {
  session: StudioSession;
  onClose: () => void;
}

const INVOICE_KIND_LABELS: Record<InvoiceDocKind, string> = {
  invoice: 'Tax invoice',
  proforma: 'Proforma invoice',
  receipt: 'Receipt',
  reminder: 'Payment reminder',
};

/** Placeholder shown in the preview until a real client is selected. */
const SAMPLE_CLIENT: Client = {
  id: '',
  name: 'Sample Client Ltd',
  contactName: 'Jane Doe',
  email: 'client@example.com',
  phone: '',
  addressLine1: '10 Sample Street',
  addressLine2: '',
  city: 'London',
  postcode: 'EC1A 1BB',
  country: 'United Kingdom',
  vatNumber: '',
  notes: '',
  createdAt: '',
  updatedAt: '',
};

export default function DocumentStudio({ session, onClose }: Props) {
  const company = useAppStore((s) => s.company);
  const clients = useAppStore((s) => s.clients);
  const payments = useAppStore((s) => s.payments);
  const saveInvoice = useAppStore((s) => s.saveInvoice);
  const saveOffer = useAppStore((s) => s.saveOffer);
  const setToast = useAppStore((s) => s.setToast);
  const logoUrl = useLogoUrl(company.logoPath);

  const [busy, setBusy] = useState(false);
  const [savedPath, setSavedPath] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [invoiceDraft, setInvoiceDraft] = useState<Invoice | null>(
    session.kind === 'invoice' ? { ...session.invoice, items: session.invoice.items.map((i) => ({ ...i })) } : null
  );
  const [offerDraft, setOfferDraft] = useState<Offer | null>(
    session.kind === 'offer' ? { ...session.offer, items: session.offer.items.map((i) => ({ ...i })) } : null
  );
  const [docKind, setDocKind] = useState<InvoiceDocKind>(
    session.kind === 'invoice' ? session.docKind : 'invoice'
  );
  const [offerStyle, setOfferStyle] = useState<OfferDocStyle>(
    session.kind === 'offer' ? session.style : 'pricing'
  );

  const client: Client | undefined = useMemo(() => {
    const id = invoiceDraft?.clientId || offerDraft?.clientId;
    return clients.find((c) => c.id === id);
  }, [clients, invoiceDraft?.clientId, offerDraft?.clientId]);

  const vatRate = resolveVatRate(company.country, client?.country, company.defaultVatRate);
  const vatHint =
    client && !isSameCountry(company.country, client.country)
      ? `Client is in ${client.country || 'another country'} (company: ${company.country || '—'}). VAT defaults to 0%.`
      : null;

  const selectInvoiceClient = (clientId: string) => {
    if (!invoiceDraft) return;
    const next = clients.find((c) => c.id === clientId);
    const rate = resolveVatRate(company.country, next?.country, company.defaultVatRate);
    setInvoiceDraft({
      ...invoiceDraft,
      clientId,
      items: applyVatRateToItems(invoiceDraft.items, rate),
    });
  };

  const selectOfferClient = (clientId: string) => {
    if (!offerDraft) return;
    const next = clients.find((c) => c.id === clientId);
    const rate = resolveVatRate(company.country, next?.country, company.defaultVatRate);
    setOfferDraft({
      ...offerDraft,
      clientId,
      items: applyVatRateToItems(offerDraft.items, rate),
    });
  };

  const title =
    session.kind === 'invoice'
      ? INVOICE_KIND_LABELS[docKind]
      : offerStyle === 'pricing'
        ? 'Pricing offer'
        : 'Quotation';

  // Friendly message used as email subject/body and WhatsApp/share-sheet text.
  const shareMessage = useMemo(() => {
    const draft = session.kind === 'invoice' ? invoiceDraft : offerDraft;
    const number = draft?.number ?? '';
    const total = formatGbp(calcTotals(draft?.items ?? []).total);
    const companyName = company.name || 'MyFinance';
    const greeting = `Hi${client ? ` ${client.contactName || client.name}` : ''},`;

    let intro: string;
    if (session.kind === 'invoice') {
      const due = invoiceDraft?.dueDate ? formatDateUk(invoiceDraft.dueDate) : '';
      if (docKind === 'receipt') {
        intro = `Please find attached receipt ${number} for ${total}. Thank you for your payment!`;
      } else if (docKind === 'reminder') {
        intro = `This is a friendly reminder that invoice ${number} for ${total} is still outstanding${due ? ` (due ${due})` : ''}. The document is attached for your convenience.`;
      } else if (docKind === 'proforma') {
        intro = `Please find attached proforma invoice ${number} for ${total}.`;
      } else {
        intro = `Please find attached invoice ${number} for ${total}${due ? `, due by ${due}` : ''}. Thank you for your business!`;
      }
    } else {
      const label = offerStyle === 'pricing' ? 'pricing offer' : 'quotation';
      const valid = offerDraft?.validUntil ? formatDateUk(offerDraft.validUntil) : '';
      intro = `Please find attached our ${label} ${number} for ${total}${valid ? `, valid until ${valid}` : ''}. We'd love to work with you!`;
    }

    return {
      subject: `${title} ${number} from ${companyName}`,
      body: `${greeting}\n\n${intro}\n\nBest regards,\n${companyName}`,
    };
  }, [session.kind, invoiceDraft, offerDraft, docKind, offerStyle, client, company.name, title]);

  const saveDraft = async () => {
    if (!client) {
      setToast('Select a client first');
      return;
    }
    const stamp = new Date().toISOString();
    if (session.kind === 'invoice' && invoiceDraft) {
      await saveInvoice({ ...invoiceDraft, updatedAt: stamp });
      setToast('Invoice saved');
    } else if (session.kind === 'offer' && offerDraft) {
      await saveOffer({ ...offerDraft, updatedAt: stamp });
      setToast('Offer saved');
    }
    onClose();
  };

  const generate = async () => {
    if (!client) {
      setToast('Select a client first');
      return;
    }
    setBusy(true);
    try {
      if (session.kind === 'invoice' && invoiceDraft) {
        const saved = {
          ...invoiceDraft,
          updatedAt: new Date().toISOString(),
        };
        await saveInvoice(saved);
        const path = await getMyFinanceApi().generateInvoicePdf(saved.id, docKind);
        setSavedPath(path);
        setToast(`${INVOICE_KIND_LABELS[docKind]} saved`);
      } else if (session.kind === 'offer' && offerDraft) {
        const saved = {
          ...offerDraft,
          updatedAt: new Date().toISOString(),
        };
        await saveOffer(saved);
        const path = await getMyFinanceApi().generateOfferPdf(saved.id, offerStyle);
        setSavedPath(path);
        setToast(offerStyle === 'pricing' ? 'Pricing offer PDF saved' : 'Quotation PDF saved');
      }
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'PDF failed');
    } finally {
      setBusy(false);
    }
  };

  const shareApple = async () => {
    if (!savedPath) return;
    try {
      const file = await getMyFinanceApi().readFileForShare(savedPath);
      const blob = new Blob([new Uint8Array(file.data)], { type: file.mime });
      const shareFile = new File([blob], file.name, { type: file.mime });
      if (navigator.canShare?.({ files: [shareFile] })) {
        await navigator.share({
          files: [shareFile],
          title: shareMessage.subject,
          text: shareMessage.body,
        });
        setToast('Shared');
        return;
      }
      const ok = await getMyFinanceApi().shareMac(savedPath, shareMessage.body);
      setToast(ok ? 'Share sheet opened' : 'Shown in Finder — use Share from there');
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return;
      try {
        await getMyFinanceApi().shareMac(savedPath, shareMessage.body);
        setToast('Share sheet opened');
      } catch (err) {
        setToast(err instanceof Error ? err.message : 'Share failed');
      }
    }
  };

  const shareEmail = async () => {
    if (!savedPath) return;
    try {
      const ok = await getMyFinanceApi().shareEmail(
        savedPath,
        shareMessage.subject,
        shareMessage.body
      );
      setToast(
        ok
          ? 'Email drafted with the PDF attached'
          : 'Email opened — attach the PDF from the Finder window'
      );
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Email share failed');
    }
  };

  const shareWhatsApp = async () => {
    if (!savedPath) return;
    try {
      await getMyFinanceApi().shareWhatsApp(savedPath, shareMessage.body);
      setToast('WhatsApp opened with your message — press \u2318V to attach the PDF');
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'WhatsApp share failed');
    }
  };

  return (
    <div className="modal-backdrop studio-backdrop" onClick={onClose}>
      <div className="studio-modal" onClick={(e) => e.stopPropagation()}>
        <div className="studio-header">
          <div>
            <h3>Generate {title}</h3>
            <p className="subtitle" style={{ margin: '4px 0 0' }}>
              Edit on the left — live preview on the right
            </p>
          </div>
          <div className="stack-sm">
            <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
              {savedPath ? 'Done' : 'Cancel'}
            </button>
            {!savedPath && (
              <>
                <button className="btn" onClick={saveDraft} disabled={busy || !client}>
                  Save draft
                </button>
                <button className="btn btn-primary" onClick={generate} disabled={busy || !client}>
                  {busy ? 'Generating…' : 'Generate PDF'}
                </button>
              </>
            )}
          </div>
        </div>

        {savedPath && (
          <div className="share-bar">
            <div className="share-bar-text">
              <strong>PDF saved</strong>
              <span className="share-path" title={savedPath}>
                {savedPath}
              </span>
            </div>
            <div className="stack-sm">
              <button className="btn btn-primary btn-sm" onClick={shareApple}>
                Share…
              </button>
              <button className="btn btn-sm" onClick={shareEmail}>
                Email
              </button>
              <button className="btn btn-sm" onClick={shareWhatsApp}>
                WhatsApp
              </button>
              <button
                className="btn btn-sm"
                onClick={() => getMyFinanceApi().openPdf(savedPath!)}
              >
                Open
              </button>
              <button
                className="btn btn-sm"
                onClick={() => getMyFinanceApi().revealPdf(savedPath!)}
              >
                Show in Finder
              </button>
              <button
                className="btn btn-sm btn-ghost"
                onClick={() => {
                  setSavedPath(null);
                }}
              >
                Edit again
              </button>
            </div>
          </div>
        )}

        <div className="studio-body">
          <aside className="studio-form">
            {session.kind === 'invoice' && invoiceDraft && (
              <>
                <div className="field">
                  <label>Document type</label>
                  <select
                    value={docKind}
                    onChange={(e) => setDocKind(e.target.value as InvoiceDocKind)}
                  >
                    <option value="invoice">Tax invoice</option>
                    <option value="proforma">Proforma invoice</option>
                    <option value="receipt">Receipt</option>
                    <option value="reminder">Payment reminder</option>
                  </select>
                </div>
                <div className="form-grid">
                  <div className="field">
                    <label>Invoice number</label>
                    <input
                      value={invoiceDraft.number}
                      onChange={(e) => setInvoiceDraft({ ...invoiceDraft, number: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label>Client</label>
                    <select
                      value={invoiceDraft.clientId}
                      onChange={(e) => selectInvoiceClient(e.target.value)}
                    >
                      <option value="">Select client…</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>Issue date</label>
                    <input
                      type="date"
                      value={invoiceDraft.issueDate}
                      onChange={(e) =>
                        setInvoiceDraft({ ...invoiceDraft, issueDate: e.target.value })
                      }
                    />
                  </div>
                  <div className="field">
                    <label>Due date</label>
                    <input
                      type="date"
                      value={invoiceDraft.dueDate}
                      onChange={(e) => setInvoiceDraft({ ...invoiceDraft, dueDate: e.target.value })}
                    />
                  </div>
                </div>
                <div className="field">
                  <label>Accent colour</label>
                  <div className="color-row">
                    {ACCENT_PRESETS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={`swatch${(invoiceDraft.accentColor || company.accentColor) === c ? ' active' : ''}`}
                        style={{ background: c }}
                        onClick={() => setInvoiceDraft({ ...invoiceDraft, accentColor: c })}
                      />
                    ))}
                  </div>
                </div>
                <div className="field">
                  <label>Line items</label>
                  <LineItemsEditor
                    items={invoiceDraft.items}
                    defaultVatRate={vatRate}
                    vatHint={vatHint}
                    onChange={(items) => setInvoiceDraft({ ...invoiceDraft, items })}
                  />
                </div>
                <div className="field">
                  <label>Notes</label>
                  <textarea
                    value={invoiceDraft.notes}
                    onChange={(e) => setInvoiceDraft({ ...invoiceDraft, notes: e.target.value })}
                  />
                </div>
              </>
            )}

            {session.kind === 'offer' && offerDraft && (
              <>
                <div className="field">
                  <label>Document style</label>
                  <select
                    value={offerStyle}
                    onChange={(e) => setOfferStyle(e.target.value as OfferDocStyle)}
                  >
                    <option value="pricing">Pricing offer (premium)</option>
                    <option value="quotation">Classic quotation</option>
                  </select>
                </div>
                <div className="form-grid">
                  <div className="field">
                    <label>Offer number</label>
                    <input
                      value={offerDraft.number}
                      onChange={(e) => setOfferDraft({ ...offerDraft, number: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label>Client</label>
                    <select
                      value={offerDraft.clientId}
                      onChange={(e) => selectOfferClient(e.target.value)}
                    >
                      <option value="">Select client…</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>Issue date</label>
                    <input
                      type="date"
                      value={offerDraft.issueDate}
                      onChange={(e) => setOfferDraft({ ...offerDraft, issueDate: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label>Valid until</label>
                    <input
                      type="date"
                      value={offerDraft.validUntil}
                      onChange={(e) => setOfferDraft({ ...offerDraft, validUntil: e.target.value })}
                    />
                  </div>
                </div>
                <div className="field">
                  <label>Accent colour</label>
                  <div className="color-row">
                    {ACCENT_PRESETS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={`swatch${(offerDraft.accentColor || company.accentColor) === c ? ' active' : ''}`}
                        style={{ background: c }}
                        onClick={() => setOfferDraft({ ...offerDraft, accentColor: c })}
                      />
                    ))}
                  </div>
                </div>
                <div className="field">
                  <label>Line items</label>
                  <LineItemsEditor
                    items={offerDraft.items}
                    defaultVatRate={vatRate}
                    vatHint={vatHint}
                    onChange={(items) => setOfferDraft({ ...offerDraft, items })}
                  />
                </div>
                <div className="field">
                  <label>Notes</label>
                  <textarea
                    value={offerDraft.notes}
                    onChange={(e) => setOfferDraft({ ...offerDraft, notes: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Terms</label>
                  <textarea
                    value={offerDraft.terms}
                    onChange={(e) => setOfferDraft({ ...offerDraft, terms: e.target.value })}
                  />
                </div>
              </>
            )}
          </aside>

          <section className="studio-preview">
            {!showPreview ? (
              <button
                type="button"
                className="studio-preview-placeholder"
                onClick={() => setShowPreview(true)}
              >
                <span className="studio-preview-placeholder-icon">◪</span>
                <strong>Show live preview</strong>
                <span>Click to render a preview of the {title.toLowerCase()}</span>
              </button>
            ) : (
              <>
                <div className="studio-preview-label">
                  <span>
                    Live preview
                    {!client && (
                      <span className="studio-preview-note">
                        {' '}
                        · sample client shown — select a client to personalise
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    onClick={() => setShowPreview(false)}
                  >
                    Hide
                  </button>
                </div>
                <div className="studio-preview-scroll">
                  {session.kind === 'invoice' && invoiceDraft ? (
                    <InvoiceDocumentPreview
                      invoice={invoiceDraft}
                      client={client ?? SAMPLE_CLIENT}
                      company={company}
                      kind={docKind}
                      payments={payments}
                      logoUrl={logoUrl}
                    />
                  ) : session.kind === 'offer' && offerDraft ? (
                    <OfferDocumentPreview
                      offer={offerDraft}
                      client={client ?? SAMPLE_CLIENT}
                      company={company}
                      style={offerStyle}
                      logoUrl={logoUrl}
                    />
                  ) : null}
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
