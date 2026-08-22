import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useData } from '../../../contexts/DataContext';

/**
 * Shown when a pet id is not in the loaded list.
 *
 * The list is page-limited, so on a clinic with thousands of patients "not in
 * context" is the NORMAL case, not a deleted record — the old screen said
 * "Pet not found. The pet may have been deleted or you may not have access to
 * view it", which was alarming and wrong for roughly three thousand pets.
 *
 * This fetches the one pet that was asked for. On success the context updates
 * and the parent re-renders straight into the real profile, so this component
 * never has to know how to draw one. Only if the fetch genuinely fails do we
 * say it is missing.
 */
const PetFetchGate: React.FC<{ petId: number; onBack: () => void }> = ({ petId, onBack }) => {
  const { ensurePetById, refreshPets } = useData();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    ensurePetById(petId).then(ok => { if (!ok && !cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [petId, ensurePetById]);

  if (!failed) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 text-slate-500 dark:text-zinc-400 py-16 justify-center">
          <Loader2 className="animate-spin" size={16} /> Loading patient…
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
          This patient could not be loaded. It may have been deleted, or belong to another clinic.
        </p>
        <button
          onClick={() => { setFailed(false); refreshPets(); ensurePetById(petId).then(ok => { if (!ok) setFailed(true); }); }}
          className="mt-3 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
};

export default PetFetchGate;
