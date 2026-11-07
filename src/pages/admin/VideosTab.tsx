import { useMemo, useState } from 'react';
import { VideoModal } from '../../components/VideoModal';
import { ErrorNote, Spinner } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { downloadCsv } from '../../lib/csv';
import { useAsync } from '../../lib/hooks';
import { CATEGORY_LABELS } from '../../lib/labels';
import { formatDuration, thumbnail } from '../../lib/youtube';
import { MAX_VIDEO_SECONDS, VIDEO_CATEGORIES, type AdminVideo, type VideoStatus } from '../../server/types';

type Sort = 'newest' | 'category' | 'votes';

export function VideosTab({ onError }: { onError: (m: string) => void }) {
  const videos = useAsync(() => api.admin.listVideos(), [], 30000);
  const [status, setStatus] = useState<VideoStatus | 'all'>('all');
  const [sort, setSort] = useState<Sort>('category');
  const [preview, setPreview] = useState<AdminVideo | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const list = useMemo(() => {
    const l = (videos.data ?? []).filter((v) => status === 'all' || v.status === status);
    if (sort === 'category') l.sort((a, b) => VIDEO_CATEGORIES.indexOf(a.category) - VIDEO_CATEGORIES.indexOf(b.category) || a.title.localeCompare(b.title));
    if (sort === 'votes') l.sort((a, b) => b.votes - a.votes);
    return l;
  }, [videos.data, status, sort]);

  if (videos.loading && !videos.data) return <Spinner />;
  if (!videos.data) return <ErrorNote onRetry={() => videos.reload()}>{errorMessage(videos.error)}</ErrorNote>;

  const patchLocal = (id: string, patch: Partial<AdminVideo>) =>
    videos.setData((list) => list?.map((v) => (v.id === id ? { ...v, ...patch } : v)) ?? null);

  const act = async (id: string, fn: () => Promise<unknown>, patch?: Partial<AdminVideo>) => {
    setBusy(id);
    try {
      const res = await fn();
      if (patch) patchLocal(id, patch);
      else if (res && typeof res === 'object') patchLocal(id, res as Partial<AdminVideo>);
    } catch (e) {
      onError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const setVideoStatus = (v: AdminVideo, s: VideoStatus) => act(v.id, () => api.admin.updateVideo(v.id, { status: s }), { status: s });
  const note = (v: AdminVideo) => {
    const n = prompt('Note for this video (only hosts see it):', v.admin_note);
    if (n !== null) act(v.id, () => api.admin.updateVideo(v.id, { admin_note: n }), { admin_note: n });
  };
  const remove = async (v: AdminVideo) => {
    if (!confirm(`Remove “${v.title}”? Votes for it are deleted too.`)) return;
    await act(v.id, () => api.admin.deleteVideo(v.id));
    videos.reload(true);
  };

  const exportCsv = () =>
    downloadCsv(
      'diwali-videos.csv',
      ['Title', 'URL', 'Submitted by', 'Category', 'Duration', 'Duration verified', 'Status', 'Why watch', 'Host note', 'Votes'],
      list.map((v) => [
        v.title, v.url, v.submitter, CATEGORY_LABELS[v.category].label, formatDuration(v.duration_seconds),
        v.duration_verified ? 'yes' : 'no', v.status, v.reason, v.admin_note, v.votes,
      ]),
    );

  const counts = (s: VideoStatus) => videos.data!.filter((v) => v.status === s).length;

  return (
    <div>
      <div className="toolbar">
        <div className="chip-picker">
          {(['all', 'pending', 'approved', 'flagged'] as const).map((s) => (
            <button key={s} className={`pill ${status === s ? 'is-selected' : ''}`} onClick={() => setStatus(s)}>
              {s === 'all' ? 'All' : s === 'pending' ? '⏳ To review' : s === 'approved' ? '✅ Approved' : '🚩 Flagged'}{' '}
              <span className="pill-count">{s === 'all' ? (videos.data?.length ?? 0) : counts(s)}</span>
            </button>
          ))}
        </div>
        <label className="select-wrap">
          Sort
          <select className="input input-sm" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="category">By category</option>
            <option value="newest">Newest first</option>
            <option value="votes">Most votes</option>
          </select>
        </label>
        <button className="btn btn-ghost btn-sm" onClick={exportCsv}>⬇ Export list</button>
      </div>

      <div className="video-admin-grid">
        {list.map((v) => {
          const long = v.duration_seconds !== null && v.duration_seconds >= MAX_VIDEO_SECONDS;
          return (
            <article key={v.id} className={`video-admin status-${v.status}`}>
              <button className="video-admin-thumb" onClick={() => setPreview(v)} aria-label={`Preview ${v.title}`}>
                <img src={thumbnail(v.youtube_id)} alt="" loading="lazy" />
                <span className="yt-play">▶</span>
                <span className={`status-badge badge-${v.status}`}>{v.status === 'pending' ? 'To review' : v.status}</span>
              </button>
              <div className="video-admin-body">
                <p className="tile-cat">{CATEGORY_LABELS[v.category].emoji} {CATEGORY_LABELS[v.category].label}</p>
                <h3>{v.title}</h3>
                <p className="muted small">by {v.submitter || 'unknown'} · {v.votes} votes</p>
                <p className="small">
                  {v.duration_seconds !== null ? (
                    <span className={`chip ${long ? 'chip-bad' : v.duration_verified ? 'chip-good' : ''}`}>
                      ⏱ {formatDuration(v.duration_seconds)} {v.duration_verified ? '✓ verified' : '(unverified)'}
                    </span>
                  ) : (
                    <span className="chip chip-warn">⏱ Length unknown: check it</span>
                  )}
                </p>
                {v.reason && <p className="video-reason">“{v.reason}”</p>}
                {v.admin_note && <p className="host-note">📝 {v.admin_note}</p>}
                <a className="small link" href={v.url} target="_blank" rel="noreferrer">{v.url}</a>
                <div className="video-actions">
                  {v.status !== 'approved' && (
                    <button className="btn btn-good btn-sm" disabled={busy === v.id || long} onClick={() => setVideoStatus(v, 'approved')}>✅ Approve</button>
                  )}
                  {v.status !== 'flagged' && (
                    <button className="btn btn-danger btn-sm" disabled={busy === v.id} onClick={() => setVideoStatus(v, 'flagged')}>🚩 Flag</button>
                  )}
                  {v.status !== 'pending' && (
                    <button className="btn btn-ghost btn-sm" disabled={busy === v.id} onClick={() => setVideoStatus(v, 'pending')}>Undo</button>
                  )}
                  {!v.duration_verified && (
                    <button className="btn btn-ghost btn-sm" disabled={busy === v.id} onClick={() => act(v.id, () => api.admin.recheckVideo(v.id))}>⏱ Check length</button>
                  )}
                  <button className="btn btn-link btn-sm" onClick={() => note(v)}>Note</button>
                  <button className="btn btn-link btn-sm" onClick={() => remove(v)}>Remove</button>
                </div>
              </div>
            </article>
          );
        })}
        {list.length === 0 && <p className="muted">No videos here.</p>}
      </div>

      {preview && (
        <VideoModal youtubeId={preview.youtube_id} title={preview.title} onClose={() => setPreview(null)}>
          <p className="muted small">Submitted by {preview.submitter} · {CATEGORY_LABELS[preview.category].label}</p>
          <div className="video-actions">
            <button className="btn btn-good btn-sm" onClick={() => { setVideoStatus(preview, 'approved'); setPreview(null); }}>✅ Approve</button>
            <button className="btn btn-danger btn-sm" onClick={() => { setVideoStatus(preview, 'flagged'); setPreview(null); }}>🚩 Flag</button>
          </div>
        </VideoModal>
      )}
    </div>
  );
}
