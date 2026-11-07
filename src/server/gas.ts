// Google Apps Script entry point. `npm run build:gas` bundles this file and
// core.ts into apps-script/Code.js, which you paste into the Apps Script
// editor attached to your Google Sheet (see README).

import { ApiError, handle, type Env, type Store, type Table } from './core';
import {
  BOOLEAN_SETTINGS, DEFAULT_SETTINGS, MAX_VIDEO_SECONDS,
  type EventSettings, type VideoMeta,
} from './types';

/* eslint-disable @typescript-eslint/no-explicit-any */
declare const SpreadsheetApp: any;
declare const PropertiesService: any;
declare const CacheService: any;
declare const LockService: any;
declare const Utilities: any;
declare const UrlFetchApp: any;
declare const ContentService: any;
declare const YouTube: any;
declare const Logger: any;

type Kind = 'text' | 'bool' | 'num';
interface TableDef {
  sheet: string;
  cols: [string, Kind][];
}

const T = (cols: string): [string, Kind][] =>
  cols.split(' ').map((c) => {
    const [name, kind] = c.split(':');
    return [name, (kind as Kind) || 'text'];
  });

const TABLES: Record<'rsvps' | 'videos' | 'songs' | 'confessions' | 'votes', TableDef> = {
  rsvps: {
    sheet: 'RSVPs',
    cols: T(
      'id full_name attending plus_one:bool plus_one_name contact diet diet_other allergies vibe pass_code plus_one_pass_code created_at updated_at contact_normalized token_hash',
    ),
  },
  videos: {
    sheet: 'Videos',
    cols: T('id rsvp_id youtube_id url title reason category duration_seconds:num duration_verified:bool status admin_note created_at'),
  },
  songs: { sheet: 'Songs', cols: T('id rsvp_id title artist created_at') },
  confessions: { sheet: 'Confessions', cols: T('id body is_favourite:bool is_revealed:bool revealed_at owner_hash') },
  votes: { sheet: 'Votes', cols: T('id voter_code rsvp_id award video_id created_at') },
};
const SETTINGS_SHEET = 'Settings';

const WRITE_ACTIONS = new Set([
  'submitRsvp', 'castVote', 'adminDeleteRsvp', 'adminUpdateVideo', 'adminRecheckVideo', 'adminDeleteVideo',
  'adminUpdateConfession', 'adminDeleteConfession', 'adminUpdateSettings', 'adminResetVotes',
]);

// ---------------------------------------------------------------- sheet storage

function spreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

/** Stop text such as "=IMPORTXML(...)" or "+44..." from being read as a formula. */
function toCell(v: unknown): unknown {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string' && /^[=+\-@]/.test(v)) return "'" + v;
  return v;
}

function fromCell(v: unknown, kind: Kind): unknown {
  if (kind === 'bool') return v === true || String(v).toUpperCase() === 'TRUE';
  if (kind === 'num') return v === '' || v === null ? null : Number(v);
  if (v instanceof Date) return v.toISOString();
  return v === null || v === undefined ? '' : String(v);
}

class SheetTable<R extends { id: string }> implements Table<R> {
  private rows: R[] | null = null;
  constructor(private def: TableDef, private randomInsert = false) {}

  private sheet() {
    return spreadsheet().getSheetByName(this.def.sheet);
  }

  all(): R[] {
    if (!this.rows) {
      const sh = this.sheet();
      const last = sh.getLastRow();
      const values: unknown[][] = last < 2 ? [] : sh.getRange(2, 1, last - 1, this.def.cols.length).getValues();
      this.rows = values
        .filter((row) => row[0] !== '')
        .map((row) => {
          const o: Record<string, unknown> = {};
          this.def.cols.forEach(([name, kind], i) => (o[name] = fromCell(row[i], kind)));
          return o as R;
        });
    }
    return this.rows.slice();
  }

  private rowNumber(id: string): number {
    const sh = this.sheet();
    const last = sh.getLastRow();
    if (last < 2) return -1;
    const ids: unknown[][] = sh.getRange(2, 1, last - 1, 1).getValues();
    const i = ids.findIndex((r) => r[0] === id);
    return i < 0 ? -1 : i + 2;
  }

  private toRow(r: R): unknown[] {
    return this.def.cols.map(([name]) => toCell((r as Record<string, unknown>)[name]));
  }

  insert(row: R) {
    const sh = this.sheet();
    const last = Math.max(sh.getLastRow(), 1);
    let at = last + 1;
    if (this.randomInsert && last > 1) {
      // Confessions land at a random position so row order reveals nothing.
      const after = 1 + Math.floor(Math.random() * last);
      sh.insertRowAfter(after);
      at = after + 1;
    }
    sh.getRange(at, 1, 1, this.def.cols.length).setValues([this.toRow(row)]);
    this.rows = null;
  }

  update(id: string, patch: Partial<R>) {
    const n = this.rowNumber(id);
    if (n < 0) throw new ApiError('NOT_FOUND');
    const current = this.all().find((r) => r.id === id)!;
    const next = { ...current, ...patch, id };
    this.sheet().getRange(n, 1, 1, this.def.cols.length).setValues([this.toRow(next)]);
    this.rows = null;
  }

  remove(id: string) {
    const n = this.rowNumber(id);
    if (n > 0) this.sheet().deleteRow(n);
    this.rows = null;
  }
}

function readSettings(): EventSettings {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('settings');
  if (hit) return JSON.parse(hit);
  const sh = spreadsheet().getSheetByName(SETTINGS_SHEET);
  const values: unknown[][] = sh.getLastRow() < 2 ? [] : sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues();
  const out: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const [k, v] of values) {
    const key = String(k);
    if (!(key in DEFAULT_SETTINGS)) continue;
    if (BOOLEAN_SETTINGS.includes(key as keyof EventSettings)) out[key] = v === true || String(v).toUpperCase() === 'TRUE';
    else out[key] = v instanceof Date ? v.toISOString() : String(v ?? '');
  }
  cache.put('settings', JSON.stringify(out), 30);
  return out as unknown as EventSettings;
}

function writeSettings(patch: Partial<EventSettings>) {
  const sh = spreadsheet().getSheetByName(SETTINGS_SHEET);
  const last = sh.getLastRow();
  const keys: unknown[][] = last < 2 ? [] : sh.getRange(2, 1, last - 1, 1).getValues();
  for (const [k, v] of Object.entries(patch)) {
    const i = keys.findIndex((r) => r[0] === k);
    const cell = typeof v === 'boolean' ? v : toCell(v);
    if (i >= 0) sh.getRange(i + 2, 2).setValue(cell);
    else sh.appendRow([k, cell]);
  }
  CacheService.getScriptCache().remove('settings');
}

function makeStore(): Store {
  return {
    rsvps: new SheetTable(TABLES.rsvps),
    videos: new SheetTable(TABLES.videos),
    songs: new SheetTable(TABLES.songs),
    confessions: new SheetTable(TABLES.confessions, true),
    votes: new SheetTable(TABLES.votes),
    getSettings: readSettings,
    saveSettings: writeSettings,
  };
}

// ---------------------------------------------------------------- environment

function prop(name: string): string | null {
  return PropertiesService.getScriptProperties().getProperty(name);
}

function hex(bytes: number[]): string {
  return bytes.map((b) => ((b + 256) % 256).toString(16).padStart(2, '0')).join('');
}

function parseIsoDuration(iso: string): number | null {
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(iso || '');
  if (!m) return null;
  const [d, h, min, s] = m.slice(1).map((x) => Number(x || 0));
  return d * 86400 + h * 3600 + min * 60 + s;
}

function lookupVideo(id: string): VideoMeta {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('yt:' + id);
  if (hit) return JSON.parse(hit);

  let meta: VideoMeta | null = null;
  // 1) YouTube Data API through the Apps Script advanced service: exact duration.
  try {
    if (typeof YouTube !== 'undefined') {
      const res = YouTube.Videos.list('snippet,contentDetails', { id });
      const item = res.items && res.items[0];
      meta = item
        ? {
            title: item.snippet.title,
            channel: item.snippet.channelTitle,
            duration_seconds: parseIsoDuration(item.contentDetails.duration),
            verified: true,
          }
        : { title: null, channel: null, duration_seconds: null, verified: false };
    }
  } catch (err) {
    Logger.log('YouTube advanced service failed: ' + err);
  }
  // 2) oEmbed: title only, hosts confirm the length themselves.
  if (!meta) {
    const res = UrlFetchApp.fetch(
      'https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + id),
      { muteHttpExceptions: true },
    );
    if (res.getResponseCode() === 200) {
      const o = JSON.parse(res.getContentText());
      meta = { title: o.title ?? null, channel: o.author_name ?? null, duration_seconds: null, verified: false };
    } else {
      meta = { title: null, channel: null, duration_seconds: null, verified: false };
    }
  }
  cache.put('yt:' + id, JSON.stringify(meta), 21600);
  return meta;
}

const env: Env = {
  sha256: (s) => hex(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8)),
  randomInt: (max) => parseInt(Utilities.getUuid().replace(/-/g, '').slice(0, 12), 16) % max,
  uuid: () => Utilities.getUuid(),
  now: () => new Date().toISOString(),
  videoMeta: lookupVideo,
  checkAdminPassword(pw) {
    const real = prop('ADMIN_PASSWORD');
    if (!real) throw new ApiError('ADMIN_NOT_CONFIGURED');
    return pw === real;
  },
  sign(data) {
    const key = (prop('TOKEN_SECRET') || '') + (prop('ADMIN_PASSWORD') || '');
    return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(data, key)).replace(/=+$/, '');
  },
  throttle(key, limit, windowSec) {
    const cache = CacheService.getScriptCache();
    const n = Number(cache.get('rl:' + key) || 0) + 1;
    cache.put('rl:' + key, String(n), windowSec);
    return n <= limit;
  },
};

// ---------------------------------------------------------------- web app

function respond(body: unknown) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
}

export function doPost(e: any) {
  let lock: any = null;
  try {
    const req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const action = String(req.action || '');
    if (WRITE_ACTIONS.has(action)) {
      lock = LockService.getScriptLock();
      lock.waitLock(25000);
    }
    const data = handle(makeStore(), env, action, req.args || {});
    return respond({ ok: true, data });
  } catch (err) {
    if (err instanceof ApiError) return respond({ ok: false, error: err.code });
    Logger.log(err && (err as Error).stack ? (err as Error).stack : String(err));
    return respond({ ok: false, error: 'SERVER_ERROR' });
  } finally {
    if (lock) lock.releaseLock();
  }
}

export function doGet() {
  return respond({ ok: true, data: 'Diwali RSVP API is running. Settings sheet: ' + SETTINGS_SHEET });
}

/** Run once from the Apps Script editor: creates the tabs and default settings. */
export function setup() {
  const ss = spreadsheet();
  for (const def of Object.values(TABLES)) {
    let sh = ss.getSheetByName(def.sheet);
    if (!sh) sh = ss.insertSheet(def.sheet);
    const headers = def.cols.map(([n]) => n);
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#2a0f3a').setFontColor('#ffd27a');
    sh.setFrozenRows(1);
    // Keep pass codes, phone numbers and ids as plain text.
    sh.getRange(1, 1, sh.getMaxRows(), headers.length).setNumberFormat('@');
  }

  let st = ss.getSheetByName(SETTINGS_SHEET);
  if (!st) st = ss.insertSheet(SETTINGS_SHEET, 0);
  st.getRange(1, 1, 1, 2).setValues([['key', 'value']]).setFontWeight('bold').setBackground('#2a0f3a').setFontColor('#ffd27a');
  st.setFrozenRows(1);
  st.getRange(1, 1, st.getMaxRows(), 2).setNumberFormat('@');
  const existing: unknown[][] = st.getLastRow() < 2 ? [] : st.getRange(2, 1, st.getLastRow() - 1, 1).getValues();
  const have = new Set(existing.map((r) => r[0]));
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) if (!have.has(k)) st.appendRow([k, toCell(v)]);
  st.autoResizeColumns(1, 2);

  const blank = ss.getSheetByName('Sheet1');
  if (blank && blank.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(blank);

  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('TOKEN_SECRET')) props.setProperty('TOKEN_SECRET', Utilities.getUuid() + Utilities.getUuid());
  CacheService.getScriptCache().remove('settings');

  const msg = props.getProperty('ADMIN_PASSWORD')
    ? 'Setup complete. Now deploy as a web app (Deploy → New deployment).'
    : 'Setup complete. IMPORTANT: add a Script Property named ADMIN_PASSWORD (Project Settings → Script properties) before deploying.';
  Logger.log(msg + ' Max video length: ' + MAX_VIDEO_SECONDS / 60 + ' minutes.');
  return msg;
}
