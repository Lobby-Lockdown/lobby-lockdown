import React, { useEffect, useState } from 'react';
import { useConfirm } from './ConfirmDialog';
import { useToast } from './Toast';
import ModalHeader from './ModalHeader';
import Button from './Button';

interface RevisionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Revision = { id: string; createdAt: string; count: number; reason: string; file: string };

const RevisionsModal: React.FC<RevisionsModalProps> = ({ isOpen, onClose }) => {
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [banCount, setBanCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const confirm = useConfirm();
  const toast = useToast();

  useEffect(() => {
    if (!isOpen) return;
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const revs = await window.electronAPI.listRevisions();
        if (mounted) setRevisions(revs);
        const count = await window.electronAPI.getCurrentBanCount();
        if (mounted) setBanCount(count);
      } catch {
        if (mounted) {
          setRevisions([]);
          setBanCount(0);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <ModalHeader
          title="Ban List History"
          subtitle={<span>Current ban list: {banCount} entries</span>}
          onClose={onClose}
          right={
            <Button
              onClick={async () => {
                const res = await window.electronAPI.openRevisionsFolder();
                if (res && res.startsWith('Error:')) toast(res, { kind: 'error' });
              }}
            >
              Open Folder
            </Button>
          }
        />

        {/* Body */}
        <div className="p-6 space-y-4">
          {loading ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading history…</p>
          ) : revisions.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No snapshots yet.</p>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-md divide-y divide-gray-200 dark:divide-gray-700">
              {revisions.map((r) => (
                <div key={r.id} className="flex items-center justify-between px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {r.id} • {r.count} entries
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {new Date(r.createdAt).toLocaleString()} • {r.reason}
                    </p>
                  </div>
                  <Button
                    onClick={async () => {
                      if (
                        !(await confirm(`Revert to revision ${r.id}?`, { confirmText: 'Revert' }))
                      )
                        return;
                      try {
                        const msg = await window.electronAPI.revertToRevision(r.id);
                        const isErr = msg.startsWith('Error:');
                        toast(isErr ? msg : 'Reverted to selected revision', {
                          kind: isErr ? 'error' : 'success',
                        });
                        // Reload list
                        const revs = await window.electronAPI.listRevisions();
                        setRevisions(revs);
                        try {
                          const count = await window.electronAPI.getCurrentBanCount();
                          setBanCount(count);
                        } catch (e) {
                          console.debug('getCurrentBanCount failed', e);
                        }
                      } catch {
                        toast('Failed to revert to revision', { kind: 'error' });
                      }
                    }}
                  >
                    Revert
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
};

export default RevisionsModal;
