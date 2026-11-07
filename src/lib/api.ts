import { ApiError as CoreError } from '../server/core';
import type {
  AdminRsvp, AdminSong, AdminVideo, ApiResponse, Award, EventSettings, MyRsvp,
  PartyVideo, PassInfo, ResultRow, RsvpPayload, RsvpResult, VideoMeta, VideoRow,
} from '../server/types';
import { storage } from './storage';

const API_URL = (import.meta.env.VITE_SHEETS_API_URL as string | undefined)?.trim() || '';
export const MODE: 'sheets' | 'demo' = API_URL ? 'sheets' : 'demo';

export class ApiError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

const MESSAGES: Record<string, string> = {
  NAME_REQUIRED: 'We need your name for the guest list.',
  ATTENDING_REQUIRED: 'Let us know if you’re coming.',
  CONTACT_REQUIRED: 'Add an email or phone number so we can reach you.',
  INVALID_CONTACT: 'That doesn’t look like a valid email or phone number.',
  PLUS_ONE_NAME_REQUIRED: 'Who’s your plus one? We need a name.',
  ALREADY_RSVPED: 'Someone has already RSVP’d with that email or phone. If it was you on another device, message the hosts and they’ll sort it.',
  INVALID_VIDEO: 'That doesn’t look like a valid YouTube video.',
  VIDEO_TITLE_REQUIRED: 'Give your video a title.',
  VIDEO_TOO_LONG: 'That video is 15 minutes or longer. Pick something shorter. Attention spans are a festive tradition.',
  INVALID_TOKEN: 'Something went wrong with your browser session. Refresh and try again.',
  INVALID_PASS: 'We couldn’t find that party pass. Check the code on your RSVP confirmation.',
  VOTING_CLOSED: 'Voting isn’t open right now.',
  OWN_VIDEO: 'Nice try. You can’t vote for your own video.',
  ALREADY_VOTED: 'You’ve already locked in a vote for this award.',
  RESULTS_HIDDEN: 'The results are still under wraps.',
  BAD_PASSWORD: 'That password isn’t right.',
  NOT_ADMIN: 'Your host session has expired. Please sign in again.',
  ADMIN_NOT_CONFIGURED: 'No host password is set yet. Add ADMIN_PASSWORD in Apps Script → Project Settings → Script properties.',
  SLOW_DOWN: 'Too many attempts. Take a breath and try again in a few minutes.',
  LOOKUP_UNAVAILABLE: 'Couldn’t check this video’s length automatically. Enable the YouTube advanced service in Apps Script, or check it by hand.',
  NETWORK: 'We couldn’t reach the server. Check your connection and try again.',
  SERVER_ERROR: 'The server hit a snag. Try again in a moment.',
};

export function errorMessage(err: unknown): string {
  const code = err instanceof ApiError || err instanceof CoreError ? err.code : 'SERVER_ERROR';
  return MESSAGES[code] ?? 'Something went wrong. Please try again.';
}
export const errorCode = (err: unknown) => (err instanceof ApiError || err instanceof CoreError ? err.code : '');

const ADMIN_KEY = 'diwali.adminToken';
export const adminToken = () => storage.getSession(ADMIN_KEY);

async function call<T>(action: string, args: Record<string, unknown> = {}): Promise<T> {
  const token = adminToken();
  const full = token ? { ...args, adminToken: token } : args;
  if (MODE === 'demo') {
    const { demoCall } = await import('./demoBackend');
    try {
      return (await demoCall(action, full)) as T;
    } catch (e) {
      if (e instanceof CoreError) throw new ApiError(e.code);
      throw e;
    }
  }
  let json: ApiResponse<T>;
  try {
    // text/plain keeps this a "simple" request, so Apps Script needs no CORS preflight.
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, args: full }),
      redirect: 'follow',
    });
    json = await res.json();
  } catch {
    throw new ApiError('NETWORK');
  }
  if (!json.ok) {
    if (json.error === 'NOT_ADMIN') storage.setSession(ADMIN_KEY, null);
    throw new ApiError(json.error ?? 'SERVER_ERROR');
  }
  return json.data as T;
}

/** Title and (when the backend can) duration for a YouTube video. */
async function videoMeta(id: string): Promise<VideoMeta | null> {
  if (MODE === 'sheets') {
    try {
      const meta = await call<VideoMeta | null>('videoMeta', { id });
      if (meta) return meta;
    } catch {
      /* fall through to public lookup */
    }
  }
  try {
    const res = await fetch('https://noembed.com/embed?url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + id));
    const o = await res.json();
    if (o.error) return { title: null, channel: null, duration_seconds: null, verified: false };
    return { title: o.title ?? null, channel: o.author_name ?? null, duration_seconds: null, verified: false };
  } catch {
    return null;
  }
}

export const api = {
  getSettings: () => call<EventSettings>('getSettings'),
  getPublicStats: () => call<{ headcount: number; videos: number }>('getPublicStats'),
  submitRsvp: (payload: RsvpPayload, token: string) => call<RsvpResult>('submitRsvp', { payload, token }),
  getMyRsvp: (token: string) => call<MyRsvp | null>('getMyRsvp', { token }),
  videoMeta,
  getPartyVideos: () => call<PartyVideo[]>('getPartyVideos'),
  checkPass: (code: string) => call<PassInfo>('checkPass', { code }),
  castVote: (code: string, award: Award, videoId: string) => call<true>('castVote', { code, award, videoId }),
  getResults: () => call<ResultRow[]>('getResults'),

  admin: {
    isSignedIn: () => !!adminToken(),
    async signIn(password: string) {
      const res = await call<{ token: string }>('adminLogin', { password });
      storage.setSession(ADMIN_KEY, res.token);
    },
    signOut: () => storage.setSession(ADMIN_KEY, null),
    check: () => call<true>('adminCheck'),
    listRsvps: () => call<AdminRsvp[]>('adminListRsvps'),
    deleteRsvp: (id: string) => call<true>('adminDeleteRsvp', { id }),
    listVideos: () => call<AdminVideo[]>('adminListVideos'),
    updateVideo: (id: string, patch: Partial<Pick<VideoRow, 'status' | 'admin_note' | 'category' | 'title'>>) =>
      call<true>('adminUpdateVideo', { id, patch }),
    recheckVideo: (id: string) => call<VideoRow>('adminRecheckVideo', { id }),
    deleteVideo: (id: string) => call<true>('adminDeleteVideo', { id }),
    listSongs: () => call<AdminSong[]>('adminListSongs'),
    updateSettings: (patch: Partial<EventSettings>) => call<EventSettings>('adminUpdateSettings', { patch }),
    resetVotes: () => call<true>('adminResetVotes'),
  },
};
