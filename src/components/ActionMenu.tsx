import { useEffect, useRef, useState } from 'react';

export interface ActionItem {
  id: string;
  label: string;
  hint?: string;
  danger?: boolean;
  separatorBefore?: boolean;
  onClick: () => void;
}

interface Props {
  label?: string;
  items: ActionItem[];
  align?: 'left' | 'right';
}

export default function ActionMenu({ label = 'Actions', items, align = 'right' }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="action-menu" ref={ref}>
      <button
        type="button"
        className="btn btn-sm action-menu-trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        {label} <span className="action-caret">▾</span>
      </button>
      {open && (
        <div className={`action-menu-panel${align === 'left' ? ' left' : ''}`} role="menu">
          {items.map((item) => (
            <div key={item.id}>
              {item.separatorBefore && <div className="action-menu-sep" />}
              <button
                type="button"
                role="menuitem"
                className={`action-menu-item${item.danger ? ' danger' : ''}`}
                onClick={() => {
                  setOpen(false);
                  item.onClick();
                }}
              >
                <span className="action-menu-label">{item.label}</span>
                {item.hint && <span className="action-menu-hint">{item.hint}</span>}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
