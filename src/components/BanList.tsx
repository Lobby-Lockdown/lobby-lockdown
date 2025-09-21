import React, { useState, useEffect, useMemo } from 'react';
import { useConfirm } from './ConfirmDialog';
import { useToast } from './Toast';
import AddBanModal from './AddBanModal';

interface Ban {
  steamId: string;
  name: string | null;
}

const BanList: React.FC<{ steamApiKey: string; onOpenHistory?: () => void }> = ({
  steamApiKey: _steamApiKey,
  onOpenHistory,
}) => {
  const [bans, setBans] = useState<Ban[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const confirm = useConfirm();
  const toast = useToast();

  const loadBans = async () => {
    try {
      setLoading(true);
      const result = await window.electronAPI.listBans();
      let parsedBans = parseBanListOutput(result);

      // Enrich names from cache and/or API. The main process returns cache hits even without an API key.
      if (parsedBans.length) {
        try {
          const ids = parsedBans.map((b) => b.steamId);
          const names = await window.electronAPI.resolveNames(ids);
          parsedBans = parsedBans.map((b) => ({ ...b, name: names[b.steamId] ?? b.name }));
        } catch {
          // ignore enrichment errors
        }
      }

      setBans(parsedBans);
    } catch (error) {
      console.error('Failed to list bans:', error);
      toast('Failed to load ban list', { kind: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateBans = async () => {
    if (
      !(await confirm('This will update your ban list from the community list. Continue?', {
        confirmText: 'Update',
      }))
    )
      return;

    try {
      setLoading(true);
      const result = await window.electronAPI.updateBans();
      const lower = (result || '').toLowerCase();
      const kind = lower.startsWith('error:')
        ? 'error'
        : lower.includes('up to date')
        ? 'info'
        : 'success';
      toast(result, { kind });
      await loadBans();
    } catch (error) {
      console.error('Failed to update bans:', error);
      toast('Failed to update bans', { kind: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleRevertBans = async () => {
    // Open history modal instead of immediate revert
    if (onOpenHistory) onOpenHistory();
  };

  const handleAddBan = async () => {
    setShowAdd(true);
  };

  const handleRemoveBan = async (steamId: string) => {
    if (!(await confirm(`Remove ban for Steam ID ${steamId}?`, { confirmText: 'Remove' }))) return;

    try {
      setLoading(true);
      const result = await window.electronAPI.removeBan(steamId);
      toast(result, { kind: 'success' });
      await loadBans(); // Refresh the list
    } catch (error) {
      console.error('Failed to remove ban:', error);
      toast('Failed to remove ban', { kind: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const parseBanListOutput = (output: string): Ban[] => {
    if (!output || typeof output !== 'string') {
      return [];
    }

    const lines = output
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line);
    const parsedBans: Ban[] = [];

    for (const line of lines) {
      if (line.includes(': ') && /^\d{17}: /.test(line)) {
        const [steamId, name] = line.split(': ');
        if (steamId && name) {
          parsedBans.push({
            steamId: steamId.trim(),
            name: name.trim(),
          });
        }
      } else if (/^\d{17}$/.test(line)) {
        parsedBans.push({
          steamId: line.trim(),
          name: null,
        });
      }
    }

    return parsedBans;
  };

  useEffect(() => {
    loadBans();
  }, []);

  const filteredBans = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return bans;
    return bans.filter((b) => {
      const idMatch = b.steamId.includes(q);
      const nameMatch = (b.name || '').toLowerCase().includes(q);
      return idMatch || nameMatch;
    });
  }, [bans, query]);

  return (
    <div className="space-y-6">
      {/* Action Buttons */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button
            onClick={loadBans}
            disabled={loading}
            className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Loading...' : 'List Bans'}
          </button>
          <button
            onClick={handleUpdateBans}
            disabled={loading}
            className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Update from Community
          </button>
          <button
            onClick={handleRevertBans}
            disabled={loading}
            className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            View History / Revert
          </button>
          <button
            onClick={handleAddBan}
            disabled={loading}
            className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add Ban
          </button>
        </div>
      </div>

      {/* Ban List Display */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Current Ban List ({filteredBans.length}
            {query ? ` of ${bans.length}` : ''} players)
          </h2>
          <div className="w-full sm:w-80">
            <label htmlFor="ban-search" className="sr-only">
              Search bans
            </label>
            <input
              id="ban-search"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by Steam ID or name..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
              spellCheck={false}
            />
          </div>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <p className="text-blue-500 dark:text-blue-400">Loading...</p>
          ) : bans.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">
              No bans found. Click "List Bans" to load the current ban list.
            </p>
          ) : filteredBans.length === 0 && query ? (
            <p className="text-gray-500 dark:text-gray-400">No matches for "{query}".</p>
          ) : (
            <div className="space-y-2">
              {filteredBans.map((ban, index) => (
                <div
                  key={ban.steamId}
                  className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 p-3 rounded-md"
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      {index + 1}.
                    </span>
                    <div>
                      <span className="font-mono text-sm text-gray-900 dark:text-white">
                        {ban.steamId}
                      </span>
                      {ban.name && (
                        <span className="text-gray-600 dark:text-gray-400 ml-2">({ban.name})</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveBan(ban.steamId)}
                    className="btn btn-red text-sm"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {/* Add Ban Modal */}
      <AddBanModal
        isOpen={showAdd}
        onClose={() => setShowAdd(false)}
        existingIds={bans.map((b) => b.steamId)}
        onAdded={async () => {
          await loadBans();
        }}
      />
    </div>
  );
};

export default BanList;
