import { auth } from '../lib/firebase';

export interface AIResponse<T = any> {
  data: T;
  error?: string;
}

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'https://ecadrn-grant-studio-ai.bradley-8b2.workers.dev';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  const token = await user.getIdToken();
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
}

// ── AI Model Status Tracking ──────────────────────────────────────────────────
// Tracks which AI model the worker is using (primary vs fallback) via response headers.
// The UI subscribes to show a status badge and notify when fallback activates.

export interface AIModelInfo {
  model: string;
  isFallback: boolean;
  tier: number;
}

let _aiModelInfo: AIModelInfo | null = null;
const _listeners: Array<(info: AIModelInfo | null) => void> = [];

export function getAIModelInfo(): AIModelInfo | null {
  return _aiModelInfo;
}

export function subscribeToAIModelStatus(cb: (info: AIModelInfo | null) => void): () => void {
  _listeners.push(cb);
  // Immediately push current state to new subscriber
  cb(_aiModelInfo);
  return () => {
    const idx = _listeners.indexOf(cb);
    if (idx >= 0) _listeners.splice(idx, 1);
  };
}

function _notifyAIModelInfo(info: AIModelInfo): boolean {
  const wasFallback = _aiModelInfo?.isFallback ?? false;
  const justEnteredFallback = info.isFallback && !wasFallback;
  const justReturnedToPrimary = !info.isFallback && wasFallback;

  if (justEnteredFallback || justReturnedToPrimary || !_aiModelInfo || _aiModelInfo.model !== info.model) {
    _aiModelInfo = info;
    _listeners.forEach(cb => cb(_aiModelInfo));
  }

  return justEnteredFallback;
}

export { _notifyAIModelInfo as _pushAIModelUpdate };

export async function callAI<T = any>(action: string, data: any): Promise<T> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/ai/${action}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });

  // Capture AI model status from response headers
  const aiModel = response.headers.get('X-AI-Model');
  const aiFallback = response.headers.get('X-AI-Fallback') === 'true';
  const aiTier = parseInt(response.headers.get('X-AI-Tier') || '0', 10);
  if (aiModel) {
    _notifyAIModelInfo({ model: aiModel, isFallback: aiFallback, tier: aiTier });
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'AI request failed');
  }

  return response.json();
}

/**
 * Check the AI model health/status from the worker.
 */
export async function checkAIHealth(): Promise<{
  status: string;
  activeModel: string;
  activeTier: number;
  isFallback: boolean;
  availableModels: Array<{ model: string; label: string }>;
  fallbackState: { activatedAt: string; cooldownMinutes: number; consecutiveFailures: number; failedModel: string; fallbackModel: string } | null;
}> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/ai/health`, { headers });
  if (!response.ok) throw new Error('AI health check failed');
  return response.json();
}

// ── Google Drive Integration ──────────────────────────────────────────────────

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  size?: string;
  webViewLink?: string;
  parents?: string[];
}

export interface DriveFolder {
  id: string;
  name: string;
}

/**
 * List files in the user's Google Drive, optionally filtered by folder or query.
 */
export async function listDriveFiles(params: {
  folderId?: string;
  query?: string;
  pageToken?: string;
  pageSize?: number;
}): Promise<{ files: DriveFile[]; nextPageToken?: string }> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/drive/files`, {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Drive list failed' }));
    throw new Error(err.error || 'Drive list failed');
  }
  return response.json();
}

/**
 * Get the text content of a Google Drive file (Docs, plain text, PDF).
 */
export async function getDriveFileContent(fileId: string): Promise<string> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/drive/file/${fileId}/content`, {
    method: 'GET',
    headers,
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'File read failed' }));
    throw new Error(err.error || 'File read failed');
  }
  const data = await response.json();
  return data.content;
}

/**
 * Export a proposal as a Google Doc to Drive.
 */
export async function exportProposalToDrive(params: {
  title: string;
  funder: string;
  sections: Array<{ title: string; content: string }>;
  budget?: any[];
  folderId?: string;
}): Promise<{ fileId: string; webViewLink: string }> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/drive/export`, {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Export failed' }));
    throw new Error(err.error || 'Export to Drive failed');
  }
  return response.json();
}

/**
 * List folders in Drive (for folder picker).
 */
export async function listDriveFolders(): Promise<DriveFolder[]> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/drive/folders`, {
    method: 'GET',
    headers,
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Folder list failed' }));
    throw new Error(err.error || 'Folder list failed');
  }
  const data = await response.json();
  return data.folders;
}
