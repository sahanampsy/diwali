import type { EventSettings } from '../server/types';

/**
 * The party's time zone. Every time is shown in it, whatever the guest's phone
 * is set to, so 6 pm in Bengaluru always reads "6:00 pm".
 */
export const EVENT_TIME_ZONE = 'Asia/Kolkata';
const EVENT_UTC_OFFSET = '+05:30'; // India has no daylight saving

/**
 * Reads a party date. One with no time zone ("2026-11-08T18:00" or
 * "2026-11-08 18:00") is taken as India time, never the phone's own zone.
 */
export function eventDate(value: string): Date {
  const v = (value || '').trim().replace(' ', 'T');
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/i.test(v);
  const isDateTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v);
  return new Date(isDateTime && !hasZone ? v + EVENT_UTC_OFFSET : v);
}

const valid = (iso: string) => !!iso && !Number.isNaN(eventDate(iso).getTime());

export function formatDate(iso: string): string {
  if (!valid(iso)) return 'Date to be announced';
  return eventDate(iso).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: EVENT_TIME_ZONE });
}

export function formatTime(iso: string): string {
  if (!valid(iso)) return '';
  return eventDate(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', timeZone: EVENT_TIME_ZONE });
}

export function formatTimeRange(start: string, end: string): string {
  const s = formatTime(start);
  const e = formatTime(end);
  return s && e ? `${s} – ${e}` : s ? `${s} onwards` : 'Time to be announced';
}

/** ISO → value for <input type="datetime-local">, in the party's time zone. */
export function toLocalInput(iso: string): string {
  if (!valid(iso)) return '';
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: EVENT_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(eventDate(iso)).map((x) => [x.type, x.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** <input type="datetime-local"> value, read as party time → ISO. */
export function fromLocalInput(v: string): string {
  if (!v) return '';
  const iso = `${v.length === 16 ? v + ':00' : v}${EVENT_UTC_OFFSET}`;
  return valid(iso) ? iso : '';
}

export function mapLink(s: EventSettings): string {
  if (s.map_url) return s.map_url;
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(`${s.venue_name}, ${s.venue_address}`);
}

/** A downloadable calendar invite. */
export function icsFile(s: EventSettings): string {
  const stamp = (iso: string) => eventDate(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const start = valid(s.starts_at) ? s.starts_at : new Date().toISOString();
  const end = valid(s.ends_at) ? s.ends_at : new Date(eventDate(start).getTime() + 5 * 3600e3).toISOString();
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
