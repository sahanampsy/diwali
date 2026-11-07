import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Diya } from '../../components/Diya';
import { ErrorNote, Field } from '../../components/ui';
import { api, errorMessage, MODE } from '../../lib/api';
import { ConfessionsTab } from './ConfessionsTab';
import { Overview } from './Overview';
import { PartyControl } from './PartyControl';
import { RsvpsTab } from './RsvpsTab';
import { SettingsTab } from './SettingsTab';
import { SongsTab } from './SongsTab';
import { VideosTab } from './VideosTab';

const TABS = [
  { key: 'overview', label: 'Overview', emoji: '📊' },
  { key: 'rsvps', label: 'RSVPs', emoji: '📜' },
  { key: 'videos', label: 'Videos', emoji: '📺' },
  { key: 'confessions', label: 'Confessions', emoji: '🤫' },
  { key: 'songs', label: 'Songs', emoji: '💃' },
  { key: 'party', label: 'Party Control', emoji: '🏆' },
  { key: 'settings', label: 'Event Details', emoji: '⚙️' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

export default function Admin() {
  const [signedIn, setSignedIn] = useState(api.admin.isSignedIn());

  // Drop a stale session (expired token or changed password).
  useEffect(() => {
    if (!signedIn) return;
    api.admin.check().catch(() => {
      api.admin.signOut();
      setSignedIn(false);
    });
  }, [signedIn]);

  if (!signedIn) return <Login onDone={() => setSignedIn(true)} />;
  return (
    <Dashboard
      onSignOut={() => {
        api.admin.signOut();
        setSignedIn(false);
      }}
    />
  );
}

function Login({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.admin.signIn(password);
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="page-center">
      <form className="card login-card" onSubmit={submit}>
        <Diya size={64} />
        <h1 className="display-sm">Hosts only</h1>
        <p className="muted">Sign in to manage RSVPs, videos, confessions and the party.</p>
        <Field label="Host password" error={error} htmlFor="pw">
          <input id="pw" type="password" className="input" autoComplete="current-password" value={password}
            onChange={(e) => setPassword(e.target.value)} autoFocus />
        </Field>
        {MODE === 'demo' && <p className="muted small">Demo mode password: <code>diwali</code></p>}
        <button className="btn btn-primary btn-block" disabled={busy || !password}>{busy ? 'Checking…' : 'Sign in'}</button>
        <Link to="/" className="btn btn-link">← Back to the invite</Link>
      </form>
    </main>
  );
}

function Dashboard({ onSignOut }: { onSignOut: () => void }) {
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find((t) => t.key === params.get('tab'))?.key ?? 'overview') as TabKey;
  const [notice, setNotice] = useState('');
  const go = (t: TabKey) => setParams({ tab: t }, { replace: true });

  return (
    <main className="admin">
      <header className="admin-head">
        <div className="admin-brand">
          <Diya size={34} />
          <div>
            <p className="kicker">Host dashboard</p>
            <h1>Diwali Control Room</h1>
          </div>
        </div>
        <div className="admin-head-actions">
          <Link className="btn btn-ghost btn-sm" to="/party" target="_blank">Open party screen ↗</Link>
          <button className="btn btn-link btn-sm" onClick={onSignOut}>Sign out</button>
        </div>
      </header>

      <nav className="admin-tabs" aria-label="Dashboard sections">
        {TABS.map((t) => (
          <button key={t.key} className={`admin-tab ${tab === t.key ? 'is-active' : ''}`} onClick={() => go(t.key)}>
            <span>{t.emoji}</span> {t.label}
          </button>
        ))}
      </nav>

      {notice && <ErrorNote onRetry={() => setNotice('')} actionLabel="Dismiss">{notice}</ErrorNote>}

      <section className="admin-body">
        {tab === 'overview' && <Overview onGo={go} />}
        {tab === 'rsvps' && <RsvpsTab onError={setNotice} />}
        {tab === 'videos' && <VideosTab onError={setNotice} />}
        {tab === 'confessions' && <ConfessionsTab onError={setNotice} />}
        {tab === 'songs' && <SongsTab />}
        {tab === 'party' && <PartyControl onError={setNotice} />}
        {tab === 'settings' && <SettingsTab />}
      </section>
    </main>
  );
}
