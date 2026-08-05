import { useMemo, useState } from 'react';
import { useAppStore } from '../store';
import LineItemsEditor from '../components/LineItemsEditor';
import ActionMenu from '../components/ActionMenu';
import DocumentStudio, { type StudioSession } from '../components/DocumentStudio';
import type { InvoiceDocKind } from '../components/DocumentPreview';
import type { Invoice, InvoiceStatus, Payment } from '../types';
import {
  applyVatRateToItems,
  calcTotals,
  formatDateUk,
  formatGbp,
  isSameCountry,
  newId,
  paidAmount,
  resolveVatRate,
  todayIso,
} from '../types';
import { newInvoiceDraft } from '../lib/documents';

export default function InvoicesPage() {
  const invoices = useAppStore((s) => s.invoices);
  const clients = useAppStore((s) => s.clients);
  const payments = useAppStore((s) => s.payments);
  const company = useAppStore((s) => s.company);
  const saveInvoice = useAppStore((s) => s.saveInvoice);
  const deleteInvoice = useAppStore((s) => s.deleteInvoice);
  const savePayment = useAppStore((s) => s.savePayment);
  const setToast = useAppStore((s) => s.setToast);

  const [editing, setEditing] = useState<Invoice | null>(null);
  const [paying, setPaying] = useState<Invoice | null>(null);
  const [studio, setStudio] = useState<StudioSession | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: 0,
    date: todayIso(),
    method: 'Bank transfer',
    reference: '',
    notes: '',
  });
  const [filter, setFilter] = useState<'all' | InvoiceStatus>('all');

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

  const selectInvoiceClient = (clientId: string) => {
    if (!editing) return;
    const client = clientMap.get(clientId);
    const vatRate = resolveVatRate(company.country, client?.country, company.defaultVatRate);
    setEditing({
      ...editing,
      clientId,
      items: applyVatRateToItems(editing.items, vatRate),
    });
  };

  const filtered = invoices
    .filter((i) => (filter === 'all' ? true : i.status === filter))
    .sort((a, b) => b.issueDate.localeCompare(a.issueDate));

  const openNew = () => {
    setStudio({ kind: 'invoice', invoice: newInvoiceDraft(company), docKind: 'invoice' });
  };

  const persist = async () => {
    if (!editing) return;
    if (!editing.clientId) {
      setToast('Select a client');
      return;
    }
    if (!editing.items.length || editing.items.every((i) => !i.description)) {
      setToast('Add at least one line item');
      return;
    }
    await saveInvoice({ ...editing, updatedAt: new Date().toISOString() });
    setEditing(null);
  };

  const openStudio = (invoice: Invoice, docKind: InvoiceDocKind) => {
    setStudio({ kind: 'invoice', invoice, docKind });
  };

  const openPay = (inv: Invoice) => {
    const { total } = calcTotals(inv.items);
    const paid = paidAmount(inv.id, payments);
    setPaying(inv);
    setPaymentForm({
      amount: Math.max(0, total - paid),
      date: todayIso(),
      method: 'Bank transfer',
      reference: inv.number,
      notes: '',
    });
  };

  const recordPayment = async () => {
    if (!paying || paymentForm.amount <= 0) return;
    const payment: Payment = {
      id: newId(),
      invoiceId: paying.id,
      amount: paymentForm.amount,
      date: paymentForm.date,
      method: paymentForm.method,
      reference: paymentForm.reference,
      notes: paymentForm.notes,
      createdAt: new Date().toISOString(),
    };
    if (paying.status === 'draft') {
      await saveInvoice({ ...paying, status: 'sent', updatedAt: new Date().toISOString() });
    }
    await savePayment(payment);
    setPaying(null);
  };

  return (
    <div>
      <div className="panel">
        <div className="panel-header">
          <div className="stack-sm">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as typeof filter)}
              style={{
                background: 'var(--bg)',
                border: '1.5px solid var(--input-border, var(--border-strong))',
                borderRadius: 8,
                padding: '6px 10px',
              }}
            >
              <option value="all">All statuses</option>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="partial">Partial</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
          <button className="btn btn-primary" onClick={openNew}>
            New invoice
          </button>
        </div>

        {filtered.length === 0 ? (
          <div className="empty">No invoices yet — create your first one</div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Client</th>
                  <th>Issue</th>
                  <th>Due</th>
                  <th>Total</th>
                  <th>Paid</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv) => {
                  const { total } = calcTotals(inv.items);
                  const paid = paidAmount(inv.id, payments);
                  return (
                    <tr key={inv.id}>
                      <td>{inv.number}</td>
                      <td>{clientMap.get(inv.clientId)?.name ?? '—'}</td>
                      <td>{formatDateUk(inv.issueDate)}</td>
                      <td>{formatDateUk(inv.dueDate)}</td>
                      <td>{formatGbp(total)}</td>
                      <td>{formatGbp(paid)}</td>
                      <td>
                        <span className={`badge badge-${inv.status}`}>{inv.status}</span>
                      </td>
                      <td>
                        <ActionMenu
                          items={[
                            {
                              id: 'edit',
                              label: 'Edit invoice',
                              onClick: () => setEditing(inv),
                            },
                            {
                              id: 'tax',
                              label: 'Generate tax invoice',
                              hint: 'VAT tax invoice PDF',
                              separatorBefore: true,
                              onClick: () => openStudio(inv, 'invoice'),
                            },
                            {
                              id: 'proforma',
                              label: 'Generate proforma',
                              hint: 'Not a tax invoice',
                              onClick: () => openStudio(inv, 'proforma'),
                            },
                            {
                              id: 'receipt',
                              label: 'Generate receipt',
                              hint: 'Payment acknowledgement',
                              onClick: () => openStudio(inv, 'receipt'),
                            },
                            {
                              id: 'reminder',
                              label: 'Generate payment reminder',
                              hint: 'Outstanding balance notice',
                              onClick: () => openStudio(inv, 'reminder'),
                            },
                            {
                              id: 'pay',
                              label: 'Record payment',
                              separatorBefore: true,
                              onClick: () => openPay(inv),
                            },
                            {
                              id: 'delete',
                              label: 'Delete',
                              danger: true,
                              separatorBefore: true,
                              onClick: () => {
                                if (confirm(`Delete ${inv.number}?`)) deleteInvoice(inv.id);
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
                  Invoice details
                </p>
              </div>
              <button className="btn btn-ghost" onClick={() => setEditing(null)}>
                Close
              </button>
            </div>

            <div className="form-grid">
              <div className="field">
                <label>Invoice number</label>
                <input
                  value={editing.number}
                  onChange={(e) => setEditing({ ...editing, number: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Client</label>
                <select
                  value={editing.clientId}
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
                <label>Status</label>
                <select
                  value={editing.status}
                  onChange={(e) =>
                    setEditing({ ...editing, status: e.target.value as InvoiceStatus })
                  }
                >
                  <option value="draft">Draft</option>
                  <option value="sent">Sent</option>
                  <option value="partial">Partially paid</option>
                  <option value="paid">Paid</option>
                  <option value="overdue">Overdue</option>
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
                <label>Due date</label>
                <input
                  type="date"
                  value={editing.dueDate}
                  onChange={(e) => setEditing({ ...editing, dueDate: e.target.value })}
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
                Save invoice
              </button>
            </div>
          </div>
        </div>
      )}

      {paying && (
        <div className="modal-backdrop" onClick={() => setPaying(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 480 }}>
            <div className="modal-header">
              <h3>Record payment — {paying.number}</h3>
              <button className="btn btn-ghost" onClick={() => setPaying(null)}>
                Close
              </button>
            </div>
            <div className="form-grid">
              <div className="field">
                <label>Amount (£)</label>
                <input
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={paymentForm.amount}
                  onChange={(e) =>
                    setPaymentForm({ ...paymentForm, amount: Number(e.target.value) })
                  }
                />
              </div>
              <div className="field">
                <label>Date</label>
                <input
                  type="date"
                  value={paymentForm.date}
                  onChange={(e) => setPaymentForm({ ...paymentForm, date: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Method</label>
                <select
                  value={paymentForm.method}
                  onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value })}
                >
                  <option>Bank transfer</option>
                  <option>Card</option>
                  <option>Cash</option>
                  <option>Cheque</option>
                  <option>Other</option>
                </select>
              </div>
              <div className="field">
                <label>Reference</label>
                <input
                  value={paymentForm.reference}
                  onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
                />
              </div>
              <div className="field full">
                <label>Notes</label>
                <textarea
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setPaying(null)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={recordPayment}>
                Save payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
