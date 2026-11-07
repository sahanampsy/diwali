import type { EventSettings } from '../server/types';

const valid = (iso: string) => !!iso && !Number.isNaN(new Date(iso).getTime());

export function formatDate(iso: string): string {
  if (!valid(iso)) return 'Date to be announced';
  return new Date(iso).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export function formatTime(iso: string): string {
  if (!valid(iso)) return '';
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function formatTimeRange(start: string, end: string): string {
  const s = formatTime(start);
  const e = formatTime(end);
  return s && e ? `${s} – ${e}` : s ? `${s} till late` : 'Time to be announced';
}

/** ISO → value for <input type="datetime-local"> in the viewer's time zone. */
export function toLocalInput(iso: string): string {
  if (!valid(iso)) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(v: string): string {
  if (!v) return '';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

export function mapLink(s: EventSettings): string {
  if (s.map_url) return s.map_url;
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(`${s.venue_name}, ${s.venue_address}`);
}

/** A downloadable calendar invite. */
export function icsFile(s: EventSettings): string {
  const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const start = valid(s.starts_at) ? s.starts_at : new Date().toISOString();
  const end = valid(s.ends_at) ? s.ends_at : new Date(new Date(start).getTime() + 5 * 3600e3).toISOString();
  const esc = (t: string) => t.replace(/[\\,;]/g, (m) => '\\' + m).replace(/\n/g, '\\n');
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Diwali RSVP//EN', 'BEGIN:VEVENT',
    `UID:${stamp(start)}-diwali@rsvp`, `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(s.event_name)} 🪔`, `LOCATION:${esc(`${s.venue_name}, ${s.venue_address}`)}`,
    `DESCRIPTION:${esc(s.subtitle + (s.dress_code ? '\nDress code: ' + s.dress_code : ''))}`,
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
}
