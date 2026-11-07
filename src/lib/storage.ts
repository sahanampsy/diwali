// Small, failure-tolerant wrappers around browser storage.

function get(store: () => Storage, key: string): string | null {
  try {
    return store().getItem(key);
  } catch {
    return null;
  }
}
function set(store: () => Storage, key: string, value: string | null) {
  try {
    if (value === null) store().removeItem(key);
    else store().setItem(key, value);
  } catch {
    /* private mode etc. */
  }
}

const local = () => window.localStorage;
const session = () => window.sessionStorage;

export const storage = {
  get: (k: string) => get(local, k),
  set: (k: string, v: string | null) => set(local, k, v),
  getSession: (k: string) => get(session, k),
  setSession: (k: string, v: string | null) => set(session, k, v),
};

const TOKEN_KEY = 'diwali.guestToken';
const SUBMITTED_KEY = 'diwali.submitted';
const PASS_KEY = 'diwali.passCode';

/** The guest's private secret. Only its hash is stored on the server. */
export function guestToken(): string {
  let t = storage.get(TOKEN_KEY);
  if (!t || t.length < 32) {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    t = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    storage.set(TOKEN_KEY, t);
  }
  return t;
}

export const hasSubmitted = () => storage.get(SUBMITTED_KEY) === '1';
export const markSubmitted = () => storage.set(SUBMITTED_KEY, '1');
export const savedPass = () => storage.get(PASS_KEY) ?? '';
export const savePass = (code: string) => storage.set(PASS_KEY, code);
