/**
 * Route wrapper for the named-animal register (264).
 *
 * Its own page rather than a tab on the farm home, because on a real dairy this
 * is the screen a farmer lives in — and because "Animals" replacing "Visits" in
 * the farm nav was the point (user, 2026-08-29: the farm menu should carry farm
 * things only).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, MapPin } from 'lucide-react';
import {
  clientPortalAPI,
  type PortalFarm, type PortalAnimalGroup, type PortalHoldings,
} from '../../../services/modules/clientPortal.api';
import ClientFarmAnimals from './ClientFarmAnimals';

const ClientFarmAnimalsPage: React.FC = () => {
  const [farms, setFarms] = useState<PortalFarm[]>([]);
  const [activeId, setActiveId] = useState('');
  const [groups, setGroups] = useState<PortalAnimalGroup[]>([]);
  const [holdings, setHoldings] = useState<PortalHoldings | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      clientPortalAPI.getMyFarms({ showError: false }),
      clientPortalAPI.getHoldings({ showError: false }),
    ]).then(([f, h]) => {
      if (f.success && f.data?.farms) {
        setFarms(f.data.farms);
        if (f.data.farms.length) setActiveId((id) => id || f.data!.farms[0].id);
      }
      if (h.success && h.data) setHoldings(h.data);
    }).finally(() => setLoading(false));
  }, []);

  const loadGroups = useCallback((farmId: string) => {
    if (!farmId) return;
    clientPortalAPI.getFarmDetail(farmId, { showError: false })
      .then((r) => { if (r.success && r.data) setGroups(r.data.animalGroups); });
  }, []);

  useEffect(() => { loadGroups(activeId); }, [activeId, loadGroups]);

  if (loading) {
    return <div className="cp-card px-5 py-12 text-center text-sm text-slate-400"><Loader2 size={16} className="animate-spin mx-auto" /></div>;
  }

  if (farms.length === 0) {
    return (
      <div className="cp-card px-5 py-12 text-center">
        <p className="text-sm font-bold text-slate-700 dark:text-zinc-200">Add your farm first</p>
        <p className="mt-1 text-xs text-slate-500">Animals live on a farm — there is nowhere to put them yet.</p>
        <button className="cp-btn mt-3" onClick={() => navigate('/client/farm')}>Go to My Farm</button>
      </div>
    );
  }

  const active = farms.find((f) => f.id === activeId);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="page-header text-lg font-black text-slate-800 dark:text-zinc-100">Animals</h2>
        {active && (
          <p className="text-[11px] text-slate-500 flex items-center gap-1">
            <MapPin size={11} /> {active.name}
            {active.county ? ` · ${active.county}` : ''}
          </p>
        )}
      </div>

      {farms.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {farms.map((f) => (
            <button
              key={f.id}
              onClick={() => setActiveId(f.id)}
              className={`px-3.5 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${
                f.id === activeId ? 'bg-pine text-white shadow' : 'bg-white dark:bg-zinc-900 text-slate-500 border border-slate-200 dark:border-zinc-800'
              }`}
            >
              {f.name}
            </button>
          ))}
        </div>
      )}

      {active && (
        <ClientFarmAnimals
          farmId={active.id}
          groups={groups}
          tier={holdings?.farmTier ?? 'BASIC'}
          onChanged={() => loadGroups(active.id)}
          onUpgrade={() => navigate('/client/plan')}
        />
      )}
    </div>
  );
};

export default ClientFarmAnimalsPage;
