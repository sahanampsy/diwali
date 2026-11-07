// Demo mode: runs the real backend logic (src/server/core.ts) inside the
// browser with localStorage as the database. Used when no Google Sheets
// URL is configured, so the whole site can be tried before setup.

import { handle, type Env, type Store, type Table } from '../server/core';
import {
  DEFAULT_SETTINGS, type EventSettings, type RsvpRow, type VideoRow, type VoteRow,
} from '../server/types';

const KEY = 'diwali.demoDb.v4';
export const DEMO_PASSWORD = 'diwali';

interface Db {
  settings: EventSettings;
  rsvps: RsvpRow[];
  videos: VideoRow[];
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
    contact_normalized: id + '@example.com', diet: 'vegetarian', diet_other: '', allergies: '', looking_forward: 'everything',
    created_at: at(600 - id.charCodeAt(0)), updated_at: at(60), ...extra,
  });
  const video = (id: string, rsvp_id: string, youtube_id: string, title: string, category: VideoRow['category'], duration: number, reason: string, status: VideoRow['status'] = 'approved'): VideoRow => ({
    id, rsvp_id, youtube_id, url: 'https://www.youtube.com/watch?v=' + youtube_id, title, reason, category,
    duration_seconds: duration, duration_verified: true, status, admin_note: '', created_at: at(500 - id.charCodeAt(1)),
  });

  return {
    settings: { ...DEFAULT_SETTINGS, starts_at: inAWeek.toISOString(), host_names: 'Priya & Sam' },
    rsvps: [
      rsvp('ar', 'Arjun Mehta', 'yes', { plus_one: true, plus_one_name: 'Kavya Iyer', plus_one_pass_code: 'DEMOKI', diet: 'jain', looking_forward: 'cats,board_games' }),
      rsvp('ns', 'Nisha Shah', 'yes', { diet: 'vegan', allergies: 'Tree nuts', looking_forward: 'cocktails,watch_party' }),
      rsvp('tom', 'Tom Hughes', 'yes', { diet: 'non_vegetarian', looking_forward: 'board_games', plus_one: true, plus_one_name: 'Ella Hughes', plus_one_pass_code: 'DEMOEH' }),
      rsvp('ri', 'Riya Kapoor', 'maybe', { looking_forward: 'cats' }),
      rsvp('ben', 'Ben Okafor', 'no', { diet: '', looking_forward: '' }),
    ],
    videos: [
      video('v1', 'ar', 'jNQXAC9IVRw', 'Me at the zoo', 'hidden_gem', 19, 'The first video ever uploaded. 19 seconds of history.'),
      video('v2', 'ns', 'dQw4w9WgXcQ', 'Never Gonna Give You Up', 'wtf', 213, 'You know exactly why.'),
      video('v3', 'tom', '9bZkp7q19f0', 'Gangnam Style', 'funniest', 252, 'A classic. Non-negotiable.'),
      video('v4', 'ri', 'txqiwrbYGrs', 'David After Dentist', 'funniest', 119, 'Is this real life?', 'pending'),
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

function table<K extends 'rsvps' | 'videos' | 'votes'>(db: Db, key: K): Table<Db[K][number]> {
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
    clear: () => {
      (db[key] as R[]) = [] as unknown as Db[K];
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
