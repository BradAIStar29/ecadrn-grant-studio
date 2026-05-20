/**
 * Google Drive integration panel for ECADRN Grant Studio.
 * - Browse & import documents from Drive into the app
 * - Export proposals back to Drive as Google Docs
 * - Auto-sync a grants folder
 */
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  HardDrive, FolderOpen, FileText, RefreshCw, Upload,
  Download, X, Check, Search, AlertCircle, Loader, ExternalLink,
  ChevronRight, Folder, Settings
} from 'lucide-react';
import { auth } from '../lib/firebase';
import { GoogleAuthProvider, getAuth, linkWithPopup, reauthenticateWithPopup } from 'firebase/auth';

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://ecadrn-grant-studio-ai.workers.dev';

// ── Get Drive OAuth token ────────────────────────────────────────────────────
async function getDriveToken(): Promise<string | null> {
  try {
    const user = auth.currentUser;
    if (!user) return null;
    // Check if the user has a Google credential with Drive scope
    const provider = new GoogleAuthProvider();
    provider.addScope(DRIVE_SCOPE);
    // Try to get fresh token via silent re-auth
    const result = await reauthenticateWithPopup(user, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    return credential?.accessToken || null;
  } catch {
    return null;
  }
}

// ── Types ────────────────────────────────────────────────────────────────────
interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  webViewLink?: string;
}

interface DriveFolder {
  id: string;
  name: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  mode: 'import' | 'export' | 'sync';
  // For export mode
  proposalToExport?: {
    title: string;
    funder: string;
    sections: Array<{ title: string; content: string }>;
    budget?: any[];
  };
  // Called when user selects a file to import
  onImport?: (content: string, fileName: string) => void;
  // For sync: auto-refresh folder ID stored in localStorage
}

export default function GoogleDrivePanel({ isOpen, onClose, mode, proposalToExport, onImport }: Props) {
  const [driveToken, setDriveToken] = useState<string | null>(null);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedFile, setSelectedFile] = useState<DriveFile | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportFolderId, setExportFolderId] = useState('');
  const [syncFolderId, setSyncFolderId] = useState(() => localStorage.getItem('ecadrn_sync_folder') || '');
  const [syncFolderName, setSyncFolderName] = useState(() => localStorage.getItem('ecadrn_sync_folder_name') || '');
  const [lastSynced, setLastSynced] = useState(() => localStorage.getItem('ecadrn_last_synced') || '');

  const authorizeWithDrive = async () => {
    setIsAuthorizing(true);
    setError('');
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not logged in');
      const provider = new GoogleAuthProvider();
      provider.addScope(DRIVE_SCOPE);
      const result = await reauthenticateWithPopup(user, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setDriveToken(credential.accessToken);
        sessionStorage.setItem('drive_token', credential.accessToken);
      } else {
        throw new Error('No access token returned');
      }
    } catch (e: any) {
      if (e.code !== 'auth/popup-closed-by-user') {
        setError('Drive authorization failed: ' + e.message);
      }
    } finally {
      setIsAuthorizing(false);
    }
  };

  // Try to restore token from session
  useEffect(() => {
    const saved = sessionStorage.getItem('drive_token');
    if (saved) setDriveToken(saved);
  }, []);

  const authFetch = useCallback(async (path: string, options: RequestInit = {}) => {
    const firebaseToken = await auth.currentUser?.getIdToken();
    return fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${firebaseToken}`,
        'X-Drive-Token': driveToken || '',
        ...((options.headers as Record<string, string>) || {}),
      },
    });
  }, [driveToken]);

  const loadFiles = useCallback(async () => {
    if (!driveToken) return;
    setIsLoading(true);
    setError('');
    try {
      const res = await authFetch('/drive/files', {
        method: 'POST',
        body: JSON.stringify({
          folderId: selectedFolder || undefined,
          query: searchQuery || undefined,
        }),
      });
      if (!res.ok) throw new Error('Failed to load files');
      const data = await res.json();
      setFiles(data.files || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  }, [driveToken, selectedFolder, searchQuery, authFetch]);

  const loadFolders = useCallback(async () => {
    if (!driveToken) return;
    try {
      const res = await authFetch('/drive/folders', { method: 'GET' });
      if (!res.ok) return;
      const data = await res.json();
      setFolders(data.folders || []);
    } catch {}
  }, [driveToken, authFetch]);

  useEffect(() => {
    if (driveToken && isOpen) {
      loadFiles();
      loadFolders();
    }
  }, [driveToken, isOpen, loadFiles, loadFolders]);

  const importFile = async (file: DriveFile) => {
    setIsImporting(true);
    setError('');
    try {
      const firebaseToken = await auth.currentUser?.getIdToken();
      const res = await fetch(`${API_BASE}/drive/file/${file.id}/content`, {
        headers: {
          Authorization: `Bearer ${firebaseToken}`,
          'X-Drive-Token': driveToken || '',
        },
      });
      if (!res.ok) throw new Error('Failed to read file');
      const data = await res.json();
      onImport?.(data.content, file.name);
      setSuccess(`"${file.name}" imported successfully!`);
      setTimeout(() => { setSuccess(''); onClose(); }, 2000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsImporting(false);
    }
  };

  const exportToDrive = async () => {
    if (!proposalToExport) return;
    setIsExporting(true);
    setError('');
    try {
      const res = await authFetch('/drive/export', {
        method: 'POST',
        body: JSON.stringify({
          ...proposalToExport,
          folderId: exportFolderId || undefined,
        }),
      });
      if (!res.ok) throw new Error('Export failed');
      const data = await res.json();
      setSuccess('Exported to Drive!');
      if (data.webViewLink) {
        setTimeout(() => window.open(data.webViewLink, '_blank'), 500);
      }
      setTimeout(() => { setSuccess(''); onClose(); }, 3000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsExporting(false);
    }
  };

  const saveSyncFolder = (folderId: string, folderName: string) => {
    setSyncFolderId(folderId);
    setSyncFolderName(folderName);
    localStorage.setItem('ecadrn_sync_folder', folderId);
    localStorage.setItem('ecadrn_sync_folder_name', folderName);
    setSuccess(`Sync folder set to "${folderName}"`);
    setTimeout(() => setSuccess(''), 3000);
  };

  const syncNow = async () => {
    if (!syncFolderId) return;
    setSelectedFolder(syncFolderId);
    await loadFiles();
    const now = new Date().toLocaleString();
    setLastSynced(now);
    localStorage.setItem('ecadrn_last_synced', now);
    setSuccess('Sync complete!');
    setTimeout(() => setSuccess(''), 3000);
  };

  const mimeIcon = (mimeType: string) => {
    if (mimeType.includes('document')) return '📄';
    if (mimeType.includes('spreadsheet')) return '📊';
    if (mimeType.includes('pdf')) return '📕';
    return '📄';
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                  <HardDrive className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    {mode === 'import' && 'Import from Google Drive'}
                    {mode === 'export' && 'Export to Google Drive'}
                    {mode === 'sync' && 'Sync Grants Folder'}
                  </h2>
                  <p className="text-xs text-slate-500">ECADRN Drive Integration</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Status messages */}
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-xl text-sm">
                  <AlertCircle size={16} /> {error}
                </div>
              )}
              {success && (
                <div className="flex items-center gap-2 p-3 bg-green-50 text-green-700 rounded-xl text-sm">
                  <Check size={16} /> {success}
                </div>
              )}

              {/* Auth step */}
              {!driveToken ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <HardDrive className="w-8 h-8 text-blue-500" />
                  </div>
                  <h3 className="font-semibold text-slate-900 mb-2">Connect Google Drive</h3>
                  <p className="text-sm text-slate-500 mb-6 max-w-sm mx-auto">
                    Authorize access to your ECADRN Google Drive to import documents and export proposals.
                  </p>
                  <button
                    onClick={authorizeWithDrive}
                    disabled={isAuthorizing}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isAuthorizing ? <Loader size={16} className="animate-spin" /> : <HardDrive size={16} />}
                    {isAuthorizing ? 'Connecting...' : 'Connect Google Drive'}
                  </button>
                </div>
              ) : (
                <>
                  {/* ── IMPORT MODE ── */}
                  {mode === 'import' && (
                    <div className="space-y-4">
                      {/* Search + folder filter */}
                      <div className="flex gap-2">
                        <div className="flex-1 relative">
                          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                          <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && loadFiles()}
                            placeholder="Search your Drive..."
                            className="w-full pl-9 pr-4 py-2 bg-slate-50 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </div>
                        <select
                          value={selectedFolder}
                          onChange={e => setSelectedFolder(e.target.value)}
                          className="px-3 py-2 bg-slate-50 rounded-xl text-sm border-none outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">All folders</option>
                          {folders.map(f => (
                            <option key={f.id} value={f.id}>{f.name}</option>
                          ))}
                        </select>
                        <button
                          onClick={loadFiles}
                          className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl"
                        >
                          <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                        </button>
                      </div>

                      {/* File list */}
                      {isLoading ? (
                        <div className="flex items-center justify-center py-10">
                          <Loader size={24} className="animate-spin text-blue-500" />
                        </div>
                      ) : files.length === 0 ? (
                        <div className="text-center py-10 text-slate-400 text-sm">
                          No documents found. Try a different search or folder.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {files.map(file => (
                            <div
                              key={file.id}
                              onClick={() => setSelectedFile(file)}
                              className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer border transition-all ${
                                selectedFile?.id === file.id
                                  ? 'border-blue-500 bg-blue-50'
                                  : 'border-slate-100 hover:border-slate-300 hover:bg-slate-50'
                              }`}
                            >
                              <span className="text-xl">{mimeIcon(file.mimeType)}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-900 truncate">{file.name}</p>
                                <p className="text-xs text-slate-400">
                                  Modified {new Date(file.modifiedTime).toLocaleDateString()}
                                </p>
                              </div>
                              {file.webViewLink && (
                                <a
                                  href={file.webViewLink}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={e => e.stopPropagation()}
                                  className="p-1 text-slate-300 hover:text-blue-500"
                                >
                                  <ExternalLink size={14} />
                                </a>
                              )}
                              {selectedFile?.id === file.id && <Check size={16} className="text-blue-600 flex-shrink-0" />}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── EXPORT MODE ── */}
                  {mode === 'export' && (
                    <div className="space-y-4">
                      <div className="p-4 bg-slate-50 rounded-xl">
                        <p className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-1">Exporting</p>
                        <p className="font-semibold text-slate-900">{proposalToExport?.title}</p>
                        <p className="text-sm text-slate-500">For: {proposalToExport?.funder}</p>
                        <p className="text-xs text-slate-400 mt-1">{proposalToExport?.sections?.length} sections</p>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">
                          Save to folder (optional)
                        </label>
                        <select
                          value={exportFolderId}
                          onChange={e => setExportFolderId(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">My Drive (root)</option>
                          {folders.map(f => (
                            <option key={f.id} value={f.id}>{f.name}</option>
                          ))}
                        </select>
                      </div>

                      <p className="text-xs text-slate-400">
                        The proposal will be created as a Google Doc in your Drive and opened automatically.
                      </p>
                    </div>
                  )}

                  {/* ── SYNC MODE ── */}
                  {mode === 'sync' && (
                    <div className="space-y-4">
                      <div className="p-4 bg-blue-50 rounded-xl text-sm text-blue-800">
                        <p className="font-semibold mb-1">📁 Auto-Sync Grants Folder</p>
                        <p>Select a folder in your ECADRN Drive to watch. Use "Sync Now" to pull the latest documents from it at any time.</p>
                      </div>

                      {syncFolderName && (
                        <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl">
                          <Folder size={18} className="text-green-600" />
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-green-800">{syncFolderName}</p>
                            {lastSynced && <p className="text-xs text-green-600">Last synced: {lastSynced}</p>}
                          </div>
                          <button
                            onClick={syncNow}
                            className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs font-bold rounded-lg"
                          >
                            <RefreshCw size={12} /> Sync Now
                          </button>
                        </div>
                      )}

                      <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">
                          Select Grants Folder
                        </label>
                        {folders.length === 0 ? (
                          <p className="text-sm text-slate-400">No folders found in your Drive.</p>
                        ) : (
                          <div className="space-y-1 max-h-60 overflow-y-auto">
                            {folders.map(f => (
                              <button
                                key={f.id}
                                onClick={() => saveSyncFolder(f.id, f.name)}
                                className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all ${
                                  syncFolderId === f.id
                                    ? 'bg-blue-50 border border-blue-300'
                                    : 'hover:bg-slate-50 border border-transparent'
                                }`}
                              >
                                <Folder size={16} className="text-yellow-500 flex-shrink-0" />
                                <span className="text-sm text-slate-800">{f.name}</span>
                                {syncFolderId === f.id && <Check size={14} className="text-blue-600 ml-auto" />}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Show synced files */}
                      {syncFolderId && files.length > 0 && (
                        <div>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Files in Folder</p>
                          <div className="space-y-1">
                            {files.slice(0, 5).map(f => (
                              <div key={f.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
                                <span>{mimeIcon(f.mimeType)}</span>
                                <span className="text-xs text-slate-700 truncate flex-1">{f.name}</span>
                              </div>
                            ))}
                            {files.length > 5 && (
                              <p className="text-xs text-slate-400 text-center">+{files.length - 5} more files</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer actions */}
            {driveToken && (
              <div className="p-4 border-t border-slate-100 flex justify-end gap-3">
                <button onClick={onClose} className="px-4 py-2 text-slate-600 text-sm font-medium hover:bg-slate-100 rounded-xl">
                  Cancel
                </button>
                {mode === 'import' && selectedFile && (
                  <button
                    onClick={() => importFile(selectedFile)}
                    disabled={isImporting}
                    className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isImporting ? <Loader size={14} className="animate-spin" /> : <Download size={14} />}
                    {isImporting ? 'Importing...' : `Import "${selectedFile.name}"`}
                  </button>
                )}
                {mode === 'export' && (
                  <button
                    onClick={exportToDrive}
                    disabled={isExporting}
                    className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isExporting ? <Loader size={14} className="animate-spin" /> : <Upload size={14} />}
                    {isExporting ? 'Exporting...' : 'Export to Drive'}
                  </button>
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
