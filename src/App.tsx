import { useEffect } from 'react';
import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { useAppStore } from './store';
import Dashboard from './pages/Dashboard';
import InvoicesPage from './pages/InvoicesPage';
import OffersPage from './pages/OffersPage';
import ClientsPage from './pages/ClientsPage';
import SettingsPage from './pages/SettingsPage';
import ReportsPage from './pages/ReportsPage';

const titles: Record<string, { title: string; subtitle: string }> = {
  '/': {
    title: 'Dashboard',
    subtitle: 'UK VAT overview and revenue at a glance',
  },
  '/invoices': {
    title: 'Invoices',
    subtitle: 'Create, track, and export branded PDF invoices',
  },
  '/offers': {
    title: 'Offers',
    subtitle: 'Professional quotations and proposals',
  },
  '/clients': {
    title: 'Clients',
    subtitle: 'Contacts and billing addresses',
  },
  '/reports': {
    title: 'Reports',
    subtitle: 'CSV exports for bookkeeping and analysis',
  },
  '/settings': {
    title: 'Settings',
    subtitle: 'Company profile, branding, and bank details',
  },
};

export default function App() {
  const load = useAppStore((s) => s.load);
  const loaded = useAppStore((s) => s.loaded);
  const toast = useAppStore((s) => s.toast);
  const company = useAppStore((s) => s.company);
  const location = useLocation();

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const theme = company?.theme === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    if (company?.accentColor) {
      document.documentElement.style.setProperty('--accent', company.accentColor);
      document.documentElement.style.setProperty(
        '--accent-soft',
        `${company.accentColor}26`
      );
    }
  }, [company?.accentColor, company?.theme]);

  const meta = titles[location.pathname] ?? titles['/'];

  if (!loaded) {
    return (
      <div className="content" style={{ display: 'grid', placeItems: 'center', height: '100%' }}>
        <div>
          <div className="brand-mark" style={{ margin: '0 auto 12px' }}>
            FS
          </div>
          <p style={{ color: 'var(--text-muted)' }}>Loading FlowState Finance…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">FS</div>
          <h1>FlowState Finance</h1>
          <p>{company.name || 'Offline · UK'}</p>
        </div>
        <nav className="nav">
          <NavLink to="/" end>
            <span className="nav-icon">▣</span> Dashboard
          </NavLink>
          <NavLink to="/invoices">
            <span className="nav-icon">▤</span> Invoices
          </NavLink>
          <NavLink to="/offers">
            <span className="nav-icon">◈</span> Offers
          </NavLink>
          <NavLink to="/clients">
            <span className="nav-icon">◎</span> Clients
          </NavLink>
          <NavLink to="/reports">
            <span className="nav-icon">▥</span> Reports
          </NavLink>
          <NavLink to="/settings">
            <span className="nav-icon">⚙</span> Settings
          </NavLink>
        </nav>
        <div className="sidebar-footer">
          Data stored locally as JSON
          <br />
          PDFs → Documents/FlowState Finance
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div>
            <h2>{meta.title}</h2>
            <p className="subtitle">{meta.subtitle}</p>
          </div>
        </header>
        <main className="content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/invoices" element={<InvoicesPage />} />
            <Route path="/offers" element={<OffersPage />} />
            <Route path="/clients" element={<ClientsPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
