import { useState } from 'react';
import { ErrorNote, Spinner } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { downloadCsv } from '../../lib/csv';
import { useAsync } from '../../lib/hooks';

export function SongsTab() {
  const songs = useAsync(() => api.admin.listSongs(), [], 30000);
  const [copied, setCopied] = useState(false);

  if (songs.loading && !songs.data) return <Spinner />;
  if (!songs.data) return <ErrorNote onRetry={() => songs.reload()}>{errorMessage(songs.error)}</ErrorNote>;

  const lines = songs.data.map((s) => (s.artist ? `${s.title} - ${s.artist}` : s.title));
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };
  const q = (s: { title: string; artist: string }) => encodeURIComponent(`${s.title} ${s.artist}`.trim());

  return (
    <div>
      <div className="toolbar">
        <p className="muted">{songs.data.length} requests. Paste the list into a playlist tool such as TuneMyMusic or Soundiiz to build a Spotify / Apple Music playlist in one go.</p>
        <button className="btn btn-ghost btn-sm" onClick={copy}>{copied ? 'Copied!' : '📋 Copy as list'}</button>
        <button className="btn btn-ghost btn-sm" onClick={() =>
          downloadCsv('diwali-songs.csv', ['Song', 'Artist', 'Requested by'], songs.data!.map((s) => [s.title, s.artist, s.requested_by]))}>
          ⬇ Export CSV
        </button>
      </div>
      <ol className="song-list">
        {songs.data.map((s) => (
          <li key={s.id}>
            <div>
              <p className="song-title">{s.title}</p>
              <p className="muted small">{s.artist || 'Unknown artist'} · requested by {s.requested_by}</p>
            </div>
            <div className="song-links">
              <a href={`https://open.spotify.com/search/${q(s)}`} target="_blank" rel="noreferrer">Spotify</a>
              <a href={`https://music.youtube.com/search?q=${q(s)}`} target="_blank" rel="noreferrer">YT Music</a>
            </div>
          </li>
        ))}
      </ol>
      {songs.data.length === 0 && <p className="muted">No song requests yet.</p>}
    </div>
  );
}
