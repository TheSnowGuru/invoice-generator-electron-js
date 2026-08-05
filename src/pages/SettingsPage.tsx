import { useEffect, useState } from 'react';
import { useAppStore } from '../store';
import type { CompanySettings } from '../types';
import { ACCENT_PRESETS } from '../types';

export default function SettingsPage() {
  const company = useAppStore((s) => s.company);
  const saveCompany = useAppStore((s) => s.saveCompany);
  const setToast = useAppStore((s) => s.setToast);

  const [form, setForm] = useState<CompanySettings>(company);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    setForm(company);
  }, [company]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!form.logoPath) {
        setLogoUrl(null);
        return;
      }
      const url = await window.flowstate.readDataUrl(form.logoPath);
      if (!cancelled) setLogoUrl(url);
    })();
    return () => {
      cancelled = true;
    };
  }, [form.logoPath]);

  const set = <K extends keyof CompanySettings>(key: K, value: CompanySettings[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const setTheme = (theme: 'dark' | 'light') => {
    set('theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  };

  const pickLogo = async () => {
    const path = await window.flowstate.pickLogo();
    if (path) set('logoPath', path);
  };

  const save = async () => {
    if (!form.name.trim()) {
      setToast('Company name is required');
      return;
    }
    await saveCompany(form);
  };

  return (
    <div className="split-2">
      <div className="panel">
        <div className="panel-header">
          <h3>Company profile</h3>
        </div>
        <div className="form-grid">
          <div className="field full">
            <label>Legal name</label>
            <input value={form.name} onChange={(e) => set('name', e.target.value)} />
          </div>
          <div className="field">
            <label>Address line 1</label>
            <input value={form.addressLine1} onChange={(e) => set('addressLine1', e.target.value)} />
          </div>
          <div className="field">
            <label>Address line 2</label>
            <input value={form.addressLine2} onChange={(e) => set('addressLine2', e.target.value)} />
          </div>
          <div className="field">
            <label>City</label>
            <input value={form.city} onChange={(e) => set('city', e.target.value)} />
          </div>
          <div className="field">
            <label>Postcode</label>
            <input value={form.postcode} onChange={(e) => set('postcode', e.target.value)} />
          </div>
          <div className="field">
            <label>Company number</label>
            <input
              value={form.companyNumber}
              onChange={(e) => set('companyNumber', e.target.value)}
            />
          </div>
          <div className="field">
            <label>VAT number</label>
            <input value={form.vatNumber} onChange={(e) => set('vatNumber', e.target.value)} />
          </div>
          <div className="field">
            <label>Email</label>
            <input value={form.email} onChange={(e) => set('email', e.target.value)} />
          </div>
          <div className="field">
            <label>Phone</label>
            <input value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          </div>
        </div>
      </div>

      <div>
        <div className="panel">
          <div className="panel-header">
            <h3>Appearance</h3>
          </div>
          <div className="field">
            <label>App theme</label>
            <div className="theme-toggle">
              <button
                type="button"
                className={`theme-option${(form.theme || 'dark') === 'dark' ? ' active' : ''}`}
                onClick={() => setTheme('dark')}
              >
                <strong>Dark</strong>
                <span>Navy / slate for low light</span>
              </button>
              <button
                type="button"
                className={`theme-option${form.theme === 'light' ? ' active' : ''}`}
                onClick={() => setTheme('light')}
              >
                <strong>Light</strong>
                <span>Bright workspace for daytime</span>
              </button>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h3>Branding</h3>
          </div>
          <div className="form-grid">
            <div className="field full">
              <label>Logo</label>
              <div className="stack-sm" style={{ alignItems: 'center' }}>
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="logo-preview" />
                ) : (
                  <div
                    className="logo-preview"
                    style={{ display: 'grid', placeItems: 'center', color: '#64748b' }}
                  >
                    No logo
                  </div>
                )}
                <button className="btn btn-sm" onClick={pickLogo}>
                  Upload logo
                </button>
                {form.logoPath && (
                  <button className="btn btn-sm btn-ghost" onClick={() => set('logoPath', '')}>
                    Remove
                  </button>
                )}
              </div>
            </div>
            <div className="field full">
              <label>Accent colour</label>
              <div className="color-row">
                {ACCENT_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`swatch${form.accentColor === c ? ' active' : ''}`}
                    style={{ background: c }}
                    onClick={() => set('accentColor', c)}
                    aria-label={c}
                  />
                ))}
                <input
                  type="color"
                  value={form.accentColor}
                  onChange={(e) => set('accentColor', e.target.value)}
                  style={{ width: 40, height: 32, border: 'none', background: 'transparent' }}
                />
              </div>
            </div>
            <div className="field">
              <label>Invoice prefix</label>
              <input
                value={form.invoicePrefix}
                onChange={(e) => set('invoicePrefix', e.target.value)}
              />
            </div>
            <div className="field">
              <label>Next invoice #</label>
              <input
                type="number"
                value={form.nextInvoiceNumber}
                onChange={(e) => set('nextInvoiceNumber', Number(e.target.value))}
              />
            </div>
            <div className="field">
              <label>Offer prefix</label>
              <input value={form.offerPrefix} onChange={(e) => set('offerPrefix', e.target.value)} />
            </div>
            <div className="field">
              <label>Next offer #</label>
              <input
                type="number"
                value={form.nextOfferNumber}
                onChange={(e) => set('nextOfferNumber', Number(e.target.value))}
              />
            </div>
            <div className="field">
              <label>Default VAT rate</label>
              <select
                value={form.defaultVatRate}
                onChange={(e) => set('defaultVatRate', Number(e.target.value))}
              >
                <option value={0.2}>20% (standard)</option>
                <option value={0.05}>5% (reduced)</option>
                <option value={0}>0% (zero-rated)</option>
              </select>
            </div>
            <div className="field full">
              <label>Default invoice notes</label>
              <textarea
                value={form.defaultNotes}
                onChange={(e) => set('defaultNotes', e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h3>Bank details</h3>
          </div>
          <div className="form-grid">
            <div className="field">
              <label>Account name</label>
              <input
                value={form.bankAccountName}
                onChange={(e) => set('bankAccountName', e.target.value)}
              />
            </div>
            <div className="field">
              <label>Sort code</label>
              <input
                value={form.bankSortCode}
                onChange={(e) => set('bankSortCode', e.target.value)}
                placeholder="00-00-00"
              />
            </div>
            <div className="field">
              <label>Account number</label>
              <input
                value={form.bankAccountNumber}
                onChange={(e) => set('bankAccountNumber', e.target.value)}
              />
            </div>
            <div className="field">
              <label>IBAN</label>
              <input value={form.bankIban} onChange={(e) => set('bankIban', e.target.value)} />
            </div>
            <div className="field">
              <label>BIC</label>
              <input value={form.bankBic} onChange={(e) => set('bankBic', e.target.value)} />
            </div>
          </div>
        </div>

        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" onClick={save}>
            Save settings
          </button>
        </div>
      </div>
    </div>
  );
}
