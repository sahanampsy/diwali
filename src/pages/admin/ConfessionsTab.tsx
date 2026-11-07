import { useMemo, useState } from 'react';
import { ErrorNote, Spinner } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { useAsync } from '../../lib/hooks';
import type { AdminConfession } from '../../server/types';

export function ConfessionsTab({ onError }: { onError: (m: string) => void }) {
  const list = useAsync(() => api.admin.listConfessions());
  const [filter, setFilter] = useState<'all' | 'favourites' | 'revealed'>('all');

  const shown = useMemo(
    () =>
      (list.data ?? []).filter(
        (c) => filter === 'all' || (filter === 'favourites' ? c.is_favourite : c.is_revealed),
      ),
    [list.data, filter],
  );

  if (list.loading && !list.data) return <Spinner />;
  if (!list.data) return <ErrorNote onRetry={() => list.reload()}>{errorMessage(list.error)}</ErrorNote>;

  const patch = async (c: AdminConfession, p: Partial<Pick<AdminConfession, 'is_favourite' | 'is_revealed'>>) => {
    const before = list.data;
    list.setData((l) => l?.map((x) => (x.id === c.id ? { ...x, ...p, revealed_at: p.is_revealed ? new Date().toISOString() : x.revealed_at } : x)) ?? null);
    try {
      await api.admin.updateConfession(c.id, p);
    } catch (e) {
      list.setData(before);
      onError(errorMessage(e));
    }
  };

  const remove = async (c: AdminConfession) => {
    if (!confirm('Delete this confession for good?')) return;
    try {
      await api.admin.deleteConfession(c.id);
      list.setData((l) => l?.filter((x) => x.id !== c.id) ?? null);
    } catch (e) {
      onError(errorMessage(e));
    }
  };

  return (
    <div>
      <div className="secret-note">
        <span>🔒</span>
        <p>
          Confessions are stored with no link to any guest, and shown here in a random order. Tap <strong>Reveal</strong> to put one
          on the party screen (Confessions view).
        </p>
      </div>
      <div className="toolbar">
        <div className="chip-picker">
          {(['all', 'favourites', 'revealed'] as const).map((f) => (
            <button key={f} className={`pill ${filter === f ? 'is-selected' : ''}`} onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : f === 'favourites' ? '⭐ Favourites' : '👁 Revealed'}{' '}
              <span className="pill-count">
                {f === 'all' ? (list.data ?? []).length : (list.data ?? []).filter((c) => (f === 'favourites' ? c.is_favourite : c.is_revealed)).length}
              </span>
            </button>
          ))}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => list.reload()}>↻ Shuffle & refresh</button>
      </div>

      <div className="confession-grid">
        {shown.map((c) => (
          <article key={c.id} className={`confession-card ${c.is_revealed ? 'is-revealed' : ''}`}>
            <p>“{c.body}”</p>
            <div className="confession-actions">
              <button className={`icon-btn ${c.is_favourite ? 'is-on' : ''}`} onClick={() => patch(c, { is_favourite: !c.is_favourite })}
                aria-pressed={c.is_favourite} title="Favourite">
                {c.is_favourite ? '⭐' : '☆'} <span>Favourite</span>
              </button>
              <button className={`icon-btn ${c.is_revealed ? 'is-on' : ''}`} onClick={() => patch(c, { is_revealed: !c.is_revealed })}
                aria-pressed={c.is_revealed} title="Reveal on party screen">
                {c.is_revealed ? '👁 Revealed' : '🙈 Reveal'}
              </button>
              <button className="icon-btn" onClick={() => remove(c)} title="Delete">🗑</button>
            </div>
          </article>
        ))}
        {shown.length === 0 && <p className="muted">Nothing here yet.</p>}
      </div>
    </div>
  );
}
