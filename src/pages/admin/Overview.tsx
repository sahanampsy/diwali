import { Spinner, ErrorNote } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { useAsync } from '../../lib/hooks';
import { DIET_LABELS, VIBE_LABELS } from '../../lib/labels';
import { DIETS, VIBES } from '../../server/types';

type Go = (t: 'rsvps' | 'videos' | 'confessions' | 'songs' | 'party') => void;

export function Overview({ onGo }: { onGo: Go }) {
  const data = useAsync(async () => {
    const [rsvps, videos, confessions, songs] = await Promise.all([
      api.admin.listRsvps(), api.admin.listVideos(), api.admin.listConfessions(), api.admin.listSongs(),
    ]);
    return { rsvps, videos, confessions, songs };
  }, [], 30000);

  if (data.loading && !data.data) return <Spinner />;
  if (!data.data) return <ErrorNote onRetry={() => data.reload()}>{errorMessage(data.error)}</ErrorNote>;

  const { rsvps, videos, confessions, songs } = data.data;
  const yes = rsvps.filter((r) => r.attending === 'yes');
  const maybe = rsvps.filter((r) => r.attending === 'maybe');
  const no = rsvps.filter((r) => r.attending === 'no');
  const heads = (list: typeof rsvps) => list.reduce((n, r) => n + r.headcount, 0);
  const coming = [...yes, ...maybe];
  const allergies = coming.filter((r) => r.allergies);

  const dietCounts = DIETS.map((d) => ({ d, n: coming.filter((r) => r.diet === d).length }));
  const unknownDiet = coming.filter((r) => !r.diet).length;
  const vibeCounts = VIBES.map((v) => ({ v, n: coming.filter((r) => r.vibe === v).length }));
  const maxDiet = Math.max(1, ...dietCounts.map((x) => x.n), unknownDiet);
  const maxVibe = Math.max(1, ...vibeCounts.map((x) => x.n));

  return (
    <div className="overview">
      <div className="stat-grid">
        <button className="stat stat-hero" onClick={() => onGo('rsvps')}>
          <span className="stat-num">{heads(yes)}</span>
          <span className="stat-label">Confirmed headcount</span>
          <span className="stat-sub">{yes.length} RSVPs + {heads(yes) - yes.length} plus ones</span>
        </button>
        <button className="stat" onClick={() => onGo('rsvps')}>
          <span className="stat-num">{heads(maybe)}</span>
          <span className="stat-label">Maybes</span>
          <span className="stat-sub">{maybe.length} RSVPs</span>
        </button>
        <button className="stat" onClick={() => onGo('rsvps')}>
          <span className="stat-num">{no.length}</span>
          <span className="stat-label">Can’t make it</span>
        </button>
        <button className="stat" onClick={() => onGo('videos')}>
          <span className="stat-num">{videos.length}</span>
          <span className="stat-label">Videos</span>
          <span className="stat-sub">
            {videos.filter((v) => v.status === 'pending').length} to review · {videos.filter((v) => v.status === 'approved').length} approved
          </span>
        </button>
        <button className="stat" onClick={() => onGo('confessions')}>
          <span className="stat-num">{confessions.length}</span>
          <span className="stat-label">Confessions</span>
          <span className="stat-sub">{confessions.filter((c) => c.is_revealed).length} revealed</span>
        </button>
        <button className="stat" onClick={() => onGo('songs')}>
          <span className="stat-num">{songs.length}</span>
          <span className="stat-label">Song requests</span>
        </button>
      </div>

      <div className="two-col">
        <div className="card">
          <h3>Food plan <span className="muted small">(yes + maybe)</span></h3>
          <ul className="hbars">
            {dietCounts.map(({ d, n }) => (
              <li key={d}>
                <span>{DIET_LABELS[d].emoji} {DIET_LABELS[d].label}</span>
                <span className="bar"><span style={{ width: `${(n / maxDiet) * 100}%` }} /></span>
                <strong>{n}</strong>
              </li>
            ))}
            {unknownDiet > 0 && (
              <li>
                <span>❔ Didn’t say</span>
                <span className="bar bar-muted"><span style={{ width: `${(unknownDiet / maxDiet) * 100}%` }} /></span>
                <strong>{unknownDiet}</strong>
              </li>
            )}
          </ul>
          <p className="muted small">Counts are per RSVP. Plus ones are assumed to share their host’s preference.</p>
          {allergies.length > 0 && (
            <>
              <h4 className="mt">⚠️ Allergies & restrictions</h4>
              <ul className="allergy-list">
                {allergies.map((r) => (
                  <li key={r.id}><strong>{r.full_name}</strong>: {r.allergies}</li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="card">
          <h3>Vibe check</h3>
          <ul className="hbars">
            {vibeCounts.map(({ v, n }) => (
              <li key={v}>
                <span>{VIBE_LABELS[v].emoji} {VIBE_LABELS[v].label}</span>
                <span className="bar"><span style={{ width: `${(n / maxVibe) * 100}%` }} /></span>
                <strong>{n}</strong>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
