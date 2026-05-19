import { auth } from '../lib/firebase';

export interface AIResponse<T = any> {
  data: T;
  error?: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://ecadrn-grant-studio-ai.workers.dev';

export async function callAI<T = any>(action: string, data: any): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  const token = await user.getIdToken();

  const response = await fetch(`${API_BASE_URL}/ai/${action}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'AI request failed');
  }

  return response.json();
}
