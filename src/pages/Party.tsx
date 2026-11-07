import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Diya } from '../components/Diya';
import { Fireworks } from '../components/Fireworks';
import { Mandala } from '../components/Mandala';
import { Qr } from '../components/Qr';
import { VideoModal } from '../components/VideoModal';
import { ErrorNote, Spinner } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { useAsync } from '../lib/hooks';
import { AWARD_LABELS, CATEGORY_LABELS } from '../lib/labels';
import { formatDuration, thumbnail, watchUrl } from '../lib/youtube';
import { AWARDS, VIDEO_CATEGORIES, type PartyVideo, type ResultRow, type VideoCategory } from '../server/types';

type View = 'gallery' | 'leaderboard';

/** The big-screen experience for the night. Hosts open this on the TV. */
export default function Party() {
  const [params, setParams] = useSearchParams();
  const view = (params.get('view') as View) || 'gallery';
  const setView = (v: View) => setParams({ view: v }, { replace: true });
  const settings = useAsync(() => api.getSettings(), [], 6000);
  const s = settings.data;
  const voteUrl = `${window.location.origin}/vote`;

  if (!s) {
    return (
      <div className="page-center">
        {settings.error ? <ErrorNote onRetry={() => settings.reload()}>{errorMessage(settings.error)}</ErrorNote> : <Spinner />}
      </div>
    );
  }

  return (
    <main className="party">
      <header className="party-head">
        <Link to="/" className="party-brand">
          <Diya size={34} /> <span>{s.event_name}</span>
        </Link>
        <nav className="party-tabs" aria-label="Watch party views">
          {(['gallery', 'leaderboard'] as View[]).map((v) => (
            <button key={v} className={`party-tab ${view === v ? 'is-active' : ''}`} onClick={() => setView(v)}>
              {v === 'gallery' ? '📺 Watch Party' : '🏆 Leaderboard'}
            </button>
          ))}
        </nav>
      </header>

      {s.voting_open && (
        <section className="vote-banner">
          <div>
            <p className="kicker">Voting is open</p>
            <h2 className="display-sm">Grab your phone & vote!</h2>
            <p className="muted">Scan the code or go to <strong>{voteUrl.replace(/^https?:\/\//, '')}</strong> and enter your party pass.</p>
          </div>
          <Qr value={voteUrl} size={150} />
        </section>
      )}

      {view === 'gallery' && <Gallery />}
      {view === 'leaderboard' && <Leaderboard revealed={s.results_revealed} votingOpen={s.voting_open} />}
    </main>
  );
}

function Gallery() {
  const videos = useAsync(() => api.getPartyVideos(), [], 30000);
  const [filter, setFilter] = useState<VideoCategory | 'all'>('all');
  const [playing, setPlaying] = useState<{ v: PartyVideo; index: number } | null>(null);

  const list = useMemo(
    () => (videos.data ?? []).filter((v) => filter === 'all' || v.category === filter),
    [videos.data, filter],
  );
  const counts = useMemo(() => {
    const c: Partial<Record<VideoCategory, number>> = {};
    for (const v of videos.data ?? []) c[v.category] = (c[v.category] ?? 0) + 1;
    return c;
  }, [videos.data]);

  if (videos.loading && !videos.data) return <Spinner label="Queueing the videos" />;
  if (!videos.data) return <ErrorNote onRetry={() => videos.reload()}>{errorMessage(videos.error)}</ErrorNote>;

  return (
    <section className="gallery-wrap">
      <div className="gallery-intro">
        <h1 className="display-sm">The Internet’s Finest</h1>
        <p className="muted">{videos.data.length} videos, hand-picked by the people in this room.</p>
      </div>
      <div className="chip-picker center">
        <button className={`pill ${filter === 'all' ? 'is-selected' : ''}`} onClick={() => setFilter('all')}>All</button>
        {VIDEO_CATEGORIES.filter((c) => counts[c]).map((c) => (
          <button key={c} className={`pill ${filter === c ? 'is-selected' : ''}`} onClick={() => setFilter(c)}>
            {CATEGORY_LABELS[c].emoji} {CATEGORY_LABELS[c].label} <span className="pill-count">{counts[c]}</span>
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="card center-card">
          <Diya size={56} lit={false} />
          <p>No approved videos yet. Hosts approve submissions in the dashboard.</p>
        </div>
      ) : (
        <div className="gallery">
          {list.map((v, i) => (
            <button key={v.id} className="tile" style={{ ['--i' as string]: i }} onClick={() => setPlaying({ v, index: i })}>
              <div className="tile-thumb">
                <img src={thumbnail(v.youtube_id)} alt="" loading="lazy" />
                <span className="tile-num">#{i + 1}</span>
                {v.duration_seconds ? <span className="yt-duration">{formatDuration(v.duration_seconds)}</span> : null}
                <span className="yt-play">▶</span>
              </div>
              <div className="tile-body">
                <span className="tile-cat">{CATEGORY_LABELS[v.category].emoji} {CATEGORY_LABELS[v.category].label}</span>
                <span className="tile-title">{v.title}</span>
                {v.reason && <span className="tile-reason">“{v.reason}”</span>}
              </div>
            </button>
          ))}
        </div>
      )}

      {playing && (
        <VideoModal youtubeId={playing.v.youtube_id} title={playing.v.title} onClose={() => setPlaying(null)}>
          {playing.v.reason && <p className="muted">Why we MUST watch: “{playing.v.reason}”</p>}
          <div className="player-nav">
            <button className="btn btn-ghost btn-sm" disabled={playing.index === 0}
              onClick={() => setPlaying({ v: list[playing.index - 1], index: playing.index - 1 })}>← Previous</button>
            <span className="muted small">{playing.index + 1} / {list.length}</span>
            <button className="btn btn-ghost btn-sm" disabled={playing.index === list.length - 1}
              onClick={() => setPlaying({ v: list[playing.index + 1], index: playing.index + 1 })}>Next →</button>
          </div>
          <a className="sr-only" href={watchUrl(playing.v.youtube_id)}>YouTube link</a>
        </VideoModal>
      )}
    </section>
  );
}

function Leaderboard({ revealed, votingOpen }: { revealed: boolean; votingOpen: boolean }) {
  const results = useAsync<ResultRow[] | null>(() => (revealed ? api.getResults() : Promise.resolve(null)), [revealed], revealed ? 8000 : 0);

  if (!revealed) {
    return (
      <section className="stage">
        <Mandala className="stage-mandala" />
        <Diya size={72} lit={false} />
        <h1 className="display-sm">{votingOpen ? 'Votes are pouring in…' : 'The results are locked 🔒'}</h1>
        <p className="muted">{votingOpen ? 'Get your votes in before the hosts close the polls.' : 'Only the hosts can reveal the winners. Drumroll, please.'}</p>
      </section>
    );
  }
  if (results.loading && !results.data) return <Spinner label="Counting the votes" />;
  if (!results.data) return <ErrorNote onRetry={() => results.reload()}>{errorMessage(results.error)}</ErrorNote>;

  const byAward = AWARDS.map((a) => ({ award: a, rows: results.data!.filter((r) => r.award === a) }));

  return (
    <section className="leaderboard">
      <Fireworks durationMs={3500} />
      <h1 className="display-sm center">And the winners are…</h1>
      <div className="awards">
        {byAward.map(({ award, rows }, i) => {
          const max = Math.max(1, ...rows.map((r) => r.votes));
          const winner = rows[0];
          const tied = rows.filter((r) => winner && r.votes === winner.votes);
          return (
            <article key={award} className={`award ${award === 'peoples_champion' ? 'award-champion' : ''}`} style={{ ['--i' as string]: i }}>
              <header>
                <span className="award-emoji">{AWARD_LABELS[award].emoji}</span>
                <h2>{AWARD_LABELS[award].label}</h2>
              </header>
              {winner ? (
                <>
                  <a className="winner" href={watchUrl(winner.youtube_id)} target="_blank" rel="noreferrer">
                    <img src={thumbnail(winner.youtube_id, 'mq')} alt="" />
                    <div>
                      <p className="winner-crown">👑 {tied.length > 1 ? 'Tied winner' : 'Winner'}</p>
                      <p className="winner-title">{winner.title}</p>
                      <p className="muted small">Submitted by {winner.submitter} · {winner.votes} {winner.votes === 1 ? 'vote' : 'votes'}</p>
                    </div>
                  </a>
                  <ol className="bars">
                    {rows.slice(0, 5).map((r) => (
                      <li key={r.video_id}>
                        <span className="bar-label">{r.title}</span>
                        <span className="bar"><span style={{ width: `${(r.votes / max) * 100}%` }} /></span>
                        <span className="bar-num">{r.votes}</span>
                      </li>
                    ))}
                  </ol>
                </>
              ) : (
                <p className="muted">No votes in this category.</p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
