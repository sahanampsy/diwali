import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Diya } from '../components/Diya';
import { VideoModal } from '../components/VideoModal';
import { ErrorNote, Field, Spinner } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { useAsync } from '../lib/hooks';
import { AWARD_LABELS, CATEGORY_LABELS } from '../lib/labels';
import { savedPass, savePass } from '../lib/storage';
import { thumbnail } from '../lib/youtube';
import { AWARDS, type Award, type PartyVideo, type PassInfo } from '../server/types';

export default function Vote() {
  const settings = useAsync(() => api.getSettings(), [], 10000);
  const [code, setCode] = useState(savedPass());
  const [pass, setPass] = useState<PassInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const [passError, setPassError] = useState('');

  const enter = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!code.trim()) {
      setPassError('Enter the party pass from your RSVP confirmation.');
      return;
    }
    setChecking(true);
    setPassError('');
    try {
      const info = await api.checkPass(code.trim().toUpperCase());
      savePass(code.trim().toUpperCase());
      setPass(info);
    } catch (err) {
      setPassError(errorMessage(err));
    } finally {
      setChecking(false);
    }
  };

  const s = settings.data;
  if (!s) {
    return (
      <div className="page-center">
        {settings.error ? <ErrorNote onRetry={() => settings.reload()}>{errorMessage(settings.error)}</ErrorNote> : <Spinner />}
      </div>
    );
  }

  return (
    <main className="vote">
      <header className="vote-head">
        <Link to="/" className="back-link">← {s.event_name}</Link>
        <h1 className="display-sm">The Watch Party Awards 🏆</h1>
      </header>

      {s.results_revealed ? (
        <div className="card center-card">
          <Diya size={64} />
          <h2>The results are in!</h2>
          <p className="muted">Eyes on the big screen. Or peek now.</p>
          <Link className="btn btn-primary" to="/party?view=leaderboard">See the leaderboard</Link>
        </div>
      ) : !s.voting_open ? (
        <div className="card center-card">
          <Diya size={64} lit={false} />
          <h2>Voting isn’t open yet</h2>
          <p className="muted">Watch the videos first. The hosts will open voting when it’s time. This page updates by itself.</p>
          <p className="waiting-dots"><span /><span /><span /></p>
        </div>
      ) : !pass ? (
        <form className="card pass-card" onSubmit={enter}>
          <h2>Voting is OPEN 🎉</h2>
          <p className="muted">Enter your party pass. It’s the 6-character code on your RSVP confirmation.</p>
          <Field label="Party pass" error={passError} htmlFor="pass">
            <input id="pass" className="input input-code" value={code} maxLength={8} autoCapitalize="characters"
              autoComplete="off" placeholder="ABC123" onChange={(e) => setCode(e.target.value.toUpperCase())} />
          </Field>
          <button className="btn btn-primary btn-block" disabled={checking}>{checking ? 'Checking…' : 'Let me vote'}</button>
          <p className="muted small">Lost your pass? The hosts can look it up.</p>
        </form>
      ) : (
        <Ballot code={code.trim().toUpperCase()} pass={pass} onPass={setPass} />
      )}
    </main>
  );
}

function Ballot({ code, pass, onPass }: { code: string; pass: PassInfo; onPass: (p: PassInfo) => void }) {
  const videos = useAsync(() => api.getPartyVideos());
  const [award, setAward] = useState<Award>(() => AWARDS.find((a) => !pass.votes[a]) ?? 'funniest');
  const [picked, setPicked] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<PartyVideo | null>(null);

  const done = AWARDS.filter((a) => pass.votes[a]).length;
  const myVote = pass.votes[award];

  const lockIn = async () => {
    if (!picked) return;
    setSaving(true);
    setError('');
    try {
      await api.castVote(code, award, picked);
      const updated = { ...pass, votes: { ...pass.votes, [award]: picked } };
      onPass(updated);
      setPicked(null);
      const nextAward = AWARDS.find((a) => !updated.votes[a]);
      if (nextAward) setAward(nextAward);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (videos.loading && !videos.data) return <Spinner label="Loading the contenders" />;
  if (!videos.data) return <ErrorNote onRetry={() => videos.reload()}>{errorMessage(videos.error)}</ErrorNote>;

  return (
    <section className="ballot">
      <p className="ballot-hello">Hey {pass.name.split(' ')[0]} 👋 · {done}/{AWARDS.length} awards voted</p>

      <div className="award-tabs" role="tablist">
        {AWARDS.map((a) => (
          <button key={a} role="tab" aria-selected={award === a}
            className={`award-tab ${award === a ? 'is-active' : ''} ${pass.votes[a] ? 'is-voted' : ''}`}
            onClick={() => { setAward(a); setPicked(null); setError(''); }}>
            <span>{AWARD_LABELS[a].emoji}</span>
            <span className="award-tab-label">{AWARD_LABELS[a].label}</span>
            {pass.votes[a] && <span className="tick">✓</span>}
          </button>
        ))}
      </div>

      <div className="award-head">
        <h2>{AWARD_LABELS[award].emoji} {AWARD_LABELS[award].label}</h2>
        <p className="muted">{AWARD_LABELS[award].blurb}</p>
        {myVote && <p className="chip chip-good">Vote locked in ✓</p>}
      </div>

      {done === AWARDS.length && (
        <div className="all-done">
          <Diya size={48} /> All your votes are in. Results are revealed by the hosts. No bribes accepted (some bribes accepted).
        </div>
      )}

      <div className="ballot-list">
        {videos.data.map((v) => {
          const own = v.id === pass.own_video_id;
          const isMine = myVote === v.id;
          const isPicked = picked === v.id;
          return (
            <div key={v.id} className={`ballot-item ${isPicked ? 'is-picked' : ''} ${isMine ? 'is-mine' : ''} ${own ? 'is-own' : ''}`}>
              <button type="button" className="ballot-thumb" onClick={() => setPreview(v)} aria-label={`Preview ${v.title}`}>
                <img src={thumbnail(v.youtube_id, 'mq')} alt="" loading="lazy" />
                <span className="yt-play small">▶</span>
              </button>
              <button type="button" className="ballot-pick" disabled={own || !!myVote}
                onClick={() => setPicked(isPicked ? null : v.id)}>
                <span className="ballot-title">{v.title}</span>
                <span className="muted small">{CATEGORY_LABELS[v.category].emoji} {CATEGORY_LABELS[v.category].label}</span>
                {own && <span className="chip">Your video. No self-votes!</span>}
                {isMine && <span className="chip chip-good">Your pick ✓</span>}
              </button>
              {!own && !myVote && <span className={`radio ${isPicked ? 'is-on' : ''}`} aria-hidden="true" />}
            </div>
          );
        })}
        {videos.data.length === 0 && <p className="muted">No approved videos yet.</p>}
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}

      {!myVote && (
        <div className="sticky-cta">
          <button className="btn btn-primary btn-block btn-glow" disabled={!picked || saving} onClick={lockIn}>
            {saving ? 'Locking in…' : picked ? `Lock in my ${AWARD_LABELS[award].label} vote 🔒` : 'Tap a video to pick it'}
          </button>
          <p className="muted small center">One vote per award. Once it’s locked, it’s locked.</p>
        </div>
      )}

      {preview && (
        <VideoModal youtubeId={preview.youtube_id} title={preview.title} onClose={() => setPreview(null)}>
          {preview.reason && <p className="muted">“{preview.reason}”</p>}
        </VideoModal>
      )}
    </section>
  );
}
