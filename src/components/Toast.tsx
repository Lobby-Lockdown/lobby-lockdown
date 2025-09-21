import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type ToastKind = 'success' | 'error' | 'info';

export type ToastOptions = {
  kind?: ToastKind;
  durationMs?: number; // default 2500
};

type ToastItem = {
  id: number;
  message: string;
  kind: ToastKind;
  expiresAt: number;
};

type ToastContextType = (message: string, options?: ToastOptions) => void;

const ToastContext = createContext<ToastContextType | null>(null);

export const useToast = (): ToastContextType => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};

let nextId = 1;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<ToastItem[]>([]);

  const show = useCallback<ToastContextType>((message, options) => {
    const id = nextId++;
    const duration = options?.durationMs ?? 2500;
    const kind: ToastKind = options?.kind ?? 'info';
    const expiresAt = Date.now() + duration;
    setItems((old) => [...old, { id, message, kind, expiresAt }]);
  }, []);

  // Garbage collect expired toasts
  useEffect(() => {
    if (items.length === 0) return;
    const t = setInterval(() => {
      const now = Date.now();
      setItems((old) => old.filter((x) => x.expiresAt > now));
    }, 200);
    return () => clearInterval(t);
  }, [items.length]);

  const remove = useCallback((id: number) => {
    setItems((old) => old.filter((x) => x.id !== id));
  }, []);

  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Container - centered at top */}
      <div className="pointer-events-none fixed top-4 left-1/2 transform -translate-x-1/2 z-[60] flex flex-col items-center gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto min-w-[240px] max-w-[360px] rounded-md shadow-md border px-4 py-2 text-sm flex items-center gap-2 transition-all bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 ${
              t.kind === 'success'
                ? 'text-emerald-800 dark:text-emerald-200'
                : t.kind === 'error'
                  ? 'text-red-800 dark:text-red-200'
                  : 'text-gray-800 dark:text-gray-200'
            }`}
          >
            <span
              className={`inline-block h-2 w-2 rounded-full ${t.kind === 'success' ? 'bg-emerald-500' : t.kind === 'error' ? 'bg-red-500' : 'bg-indigo-500'}`}
            />
            <div className="flex-1">{t.message}</div>
            <button
              aria-label="Dismiss"
              title="Dismiss"
              className="ml-2 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
              onClick={() => remove(t.id)}
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
