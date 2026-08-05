import { useMemo, useState } from 'react';
import { useAppStore } from '../store';
import LineItemsEditor from '../components/LineItemsEditor';
import ActionMenu from '../components/ActionMenu';
import DocumentStudio, { type StudioSession } from '../components/DocumentStudio';
import type { OfferDocStyle } from '../components/DocumentPreview';
import type { Offer, OfferStatus } from '../types';
import {
  addDaysIso,
  applyVatRateToItems,
  calcTotals,
  formatDateUk,
  formatGbp,
  isSameCountry,
  newId,
  resolveVatRate,
  todayIso,
} from '../types';
import { newOfferDraft } from '../lib/documents';

export default function OffersPage() {
  const offers = useAppStore((s) => s.offers);
  const clients = useAppStore((s) => s.clients);
  const company = useAppStore((s) => s.company);
  const saveOffer = useAppStore((s) => s.saveOffer);
  const deleteOffer = useAppStore((s) => s.deleteOffer);
  const saveInvoice = useAppStore((s) => s.saveInvoice);
  const setToast = useAppStore((s) => s.setToast);

  const [editing, setEditing] = useState<Offer | null>(null);
  const [studio, setStudio] = useState<StudioSession | null>(null);

  const clientMap = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);

  const editingClient = editing ? clientMap.get(editing.clientId) : undefined;
  const editingVatRate = resolveVatRate(
    company.country,
    editingClient?.country,
    company.defaultVatRate
  );
  const editingVatHint =
    editingClient && !isSameCountry(company.country, editingClient.country)
      ? `Client is in ${editingClient.country || 'another country'} (company: ${company.country || '—'}). VAT defaults to 0%.`
      : null;

  const selectOfferClient = (clientId: string) => {
    if (!editing) return;
    const client = clientMap.get(clientId);
    const vatRate = resolveVatRate(company.country, client?.country, company.defaultVatRate);
    setEditing({
      ...editing,
      clientId,
      items: applyVatRateToItems(editing.items, vatRate),
    });
  };

  const sorted = [...offers].sort((a, b) => b.issueDate.localeCompare(a.issueDate));

  const openNew = () => {
    setStudio({ kind: 'offer', offer: newOfferDraft(company), style: 'pricing' });
  };

  const persist = async () => {
    if (!editing) return;
    if (!editing.clientId) {
      setToast('Select a client');
      return;
    }
    await saveOffer({ ...editing, updatedAt: new Date().toISOString() });
    setEditing(null);
  };

  const openStudio = (offer: Offer, style: OfferDocStyle) => {
    setStudio({ kind: 'offer', offer, style });
  };

  const convertToInvoice = async (offer: Offer) => {
    const now = new Date().toISOString();
    const client = clientMap.get(offer.clientId);
    const vatRate = resolveVatRate(company.country, client?.country, company.defaultVatRate);
    await saveInvoice({
      id: newId(),
      number: `${company.invoicePrefix}${company.nextInvoiceNumber}`,
      clientId: offer.clientId,
      status: 'draft',
      issueDate: todayIso(),
      dueDate: addDaysIso(30),
      currency: 'GBP',
      items: offer.items.map((i) => ({ ...i, id: newId(), vatRate })),
      notes: company.defaultNotes,
      createdAt: now,
      updatedAt: now,
    });
    await saveOffer({
      ...offer,
      status: 'accepted',
      updatedAt: now,
    });
    setToast('Offer converted to draft invoice');
  };

  return (
    <div>
      <div className="panel">
        <div className="panel-header">
          <h3>Quotations & offers</h3>
          <button className="btn btn-primary" onClick={openNew}>
            New offer
          </button>
        </div>

        {sorted.length === 0 ? (
          <div className="empty">No offers yet — create a polished pricing offer PDF</div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Client</th>
                  <th>Issued</th>
                  <th>Valid until</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((offer) => {
                  const { total } = calcTotals(offer.items);
                  return (
                    <tr key={offer.id}>
                      <td>{offer.number}</td>
                      <td>{clientMap.get(offer.clientId)?.name ?? '—'}</td>
                      <td>{formatDateUk(offer.issueDate)}</td>
                      <td>{formatDateUk(offer.validUntil)}</td>
                      <td>{formatGbp(total)}</td>
                      <td>
                        <span className={`badge badge-${offer.status}`}>{offer.status}</span>
                      </td>
                      <td>
                        <ActionMenu
                          items={[
                            {
                              id: 'edit',
                              label: 'Edit offer',
                              onClick: () => setEditing(offer),
                            },
                            {
                              id: 'pricing',
                              label: 'Generate pricing offer',
                              hint: 'Premium proposal PDF',
                              separatorBefore: true,
                              onClick: () => openStudio(offer, 'pricing'),
                            },
                            {
                              id: 'quotation',
                              label: 'Generate quotation',
                              hint: 'Classic quotation PDF',
                              onClick: () => openStudio(offer, 'quotation'),
                            },
                            {
                              id: 'convert',
                              label: 'Convert to invoice',
                              hint: 'Create draft tax invoice',
                              separatorBefore: true,
                              onClick: () => convertToInvoice(offer),
                            },
                            {
                              id: 'delete',
                              label: 'Delete',
                              danger: true,
                              separatorBefore: true,
                              onClick: () => {
                                if (confirm(`Delete ${offer.number}?`)) deleteOffer(offer.id);
                              },
                            },
                          ]}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {studio && <DocumentStudio session={studio} onClose={() => setStudio(null)} />}

      {editing && (
        <div className="modal-backdrop" onClick={() => setEditing(null)}>
          <div className="modal wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>{editing.number}</h3>
                <p className="subtitle" style={{ margin: '4px 0 0' }}>
                  Offer / quotation
                </p>
              </div>
              <button className="btn btn-ghost" onClick={() => setEditing(null)}>
                Close
              </button>
            </div>

            <div className="form-grid">
              <div className="field">
                <label>Offer number</label>
                <input
                  value={editing.number}
                  onChange={(e) => setEditing({ ...editing, number: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Client</label>
                <select
                  value={editing.clientId}
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
                <label>Status</label>
                <select
                  value={editing.status}
                  onChange={(e) =>
                    setEditing({ ...editing, status: e.target.value as OfferStatus })
                  }
                >
                  <option value="draft">Draft</option>
                  <option value="sent">Sent</option>
                  <option value="accepted">Accepted</option>
                  <option value="rejected">Rejected</option>
                  <option value="expired">Expired</option>
                </select>
              </div>
              <div className="field">
                <label>Issue date</label>
                <input
                  type="date"
                  value={editing.issueDate}
                  onChange={(e) => setEditing({ ...editing, issueDate: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Valid until</label>
                <input
                  type="date"
                  value={editing.validUntil}
                  onChange={(e) => setEditing({ ...editing, validUntil: e.target.value })}
                />
              </div>
              <div className="field full">
                <label>Line items</label>
                <LineItemsEditor
                  items={editing.items}
                  defaultVatRate={editingVatRate}
                  vatHint={editingVatHint}
                  onChange={(items) => setEditing({ ...editing, items })}
                />
              </div>
              <div className="field">
                <label>Notes</label>
                <textarea
                  value={editing.notes}
                  onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Terms</label>
                <textarea
                  value={editing.terms}
                  onChange={(e) => setEditing({ ...editing, terms: e.target.value })}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={persist}>
                Save offer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
