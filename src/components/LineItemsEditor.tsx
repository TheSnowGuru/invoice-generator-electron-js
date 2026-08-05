import type { LineItem } from '../types';
import { calcTotals, formatGbp } from '../types';

interface Props {
  items: LineItem[];
  defaultVatRate: number;
  onChange: (items: LineItem[]) => void;
}

export default function LineItemsEditor({ items, defaultVatRate, onChange }: Props) {
  const totals = calcTotals(items);

  const update = (id: string, patch: Partial<LineItem>) => {
    onChange(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  };

  const add = () => {
    onChange([
      ...items,
      {
        id: crypto.randomUUID(),
        description: '',
        quantity: 1,
        unitPrice: 0,
        vatRate: defaultVatRate,
      },
    ]);
  };

  const remove = (id: string) => {
    onChange(items.filter((i) => i.id !== id));
  };

  return (
    <div>
      <div className="line-items">
        {items.map((item) => (
          <div className="line-item" key={item.id}>
            <div className="field">
              <label>Description</label>
              <input
                value={item.description}
                onChange={(e) => update(item.id, { description: e.target.value })}
                placeholder="Service or product"
              />
            </div>
            <div className="field">
              <label>Qty</label>
              <input
                type="number"
                min={0}
                step={1}
                value={item.quantity}
                onChange={(e) => update(item.id, { quantity: Number(e.target.value) })}
              />
            </div>
            <div className="field">
              <label>Unit £</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={item.unitPrice}
                onChange={(e) => update(item.id, { unitPrice: Number(e.target.value) })}
              />
            </div>
            <div className="field">
              <label>VAT %</label>
              <select
                value={item.vatRate}
                onChange={(e) => update(item.id, { vatRate: Number(e.target.value) })}
              >
                <option value={0.2}>20%</option>
                <option value={0.05}>5%</option>
                <option value={0}>0%</option>
              </select>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => remove(item.id)}>
              Remove
            </button>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 10 }}>
        <button type="button" className="btn btn-sm" onClick={add}>
          + Add line
        </button>
      </div>
      <div className="totals-box">
        <div className="totals-row">
          <span>Subtotal</span>
          <span>{formatGbp(totals.subtotal)}</span>
        </div>
        <div className="totals-row">
          <span>VAT</span>
          <span>{formatGbp(totals.vat)}</span>
        </div>
        <div className="totals-row grand">
          <span>Total</span>
          <span>{formatGbp(totals.total)}</span>
        </div>
      </div>
    </div>
  );
}
