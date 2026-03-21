
import React, { useState } from 'react';
import { User, MapPin, Mail, Phone, ArrowRight, X, User as UserIcon, Globe, CreditCard, Calendar, CheckSquare, Square, Coins, Loader2, Navigation, Map } from 'lucide-react';
import { Client, ClientRegion } from '../types';
import { COUNTRIES } from '../constants';
import { clientsAPI } from '../services';
import { useClinic } from '../contexts/ClinicContext';
import { useData } from '../contexts/DataContext';
import LoadingSpinner from './LoadingSpinner';

interface Props {
  onSave?: (data: Omit<Client, 'id' | 'totalSpent' | 'joinDate'>) => void;
  onCancel: () => void;
  clinicId?: number;
}

const REGIONS: ClientRegion[] = [
  'Local', 'African', 'European', 'North American', 'South American',
  'Australian', 'Arabic', 'East Asian', 'Southeast Asian', 'Indian/Pakistani/Bangladeshi'
];

const RegisterClientView: React.FC<Props> = ({ onSave, onCancel, clinicId }) => {
  const { selectedClinicIds } = useClinic();
  const { addClientOptimistically } = useData();
  const [useCustomCurrency, setUseCustomCurrency] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', address: '', country: 'Kenya', currency: 'KES',
    gender: 'Female' as const, region: 'Local' as ClientRegion, dob: '1990-01-01',
    lat: '' as string, lng: '' as string,
  });

  const hasCoords = formData.lat !== '' && formData.lng !== '' &&
    !isNaN(parseFloat(formData.lat)) && !isNaN(parseFloat(formData.lng));

  const mapSrc = hasCoords
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${parseFloat(formData.lng) - 0.015},${parseFloat(formData.lat) - 0.015},${parseFloat(formData.lng) + 0.015},${parseFloat(formData.lat) + 0.015}&layer=mapnik&marker=${formData.lat},${formData.lng}`
    : null;

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFormData(f => ({
          ...f,
          lat: pos.coords.latitude.toFixed(6),
          lng: pos.coords.longitude.toFixed(6),
        }));
        setGeoLoading(false);
      },
      () => {
        setError('Unable to retrieve your location. Please enter coordinates manually.');
        setGeoLoading(false);
      }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const activeClinicId = clinicId || selectedClinicIds[0];
      if (!activeClinicId) throw new Error('No clinic selected');

      const clientData: any = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        country: formData.country,
        gender: formData.gender,
        dob: formData.dob ? new Date(formData.dob).toISOString() : undefined,
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${formData.name || 'Owner'}`,
      };
      if (hasCoords) {
        clientData.lat = parseFloat(formData.lat);
        clientData.lng = parseFloat(formData.lng);
      }

      const response: any = await clientsAPI.create(clientData);

      if (response.success) {
        const c = response.data.client;
        addClientOptimistically({
          id: parseInt(c.id),
          clinicId: parseInt(c.clinicId),
          name: c.name,
          email: c.email || '',
          phone: c.phone,
          address: c.address || '',
          country: c.country,
          currency: formData.currency,
          avatar: c.avatarUrl,
          totalSpent: 0,
          gender: c.gender,
          region: c.region,
          dob: c.dob ? new Date(c.dob).toISOString().split('T')[0] : formData.dob,
          joinDate: c.joinedAt,
          lat: hasCoords ? parseFloat(formData.lat) : undefined,
          lng: hasCoords ? parseFloat(formData.lng) : undefined,
        });

        if (onSave) {
          onSave({ ...formData, clinicId: typeof activeClinicId === 'string' ? parseInt(activeClinicId) : activeClinicId, avatar: clientData.avatarUrl } as any);
        } else {
          onCancel();
        }
      } else {
        throw new Error(response.message || 'Failed to create client');
      }
    } catch (err: any) {
      console.error('Failed to create client:', err);
      setError(err.message || 'Failed to create client. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="animate-in fade-in duration-500 pb-16 max-w-5xl mx-auto px-2 sm:px-4">
      {isSubmitting && <LoadingSpinner fullScreen message="Registering client..." />}

      <header className="flex items-center justify-between py-4 sm:py-6 mb-4 sm:mb-6 border-b border-slate-200 dark:border-zinc-800">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-pine dark:text-zinc-100 tracking-tighter uppercase leading-none">Register Client</h1>
          <p className="text-seafoam dark:text-zinc-400 font-bold mt-1 uppercase tracking-widest text-[10px]">Create a new client profile</p>
        </div>
        <button onClick={onCancel} className="p-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-seafoam dark:text-zinc-400 hover:text-pine dark:hover:text-zinc-100 rounded-2xl transition-all shadow-lg active:scale-95">
          <X size={20}/>
        </button>
      </header>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
        {/* ── Left: Identity + Location Map ── */}
        <div className="lg:col-span-8 space-y-4">
          {/* Identity */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-8 shadow-lg space-y-5">
            <div className="flex items-center gap-3 border-b border-slate-50 dark:border-zinc-800 pb-4">
              <div className="p-2.5 bg-seafoam text-white rounded-xl shadow-lg shadow-seafoam/20"><UserIcon size={18}/></div>
              <h2 className="text-lg font-black text-pine dark:text-zinc-100 tracking-tight uppercase">Identity Profile</h2>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-seafoam uppercase tracking-widest px-1">Full Legal Name</label>
                <input required className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-pine dark:text-zinc-100 font-bold text-base outline-none focus:ring-2 focus:ring-seafoam/20" placeholder="e.g. Alice Mwikali" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-seafoam uppercase tracking-widest px-1">Email Address</label>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-seafoam transition-colors" size={16} />
                    <input type="email" required className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl pl-11 pr-4 py-3 text-pine dark:text-zinc-100 font-bold outline-none focus:ring-2 focus:ring-seafoam/20" placeholder="alice@example.com" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-seafoam uppercase tracking-widest px-1">Phone Number</label>
                  <div className="relative group">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-seafoam transition-colors" size={16} />
                    <input required className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl pl-11 pr-4 py-3 text-pine dark:text-zinc-100 font-bold outline-none focus:ring-2 focus:ring-seafoam/20" placeholder="+254..." value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-seafoam uppercase tracking-widest px-1">Gender</label>
                  <select className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-pine dark:text-zinc-100 font-black outline-none appearance-none" value={formData.gender} onChange={e=>setFormData({...formData, gender: e.target.value as any})}>
                    <option>Female</option><option>Male</option><option>Other</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-seafoam uppercase tracking-widest px-1">Region</label>
                  <select className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-pine dark:text-zinc-100 font-black outline-none appearance-none" value={formData.region} onChange={e=>setFormData({...formData, region: e.target.value as any})}>
                    {REGIONS.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-seafoam uppercase tracking-widest px-1">Date of Birth</label>
                  <div className="relative group">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-seafoam transition-colors" size={16}/>
                    <input type="date" required className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl pl-11 pr-4 py-3 text-pine dark:text-zinc-100 font-black outline-none focus:ring-2 focus:ring-seafoam/20" value={formData.dob} onChange={e=>setFormData({...formData, dob: e.target.value})}/>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 pt-4 border-t border-slate-50 dark:border-zinc-800">
                <label className="text-[10px] font-black text-seafoam uppercase tracking-widest px-1">Street Address</label>
                <div className="relative group">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-seafoam transition-colors" size={16} />
                  <input required className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl pl-11 pr-4 py-3 text-pine dark:text-zinc-100 font-bold outline-none focus:ring-2 focus:ring-seafoam/20" placeholder="e.g. Westlands, Nairobi" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
                </div>
              </div>
            </div>
          </div>

          {/* Map Location Picker */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-8 shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-slate-50 dark:border-zinc-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-cyan text-white rounded-xl shadow-lg shadow-cyan/20"><Map size={18}/></div>
                <h2 className="text-lg font-black text-pine dark:text-zinc-100 tracking-tight uppercase">GPS Location</h2>
              </div>
              <button
                type="button"
                onClick={handleUseMyLocation}
                disabled={geoLoading}
                className="flex items-center gap-2 px-3 py-2 bg-cyan/10 border border-cyan/30 text-cyan rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-cyan/20 transition-all disabled:opacity-50"
              >
                {geoLoading ? <Loader2 size={12} className="animate-spin"/> : <Navigation size={12}/>}
                Use My Location
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Latitude</label>
                <input
                  type="number" step="any"
                  className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-3 text-pine dark:text-zinc-100 font-mono text-sm outline-none focus:ring-2 focus:ring-cyan/20"
                  placeholder="-1.286389"
                  value={formData.lat}
                  onChange={e => setFormData({...formData, lat: e.target.value})}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Longitude</label>
                <input
                  type="number" step="any"
                  className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-3 text-pine dark:text-zinc-100 font-mono text-sm outline-none focus:ring-2 focus:ring-cyan/20"
                  placeholder="36.817223"
                  value={formData.lng}
                  onChange={e => setFormData({...formData, lng: e.target.value})}
                />
              </div>
            </div>

            {mapSrc ? (
              <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-zinc-700 h-44 sm:h-56">
                <iframe
                  src={mapSrc}
                  width="100%" height="100%"
                  title="Client location map"
                  className="border-0"
                  loading="lazy"
                />
              </div>
            ) : (
              <div className="h-44 sm:h-56 flex flex-col items-center justify-center bg-slate-50 dark:bg-zinc-800 rounded-xl border-2 border-dashed border-slate-200 dark:border-zinc-700 gap-3">
                <Map size={28} className="text-slate-300 dark:text-zinc-600" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">
                  Enter coordinates or use<br/>your current location
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── Right: Location Details + Submit ── */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-8 shadow-lg space-y-5 lg:sticky lg:top-24">
            <div className="flex items-center gap-3 border-b border-slate-50 dark:border-zinc-800 pb-4">
              <div className="p-2.5 bg-cyan text-white rounded-xl shadow-lg shadow-cyan/20"><Globe size={18}/></div>
              <h2 className="text-lg font-black text-pine dark:text-zinc-100 tracking-tight uppercase">Location Details</h2>
            </div>

            <div className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-seafoam uppercase tracking-widest px-1">Country</label>
                <select
                  className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-pine dark:text-zinc-100 font-black outline-none appearance-none"
                  value={formData.country}
                  onChange={e => {
                    const c = COUNTRIES.find(x => x.name === e.target.value);
                    setFormData({...formData, country: e.target.value, currency: c?.currency || 'KES'});
                  }}
                >
                  {COUNTRIES.map(c => <option key={c.code} value={c.name}>{c.name}</option>)}
                </select>
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-50 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setUseCustomCurrency(!useCustomCurrency)}
                  className="flex items-center gap-3 group transition-all"
                >
                  {useCustomCurrency
                    ? <CheckSquare className="text-seafoam" size={22}/>
                    : <Square className="text-slate-300 group-hover:text-seafoam transition-colors" size={22}/>}
                  <span className="text-[10px] font-black uppercase text-pine dark:text-zinc-300 tracking-widest">Custom currency</span>
                </button>

                {useCustomCurrency && (
                  <div className="space-y-2 animate-in slide-in-from-top-4">
                    <label className="text-[10px] font-black text-seafoam uppercase tracking-widest px-1">Currency</label>
                    <div className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-pine dark:text-zinc-100 font-black flex items-center gap-2">
                      <Coins size={15} className="text-seafoam shrink-0"/>
                      <select className="bg-transparent outline-none flex-1 font-black appearance-none cursor-pointer" value={formData.currency} onChange={e => setFormData({...formData, currency: e.target.value})}>
                        {COUNTRIES.map(c => <option key={c.currency} value={c.currency}>{c.currency} ({c.name})</option>)}
                      </select>
                    </div>
                  </div>
                )}

                {!useCustomCurrency && (
                  <div className="p-4 bg-slate-50 dark:bg-zinc-800/50 rounded-xl border-2 border-dashed border-slate-200 dark:border-zinc-700">
                    <p className="text-[10px] font-black text-slate-400 uppercase leading-relaxed text-center italic">Global clinic currency applies.</p>
                  </div>
                )}
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                <p className="text-xs font-bold text-red-600 dark:text-red-400 text-center">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-pine dark:bg-zinc-100 text-white dark:text-pine py-4 rounded-2xl font-black text-xs uppercase tracking-[0.25em] shadow-xl transition-all flex items-center justify-center gap-3 active:scale-95 group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  PROCESSING...
                </>
              ) : (
                <>
                  REGISTER CLIENT <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default RegisterClientView;
