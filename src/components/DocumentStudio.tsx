import { useMemo, useState } from 'react';
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
        const path = await window.flowstate.generateInvoicePdf(saved.id, docKind);
        setSavedPath(path);
        setToast(`${INVOICE_KIND_LABELS[docKind]} saved`);
      } else if (session.kind === 'offer' && offerDraft) {
        const saved = {
          ...offerDraft,
          updatedAt: new Date().toISOString(),
        };
        await saveOffer(saved);
        const path = await window.flowstate.generateOfferPdf(saved.id, offerStyle);
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
      const file = await window.flowstate.readFileForShare(savedPath);
      const blob = new Blob([file.data], { type: file.mime });
      const shareFile = new File([blob], file.name, { type: file.mime });
      if (navigator.canShare?.({ files: [shareFile] })) {
        await navigator.share({
          files: [shareFile],
          title: file.name,
          text: `Sharing ${file.name}`,
        });
        setToast('Shared');
        return;
      }
      const ok = await window.flowstate.shareMac(savedPath);
      setToast(ok ? 'Share sheet opened' : 'Shown in Finder — use Share from there');
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return;
      try {
        await window.flowstate.shareMac(savedPath);
        setToast('Share sheet opened');
      } catch (err) {
        setToast(err instanceof Error ? err.message : 'Share failed');
      }
    }
  };

  const shareWhatsApp = async () => {
    if (!savedPath) return;
    try {
      await window.flowstate.shareWhatsApp(savedPath);
      setToast('Opened in WhatsApp');
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
              <button className="btn btn-primary" onClick={generate} disabled={busy || !client}>
                {busy ? 'Generating…' : 'Generate PDF'}
              </button>
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
              <button className="btn btn-sm" onClick={shareWhatsApp}>
                WhatsApp
              </button>
              <button
                className="btn btn-sm"
                onClick={() => window.flowstate.openPdf(savedPath)}
              >
                Open
              </button>
              <button
                className="btn btn-sm"
                onClick={() => window.flowstate.revealPdf(savedPath)}
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
            <div className="studio-preview-label">Live preview</div>
            <div className="studio-preview-scroll">
              {!client ? (
                <div className="empty">Select a client to preview the document</div>
              ) : session.kind === 'invoice' && invoiceDraft ? (
                <InvoiceDocumentPreview
                  invoice={invoiceDraft}
                  client={client}
                  company={company}
                  kind={docKind}
                  payments={payments}
                  logoUrl={logoUrl}
                />
              ) : session.kind === 'offer' && offerDraft ? (
                <OfferDocumentPreview
                  offer={offerDraft}
                  client={client}
                  company={company}
                  style={offerStyle}
                  logoUrl={logoUrl}
                />
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
