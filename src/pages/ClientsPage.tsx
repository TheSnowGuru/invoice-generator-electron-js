import { useState } from 'react';
import { useAppStore } from '../store';
import type { Client } from '../types';
import { calcTotals, formatGbp, newId, paidAmount } from '../types';

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
  const payments = useAppStore((s) => s.payments);
  const saveClient = useAppStore((s) => s.saveClient);
  const deleteClient = useAppStore((s) => s.deleteClient);
  const setToast = useAppStore((s) => s.setToast);

  const [editing, setEditing] = useState<Client | null>(null);

  const persist = async () => {
    if (!editing) return;
    if (!editing.name.trim()) {
      setToast('Client name is required');
      return;
    }
    await saveClient({ ...editing, updatedAt: new Date().toISOString() });
    setEditing(null);
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
                  const clientInvs = invoices.filter((i) => i.clientId === c.id);
                  const invoiced = clientInvs.reduce((s, i) => s + calcTotals(i.items).total, 0);
                  const paid = clientInvs.reduce((s, i) => s + paidAmount(i.id, payments), 0);
                  return (
                    <tr key={c.id}>
                      <td>{c.name}</td>
                      <td>{c.contactName || '—'}</td>
                      <td>{c.email || '—'}</td>
                      <td>{c.city}</td>
                      <td>{formatGbp(invoiced)}</td>
                      <td>{formatGbp(paid)}</td>
                      <td>
                        <div className="stack-sm">
                          <button className="btn btn-sm" onClick={() => setEditing(c)}>
                            Edit
                          </button>
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => {
                              if (confirm(`Delete ${c.name}?`)) deleteClient(c.id);
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
