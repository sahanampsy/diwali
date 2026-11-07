import { useMemo, useState } from 'react';
import { ErrorNote, Spinner } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { downloadCsv } from '../../lib/csv';
import { useAsync } from '../../lib/hooks';
import { ATTENDING_LABELS, DIET_LABELS, LOOKING_FORWARD_LABELS } from '../../lib/labels';
import type { Attending, Diet, LookingForward } from '../../server/types';

const lookingText = (list: LookingForward[], emoji = false) =>
  list.map((v) => (emoji ? LOOKING_FORWARD_LABELS[v].emoji + ' ' : '') + LOOKING_FORWARD_LABELS[v].label).join(', ');

export function RsvpsTab({ onError }: { onError: (m: string) => void }) {
  const rsvps = useAsync(() => api.admin.listRsvps(), [], 30000);
  const [filter, setFilter] = useState<Attending | 'all'>('all');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (rsvps.data ?? []).filter(
      (r) =>
        (filter === 'all' || r.attending === filter) &&
        (!needle || [r.full_name, r.plus_one_name, r.contact, r.pass_code].some((x) => x.toLowerCase().includes(needle))),
    );
  }, [rsvps.data, filter, q]);

  if (rsvps.loading && !rsvps.data) return <Spinner />;
  if (!rsvps.data) return <ErrorNote onRetry={() => rsvps.reload()}>{errorMessage(rsvps.error)}</ErrorNote>;

  const all = rsvps.data;
  const count = (a: Attending) => all.filter((r) => r.attending === a).length;
  const confirmed = all.filter((r) => r.attending === 'yes').reduce((n, r) => n + r.headcount, 0);

  const exportCsv = () =>
    downloadCsv(
      'diwali-rsvps.csv',
      ['Name', 'Attending', 'Plus one', 'Plus one name', 'Headcount', 'Contact', 'Diet', 'Diet notes', 'Allergies', 'Looking forward to', 'Video', 'Party pass', 'Plus one pass', 'RSVP’d at', 'Updated at'],
      list.map((r) => [
        r.full_name, r.attending, r.plus_one ? 'yes' : 'no', r.plus_one_name, r.headcount, r.contact,
        r.diet ? DIET_LABELS[r.diet as Diet].label : '', r.diet_other, r.allergies,
        lookingText(r.looking_forward), r.video_title, r.pass_code, r.plus_one_pass_code,
        r.created_at, r.updated_at,
      ]),
    );

  const remove = async (id: string, name: string) => {
    if (!confirm(`Delete ${name}’s RSVP? Their video and votes are removed too. This can’t be undone.`)) return;
    try {
      await api.admin.deleteRsvp(id);
      rsvps.reload(true);
    } catch (e) {
      onError(errorMessage(e));
    }
  };

  return (
    <div>
      <div className="toolbar">
        <div className="chip-picker">
          {(['all', 'yes', 'maybe', 'no'] as const).map((f) => (
            <button key={f} className={`pill ${filter === f ? 'is-selected' : ''}`} onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : `${ATTENDING_LABELS[f].emoji} ${ATTENDING_LABELS[f].label.replace('!', '')}`}{' '}
              <span className="pill-count">{f === 'all' ? all.length : count(f)}</span>
            </button>
          ))}
        </div>
        <input className="input input-sm" type="search" placeholder="Search name, contact or pass" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn btn-ghost btn-sm" onClick={exportCsv}>⬇ Export CSV</button>
      </div>
      <p className="muted small">Confirmed headcount including plus ones: <strong className="gold">{confirmed}</strong></p>

      <div className="rows">
        {list.map((r) => (
          <article key={r.id} className={`row-card att-${r.attending}`}>
            <button className="row-main" onClick={() => setOpen(open === r.id ? null : r.id)} aria-expanded={open === r.id}>
              <span className={`status-dot dot-${r.attending}`} />
              <span className="row-name">
                {r.full_name}
                {r.plus_one && <span className="muted"> + {r.plus_one_name}</span>}
              </span>
              <span className="row-tags">
                <span className="chip">{ATTENDING_LABELS[r.attending].label.replace('!', '')}</span>
                {r.headcount > 0 && <span className="chip">👥 {r.headcount}</span>}
                {r.diet && <span className="chip">{DIET_LABELS[r.diet as Diet].emoji} {DIET_LABELS[r.diet as Diet].label}</span>}
                {r.allergies && <span className="chip chip-warn">⚠️ Allergy</span>}
                {r.video_title && <span className="chip">📺</span>}
              </span>
            </button>
            {open === r.id && (
              <dl className="row-detail">
                <div><dt>Contact</dt><dd>{r.contact}</dd></div>
                <div><dt>Party pass</dt><dd><code>{r.pass_code}</code>{r.plus_one_pass_code && <> · +1: <code>{r.plus_one_pass_code}</code></>}</dd></div>
                {r.diet === 'other' && <div><dt>Diet notes</dt><dd>{r.diet_other}</dd></div>}
                {r.allergies && <div><dt>Allergies</dt><dd>{r.allergies}</dd></div>}
                {r.looking_forward.length > 0 && <div><dt>Looking forward to</dt><dd>{lookingText(r.looking_forward, true)}</dd></div>}
                {r.video_title && <div><dt>Video</dt><dd>{r.video_title}</dd></div>}
                <div><dt>RSVP’d</dt><dd>{new Date(r.created_at).toLocaleString()}</dd></div>
                <div className="row-detail-actions">
                  <button className="btn btn-danger btn-sm" onClick={() => remove(r.id, r.full_name)}>Delete RSVP</button>
                </div>
              </dl>
            )}
          </article>
        ))}
        {list.length === 0 && <p className="muted center">No RSVPs match.</p>}
      </div>
    </div>
  );
}
