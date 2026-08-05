import { useAppStore } from '../store';

export default function ReportsPage() {
  const setToast = useAppStore((s) => s.setToast);
  const invoices = useAppStore((s) => s.invoices);
  const payments = useAppStore((s) => s.payments);
  const clients = useAppStore((s) => s.clients);

  const exportCsv = async (kind: 'invoices' | 'payments' | 'clients') => {
    try {
      const path = await window.flowstate.exportCsv(kind);
      if (path) setToast(`Exported to ${path}`);
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Export failed');
    }
  };

  return (
    <div>
      <div className="grid-kpi" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
        <div className="kpi">
          <div className="label">Invoices</div>
          <div className="value">{invoices.length}</div>
          <div className="hint">Ready for CSV export</div>
        </div>
        <div className="kpi">
          <div className="label">Payments</div>
          <div className="value">{payments.length}</div>
          <div className="hint">Cashflow records</div>
        </div>
        <div className="kpi">
          <div className="label">Clients</div>
          <div className="value">{clients.length}</div>
          <div className="hint">CRM snapshot</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h3>CSV exports</h3>
        </div>
        <p style={{ color: 'var(--text-muted)', marginTop: 0, fontSize: 14 }}>
          Export bookkeeping-friendly CSVs for spreadsheets, accountants, or HMRC prep. Files use
          en-GB date formatting and GBP amounts.
        </p>
        <div className="stack-sm" style={{ marginTop: 16 }}>
          <button className="btn btn-primary" onClick={() => exportCsv('invoices')}>
            Export invoices CSV
          </button>
          <button className="btn" onClick={() => exportCsv('payments')}>
            Export payments CSV
          </button>
          <button className="btn" onClick={() => exportCsv('clients')}>
            Export clients CSV
          </button>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h3>Where files live</h3>
        </div>
        <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--text-muted)', lineHeight: 1.7 }}>
          <li>
            <strong style={{ color: 'var(--text)' }}>JSON database:</strong> app userData folder
            (<code>myfinance-data.json</code>)
          </li>
          <li>
            <strong style={{ color: 'var(--text)' }}>Invoice PDFs:</strong> configured invoices
            folder (Settings), then <code>Client Name / INV-….pdf</code>
          </li>
          <li>
            <strong style={{ color: 'var(--text)' }}>Offer PDFs:</strong> sibling{' '}
            <code>offers / Client Name /</code> folder next to invoices
          </li>
          <li>
            <strong style={{ color: 'var(--text)' }}>CSV exports:</strong> you choose the save
            location each time
          </li>
        </ul>
      </div>
    </div>
  );
}
