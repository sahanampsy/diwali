// Demo mode: runs the real backend logic (src/server/core.ts) inside the
// browser with localStorage as the database. Used when no Google Sheets
// URL is configured, so the whole site can be tried before setup.

import { handle, type Env, type Store, type Table } from '../server/core';
import {
  DEFAULT_SETTINGS, type ConfessionRow, type EventSettings, type RsvpRow, type SongRow, type VideoRow, type VoteRow,
} from '../server/types';

const KEY = 'diwali.demoDb.v1';
export const DEMO_PASSWORD = 'diwali';

interface Db {
  settings: EventSettings;
  rsvps: RsvpRow[];
  videos: VideoRow[];
  songs: SongRow[];
  confessions: ConfessionRow[];
  votes: VoteRow[];
}

/** Fast non-cryptographic hash. Fine for a browser-only demo. */
function demoHash(s: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
}

function seed(): Db {
  const inAWeek = new Date(Date.now() + 7 * 864e5);
  inAWeek.setHours(19, 30, 0, 0);
  const at = (minsAgo: number) => new Date(Date.now() - minsAgo * 60000).toISOString();
  const rsvp = (id: string, name: string, attending: RsvpRow['attending'], extra: Partial<RsvpRow> = {}): RsvpRow => ({
    id, token_hash: 'seed-' + id, pass_code: ('DEMO' + id.toUpperCase()).slice(0, 6), plus_one_pass_code: '',
    full_name: name, attending, plus_one: false, plus_one_name: '', contact: id + '@example.com',
    contact_normalized: id + '@example.com', diet: 'vegetarian', diet_other: '', allergies: '', vibe: 'all',
    created_at: at(600 - id.charCodeAt(0)), updated_at: at(60), ...extra,
  });
  const video = (id: string, rsvp_id: string, youtube_id: string, title: string, category: VideoRow['category'], duration: number, reason: string, status: VideoRow['status'] = 'approved'): VideoRow => ({
    id, rsvp_id, youtube_id, url: 'https://www.youtube.com/watch?v=' + youtube_id, title, reason, category,
    duration_seconds: duration, duration_verified: true, status, admin_note: '', created_at: at(500 - id.charCodeAt(1)),
  });

  return {
    settings: { ...DEFAULT_SETTINGS, starts_at: inAWeek.toISOString(), host_names: 'Priya & Sam', venue_name: 'The Lantern House' },
    rsvps: [
      rsvp('ar', 'Arjun Mehta', 'yes', { plus_one: true, plus_one_name: 'Kavya Iyer', plus_one_pass_code: 'DEMOKI', diet: 'jain', vibe: 'dancing' }),
      rsvp('ns', 'Nisha Shah', 'yes', { diet: 'vegan', allergies: 'Tree nuts', vibe: 'gossip' }),
      rsvp('tom', 'Tom Hughes', 'yes', { diet: 'non_vegetarian', vibe: 'food', plus_one: true, plus_one_name: 'Ella Hughes', plus_one_pass_code: 'DEMOEH' }),
      rsvp('ri', 'Riya Kapoor', 'maybe', { vibe: 'vibes' }),
      rsvp('ben', 'Ben Okafor', 'no', { diet: '', vibe: '' }),
    ],
    videos: [
      video('v1', 'ar', 'jNQXAC9IVRw', 'Me at the zoo', 'hidden_gem', 19, 'The first video ever uploaded. 19 seconds of history.'),
      video('v2', 'ns', 'dQw4w9WgXcQ', 'Never Gonna Give You Up', 'wtf', 213, 'You know exactly why.'),
      video('v3', 'tom', '9bZkp7q19f0', 'Gangnam Style', 'funniest', 252, 'Dance floor warm-up. Non-negotiable.'),
      video('v4', 'ri', 'txqiwrbYGrs', 'David After Dentist', 'funniest', 119, 'Is this real life?', 'pending'),
    ],
    songs: [
      { id: 's1', rsvp_id: 'ar', title: 'Kala Chashma', artist: 'Badshah', created_at: at(300) },
      { id: 's2', rsvp_id: 'ns', title: 'London Thumakda', artist: 'Labh Janjua', created_at: at(200) },
      { id: 's3', rsvp_id: 'tom', title: 'Mr. Brightside', artist: 'The Killers', created_at: at(100) },
    ],
    confessions: [
      { id: 'c1', owner_hash: 'x1', body: 'I have never once finished a book I recommended to someone.', is_favourite: true, is_revealed: true, revealed_at: at(5) },
      { id: 'c2', owner_hash: 'x2', body: 'I can recite the whole of K3G from memory. Including the songs.', is_favourite: false, is_revealed: false, revealed_at: '' },
      { id: 'c3', owner_hash: 'x3', body: 'I was once mistaken for a minor celebrity at an airport and I just went with it.', is_favourite: true, is_revealed: false, revealed_at: '' },
    ],
    votes: [],
  };
}

function load(): Db {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Db;
  } catch {
    /* fall through */
  }
  const db = seed();
  save(db);
  return db;
}

function save(db: Db) {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    /* ignore */
  }
}

export function resetDemo() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

function table<K extends 'rsvps' | 'videos' | 'songs' | 'confessions' | 'votes'>(db: Db, key: K): Table<Db[K][number]> {
  type R = Db[K][number];
  return {
    all: () => (db[key] as R[]).slice(),
    insert: (row: R) => {
      (db[key] as R[]).push(row);
    },
    update: (id: string, patch: Partial<R>) => {
      const list = db[key] as R[];
      const i = list.findIndex((r) => r.id === id);
      if (i >= 0) list[i] = { ...list[i], ...patch, id };
    },
    remove: (id: string) => {
      (db[key] as R[]) = (db[key] as R[]).filter((r) => r.id !== id) as Db[K];
    },
  };
}

const counters = new Map<string, number[]>();

const env: Env = {
  sha256: demoHash,
  randomInt: (max) => {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0] % max;
  },
  uuid: () => crypto.randomUUID(),
  now: () => new Date().toISOString(),
  videoMeta: () => null,
  checkAdminPassword: (pw) => pw === DEMO_PASSWORD,
  sign: (data) => demoHash('demo-secret:' + data),
  throttle: (key, limit, windowSec) => {
    const now = Date.now();
    const hits = (counters.get(key) ?? []).filter((t) => now - t < windowSec * 1000);
    hits.push(now);
    counters.set(key, hits);
    return hits.length <= limit;
  },
};

export async function demoCall(action: string, args: Record<string, unknown>): Promise<unknown> {
  await new Promise((r) => setTimeout(r, 250 + Math.random() * 250)); // feel like a network
  const db = load();
  const store: Store = {
    rsvps: table(db, 'rsvps'),
    videos: table(db, 'videos'),
    songs: table(db, 'songs'),
    confessions: table(db, 'confessions'),
    votes: table(db, 'votes'),
    getSettings: () => ({ ...db.settings }),
    saveSettings: (patch) => {
      db.settings = { ...db.settings, ...patch };
    },
  };
  // JSON round trip so the UI never holds references into the "database".
  const result = handle(store, env, action, JSON.parse(JSON.stringify(args)));
  save(db);
  return result === undefined ? null : JSON.parse(JSON.stringify(result));
}
