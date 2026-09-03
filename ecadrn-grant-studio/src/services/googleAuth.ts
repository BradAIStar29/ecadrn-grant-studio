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
