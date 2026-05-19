import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';
import { getAuth } from 'firebase/auth';
import { initializeApp, getApps } from 'firebase/app';
import firebaseConfig from '../../firebase-applet-config.json';

// Ensure Firebase is initialized
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);

// Firebase Function URL — set VITE_API_BASE_URL in GitHub repo variables after deploying functions
// e.g. https://us-east1-gen-lang-client-0456143672.cloudfunctions.net
const FUNCTIONS_BASE = import.meta.env.VITE_API_BASE_URL || '';

export interface AIResponse<T = any> {
  data: T;
  error?: string;
}

export async function callAI<T = any>(action: string, data: any): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  const idToken = await user.getIdToken();

  const url = `${FUNCTIONS_BASE}/ai/${action}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'AI request failed');
  }

  return response.json();
}
