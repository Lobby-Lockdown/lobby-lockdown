import React, { useState, useEffect } from 'react';
import SettingsMenu from './SettingsMenu';
import BanList from './BanList';
import { ConfirmProvider } from './ConfirmDialog';
import { ToastProvider, useToast } from './Toast';
import Tooltip from './Tooltip';
import RevisionsModal from './RevisionsModal';

// Resolve app icon for renderer (bundled by Vite)
const APP_ICON_URL = new URL('../../assets/lobby-lockdown.ico', import.meta.url).toString();

// Internal bridge component to access toast context
const ToastBridge: React.FC = () => {
  const toast = useToast();
  React.useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        kind?: 'info' | 'success' | 'error';
        message: string;
      };
      if (!detail || !detail.message) return;
      toast(detail.message, { kind: detail.kind || 'info' });
    };
    document.addEventListener('LL_BACKGROUND_TOAST', handler as EventListener);
    return () => document.removeEventListener('LL_BACKGROUND_TOAST', handler as EventListener);
  }, [toast]);
  return null;
};

// Header actions rendered inside ToastProvider so hooks work
const HeaderActions: React.FC<{ onOpenSettings: () => void }> = ({ onOpenSettings }) => {
  const toast = useToast();
  return (
    <div className="flex items-center gap-2">
      {/* Save to file */}
      <Tooltip content="Save ban list to a file" position="bottom">
        <button
          onClick={async () => {
            try {
              const msg = await window.electronAPI.exportBansToFile();
              if (msg.startsWith('Error:')) toast(msg, { kind: 'error' });
              else if (msg.includes('Export canceled')) toast('Export canceled', { kind: 'info' });
              else toast(msg, { kind: 'success' });
            } catch {
              toast('Failed to save file', { kind: 'error' });
            }
          }}
          className="p-2 rounded-md text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
          aria-label="Save ban list to a file"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 16h18v2H3z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v10" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10l4 4 4-4" />
          </svg>
        </button>
      </Tooltip>
      {/* Import from file */}
      <Tooltip content="Import ban list from a file (adds only, deduplicated)" position="bottom">
        <button
          onClick={async () => {
            try {
              const msg = await window.electronAPI.importBansFromFile();
              if (msg.startsWith('Error:')) toast(msg, { kind: 'error' });
              else if (msg.includes('added 0')) toast('No new IDs to import', { kind: 'info' });
              else toast(msg, { kind: 'success' });
            } catch {
              toast('Failed to import ban list', { kind: 'error' });
            }
          }}
          className="p-2 rounded-md text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
          aria-label="Import ban list from a file (adds only, deduplicated)"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6h18v2H3z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 20V10" />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 14l-4-4-4 4"
            />
          </svg>
        </button>
      </Tooltip>
      <button
        onClick={onOpenSettings}
        className="p-2 rounded-md text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
        title="Settings"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      </button>
    </div>
  );
};

const App: React.FC = () => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [steamApiKey, setSteamApiKey] = useState('');
  const [saveFilePath, setSaveFilePath] = useState('');
  const [showRevisions, setShowRevisions] = useState(false);
  const [version, setVersion] = useState('');

  // Initialize dark mode based on system preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDarkMode(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setIsDarkMode(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Load initial data
  useEffect(() => {
    loadSteamApiKey();
    loadSaveFilePath();
    (async () => {
      try {
        const v = await window.electronAPI.getAppVersion();
        setVersion(v || '');
      } catch (e) {
        // Non-critical; show nothing if version cannot be read
        console.debug('getAppVersion failed', e);
      }
    })();
  }, []);

  // Hook background toasts from main
  useEffect(() => {
    if (!('electronAPI' in window) || typeof window.electronAPI.onBackgroundToast !== 'function')
      return;
    const off = window.electronAPI.onBackgroundToast(
      (payload: { kind?: 'info' | 'success' | 'error'; message: string }) => {
        // Lazy import toast via context from below providers using a trampoline component
        // We'll enqueue a custom event and handle inside ToastBridge
        document.dispatchEvent(new CustomEvent('LL_BACKGROUND_TOAST', { detail: payload }));
      }
    );
    return () => {
      if (typeof off === 'function') off();
    };
  }, []);

  const loadSteamApiKey = async () => {
    try {
      const apiKey = await window.electronAPI.getSteamApiKey();
      if (apiKey) {
        setSteamApiKey(apiKey);
      }
    } catch (error) {
      console.error('Failed to load Steam API key:', error);
    }
  };

  const loadSaveFilePath = async () => {
    try {
      const path = await window.electronAPI.getSaveFilePath();
      if (path) {
        setSaveFilePath(path);
      }
    } catch (error) {
      console.error('Failed to load save file path:', error);
    }
  };

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  return (
    <div className={`${isDarkMode ? 'dark' : ''}`}>
      <div className="h-screen overflow-hidden flex flex-col bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-200">
        <ToastProvider>
          <ToastBridge />
          <ConfirmProvider>
            {/* Header */}
            <header className="sticky top-0 z-40 bg-white/90 dark:bg-gray-800/90 backdrop-blur border-b border-gray-200 dark:border-gray-700 overflow-visible">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center py-4">
                  <div className="flex items-center gap-3">
                    <img src={APP_ICON_URL} alt="Lobby Lockdown" className="w-8 h-8 rounded" />
                    <div>
                      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                        Lobby Lockdown
                      </h1>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Ban List Manager for Lockdown Protocol
                      </p>
                    </div>
                  </div>

                  {/* Header actions */}
                  <div className="overflow-visible">
                    <HeaderActions onOpenSettings={() => setShowSettings(!showSettings)} />
                  </div>
                </div>
              </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto overflow-x-hidden">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="space-y-6">
                  {/* Ban List */}
                  <BanList steamApiKey={steamApiKey} onOpenHistory={() => setShowRevisions(true)} />
                </div>
              </div>
            </main>

            {/* Settings Modal */}
            {showSettings && (
              <SettingsMenu
                isOpen={showSettings}
                onClose={() => setShowSettings(false)}
                isDarkMode={isDarkMode}
                onToggleDarkMode={toggleDarkMode}
                steamApiKey={steamApiKey}
                onSteamApiKeyChange={setSteamApiKey}
                saveFilePath={saveFilePath}
                onSaveFilePathChange={setSaveFilePath}
              />
            )}
            {showRevisions && (
              <RevisionsModal isOpen={showRevisions} onClose={() => setShowRevisions(false)} />
            )}
          </ConfirmProvider>
        </ToastProvider>
      </div>
      {/* App footer */}
      <footer className="fixed bottom-0 left-0 right-0 z-30 bg-white/90 dark:bg-gray-800/90 backdrop-blur border-t border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
          <span>Lobby Lockdown {version ? `v${version}` : ''}</span>
          <button
            className="inline-flex items-center gap-2 hover:text-gray-900 dark:hover:text-white"
            onClick={() =>
              window.electronAPI.openExternal('https://github.com/Lobby-Lockdown/lobby-lockdown')
            }
            title="Open GitHub"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M12 .5C5.73.5.98 5.24.98 11.52c0 4.86 3.15 8.98 7.52 10.43.55.1.75-.24.75-.53 0-.26-.01-1.11-.02-2.01-3.06.66-3.71-1.3-3.71-1.3-.5-1.27-1.23-1.6-1.23-1.6-1.01-.69.08-.68.08-.68 1.12.08 1.71 1.15 1.71 1.15 1 .1.78 1.95 2.67 1.38.1-.73.39-1.23.71-1.52-2.44-.28-5-1.22-5-5.43 0-1.2.43-2.17 1.14-2.94-.11-.28-.49-1.42.11-2.97 0 0 .93-.3 3.06 1.12.89-.25 1.84-.38 2.78-.38.94 0 1.89.13 2.78.38 2.12-1.42 3.05-1.12 3.05-1.12.6 1.55.22 2.69.11 2.97.71.77 1.14 1.74 1.14 2.94 0 4.22-2.56 5.14-5 5.42.4.35.75 1.04.75 2.1 0 1.52-.02 2.74-.02 3.11 0 .29.2.63.76.52 4.36-1.46 7.5-5.58 7.5-10.43C23.02 5.24 18.27.5 12 .5Z"
                clipRule="evenodd"
              />
            </svg>
            GitHub
          </button>
        </div>
      </footer>
    </div>
  );
};

export default App;
