import { auth } from '../lib/firebase';

export interface AIResponse<T = any> {
  data: T;
  error?: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://ecadrn-grant-studio-ai.workers.dev';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  const token = await user.getIdToken();
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
}

export async function callAI<T = any>(action: string, data: any): Promise<T> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/ai/${action}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'AI request failed');
  }

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
