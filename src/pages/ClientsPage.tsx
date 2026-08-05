import { useMemo, useState } from 'react';
import { useAppStore } from '../store';
import ActionMenu from '../components/ActionMenu';
import DocumentStudio, { type StudioSession } from '../components/DocumentStudio';
import type { Client, Invoice, Offer } from '../types';
import { calcTotals, formatDateUk, formatGbp, newId, paidAmount } from '../types';
import { newInvoiceDraft, newOfferDraft } from '../lib/documents';

function blankClient(): Client {
  const now = new Date().toISOString();
  return {
    id: newId(),
    name: '',
    contactName: '',
    email: '',
    phone: '',
    addressLine1: '',
    addressLine2: '',
    city: 'London',
    postcode: '',
    country: 'United Kingdom',
    vatNumber: '',
    notes: '',
    createdAt: now,
    updatedAt: now,
  };
}

export default function ClientsPage() {
  const clients = useAppStore((s) => s.clients);
  const invoices = useAppStore((s) => s.invoices);
  const offers = useAppStore((s) => s.offers);
  const payments = useAppStore((s) => s.payments);
  const company = useAppStore((s) => s.company);
  const saveClient = useAppStore((s) => s.saveClient);
  const deleteClient = useAppStore((s) => s.deleteClient);
  const setToast = useAppStore((s) => s.setToast);

  const [editing, setEditing] = useState<Client | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [studio, setStudio] = useState<StudioSession | null>(null);

  const viewing = useMemo(
    () => clients.find((c) => c.id === viewingId) ?? null,
    [clients, viewingId]
  );

  // Single pass over invoices/payments instead of re-filtering per client row.
  const totalsByClient = useMemo(() => {
    const paidByInvoice = new Map<string, number>();
    for (const p of payments) {
      paidByInvoice.set(p.invoiceId, (paidByInvoice.get(p.invoiceId) ?? 0) + p.amount);
    }
    const map = new Map<string, { invoiced: number; paid: number }>();
    for (const inv of invoices) {
      const entry = map.get(inv.clientId) ?? { invoiced: 0, paid: 0 };
      entry.invoiced += calcTotals(inv.items).total;
      entry.paid += paidByInvoice.get(inv.id) ?? 0;
      map.set(inv.clientId, entry);
    }
    return map;
  }, [invoices, payments]);

  const startInvoice = (client: Client) => {
    setStudio({ kind: 'invoice', invoice: newInvoiceDraft(company, client), docKind: 'invoice' });
  };

  const startOffer = (client: Client) => {
    setStudio({ kind: 'offer', offer: newOfferDraft(company, client), style: 'pricing' });
  };

  const persist = async () => {
    if (!editing) return;
    if (!editing.name.trim()) {
      setToast('Client name is required');
      return;
    }
    await saveClient({ ...editing, updatedAt: new Date().toISOString() });
    setEditing(null);
  };

  const removeClient = (client: Client) => {
    if (confirm(`Delete ${client.name}?`)) {
      deleteClient(client.id);
      if (viewingId === client.id) setViewingId(null);
    }
  };

  return (
    <div>
      <div className="panel">
        <div className="panel-header">
          <h3>{clients.length} clients</h3>
          <button className="btn btn-primary" onClick={() => setEditing(blankClient())}>
            New client
          </button>
        </div>

        {clients.length === 0 ? (
          <div className="empty">Add a client to start invoicing</div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Contact</th>
                  <th>Email</th>
                  <th>City</th>
                  <th>Invoiced</th>
                  <th>Paid</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => {
                  const { invoiced, paid } = totalsByClient.get(c.id) ?? { invoiced: 0, paid: 0 };
                  return (
                    <tr key={c.id}>
                      <td>
                        <button className="link-btn" onClick={() => setViewingId(c.id)}>
                          {c.name}
                        </button>
                      </td>
                      <td>{c.contactName || '—'}</td>
                      <td>{c.email || '—'}</td>
                      <td>{c.city}</td>
                      <td>{formatGbp(invoiced)}</td>
                      <td>{formatGbp(paid)}</td>
                      <td>
                        <ActionMenu
                          items={[
                            {
                              id: 'view',
                              label: 'View client',
                              hint: 'All info, invoices & offers',
                              onClick: () => setViewingId(c.id),
                            },
                            {
                              id: 'new-invoice',
                              label: 'New invoice',
                              hint: 'Pre-filled for this client',
                              separatorBefore: true,
                              onClick: () => startInvoice(c),
                            },
                            {
                              id: 'new-offer',
                              label: 'New pricing offer',
                              hint: 'Pre-filled for this client',
                              onClick: () => startOffer(c),
                            },
                            {
                              id: 'edit',
                              label: 'Edit client',
                              separatorBefore: true,
                              onClick: () => setEditing(c),
                            },
                            {
                              id: 'delete',
                              label: 'Delete',
                              danger: true,
                              separatorBefore: true,
                              onClick: () => removeClient(c),
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

      {viewing && (
        <ClientDetail
          client={viewing}
          invoices={invoices}
          offers={offers}
          onClose={() => setViewingId(null)}
          onEdit={() => setEditing(viewing)}
          onNewInvoice={() => startInvoice(viewing)}
          onNewOffer={() => startOffer(viewing)}
        />
      )}

      {editing && (
        <div className="modal-backdrop" onClick={() => setEditing(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editing.name || 'New client'}</h3>
              <button className="btn btn-ghost" onClick={() => setEditing(null)}>
                Close
              </button>
            </div>
            <div className="form-grid">
              <div className="field">
                <label>Company / name</label>
                <input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Contact name</label>
                <input
                  value={editing.contactName}
                  onChange={(e) => setEditing({ ...editing, contactName: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Email</label>
                <input
                  type="email"
                  value={editing.email}
                  onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Phone</label>
                <input
                  value={editing.phone}
                  onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Address line 1</label>
                <input
                  value={editing.addressLine1}
                  onChange={(e) => setEditing({ ...editing, addressLine1: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Address line 2</label>
                <input
                  value={editing.addressLine2}
                  onChange={(e) => setEditing({ ...editing, addressLine2: e.target.value })}
                />
              </div>
              <div className="field">
                <label>City</label>
                <input
                  value={editing.city}
                  onChange={(e) => setEditing({ ...editing, city: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Postcode</label>
                <input
                  value={editing.postcode}
                  onChange={(e) => setEditing({ ...editing, postcode: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Country</label>
                <input
                  value={editing.country}
                  onChange={(e) => setEditing({ ...editing, country: e.target.value })}
                />
              </div>
              <div className="field">
                <label>VAT number</label>
                <input
                  value={editing.vatNumber}
                  onChange={(e) => setEditing({ ...editing, vatNumber: e.target.value })}
                />
              </div>
              <div className="field full">
                <label>Notes</label>
                <textarea
                  value={editing.notes}
                  onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={persist}>
                Save client
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface ClientDetailProps {
  client: Client;
  invoices: Invoice[];
  offers: Offer[];
  onClose: () => void;
  onEdit: () => void;
  onNewInvoice: () => void;
  onNewOffer: () => void;
}

function ClientDetail({
  client,
  invoices,
  offers,
  onClose,
  onEdit,
  onNewInvoice,
  onNewOffer,
}: ClientDetailProps) {
  const payments = useAppStore((s) => s.payments);

  const clientInvoices = invoices
    .filter((i) => i.clientId === client.id)
    .sort((a, b) => b.issueDate.localeCompare(a.issueDate));
  const clientOffers = offers
    .filter((o) => o.clientId === client.id)
    .sort((a, b) => b.issueDate.localeCompare(a.issueDate));

  const invoiced = clientInvoices.reduce((s, i) => s + calcTotals(i.items).total, 0);
  const paid = clientInvoices.reduce((s, i) => s + paidAmount(i.id, payments), 0);
  const outstanding = Math.max(0, invoiced - paid);

  const address = [
    client.addressLine1,
    client.addressLine2,
    [client.city, client.postcode].filter(Boolean).join(' '),
    client.country,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal wide client-detail" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>{client.name}</h3>
            <p className="subtitle" style={{ margin: '4px 0 0' }}>
              Client since {formatDateUk(client.createdAt.slice(0, 10))}
            </p>
          </div>
          <div className="stack-sm">
            <button className="btn btn-sm" onClick={onNewInvoice}>
              New invoice
            </button>
            <button className="btn btn-sm" onClick={onNewOffer}>
              New offer
            </button>
            <button className="btn btn-sm" onClick={onEdit}>
              Edit
            </button>
            <button className="btn btn-ghost" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        <div className="client-kpis">
          <div className="client-kpi">
            <span className="client-kpi-label">Invoiced</span>
            <span className="client-kpi-value">{formatGbp(invoiced)}</span>
          </div>
          <div className="client-kpi">
            <span className="client-kpi-label">Paid</span>
            <span className="client-kpi-value">{formatGbp(paid)}</span>
          </div>
          <div className="client-kpi">
            <span className="client-kpi-label">Outstanding</span>
            <span className="client-kpi-value">{formatGbp(outstanding)}</span>
          </div>
          <div className="client-kpi">
            <span className="client-kpi-label">Documents</span>
            <span className="client-kpi-value">
              {clientInvoices.length + clientOffers.length}
            </span>
          </div>
        </div>

        <div className="client-info-grid">
          <div className="client-info-item">
            <span className="client-info-label">Contact</span>
            <span>{client.contactName || '—'}</span>
          </div>
          <div className="client-info-item">
            <span className="client-info-label">Email</span>
            <span>{client.email || '—'}</span>
          </div>
          <div className="client-info-item">
            <span className="client-info-label">Phone</span>
            <span>{client.phone || '—'}</span>
          </div>
          <div className="client-info-item">
            <span className="client-info-label">VAT number</span>
            <span>{client.vatNumber || '—'}</span>
          </div>
          <div className="client-info-item full">
            <span className="client-info-label">Address</span>
            <span>{address || '—'}</span>
          </div>
          {client.notes && (
            <div className="client-info-item full">
              <span className="client-info-label">Notes</span>
              <span>{client.notes}</span>
            </div>
          )}
        </div>

        <h4 className="client-section-title">Invoices ({clientInvoices.length})</h4>
        {clientInvoices.length === 0 ? (
          <div className="empty">No invoices for this client yet</div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Issue</th>
                  <th>Due</th>
                  <th>Total</th>
                  <th>Paid</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {clientInvoices.map((inv) => (
                  <tr key={inv.id}>
                    <td>{inv.number}</td>
                    <td>{formatDateUk(inv.issueDate)}</td>
                    <td>{formatDateUk(inv.dueDate)}</td>
                    <td>{formatGbp(calcTotals(inv.items).total)}</td>
                    <td>{formatGbp(paidAmount(inv.id, payments))}</td>
                    <td>
                      <span className={`badge badge-${inv.status}`}>{inv.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <h4 className="client-section-title">Offers ({clientOffers.length})</h4>
        {clientOffers.length === 0 ? (
          <div className="empty">No offers for this client yet</div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Issue</th>
                  <th>Valid until</th>
                  <th>Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {clientOffers.map((o) => (
                  <tr key={o.id}>
                    <td>{o.number}</td>
                    <td>{formatDateUk(o.issueDate)}</td>
                    <td>{formatDateUk(o.validUntil)}</td>
                    <td>{formatGbp(calcTotals(o.items).total)}</td>
                    <td>
                      <span className={`badge badge-${o.status}`}>{o.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
