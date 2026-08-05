import { useMemo, useState } from 'react';
import { useAppStore } from '../store';
import LineItemsEditor from '../components/LineItemsEditor';
import type { Offer, OfferStatus } from '../types';
import {
  addDaysIso,
  calcTotals,
  formatDateUk,
  formatGbp,
  newId,
  todayIso,
} from '../types';

function blankOffer(prefix: string, next: number, vat: number): Offer {
  const now = new Date().toISOString();
  return {
    id: newId(),
    number: `${prefix}${next}`,
    clientId: '',
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
        vatRate: vat,
      },
    ],
    notes: 'This quotation is valid until the date shown above.',
    terms: 'Prices exclude expenses unless stated. Work begins upon written acceptance.',
    createdAt: now,
    updatedAt: now,
  };
}

export default function OffersPage() {
  const offers = useAppStore((s) => s.offers);
  const clients = useAppStore((s) => s.clients);
  const company = useAppStore((s) => s.company);
  const saveOffer = useAppStore((s) => s.saveOffer);
  const deleteOffer = useAppStore((s) => s.deleteOffer);
  const saveInvoice = useAppStore((s) => s.saveInvoice);
  const setToast = useAppStore((s) => s.setToast);

  const [editing, setEditing] = useState<Offer | null>(null);

  const clientMap = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);

  const sorted = [...offers].sort((a, b) => b.issueDate.localeCompare(a.issueDate));

  const openNew = () => {
    setEditing(blankOffer(company.offerPrefix, company.nextOfferNumber, company.defaultVatRate));
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

  const generatePdf = async (id: string) => {
    try {
      const path = await window.flowstate.generateOfferPdf(id);
      setToast(`Offer PDF saved`);
      await window.flowstate.openPdf(path);
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'PDF failed');
    }
  };

  const convertToInvoice = async (offer: Offer) => {
    const now = new Date().toISOString();
    await saveInvoice({
      id: newId(),
      number: `${company.invoicePrefix}${company.nextInvoiceNumber}`,
      clientId: offer.clientId,
      status: 'draft',
      issueDate: todayIso(),
      dueDate: addDaysIso(30),
      currency: 'GBP',
      items: offer.items.map((i) => ({ ...i, id: newId() })),
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
          <div className="empty">No offers yet — create a polished quotation PDF</div>
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
                        <div className="stack-sm">
                          <button className="btn btn-sm" onClick={() => setEditing(offer)}>
                            Edit
                          </button>
                          <button className="btn btn-sm" onClick={() => generatePdf(offer.id)}>
                            PDF
                          </button>
                          <button className="btn btn-sm" onClick={() => convertToInvoice(offer)}>
                            → Invoice
                          </button>
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => {
                              if (confirm(`Delete ${offer.number}?`)) deleteOffer(offer.id);
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
                  onChange={(e) => setEditing({ ...editing, clientId: e.target.value })}
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
                  defaultVatRate={company.defaultVatRate}
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
