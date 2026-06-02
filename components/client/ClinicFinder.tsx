import React, { useState, useCallback } from 'react';
import { Search, MapPin, Loader2, Check } from 'lucide-react';
import { clientPortalAPI, PortalClinic } from '../../services';

// Reusable clinic discovery widget: text search + "use my location" nearest
// lookup. Used both on the public signup page and inside the portal (add a
// clinic). Calls onPick with the chosen clinic.
interface ClinicFinderProps {
  onPick: (clinic: PortalClinic) => void;
  pickedClinicId?: string | null;
  ctaLabel?: string;
  busyClinicId?: string | null;
}

const ClinicFinder: React.FC<ClinicFinderProps> = ({ onPick, pickedClinicId, ctaLabel = 'Select', busyClinicId }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PortalClinic[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [searched, setSearched] = useState(false);

  const runSearch = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setSearched(true);
    try {
      const res = await clientPortalAPI.searchClinics(q);
      setResults(res.data?.clinics ?? []);
    } finally {
      setSearching(false);
    }
  }, [query]);

  const useMyLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    setLocating(true);
    setSearched(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await clientPortalAPI.nearestClinics(pos.coords.latitude, pos.coords.longitude);
          setResults(res.data?.clinics ?? []);
        } finally {
          setLocating(false);
        }
      },
      () => setLocating(false),
      { timeout: 10000 },
    );
  }, []);

  return (
    <div>
      <form onSubmit={runSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 cp-muted" />
          <input
            className="cp-input"
            style={{ paddingLeft: '2.25rem' }}
            placeholder="Search by clinic name or town…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <button type="submit" className="cp-btn" disabled={searching || !query.trim()}>
          {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
        </button>
      </form>

      <button type="button" onClick={useMyLocation} disabled={locating} className="cp-btn-ghost mt-2 w-full">
        {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
        Use my location to find nearby clinics
      </button>

      <div className="mt-4 space-y-2">
        {results.map((c) => {
          const isPicked = pickedClinicId === c.id;
          const isBusy = busyClinicId === c.id;
          return (
            <div key={c.id} className="cp-card-soft p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0"
                   style={{ background: 'var(--cp-accent-soft)' }}>
                {c.logo && c.logo.length <= 4 ? c.logo : '🏥'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-bold truncate" style={{ color: 'var(--cp-ink)' }}>{c.name}</div>
                <div className="text-xs cp-muted truncate">
                  {[c.city, c.address].filter(Boolean).join(' · ') || c.region || '—'}
                  {typeof c.distanceKm === 'number' && <span className="cp-accent-text font-bold"> · {c.distanceKm} km</span>}
                </div>
              </div>
              <button
                type="button"
                className={isPicked ? 'cp-btn-ghost' : 'cp-btn'}
                disabled={isBusy}
                onClick={() => onPick(c)}
              >
                {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : isPicked ? <><Check className="w-4 h-4" /> Selected</> : ctaLabel}
              </button>
            </div>
          );
        })}
        {searched && !searching && !locating && results.length === 0 && (
          <p className="text-sm cp-muted text-center py-4">No clinics found. Try another name or your location.</p>
        )}
      </div>
    </div>
  );
};

export default ClinicFinder;
