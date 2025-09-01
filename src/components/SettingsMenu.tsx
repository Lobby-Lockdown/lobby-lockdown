import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useConfirm } from './ConfirmDialog';
import { useToast } from './Toast';
import ModalHeader from './ModalHeader';
import Button from './Button';

interface SettingsMenuProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  steamApiKey: string;
  onSteamApiKeyChange: (key: string) => void;
  saveFilePath: string;
  onSaveFilePathChange: (p: string) => void;
}

const SettingsMenu: React.FC<SettingsMenuProps> = ({
  isOpen,
  onClose,
  isDarkMode,
  onToggleDarkMode,
  steamApiKey,
  onSteamApiKeyChange,
  saveFilePath,
  onSaveFilePathChange,
}) => {
  const [cacheSize, setCacheSize] = useState<number>(0);
  const hasApiKey = Boolean(steamApiKey && steamApiKey.trim().length > 0);
  const confirm = useConfirm();
  const toast = useToast();
  const [showKey, setShowKey] = useState(false);
  const [encAvailable, setEncAvailable] = useState<boolean | null>(null);
  const initialApiKeyRef = useRef<string>('');

  const apiKeyInputType = useMemo(() => (showKey ? 'text' : 'password'), [showKey]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const size = await window.electronAPI.getNameCacheSize();
        if (mounted) setCacheSize(size);
      } catch {
        if (mounted) setCacheSize(0);
      }
      try {
        const enc = await window.electronAPI.isEncryptionAvailable();
        if (mounted) setEncAvailable(enc);
      } catch {
        if (mounted) setEncAvailable(null);
      }
    };
    load();
    // capture the current saved API key as the initial value when the modal opens
    if (isOpen) {
      initialApiKeyRef.current = (steamApiKey || '').trim();
    }
    return () => {
      mounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;
  const handleSaveApiKey = async () => {
    const current = (steamApiKey || '').trim();
    const initial = initialApiKeyRef.current;
    if (current === initial) {
      // No changes; do not call save or show a toast
      return;
    }
    try {
      await window.electronAPI.setSteamApiKey(current);
      initialApiKeyRef.current = current;
      toast('Steam API key saved', { kind: 'success' });
    } catch (error) {
      console.error('Failed to save Steam API key:', error);
      toast('Failed to save Steam API key', { kind: 'error' });
    }
  };

  const handleRemoveApiKey = async () => {
    if (!(await confirm('Remove the saved Steam API key?', { confirmText: 'Remove' }))) return;
    try {
      await window.electronAPI.setSteamApiKey('');
      onSteamApiKeyChange('');
      initialApiKeyRef.current = '';
      toast('Steam API key removed', { kind: 'success' });
    } catch (error) {
      console.error('Failed to remove Steam API key:', error);
      toast('Failed to remove Steam API key', { kind: 'error' });
    }
  };

  const handleClearCache = async () => {
    if (!(await confirm('Clear the cached player names?', { confirmText: 'Clear' }))) return;
    try {
      const ok = await window.electronAPI.clearNameCache();
      if (ok) {
        setCacheSize(0);
        toast('Name cache cleared', { kind: 'success' });
      } else {
        toast('Failed to clear name cache', { kind: 'error' });
      }
    } catch (error) {
      console.error('Failed to clear name cache:', error);
      toast('Failed to clear name cache', { kind: 'error' });
    }
  };

  const handleSelectSaveFile = async () => {
    try {
      const p = await window.electronAPI.selectSaveFile();
      if (p) {
        onSaveFilePathChange(p);
        toast('Save file selected', { kind: 'success' });
      }
    } catch (error) {
      console.error('Failed to select save file:', error);
      toast('Failed to select save file', { kind: 'error' });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-xl w-full border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <ModalHeader title="Settings" onClose={onClose} />

        {/* Body */}
        <div className="p-6 space-y-8">
          {/* Save File Section */}
          <section className="space-y-3">
            <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
              Save File
            </label>
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={saveFilePath || ''}
                readOnly
                className="flex-1 h-10 px-3 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none dark:bg-gray-700 dark:text-white truncate"
                placeholder="No save file selected"
              />
              <Button type="button" onClick={handleSelectSaveFile} className="h-10">
                Select File
              </Button>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Choose your Lockdown Protocol save file (Save_BanList.sav) to manage bans.
            </p>
          </section>
          {/* Theme Section */}
          <section className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-900 dark:text-white">Dark Mode</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Toggle between light and dark themes
              </p>
            </div>
            <button
              onClick={onToggleDarkMode}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                isDarkMode ? 'bg-indigo-600' : 'bg-gray-300'
              }`}
              role="switch"
              aria-checked={isDarkMode}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                  isDarkMode ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </section>

          {/* API Key Section */}
          <section className="space-y-3">
            <label
              htmlFor="steamApiKey"
              className="block text-sm font-medium text-gray-900 dark:text-gray-100"
            >
              Steam API Key
            </label>
            <div className="relative">
              <input
                type={apiKeyInputType}
                id="steamApiKey"
                value={steamApiKey}
                onChange={(e) => onSteamApiKeyChange(e.target.value)}
                placeholder="Enter Steam API Key"
                className="w-full pr-11 pl-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-gray-100"
                aria-label={showKey ? 'Hide API key' : 'Show API key'}
                title={showKey ? 'Hide API key' : 'Show API key'}
              >
                {showKey ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-5 0-9-4-9-7 0-1.036.418-2.324 1.25-3.675M6.223 6.223C7.97 5.112 9.92 4.5 12 4.5c5 0 9 4 9 7 0 1.117-.43 2.46-1.277 3.838M3 3l18 18M9.88 9.88A3 3 0 1014.12 14.12"
                    />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                )}
              </button>
            </div>
            <div className="flex items-center gap-3">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Used to display player names. Get one from{' '}
                <a
                  href="https://steamcommunity.com/dev/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Steam Web API
                </a>
              </p>
              {encAvailable === false && (
                <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                  Encryption unavailable
                </span>
              )}
              {encAvailable === true && (
                <span className="text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                  Saved securely
                </span>
              )}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            {cacheSize > 0 && (
              <Button onClick={handleClearCache}>Clear Name Cache ({cacheSize})</Button>
            )}
            {hasApiKey && (
              <Button onClick={handleRemoveApiKey} variant="danger">
                Remove API Key
              </Button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={onClose}>Cancel</Button>
            <Button onClick={handleSaveApiKey} variant="primary">
              Save
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsMenu;
