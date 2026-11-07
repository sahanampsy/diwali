import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Qr } from '../../components/Qr';
import { ErrorNote, Spinner } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { useAsync } from '../../lib/hooks';
import { AWARD_LABELS } from '../../lib/labels';
import { AWARDS, type EventSettings } from '../../server/types';

export function PartyControl({ onError }: { onError: (m: string) => void }) {
  const settings = useAsync(() => api.getSettings());
  const results = useAsync(() => api.getResults(), [], 5000);
  const videos = useAsync(() => api.getPartyVideos());
  const [busy, setBusy] = useState(false);

  if (!settings.data) return settings.error ? <ErrorNote onRetry={() => settings.reload()}>{errorMessage(settings.error)}</ErrorNote> : <Spinner />;
  const s = settings.data;
  const phase = s.results_revealed ? 'revealed' : s.voting_open ? 'open' : (results.data?.length ?? 0) > 0 ? 'closed' : 'before';

  const update = async (patch: Partial<EventSettings>, confirmText?: string) => {
    if (confirmText && !confirm(confirmText)) return;
    setBusy(true);
    try {
      settings.setData(await api.admin.updateSettings(patch));
      results.reload(true);
    } catch (e) {
      onError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (!confirm('Delete ALL votes? Use this after a rehearsal. This can’t be undone.')) return;
    try {
      await api.admin.resetVotes();
      results.reload();
    } catch (e) {
      onError(errorMessage(e));
    }
  };

  const totalVotes = (results.data ?? []).reduce((n, r) => n + r.votes, 0);
  const origin = window.location.origin;

  return (
    <div className="party-control">
      <div className="phase-track">
        {[
          ['before', '1. Watch the videos'],
          ['open', '2. Voting open'],
          ['closed', '3. Voting closed'],
          ['revealed', '4. Results revealed'],
        ].map(([k, label]) => (
          <span key={k} className={`phase ${phase === k ? 'is-current' : ''}`}>{label}</span>
        ))}
      </div>

      <div className="control-grid">
        <div className="card control-card">
          <h3>Voting</h3>
          <p className="muted small">{videos.data?.length ?? 0} approved videos in the running · {totalVotes} votes cast</p>
          <div className="control-buttons">
            {!s.voting_open ? (
              <button className="btn btn-primary btn-glow" disabled={busy} onClick={() => update({ voting_open: true, results_revealed: false })}>
                🗳 Open voting
              </button>
            ) : (
              <button className="btn btn-danger" disabled={busy} onClick={() => update({ voting_open: false }, 'Close voting? Guests won’t be able to vote any more.')}>
                ⏹ Close voting
              </button>
            )}
            {!s.results_revealed ? (
              <button className="btn btn-good" disabled={busy || s.voting_open}
                title={s.voting_open ? 'Close voting first' : ''}
                onClick={() => update({ results_revealed: true }, 'Reveal the results on everyone’s screens?')}>
                🏆 Reveal results
              </button>
            ) : (
              <button className="btn btn-ghost" disabled={busy} onClick={() => update({ results_revealed: false })}>🙈 Hide results</button>
            )}
          </div>
          {s.voting_open && <p className="small muted">Close voting before revealing results.</p>}
          <button className="btn btn-link btn-sm" onClick={reset}>Reset all votes</button>
        </div>

        <div className="card control-card qr-card">
          <h3>Guest voting link</h3>
          <Qr value={`${origin}/vote`} size={160} />
          <p className="small"><a href={`${origin}/vote`} target="_blank" rel="noreferrer">{origin.replace(/^https?:\/\//, '')}/vote</a></p>
          <p className="muted small">Guests enter their 6-character party pass. Look passes up in the RSVPs tab.</p>
        </div>

        <div className="card control-card">
          <h3>Party screen</h3>
          <p className="muted small">Open on the TV. It updates by itself when you open voting or reveal results.</p>
          <div className="control-buttons">
            <Link className="btn btn-ghost btn-sm" to="/party?view=gallery" target="_blank">📺 Gallery</Link>
            <Link className="btn btn-ghost btn-sm" to="/party?view=leaderboard" target="_blank">🏆 Leaderboard</Link>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Live tally <span className="muted small">(hosts only until you reveal)</span></h3>
        {results.error ? (
          <ErrorNote onRetry={() => results.reload()}>{errorMessage(results.error)}</ErrorNote>
        ) : (
          <div className="tally-grid">
            {AWARDS.map((a) => {
              const rows = (results.data ?? []).filter((r) => r.award === a);
              return (
                <div key={a} className="tally">
                  <h4>{AWARD_LABELS[a].emoji} {AWARD_LABELS[a].label}</h4>
                  {rows.length === 0 ? <p className="muted small">No votes yet</p> : (
                    <ol>
                      {rows.slice(0, 5).map((r) => (
                        <li key={r.video_id}><span>{r.title}</span> <strong>{r.votes}</strong></li>
                      ))}
                    </ol>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
