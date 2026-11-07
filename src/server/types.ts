// Types shared by the browser app and the Google Apps Script backend.

export type Attending = 'yes' | 'no' | 'maybe';
export type Diet = 'vegetarian' | 'vegan' | 'jain' | 'non_vegetarian' | 'other';
export type VideoCategory = 'funniest' | 'mind_blowing' | 'wholesome' | 'wtf' | 'hidden_gem' | 'other';
export type LookingForward = 'cats' | 'board_games' | 'cocktails' | 'watch_party' | 'everything';
/** One award: the best video of the night. */
export type Award = 'best';
export type VideoStatus = 'pending' | 'approved' | 'flagged';

export const ATTENDING: Attending[] = ['yes', 'no', 'maybe'];
export const DIETS: Diet[] = ['vegetarian', 'vegan', 'jain', 'non_vegetarian', 'other'];
export const VIDEO_CATEGORIES: VideoCategory[] = ['funniest', 'mind_blowing', 'wholesome', 'wtf', 'hidden_gem', 'other'];
export const LOOKING_FORWARD: LookingForward[] = ['cats', 'board_games', 'cocktails', 'watch_party', 'everything'];
export const AWARDS: Award[] = ['best'];
export const MAX_VIDEO_SECONDS = 15 * 60;

export interface EventSettings {
  event_name: string;
  headline: string;
  subtitle: string;
  starts_at: string; // ISO date-time
  ends_at: string;
  venue_name: string;
  venue_address: string;
  map_url: string;
  dress_code: string;
  host_names: string;
  rsvp_deadline: string;
  extra_note: string;
  voting_open: boolean;
  results_revealed: boolean;
}

export const DEFAULT_SETTINGS: EventSettings = {
  event_name: 'Diwali at Ours',
  headline: "LET'S GET LIT. IT'S DIWALI!",
  subtitle: 'An evening of lights, laughter, questionable decisions and excellent company.',
  starts_at: '2026-11-08T18:00:00+05:30', // Sunday 8 Nov, 6 pm IST
  ends_at: '',
  venue_name: 'Sagar Villa',
  venue_address: 'Kaggadasapura, Bengaluru',
  map_url: 'https://share.google/cUxpigm9KldLJL765',
  dress_code: 'Kurtas, sarees, sequins, sparkle',
  host_names: 'The Hosts',
  rsvp_deadline: '',
  extra_note: '',
  voting_open: false,
  results_revealed: false,
};

export const BOOLEAN_SETTINGS: (keyof EventSettings)[] = ['voting_open', 'results_revealed'];

export interface VideoInput {
  youtube_id: string;
  title: string;
  reason: string;
  category: VideoCategory;
  duration_seconds: number | null;
}

export interface RsvpPayload {
  full_name: string;
  attending: Attending;
  plus_one: boolean;
  plus_one_name: string;
  contact: string;
  diet: Diet | '';
  diet_other: string;
  allergies: string;
  looking_forward: LookingForward[];
  video: VideoInput | null;
}

export interface RsvpResult {
  pass_code: string;
  plus_one_pass_code: string;
  attending: Attending;
  headcount: number;
}

export type MyRsvp = RsvpPayload & RsvpResult & { video_status: VideoStatus | null };

export interface VideoMeta {
  /** true = YouTube confirmed it exists, false = YouTube says no such video, null = couldn't tell */
  exists: boolean | null;
  title: string | null;
  channel: string | null;
  duration_seconds: number | null;
  verified: boolean;
}

export interface PartyVideo {
  id: string;
  youtube_id: string;
  title: string;
  reason: string;
  category: VideoCategory;
  duration_seconds: number | null;
}

export interface PassInfo {
  name: string;
  own_video_id: string | null;
  votes: Partial<Record<Award, string>>;
}

export interface ResultRow {
  award: Award;
  video_id: string;
  youtube_id: string;
  title: string;
  submitter: string;
  votes: number;
}

// ---- Stored rows ----

export interface RsvpRow {
  id: string;
  token_hash: string;
  pass_code: string;
  plus_one_pass_code: string;
  full_name: string;
  attending: Attending;
  plus_one: boolean;
  plus_one_name: string;
  contact: string;
  contact_normalized: string;
  diet: string;
  diet_other: string;
  allergies: string;
  /** Comma-separated LookingForward values. */
  looking_forward: string;
  created_at: string;
  updated_at: string;
}

export interface VideoRow {
  id: string;
  rsvp_id: string;
  youtube_id: string;
  url: string;
  title: string;
  reason: string;
  category: VideoCategory;
  duration_seconds: number | null;
  duration_verified: boolean;
  status: VideoStatus;
  admin_note: string;
  created_at: string;
}

export interface VoteRow {
  id: string;
  voter_code: string;
  rsvp_id: string;
  award: Award;
  video_id: string;
  created_at: string;
}

// ---- Admin views ----

export interface AdminRsvp extends Omit<RsvpRow, 'token_hash' | 'contact_normalized' | 'looking_forward'> {
  looking_forward: LookingForward[];
  headcount: number;
  video_title: string;
}

export interface AdminVideo extends VideoRow {
  submitter: string;
  votes: number;
}

export interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
  detail?: string;
}

/**
 * Placeholder values written by earlier versions of this script. If a Sheet
 * still has them, they're swapped for the real party details in DEFAULT_SETTINGS.
 */
const OLD_PLACEHOLDERS: Partial<Record<keyof EventSettings, string[]>> = {
  venue_name: ['Our Place', 'Our place'],
  venue_address: ['123 Lantern Lane, Your City', 'Tap for directions'],
  starts_at: ['2026-11-14T19:00:00+00:00', '2026-11-14T19:00:00.000Z', '2026-11-14T19:00:00+05:30', '2026-11-08T18:00:00'],
  dress_code: ['Festive glam — kurtas, sarees, sequins, sparkle', 'Festive glam: kurtas, sarees, sequins, sparkle'],
};

export function replacePlaceholders(out: Record<string, unknown>): Partial<EventSettings> {
  const fixes: Record<string, unknown> = {};
  const venueWasPlaceholder = OLD_PLACEHOLDERS.venue_address!.includes(String(out.venue_address));
  for (const [key, olds] of Object.entries(OLD_PLACEHOLDERS)) {
    if (olds!.includes(String(out[key]))) fixes[key] = (DEFAULT_SETTINGS as unknown as Record<string, unknown>)[key];
  }
  if (venueWasPlaceholder && !out.map_url) fixes.map_url = DEFAULT_SETTINGS.map_url;
  Object.assign(out, fixes);
  return fixes as Partial<EventSettings>;
}
