import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useData } from '../../../contexts/DataContext';

/**
 * Shown when a client id is not in the loaded list.
 *
 * The list is page-limited (1000, newest createdAt first), so on a clinic
 * with thousands of clients "not in context" is the NORMAL case, not a
 * deleted record — the old screen said "Client not found. The client may
 * have been deleted or you may not have access to view them", which is
 * alarming and wrong for everyone past the newest 1000 (a migrated clinic's
 * oldest, highest-history clients sort to the back of that window first).
 * Mirrors PetFetchGate, same cause.
 *
 * This fetches the one client that was asked for. On success the context
 * updates and the parent re-renders straight into the real profile, so this
 * component never has to know how to draw one. Only if the fetch genuinely
 * fails do we say it is missing.
 */
const ClientFetchGate: React.FC<{ clientId: number; onBack: () => void }> = ({ clientId, onBack }) => {
  const { ensureClientById, refreshClients } = useData();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    ensureClientById(clientId).then(ok => { if (!ok && !cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [clientId, ensureClientById]);

  if (!failed) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 text-slate-500 dark:text-zinc-400 py-16 justify-center">
          <Loader2 className="animate-spin" size={16} /> Loading client…
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <button onClick={onBack} className="mb-4 px-4 py-2 bg-slate-200 dark:bg-zinc-800 rounded-lg hover:bg-slate-300 dark:hover:bg-zinc-700">
        ← Back
      </button>
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
        <p className="text-yellow-800 dark:text-yellow-200">
          This client could not be loaded. It may have been deleted, or belong to another clinic.
        </p>
        <button
          onClick={() => { setFailed(false); refreshClients(); ensureClientById(clientId).then(ok => { if (!ok) setFailed(true); }); }}
          className="mt-3 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
};

export default ClientFetchGate;
