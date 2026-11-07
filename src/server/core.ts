// Backend logic, written once and run in two places:
//  * Google Apps Script (src/server/gas.ts) with Google Sheets as storage
//  * the browser, in demo mode (src/lib/demoBackend.ts) with localStorage
// Everything here is synchronous, because Apps Script web apps must answer synchronously.

import {
  ATTENDING, AWARDS, DIETS, MAX_VIDEO_SECONDS, VIBES, VIDEO_CATEGORIES,
  type AdminConfession, type AdminRsvp, type AdminSong, type AdminVideo, type Award, type ConfessionRow,
  type EventSettings, type MyRsvp, type PartyVideo, type PassInfo, type ResultRow, type RsvpPayload,
  type RsvpResult, type RsvpRow, type SongRow, type VideoCategory, type VideoMeta, type VideoRow,
  type VideoStatus, type VoteRow,
} from './types';

export interface Table<T extends { id: string }> {
  all(): T[];
  insert(row: T): void;
  update(id: string, patch: Partial<T>): void;
  remove(id: string): void;
}

export interface Store {
  rsvps: Table<RsvpRow>;
  videos: Table<VideoRow>;
  songs: Table<SongRow>;
  confessions: Table<ConfessionRow>;
  votes: Table<VoteRow>;
  getSettings(): EventSettings;
  saveSettings(patch: Partial<EventSettings>): void;
}

export interface Env {
  sha256(s: string): string;
  randomInt(maxExclusive: number): number;
  uuid(): string;
  now(): string;
  /** Looks up a YouTube video; null when no lookup is possible here. */
  videoMeta(id: string): VideoMeta | null;
  checkAdminPassword(pw: string): boolean;
  /** Keyed signature used for host session tokens. */
  sign(data: string): string;
  /** Returns false when `key` has been used more than `limit` times in `windowSec`. */
  throttle(key: string, limit: number, windowSec: number): boolean;
}

export class ApiError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

function fail(code: string): never {
  throw new ApiError(code);
}

// ---------------------------------------------------------------- helpers

const str = (v: unknown, max: number): string =>
  typeof v === 'string' || typeof v === 'number' ? String(v).trim().slice(0, max) : '';

const PASS_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const ADMIN_SESSION_HOURS = 12;

export function normalizeContact(raw: string): string {
  const v = raw.trim().toLowerCase();
  if (v.includes('@')) {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) fail('INVALID_CONTACT');
    return v;
  }
  const digits = v.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) fail('INVALID_CONTACT');
  return digits;
}

function newPassCode(store: Store, env: Env): string {
  const used = new Set<string>();
  for (const r of store.rsvps.all()) {
    used.add(r.pass_code);
    if (r.plus_one_pass_code) used.add(r.plus_one_pass_code);
  }
  for (;;) {
    let code = '';
    for (let i = 0; i < 6; i++) code += PASS_ALPHABET[env.randomInt(PASS_ALPHABET.length)];
    if (!used.has(code)) return code;
  }
}

const headcount = (r: Pick<RsvpRow, 'attending' | 'plus_one'>) =>
  r.attending === 'no' ? 0 : 1 + (r.plus_one ? 1 : 0);

const confessionKey = (env: Env, token: string) => env.sha256('confession:' + token);

function validToken(token: unknown): token is string {
  return typeof token === 'string' && token.length >= 32 && token.length <= 128;
}

function findByPass(store: Store, rawCode: unknown) {
  const code = str(rawCode, 12).toUpperCase();
  if (!code) return null;
  const r = store.rsvps
    .all()
    .find((x) => x.attending !== 'no' && (x.pass_code === code || x.plus_one_pass_code === code));
  return r ? { rsvp: r, code, isPlusOne: r.plus_one_pass_code === code } : null;
}

// ---------------------------------------------------------------- guest actions

export function submitRsvp(store: Store, env: Env, p: Partial<RsvpPayload>, token: unknown): RsvpResult {
  if (!validToken(token)) fail('INVALID_TOKEN');
  const t = token as string;
  if (!p || typeof p !== 'object') fail('BAD_REQUEST');

  const full_name = str(p.full_name, 100);
  if (!full_name) fail('NAME_REQUIRED');
  const attending = p.attending as RsvpRow['attending'];
  if (!ATTENDING.includes(attending)) fail('ATTENDING_REQUIRED');
  const contact = str(p.contact, 200);
  if (!contact) fail('CONTACT_REQUIRED');
  const contact_normalized = normalizeContact(contact);

  const tokenHash = env.sha256(t);
  const all = store.rsvps.all();
  const existing = all.find((r) => r.token_hash === tokenHash) ?? null;
  if (all.some((r) => r.contact_normalized === contact_normalized && r.id !== existing?.id)) {
    fail('ALREADY_RSVPED');
  }

  const going = attending !== 'no';
  const plus_one = going && p.plus_one === true;
  const plus_one_name = plus_one ? str(p.plus_one_name, 100) : '';
  if (plus_one && !plus_one_name) fail('PLUS_ONE_NAME_REQUIRED');
  const diet = going && DIETS.includes(p.diet as never) ? (p.diet as string) : '';
  const vibe = going && VIBES.includes(p.vibe as never) ? (p.vibe as string) : '';

  // Validate the video before writing anything.
  let video: Omit<VideoRow, 'id' | 'rsvp_id' | 'status' | 'admin_note' | 'created_at'> | null = null;
  if (going && p.video && str(p.video.youtube_id, 11)) {
    const yt = str(p.video.youtube_id, 11);
    if (!YT_ID.test(yt)) fail('INVALID_VIDEO');
    const title = str(p.video.title, 200);
    if (!title) fail('VIDEO_TITLE_REQUIRED');
    const category = (VIDEO_CATEGORIES.includes(p.video.category) ? p.video.category : 'other') as VideoCategory;

    const meta = env.videoMeta(yt);
    let duration: number | null = null;
    let verified = false;
    if (meta && meta.verified) {
      duration = meta.duration_seconds;
      verified = duration !== null;
    } else {
      const claimed = Number(p.video.duration_seconds);
      duration = Number.isFinite(claimed) && claimed > 0 ? Math.round(claimed) : null;
    }
    if (duration !== null && duration >= MAX_VIDEO_SECONDS) fail('VIDEO_TOO_LONG');
    video = {
      youtube_id: yt,
      url: 'https://www.youtube.com/watch?v=' + yt,
      title,
      reason: str(p.video.reason, 500),
      category,
      duration_seconds: duration,
      duration_verified: verified,
    };
  }

  const now = env.now();
  const fields = {
    full_name,
    attending,
    plus_one,
    plus_one_name,
    contact,
    contact_normalized,
    diet,
    diet_other: diet === 'other' ? str(p.diet_other, 200) : '',
    allergies: going ? str(p.allergies, 500) : '',
    vibe,
    updated_at: now,
  };

  let row: RsvpRow;
  if (existing) {
    row = {
      ...existing,
      ...fields,
      plus_one_pass_code: plus_one ? existing.plus_one_pass_code || newPassCode(store, env) : '',
    };
    store.rsvps.update(existing.id, row);
    // A dropped plus one (or a switch to "no") takes their votes with them.
    const goneCodes = [existing.pass_code, existing.plus_one_pass_code].filter(
      (c) => c && (c === existing.plus_one_pass_code ? !row.plus_one_pass_code : !going),
    );
    for (const v of store.votes.all()) if (goneCodes.includes(v.voter_code)) store.votes.remove(v.id);
  } else {
    row = {
      id: env.uuid(),
      token_hash: tokenHash,
      pass_code: newPassCode(store, env),
      plus_one_pass_code: '',
      created_at: now,
      ...fields,
    };
    if (plus_one) row.plus_one_pass_code = newPassCode(store, env);
    store.rsvps.insert(row);
  }

  // Video: one per RSVP. A different video goes back into review.
  const oldVideo = store.videos.all().find((v) => v.rsvp_id === row.id);
  if (!video) {
    if (oldVideo) removeVideo(store, oldVideo.id);
  } else if (oldVideo) {
    const same = oldVideo.youtube_id === video.youtube_id;
    if (!same) for (const v of store.votes.all()) if (v.video_id === oldVideo.id) store.votes.remove(v.id);
    store.videos.update(oldVideo.id, {
      ...video,
      duration_seconds: video.duration_seconds ?? (same ? oldVideo.duration_seconds : null),
      duration_verified: video.duration_verified || (same && oldVideo.duration_verified),
      status: same ? oldVideo.status : 'pending',
    });
  } else {
    store.videos.insert({ ...video, id: env.uuid(), rsvp_id: row.id, status: 'pending', admin_note: '', created_at: now });
  }

  // Song request
  const songTitle = going && p.song ? str(p.song.title, 200) : '';
  const oldSong = store.songs.all().find((s) => s.rsvp_id === row.id);
  if (!songTitle) {
    if (oldSong) store.songs.remove(oldSong.id);
  } else {
    const song = { title: songTitle, artist: str(p.song?.artist, 200) };
    if (oldSong) store.songs.update(oldSong.id, song);
    else store.songs.insert({ id: env.uuid(), rsvp_id: row.id, created_at: now, ...song });
  }

  // Anonymous confession, keyed only by a one-way hash of the guest's private token.
  if (typeof p.confession === 'string') {
    const key = confessionKey(env, t);
    const body = going ? str(p.confession, 1000) : '';
    const old = store.confessions.all().find((c) => c.owner_hash === key);
    if (!body) {
      if (old) store.confessions.remove(old.id);
    } else if (old) {
      store.confessions.update(old.id, { body });
    } else {
      store.confessions.insert({ id: env.uuid(), owner_hash: key, body, is_favourite: false, is_revealed: false, revealed_at: '' });
    }
  }

  return { pass_code: row.pass_code, plus_one_pass_code: row.plus_one_pass_code, attending: row.attending, headcount: headcount(row) };
}

function removeVideo(store: Store, videoId: string) {
  for (const v of store.votes.all()) if (v.video_id === videoId) store.votes.remove(v.id);
  store.videos.remove(videoId);
}

function removeRsvp(store: Store, rsvpId: string) {
  for (const v of store.videos.all()) if (v.rsvp_id === rsvpId) removeVideo(store, v.id);
  for (const s of store.songs.all()) if (s.rsvp_id === rsvpId) store.songs.remove(s.id);
  for (const v of store.votes.all()) if (v.rsvp_id === rsvpId) store.votes.remove(v.id);
  store.rsvps.remove(rsvpId);
}

export function getMyRsvp(store: Store, env: Env, token: unknown): MyRsvp | null {
  if (!validToken(token)) return null;
  const r = store.rsvps.all().find((x) => x.token_hash === env.sha256(token));
  if (!r) return null;
  const v = store.videos.all().find((x) => x.rsvp_id === r.id);
  const s = store.songs.all().find((x) => x.rsvp_id === r.id);
  const c = store.confessions.all().find((x) => x.owner_hash === confessionKey(env, token));
  return {
    full_name: r.full_name,
    attending: r.attending,
    plus_one: r.plus_one,
    plus_one_name: r.plus_one_name,
    contact: r.contact,
    diet: r.diet as MyRsvp['diet'],
    diet_other: r.diet_other,
    allergies: r.allergies,
    vibe: r.vibe as MyRsvp['vibe'],
    video: v
      ? { youtube_id: v.youtube_id, title: v.title, reason: v.reason, category: v.category, duration_seconds: v.duration_seconds }
      : null,
    video_status: v ? v.status : null,
    song: s ? { title: s.title, artist: s.artist } : null,
    confession: c ? c.body : '',
    pass_code: r.pass_code,
    plus_one_pass_code: r.plus_one_pass_code,
    headcount: headcount(r),
  };
}

export function getPublicStats(store: Store) {
  return {
    headcount: store.rsvps.all().filter((r) => r.attending === 'yes').reduce((n, r) => n + headcount(r), 0),
    videos: store.videos.all().length,
  };
}

export function getPartyVideos(store: Store): PartyVideo[] {
  return store.videos
    .all()
    .filter((v) => v.status === 'approved')
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map(({ id, youtube_id, title, reason, category, duration_seconds }) => ({
      id, youtube_id, title, reason, category, duration_seconds,
    }));
}

export function getRevealedConfessions(store: Store) {
  return store.confessions
    .all()
    .filter((c) => c.is_revealed)
    .sort((a, b) => b.revealed_at.localeCompare(a.revealed_at))
    .map(({ id, body, revealed_at }) => ({ id, body, revealed_at }));
}

export function checkPass(store: Store, env: Env, code: unknown): PassInfo {
  if (!env.throttle('pass', 300, 600)) fail('SLOW_DOWN');
  const found = findByPass(store, code);
  if (!found) fail('INVALID_PASS');
  const { rsvp, code: c, isPlusOne } = found!;
  const votes: PassInfo['votes'] = {};
  for (const v of store.votes.all()) if (v.voter_code === c) votes[v.award] = v.video_id;
  return {
    name: isPlusOne ? rsvp.plus_one_name : rsvp.full_name,
    own_video_id: store.videos.all().find((v) => v.rsvp_id === rsvp.id)?.id ?? null,
    votes,
  };
}

export function castVote(store: Store, env: Env, code: unknown, award: unknown, videoId: unknown) {
  if (!store.getSettings().voting_open) fail('VOTING_CLOSED');
  const found = findByPass(store, code);
  if (!found) fail('INVALID_PASS');
  if (!AWARDS.includes(award as Award)) fail('INVALID_AWARD');
  const video = store.videos.all().find((v) => v.id === videoId && v.status === 'approved');
  if (!video) fail('INVALID_VIDEO');
  if (video!.rsvp_id === found!.rsvp.id) fail('OWN_VIDEO');
  if (store.votes.all().some((v) => v.voter_code === found!.code && v.award === award)) fail('ALREADY_VOTED');
  store.votes.insert({
    id: env.uuid(),
    voter_code: found!.code,
    rsvp_id: found!.rsvp.id,
    award: award as Award,
    video_id: video!.id,
    created_at: env.now(),
  });
  return true;
}

export function getResults(store: Store, isAdmin: boolean): ResultRow[] {
  if (!isAdmin && !store.getSettings().results_revealed) fail('RESULTS_HIDDEN');
  const videos = new Map(store.videos.all().map((v) => [v.id, v]));
  const names = new Map(store.rsvps.all().map((r) => [r.id, r.full_name.split(' ')[0]]));
  const counts = new Map<string, ResultRow>();
  for (const vote of store.votes.all()) {
    const v = videos.get(vote.video_id);
    if (!v) continue;
    const key = vote.award + '|' + v.id;
    const row = counts.get(key) ?? {
      award: vote.award, video_id: v.id, youtube_id: v.youtube_id, title: v.title,
      submitter: names.get(v.rsvp_id) ?? '', votes: 0,
    };
    row.votes++;
    counts.set(key, row);
  }
  return [...counts.values()].sort(
    (a, b) => AWARDS.indexOf(a.award) - AWARDS.indexOf(b.award) || b.votes - a.votes || a.title.localeCompare(b.title),
  );
}

// ---------------------------------------------------------------- hosts

export function adminLogin(env: Env, password: unknown): { token: string; expires_at: string } {
  if (!env.throttle('admin-login', 10, 600)) fail('SLOW_DOWN');
  if (typeof password !== 'string' || !env.checkAdminPassword(password)) fail('BAD_PASSWORD');
  const exp = Date.now() + ADMIN_SESSION_HOURS * 3600 * 1000;
  return { token: exp + '.' + env.sign('admin:' + exp), expires_at: new Date(exp).toISOString() };
}

export function isAdminToken(env: Env, token: unknown): boolean {
  if (typeof token !== 'string') return false;
  const [exp, sig] = token.split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return env.sign('admin:' + exp) === sig;
}

function adminRsvps(store: Store): AdminRsvp[] {
  const videos = store.videos.all();
  const songs = store.songs.all();
  return store.rsvps
    .all()
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map(({ token_hash: _t, contact_normalized: _c, ...r }) => {
      const s = songs.find((x) => x.rsvp_id === r.id);
      return {
        ...r,
        headcount: headcount(r),
        video_title: videos.find((v) => v.rsvp_id === r.id)?.title ?? '',
        song: s ? s.title + (s.artist ? ' – ' + s.artist : '') : '',
      };
    });
}

function adminVideos(store: Store): AdminVideo[] {
  const names = new Map(store.rsvps.all().map((r) => [r.id, r.full_name]));
  const votes = store.votes.all();
  return store.videos
    .all()
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((v) => ({ ...v, submitter: names.get(v.rsvp_id) ?? '', votes: votes.filter((x) => x.video_id === v.id).length }));
}

/** Shuffled on every read, so the order never hints at who wrote what. */
function adminConfessions(store: Store, env: Env): AdminConfession[] {
  const list = store.confessions.all().map(({ owner_hash: _o, ...c }) => c);
  for (let i = list.length - 1; i > 0; i--) {
    const j = env.randomInt(i + 1);
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function adminSongs(store: Store): AdminSong[] {
  const names = new Map(store.rsvps.all().map((r) => [r.id, r.full_name]));
  return store.songs.all().map((s) => ({ ...s, requested_by: names.get(s.rsvp_id) ?? '' }));
}

const SETTINGS_KEYS: (keyof EventSettings)[] = [
  'event_name', 'headline', 'subtitle', 'starts_at', 'ends_at', 'venue_name', 'venue_address', 'map_url',
  'dress_code', 'host_names', 'rsvp_deadline', 'extra_note', 'voting_open', 'results_revealed',
];

function cleanSettings(patch: Record<string, unknown>): Partial<EventSettings> {
  const out: Record<string, unknown> = {};
  for (const k of SETTINGS_KEYS) {
    if (!(k in patch)) continue;
    const v = patch[k];
    if (k === 'voting_open' || k === 'results_revealed') out[k] = v === true;
    else out[k] = str(v, 2000);
  }
  return out as Partial<EventSettings>;
}

// ---------------------------------------------------------------- router

const PUBLIC_ACTIONS = [
  'getSettings', 'getPublicStats', 'submitRsvp', 'getMyRsvp', 'videoMeta', 'getPartyVideos',
  'getRevealedConfessions', 'checkPass', 'castVote', 'getResults', 'adminLogin',
] as const;

/** Single entry point for every request. `args` is untrusted JSON from the browser. */
export function handle(store: Store, env: Env, action: string, args: Record<string, unknown> = {}): unknown {
  const admin = isAdminToken(env, args.adminToken);
  if (!(PUBLIC_ACTIONS as readonly string[]).includes(action) && !admin) fail('NOT_ADMIN');

  switch (action) {
    case 'getSettings':
      return store.getSettings();
    case 'getPublicStats':
      return getPublicStats(store);
    case 'submitRsvp':
      return submitRsvp(store, env, args.payload as Partial<RsvpPayload>, args.token);
    case 'getMyRsvp':
      return getMyRsvp(store, env, args.token);
    case 'videoMeta': {
      const id = str(args.id, 11);
      if (!YT_ID.test(id)) fail('INVALID_VIDEO');
      return env.videoMeta(id);
    }
    case 'getPartyVideos':
      return getPartyVideos(store);
    case 'getRevealedConfessions':
      return getRevealedConfessions(store);
    case 'checkPass':
      return checkPass(store, env, args.code);
    case 'castVote':
      return castVote(store, env, args.code, args.award, args.videoId);
    case 'getResults':
      return getResults(store, admin);
    case 'adminLogin':
      return adminLogin(env, args.password);

    // ---- host-only below
    case 'adminCheck':
      return true;
    case 'adminListRsvps':
      return adminRsvps(store);
    case 'adminDeleteRsvp':
      removeRsvp(store, str(args.id, 64));
      return true;
    case 'adminListVideos':
      return adminVideos(store);
    case 'adminUpdateVideo': {
      const patch = (args.patch ?? {}) as Partial<VideoRow>;
      const clean: Partial<VideoRow> = {};
      if (['pending', 'approved', 'flagged'].includes(patch.status as string)) clean.status = patch.status as VideoStatus;
      if ('admin_note' in patch) clean.admin_note = str(patch.admin_note, 500);
      if ('category' in patch && VIDEO_CATEGORIES.includes(patch.category as VideoCategory)) clean.category = patch.category;
      if ('title' in patch && str(patch.title, 200)) clean.title = str(patch.title, 200);
      store.videos.update(str(args.id, 64), clean);
      return true;
    }
    case 'adminRecheckVideo': {
      const v = store.videos.all().find((x) => x.id === args.id);
      if (!v) fail('NOT_FOUND');
      const meta = env.videoMeta(v!.youtube_id);
      if (!meta || !meta.verified || meta.duration_seconds === null) fail('LOOKUP_UNAVAILABLE');
      const patch: Partial<VideoRow> = { duration_seconds: meta!.duration_seconds, duration_verified: true };
      if (meta!.duration_seconds! >= MAX_VIDEO_SECONDS) {
        patch.status = 'flagged';
        patch.admin_note = 'Over 15 minutes';
      }
      store.videos.update(v!.id, patch);
      return { ...v, ...patch };
    }
    case 'adminDeleteVideo':
      removeVideo(store, str(args.id, 64));
      return true;
    case 'adminListConfessions':
      return adminConfessions(store, env);
    case 'adminUpdateConfession': {
      const patch = (args.patch ?? {}) as Partial<ConfessionRow>;
      const clean: Partial<ConfessionRow> = {};
      if ('is_favourite' in patch) clean.is_favourite = patch.is_favourite === true;
      if ('is_revealed' in patch) {
        clean.is_revealed = patch.is_revealed === true;
        clean.revealed_at = clean.is_revealed ? env.now() : '';
      }
      store.confessions.update(str(args.id, 64), clean);
      return true;
    }
    case 'adminDeleteConfession':
      store.confessions.remove(str(args.id, 64));
      return true;
    case 'adminListSongs':
      return adminSongs(store);
    case 'adminUpdateSettings':
      store.saveSettings(cleanSettings((args.patch ?? {}) as Record<string, unknown>));
      return store.getSettings();
    case 'adminResetVotes':
      for (const v of store.votes.all()) store.votes.remove(v.id);
      return true;
    default:
      return fail('UNKNOWN_ACTION');
  }
}
