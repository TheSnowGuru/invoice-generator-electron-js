import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAppStore } from '../store';
import { calcTotals, formatGbp, paidAmount } from '../types';

const STATUS_COLORS: Record<string, string> = {
  draft: '#94a3b8',
  sent: '#38bdf8',
  partial: '#fbbf24',
  paid: '#34d399',
  overdue: '#f87171',
};

export default function Dashboard() {
  const invoices = useAppStore((s) => s.invoices);
  const payments = useAppStore((s) => s.payments);
  const clients = useAppStore((s) => s.clients);
  const offers = useAppStore((s) => s.offers);
  const theme = useAppStore((s) => s.company.theme) || 'dark';
  const isLight = theme === 'light';

  const chartStyle = {
    grid: isLight ? 'rgba(15,23,42,0.1)' : 'rgba(148,163,184,0.15)',
    axis: isLight ? '#64748b' : '#94a3b8',
    tooltip: {
      background: isLight ? '#ffffff' : '#111827',
      border: isLight ? '1px solid rgba(15,23,42,0.12)' : '1px solid rgba(148,163,184,0.2)',
      borderRadius: 8,
      color: isLight ? '#0f172a' : '#e8eef7',
    },
  };

  const stats = useMemo(() => {
    let invoiced = 0;
    let vatCollected = 0;
    let vatOutstanding = 0;
    let outstanding = 0;

    for (const inv of invoices) {
      const { total, vat } = calcTotals(inv.items);
      const paid = paidAmount(inv.id, payments);
      invoiced += total;
      if (inv.status === 'paid') vatCollected += vat;
      else if (inv.status !== 'draft') {
        vatOutstanding += vat;
        outstanding += Math.max(0, total - paid);
      }
    }

    return {
      invoiced,
      vatCollected,
      vatOutstanding,
      outstanding,
      clients: clients.length,
      openOffers: offers.filter((o) => o.status === 'sent' || o.status === 'draft').length,
    };
  }, [invoices, payments, clients, offers]);

  const monthly = useMemo(() => {
    const map = new Map<string, number>();
    for (const inv of invoices) {
      if (inv.status === 'draft') continue;
      const key = inv.issueDate.slice(0, 7);
      const { total } = calcTotals(inv.items);
      map.set(key, (map.get(key) ?? 0) + total);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, amount]) => ({
        month: month.slice(5) + '/' + month.slice(2, 4),
        amount,
      }));
  }, [invoices]);

  const byStatus = useMemo(() => {
    const map = new Map<string, number>();
    for (const inv of invoices) {
      const { total } = calcTotals(inv.items);
      map.set(inv.status, (map.get(inv.status) ?? 0) + total);
    }
    return [...map.entries()].map(([name, value]) => ({ name, value }));
  }, [invoices]);

  const leaderboard = useMemo(() => {
    return clients
      .map((c) => {
        const revenue = invoices
          .filter((i) => i.clientId === c.id)
          .reduce((s, inv) => s + paidAmount(inv.id, payments), 0);
        return { name: c.name, revenue };
      })
      .filter((r) => r.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [clients, invoices, payments]);

  return (
    <div>
      <div className="grid-kpi">
        <div className="kpi">
          <div className="label">Total Invoiced</div>
          <div className="value">{formatGbp(stats.invoiced)}</div>
          <div className="hint">{invoices.length} invoices</div>
        </div>
        <div className="kpi">
          <div className="label">VAT Collected</div>
          <div className="value">{formatGbp(stats.vatCollected)}</div>
          <div className="hint">From paid invoices</div>
        </div>
        <div className="kpi">
          <div className="label">VAT Outstanding</div>
          <div className="value">{formatGbp(stats.vatOutstanding)}</div>
          <div className="hint">On open invoices</div>
        </div>
        <div className="kpi">
          <div className="label">Amount Due</div>
          <div className="value">{formatGbp(stats.outstanding)}</div>
          <div className="hint">
            {stats.clients} clients · {stats.openOffers} open offers
          </div>
        </div>
      </div>

      <div className="charts">
        <div className="panel">
          <div className="panel-header">
            <h3>Monthly invoicing</h3>
          </div>
          {monthly.length === 0 ? (
            <div className="empty">No invoice data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartStyle.grid} />
                <XAxis dataKey="month" stroke={chartStyle.axis} fontSize={12} />
                <YAxis stroke={chartStyle.axis} fontSize={12} tickFormatter={(v) => `£${v}`} />
                <Tooltip
                  formatter={(v: number) => formatGbp(v)}
                  contentStyle={chartStyle.tooltip}
                />
                <Bar dataKey="amount" fill="var(--accent)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="panel">
          <div className="panel-header">
            <h3>Revenue by status</h3>
          </div>
          {byStatus.length === 0 ? (
            <div className="empty">No invoice data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={byStatus} dataKey="value" nameKey="name" outerRadius={90} label>
                  {byStatus.map((entry) => (
                    <Cell key={entry.name} fill={STATUS_COLORS[entry.name] ?? '#64748b'} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: number) => formatGbp(v)}
                  contentStyle={chartStyle.tooltip}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <div className="panel-header">
          <h3>Client leaderboard</h3>
        </div>
        {leaderboard.length === 0 ? (
          <div className="empty">Record payments to see top clients</div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Client</th>
                  <th>Revenue paid</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((row, i) => (
                  <tr key={row.name}>
                    <td>{i + 1}</td>
                    <td>{row.name}</td>
                    <td>{formatGbp(row.revenue)}</td>
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
