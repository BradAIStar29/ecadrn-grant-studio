export interface AIResponse<T = any> {
  data: T;
  error?: string;
}

// In production (GitHub Pages), VITE_API_BASE_URL points to the Vercel backend.
// In local dev, it falls back to the local Express server at /api.
const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export async function callAI<T = any>(action: string, data: any): Promise<T> {
  const response = await fetch(`${API_BASE}/api/ai/${action}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'AI request failed');
  }

  return response.json();
}
