import type { ReactNode } from 'react';
import { embedUrl, watchUrl } from '../lib/youtube';
import { Modal } from './Modal';

export function VideoModal({ youtubeId, title, onClose, children }: { youtubeId: string; title: string; onClose: () => void; children?: ReactNode }) {
  return (
    <Modal onClose={onClose} wide label={title}>
      <div className="player">
        <iframe
          src={embedUrl(youtubeId)}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
        />
      </div>
      <div className="player-meta">
        <h3>{title}</h3>
        {children}
        <a className="btn btn-ghost btn-sm" href={watchUrl(youtubeId)} target="_blank" rel="noreferrer">
          Open on YouTube ↗
        </a>
      </div>
    </Modal>
  );
}
