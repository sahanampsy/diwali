import { useEffect, useState, type FormEvent } from 'react';
import { ErrorNote, Field, Spinner } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { fromLocalInput, toLocalInput } from '../../lib/format';
import { useAsync } from '../../lib/hooks';
import type { EventSettings } from '../../server/types';

type TextKey = Exclude<keyof EventSettings, 'voting_open' | 'results_revealed'>;

const FIELDS: { key: TextKey; label: string; type?: 'datetime' | 'textarea' | 'url'; hint?: string }[] = [
  { key: 'event_name', label: 'Event name' },
  { key: 'host_names', label: 'Hosted by', hint: 'Shown as “… invite you to”' },
  { key: 'headline', label: 'Hero headline', hint: 'Text after the first “. ” gets the shimmering gold treatment.' },
  { key: 'subtitle', label: 'Subtitle', type: 'textarea' },
  { key: 'starts_at', label: 'Starts', type: 'datetime', hint: 'Drives the countdown. In your local time zone.' },
  { key: 'ends_at', label: 'Ends (optional)', type: 'datetime' },
  { key: 'venue_name', label: 'Venue name' },
  { key: 'venue_address', label: 'Venue address' },
  { key: 'map_url', label: 'Map link (optional)', type: 'url', hint: 'Leave blank to search Google Maps for the address.' },
  { key: 'dress_code', label: 'Dress code (optional)' },
  { key: 'rsvp_deadline', label: 'RSVP by (optional)', type: 'datetime' },
  { key: 'extra_note', label: 'Extra note (optional)', type: 'textarea', hint: 'Parking, gate code, what to bring…' },
];

export function SettingsTab() {
  const settings = useAsync(() => api.getSettings());
  const [form, setForm] = useState<EventSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (settings.data) setForm(settings.data);
  }, [settings.data]);

  if (!form) return settings.error ? <ErrorNote onRetry={() => settings.reload()}>{errorMessage(settings.error)}</ErrorNote> : <Spinner />;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const patch: Partial<EventSettings> = {};
      for (const f of FIELDS) patch[f.key] = form[f.key];
      setForm(await api.admin.updateSettings(patch));
      setMsg({ ok: true, text: 'Saved! The invite is updated.' });
    } catch (err) {
      setMsg({ ok: false, text: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="card settings-form" onSubmit={save}>
      <h3>Event details</h3>
      <p className="muted small">Everything on the invite page. Changes go live immediately.</p>
      <div className="settings-grid">
        {FIELDS.map((f) => (
          <Field key={f.key} label={f.label} hint={f.hint} htmlFor={`s-${f.key}`}>
            {f.type === 'textarea' ? (
              <textarea id={`s-${f.key}`} className="input" rows={2} value={form[f.key]}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
            ) : f.type === 'datetime' ? (
              <input id={`s-${f.key}`} type="datetime-local" className="input" value={toLocalInput(form[f.key])}
                onChange={(e) => setForm({ ...form, [f.key]: fromLocalInput(e.target.value) })} />
            ) : (
              <input id={`s-${f.key}`} className="input" type={f.type === 'url' ? 'url' : 'text'} value={form[f.key]}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
            )}
          </Field>
        ))}
      </div>
      {msg && (msg.ok ? <p className="success-note">{msg.text}</p> : <ErrorNote>{msg.text}</ErrorNote>)}
      <button className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save details'}</button>
    </form>
  );
}
