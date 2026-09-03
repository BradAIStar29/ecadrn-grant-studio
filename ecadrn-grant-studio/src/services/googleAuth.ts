/**
 * Per-user Google account connection for ECADRN Grant Studio.
 *
 * Each user connects their OWN Google account (Firebase Google sign-in popup
 * with Drive + Gmail scopes). The access token lives ONLY in sessionStorage
 * (~55 min) and is forwarded per-request to the Cloudflare Worker — it is
 * never written to Firestore or localStorage.
 *
 * Capabilities unlocked when connected:
 *  - Google Drive: import/export documents (existing feature)
 *  - Gmail send: outreach emails go out from the user's own Gmail
 *  - Gmail inbox: read funder replies received in their Gmail
 */
import { auth } from '../lib/firebase';
import { GoogleAuthProvider, reauthenticateWithPopup, signInWithPopup } from 'firebase/auth';

export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
];

const TOKEN_KEY = 'ecadrn_drive_token';
const TOKEN_EXPIRY_KEY = 'ecadrn_drive_token_expiry';
const EMAIL_KEY = 'ecadrn_google_email';

function saveToken(token: string, email: string) {
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(TOKEN_EXPIRY_KEY, String(Date.now() + 55 * 60 * 1000));
  if (email) sessionStorage.setItem(EMAIL_KEY, email);
  // Notify listeners (e.g. UI connection badges)
  window.dispatchEvent(new CustomEvent('ecadrn-google-auth', { detail: { connected: true, email } }));
}

export function getToken(): string | null {
  const token = sessionStorage.getItem(TOKEN_KEY);
  const expiry = Number(sessionStorage.getItem(TOKEN_EXPIRY_KEY) || 0);
  if (!token || Date.now() > expiry) {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_EXPIRY_KEY);
    return null;
  }
  return token;
}

export function isConnected(): boolean {
  return getToken() !== null;
}

export function getConnectedEmail(): string {
  return sessionStorage.getItem(EMAIL_KEY) || '';
}

export function disconnect() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_EXPIRY_KEY);
  sessionStorage.removeItem(EMAIL_KEY);
  window.dispatchEvent(new CustomEvent('ecadrn-google-auth', { detail: { connected: false } }));
}

/**
 * Connect the current user's Google account. Returns the account email on
 * success. Uses the same @ecadrn.org-restricted popup as the main sign-in.
 */
export async function connectGoogle(): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('You must be signed in to connect Google');

  const provider = new GoogleAuthProvider();
  for (const scope of GOOGLE_SCOPES) provider.addScope(scope);
  provider.setCustomParameters({ prompt: 'select_account', hd: 'ecadrn.org' });

  let credential;
  try {
    const result = await reauthenticateWithPopup(user, provider);
    credential = GoogleAuthProvider.credentialFromResult(result);
  } catch (reAuthErr: any) {
    if (reAuthErr.code === 'auth/popup-closed-by-user') throw new Error('popup-closed');
    const result = await signInWithPopup(auth, provider);
    credential = GoogleAuthProvider.credentialFromResult(result);
  }

  if (credential?.accessToken) {
    const email = user.email || '';
    saveToken(credential.accessToken, email);
    return email;
  }
  throw new Error('Google did not return an access token for this account.');
}

// ── Deadline Alerts via Gmail (per-user prefs, local-only) ─────────────────────
// When enabled and the Google account is connected, the app emails the user's
// own Gmail with urgent grant deadlines (≤7 days). Once-per-day guard is keyed
// per user so shared devices don't cross-contaminate.
const ALERTS_PREFIX = 'ecadrn_deadline_alerts_';

export function isDeadlineAlertsEnabled(uid: string): boolean {
  return localStorage.getItem(ALERTS_PREFIX + uid) === '1';
}

export function setDeadlineAlertsEnabled(uid: string, enabled: boolean) {
  if (enabled) localStorage.setItem(ALERTS_PREFIX + uid, '1');
  else localStorage.removeItem(ALERTS_PREFIX + uid);
}

export function getAlertLastSentDate(uid: string): string {
  return localStorage.getItem(ALERTS_PREFIX + uid + '_last') || '';
}

export function markAlertSentToday(uid: string) {
  localStorage.setItem(ALERTS_PREFIX + uid + '_last', new Date().toISOString().slice(0, 10));
}

/**
 * Collect grants with a deadline within the next `days` days (default 7).
 * Rejects missing/malformed dates and "Rolling"/"Varies" strings safely.
 */
export function collectUrgentGrants(grants: any[], days = 7): any[] {
  const now = Date.now();
  const horizon = now + days * 24 * 60 * 60 * 1000;
  return (Array.isArray(grants) ? grants : [])
    .filter((g: any) => {
      const raw = g?.deadline;
      if (!raw || typeof raw !== 'string') return false;
      const t = new Date(raw).getTime();
      return !isNaN(t) && t >= now && t <= horizon;
    })
    .sort((a: any, b: any) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
}
