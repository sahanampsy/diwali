import type { ReactNode } from 'react';
import { MODE } from '../lib/api';
import { Diya } from './Diya';

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="spinner" role="status">
      <Diya size={44} />
      <span>{label}…</span>
    </div>
  );
}

export function ErrorNote({ children, onRetry, actionLabel = 'Try again' }: { children: ReactNode; onRetry?: () => void; actionLabel?: string }) {
  return (
    <div className="error-note" role="alert">
      <span>{children}</span>
      {onRetry && (
        <button className="btn btn-ghost btn-sm" onClick={onRetry}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export function DemoBanner() {
  if (MODE !== 'demo') return null;
  return (
    <div className="demo-banner">
      Demo mode: responses are saved in this browser only. Connect Google Sheets to go live (see README).
    </div>
  );
}

export function Field({ label, hint, error, children, htmlFor }: { label: ReactNode; hint?: ReactNode; error?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className={`field ${error ? 'has-error' : ''}`}>
      <label className="field-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && !error && <p className="field-hint">{hint}</p>}
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}
