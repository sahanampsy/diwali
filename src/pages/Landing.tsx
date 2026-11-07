import { Link } from 'react-router-dom';
import { Countdown } from '../components/Countdown';
import { Diya } from '../components/Diya';
import { Mandala } from '../components/Mandala';
import { Toran } from '../components/Toran';
import { ErrorNote, Spinner } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { formatDate, formatTimeRange, mapLink } from '../lib/format';
import { useAsync } from '../lib/hooks';
import { hasSubmitted } from '../lib/storage';

function splitHeadline(h: string): [string, string] {
  const i = h.indexOf('. ');
  return i > 0 ? [h.slice(0, i + 1), h.slice(i + 2)] : [h, ''];
}

const FEATURES = [
  { emoji: '📺', title: 'The YouTube Watch Party', text: 'Bring the best video the internet ever gave you. We watch them all, then vote for the winners.' },
  { emoji: '🍛', title: 'A ridiculous feast', text: 'Tell us how you eat and we’ll make sure there’s far too much of it.' },
  { emoji: '🎲', title: 'Board games & cocktails', text: 'No dance floor. Just fierce competition and very good drinks.' },
  { emoji: '🐈', title: 'Meet the cats', text: 'Our cats are co-hosting. Come and say hello.' },
];

export function Landing() {
  const settings = useAsync(() => api.getSettings());
  const stats = useAsync(() => api.getPublicStats());
  const s = settings.data;
  const returning = hasSubmitted();

  if (settings.loading && !s) return <div className="page-center"><Spinner label="Lighting the diyas" /></div>;
  if (!s) {
    return (
      <div className="page-center">
        <ErrorNote onRetry={() => settings.reload()}>{errorMessage(settings.error)}</ErrorNote>
      </div>
    );
  }

  const [line1, line2] = splitHeadline(s.headline);

  return (
    <main className="landing">
      <Toran />

      <section className="hero">
        <Mandala className="hero-mandala" />
        <p className="eyebrow reveal" style={{ ['--r' as string]: 0 }}>
          {s.host_names ? `${s.host_names} invite you to` : 'You’re invited to'} · {s.event_name}
        </p>
        <h1 className="display reveal" style={{ ['--r' as string]: 1 }}>
          <span className="display-line">{line1}</span>
          {line2 && <span className="display-line shimmer">{line2}</span>}
        </h1>
        <div className="diya-row reveal" style={{ ['--r' as string]: 2 }}>
          {[0, 0.4, 0.2, 0.6, 0.1].map((d, i) => (
            <Diya key={i} size={i === 2 ? 72 : i % 2 ? 52 : 40} delay={d} />
          ))}
        </div>
        <p className="lede reveal" style={{ ['--r' as string]: 3 }}>{s.subtitle}</p>

        <div className="hero-cta reveal" style={{ ['--r' as string]: 4 }}>
          <Link to="/rsvp" className="btn btn-primary btn-xl btn-glow">
            {returning ? 'Edit my RSVP' : 'RSVP NOW'}
          </Link>
          {stats.data && stats.data.headcount > 0 && (
            <p className="social-proof">
              <span className="pulse-dot" /> {stats.data.headcount} {stats.data.headcount === 1 ? 'person is' : 'people are'} coming
              {stats.data.videos > 0 && <> · {stats.data.videos} videos submitted</>}
            </p>
          )}
        </div>
      </section>

      <section className="section">
        <Countdown to={s.starts_at} />
      </section>

      <section className="section details">
        <div className="detail-card">
          <span className="detail-icon">📅</span>
          <div>
            <p className="detail-label">When</p>
            <p className="detail-value">{formatDate(s.starts_at)}</p>
            <p className="detail-sub">{formatTimeRange(s.starts_at, s.ends_at)}</p>
          </div>
        </div>
        <a className="detail-card detail-link" href={mapLink(s)} target="_blank" rel="noreferrer">
          <span className="detail-icon">📍</span>
          <div>
            <p className="detail-label">Where</p>
            <p className="detail-value">{s.venue_name}</p>
            <p className="detail-sub">{s.venue_address} <span className="arrow">↗</span></p>
          </div>
        </a>
        {s.dress_code && (
          <div className="detail-card">
            <span className="detail-icon">✨</span>
            <div>
              <p className="detail-label">Dress code</p>
              <p className="detail-value">{s.dress_code}</p>
            </div>
          </div>
        )}
        {s.rsvp_deadline && (
          <div className="detail-card">
            <span className="detail-icon">⏳</span>
            <div>
              <p className="detail-label">RSVP by</p>
              <p className="detail-value">{formatDate(s.rsvp_deadline)}</p>
            </div>
          </div>
        )}
      </section>

      {s.extra_note && <p className="section note-card">{s.extra_note}</p>}

      <section className="section">
        <h2 className="section-title">On the menu tonight</h2>
        <div className="features">
          {FEATURES.map((f, i) => (
            <article key={f.title} className="feature" style={{ ['--i' as string]: i }}>
              <span className="feature-emoji">{f.emoji}</span>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section final-cta">
        <Diya size={88} />
        <h2 className="display-sm">Your diya is waiting.</h2>
        <p className="muted">Takes two minutes. Mostly fun questions, we promise.</p>
        <Link to="/rsvp" className="btn btn-primary btn-xl btn-glow">
          {returning ? 'Edit my RSVP' : 'RSVP NOW'}
        </Link>
      </section>

      <footer className="footer">
        <p>Made with ghee, glitter and questionable decisions.</p>
        <p>
          <Link to="/vote">Party voting</Link> · <Link to="/party">Watch party screen</Link>
        </p>
      </footer>
    </main>
  );
}
