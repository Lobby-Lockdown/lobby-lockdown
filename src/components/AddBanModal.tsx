import React, { useEffect, useMemo, useState } from 'react';
import ModalHeader from './ModalHeader';
import Button from './Button';
import { useToast } from './Toast';

interface AddBanModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingIds: string[];
  onAdded?: () => Promise<void> | void;
}

const AddBanModal: React.FC<AddBanModalProps> = ({ isOpen, onClose, existingIds, onAdded }) => {
  const [steamId, setSteamId] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();

  const existingSet = useMemo(() => new Set(existingIds || []), [existingIds]);

  useEffect(() => {
    if (isOpen) {
      setSteamId('');
      setError('');
      setSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const validate = (value: string) => {
    const v = (value || '').trim();
    if (!v) return 'Please enter a Steam64 ID.';
    if (!/^7656\d{13}$/.test(v)) return 'Steam64 ID must be 17 digits and start with 7656.';
    if (existingSet.has(v)) return 'That Steam64 ID is already in the ban list.';
    return '';
  };

  const onSubmit = async () => {
    const msg = validate(steamId);
    if (msg) {
      setError(msg);
      return;
    }
    try {
      setSubmitting(true);
      const res = await window.electronAPI.addBan(steamId.trim());
      const isErr = typeof res === 'string' && res.startsWith('Error:');
      toast(isErr ? res : res || 'Added to ban list', { kind: isErr ? 'error' : 'success' });
      if (!isErr) {
        if (onAdded) await onAdded();
        onClose();
      }
    } catch {
      toast('Failed to add ban', { kind: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-gray-700">
        <ModalHeader
          title="Add Ban"
          subtitle="Enter a Steam64 ID (17 digits, starts with 7656)"
          onClose={onClose}
        />
        <div className="p-6 space-y-4">
          <div>
            <label
              htmlFor="steamId"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Steam64 ID
            </label>
            <input
              id="steamId"
              value={steamId}
              onChange={(e) => {
                setSteamId(e.target.value);
                setError('');
              }}
              placeholder="7656xxxxxxxxxxxxx"
              spellCheck={false}
              autoFocus
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
            />
            {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <Button onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={submitting}>
            {submitting ? 'Adding…' : 'Add'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AddBanModal;
