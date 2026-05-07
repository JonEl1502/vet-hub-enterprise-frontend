
import React, { useState } from 'react';
import { MapPin, Mail, Phone, ArrowRight, X, User as UserIcon, Globe, Calendar, CheckSquare, Square, Coins, Loader2, Navigation, Map, ShieldAlert, ChevronDown, Plus, FileText } from 'lucide-react';
import ClickableMap from '../../shared/common/ClickableMap';
import { Client, ClientRegion, ClientType } from '../../../types';
import { COUNTRIES, CLIENT_TYPES } from '../../../constants';
import { clientsAPI } from '../../../services';
import { useClinic } from '../../../contexts/ClinicContext';
import { useData } from '../../../contexts/DataContext';
import LoadingSpinner from '../../shared/common/LoadingSpinner';

interface Props {
  onSave?: (data: Omit<Client, 'id' | 'totalSpent' | 'joinDate'>) => void;
  onCancel: () => void;
  clinicId?: number;
}

const REGIONS: ClientRegion[] = [
  'Local', 'African', 'European', 'North American', 'South American',
  'Australian', 'Arabic', 'East Asian', 'Southeast Asian', 'Indian/Pakistani/Bangladeshi'
];

const TITLES = ['', 'Mr', 'Mrs', 'Ms', 'Miss', 'Dr', 'Prof', 'Rev', 'Eng', 'Hon', 'Sir', 'Maj', 'Capt', 'Col'];

const RegisterClientView: React.FC<Props> = ({ onSave, onCancel, clinicId }) => {
  const { selectedClinicIds } = useClinic();
  const { addClientOptimistically } = useData();
  const [useCustomCurrency, setUseCustomCurrency] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '', firstName: '', secondName: '', surname: '',
    email: '', phone: '', address: '', country: 'Kenya', currency: 'KES',
    gender: 'Female' as const, region: 'Local' as ClientRegion, dob: '1990-01-01',
    lat: '' as string, lng: '' as string,
  });
  const [clientType, setClientType] = useState<ClientType | null>(null);
  const [clientTypeNotes, setClientTypeNotes] = useState<string[]>([]);
  const [clientTypeNoteInput, setClientTypeNoteInput] = useState('');
  const [maxDebt, setMaxDebt] = useState('');
  const [clientRiskRate, setClientRiskRate] = useState('');
  const [notes, setNotes] = useState<string[]>([]);
  const [noteInput, setNoteInput] = useState('');

  const hasCoords = formData.lat !== '' && formData.lng !== '' &&
    !isNaN(parseFloat(formData.lat)) && !isNaN(parseFloat(formData.lng));

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

  const addNote = () => {
    const trimmed = noteInput.trim();
    if (trimmed) {
      setNotes(n => [...n, trimmed]);
      setNoteInput('');
    }
  };

  const removeNote = (idx: number) => setNotes(n => n.filter((_, i) => i !== idx));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const activeClinicId = clinicId || selectedClinicIds[0];
      if (!activeClinicId) throw new Error('No clinic selected');

      const clientData: any = {
        title: formData.title || undefined,
        firstName: formData.firstName,
        secondName: formData.secondName || undefined,
        surname: formData.surname,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        country: formData.country,
        gender: formData.gender,
        dob: formData.dob ? new Date(formData.dob).toISOString() : undefined,
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${formData.firstName || 'Owner'}`,
      };
      if (hasCoords) {
        clientData.lat = parseFloat(formData.lat);
        clientData.lng = parseFloat(formData.lng);
      }
      if (clientType) clientData.clientType = clientType;
      const joinedTypeNote = clientTypeNotes.map(s => s.trim()).filter(Boolean).join('; ');
      if (joinedTypeNote) clientData.clientTypeNote = joinedTypeNote;
      if (maxDebt !== '') clientData.maxDebt = parseFloat(maxDebt);
      if (clientRiskRate !== '') clientData.clientRiskRate = parseFloat(clientRiskRate);
      if (notes.length > 0) clientData.internalNotes = notes.join(',');

      const response: any = await clientsAPI.create(clientData);

      if (response.success) {
        const c = response.data.client;
        addClientOptimistically({
          id: parseInt(c.id),
          clinicId: parseInt(c.clinicId),
          title: c.title,
          firstName: c.firstName,
          secondName: c.secondName,
          surname: c.surname,
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
    <div className="animate-in fade-in duration-500">
      {isSubmitting && <LoadingSpinner fullScreen message="Registering client..." />}

      <header className="flex items-center justify-between py-2 sm:py-3 mb-2 sm:mb-3 border-b border-slate-200 dark:border-zinc-800">
        <div className="min-w-0">
          <h1 className="text-base sm:text-xl font-black text-pine dark:text-zinc-100 tracking-tighter uppercase leading-none truncate">Register Client</h1>
          <p className="text-seafoam dark:text-zinc-400 font-bold mt-0.5 uppercase tracking-widest text-[9px]">Create a new client profile</p>
        </div>
        <button onClick={onCancel} className="p-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-seafoam dark:text-zinc-400 hover:text-pine dark:hover:text-zinc-100 rounded-lg transition-all shadow-sm active:scale-95 shrink-0">
          <X size={14}/>
        </button>
      </header>

      <form onSubmit={handleSubmit} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3 sm:p-4 shadow-sm">
        <div className="grid grid-cols-1 lg:grid-cols-2 lg:gap-6">
          {/* ─────────── LEFT COLUMN ─────────── */}
          <div className="space-y-4 lg:pr-5">
            {/* Identity */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <UserIcon size={13} className="text-seafoam shrink-0"/>
                <h2 className="text-[11px] font-black text-pine dark:text-zinc-100 uppercase tracking-widest">Identity Profile</h2>
              </div>

              {/* Name fields */}
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                <div>
                  <label className="field-label">Title</label>
                  <div className="relative">
                    <select
                      className="field-select px-2"
                      value={formData.title}
                      onChange={e => setFormData({...formData, title: e.target.value})}
                    >
                      {TITLES.map(t => <option key={t} value={t}>{t || '—'}</option>)}
                    </select>
                    <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="field-label">First Name *</label>
                  <input required className="field-input" placeholder="Alice" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} />
                </div>
                <div className="col-span-3 sm:col-span-1">
                  <label className="field-label">Second Name</label>
                  <input className="field-input" placeholder="Wanjiru" value={formData.secondName} onChange={e => setFormData({...formData, secondName: e.target.value})} />
                </div>
                <div className="col-span-3 sm:col-span-1">
                  <label className="field-label">Surname *</label>
                  <input required className="field-input" placeholder="Mwikali" value={formData.surname} onChange={e => setFormData({...formData, surname: e.target.value})} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="field-label">Email Address</label>
                  <div className="relative group">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-seafoam transition-colors" size={14} />
                    <input type="email" required className="field-input field-icon-left" placeholder="alice@example.com" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                  </div>
                </div>
                <div>
                  <label className="field-label">Phone Number</label>
                  <div className="relative group">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-seafoam transition-colors" size={14} />
                    <input required className="field-input field-icon-left" placeholder="+254..." value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="field-label">Gender</label>
                  <select className="field-select" value={formData.gender} onChange={e=>setFormData({...formData, gender: e.target.value as any})}>
                    <option>Female</option><option>Male</option><option>Other</option>
                  </select>
                </div>
                <div>
                  <label className="field-label">Region</label>
                  <select className="field-select" value={formData.region} onChange={e=>setFormData({...formData, region: e.target.value as any})}>
                    {REGIONS.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="field-label">Date of Birth</label>
                  <div className="relative group">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-seafoam transition-colors" size={14}/>
                    <input type="date" required className="field-input field-icon-left" value={formData.dob} onChange={e=>setFormData({...formData, dob: e.target.value})}/>
                  </div>
                </div>
              </div>

              <div>
                <label className="field-label">Street Address</label>
                <div className="relative group">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-seafoam transition-colors" size={14} />
                  <input required className="field-input field-icon-left" placeholder="e.g. Westlands, Nairobi" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
                </div>
              </div>
            </div>

            {/* GPS Location */}
            <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-zinc-800">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Map size={13} className="text-cyan shrink-0"/>
                  <h2 className="text-[11px] font-black text-pine dark:text-zinc-100 uppercase tracking-widest truncate">GPS Location</h2>
                </div>
                <button
                  type="button"
                  onClick={handleUseMyLocation}
                  disabled={geoLoading}
                  className="flex items-center gap-1 px-2 py-1 bg-cyan/10 border border-cyan/30 text-cyan rounded-md text-[9px] font-black uppercase tracking-wider hover:bg-cyan/20 transition-all disabled:opacity-50 shrink-0"
                >
                  {geoLoading ? <Loader2 size={10} className="animate-spin"/> : <Navigation size={10}/>}
                  <span className="hidden sm:inline">Use My Location</span>
                  <span className="sm:hidden">Locate</span>
                </button>
              </div>

              <ClickableMap
                lat={hasCoords ? parseFloat(formData.lat) : null}
                lng={hasCoords ? parseFloat(formData.lng) : null}
                height={180}
                onPick={(lat, lng) => setFormData(f => ({ ...f, lat: String(lat), lng: String(lng) }))}
              />

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="field-label">Latitude</label>
                  <input
                    type="number" step="any"
                    className="field-input font-mono focus:ring-cyan/20 focus:border-cyan"
                    placeholder="-1.286389"
                    value={formData.lat}
                    onChange={e => setFormData({...formData, lat: e.target.value})}
                  />
                </div>
                <div>
                  <label className="field-label">Longitude</label>
                  <input
                    type="number" step="any"
                    className="field-input font-mono focus:ring-cyan/20 focus:border-cyan"
                    placeholder="36.817223"
                    value={formData.lng}
                    onChange={e => setFormData({...formData, lng: e.target.value})}
                  />
                </div>
              </div>
            </div>

            {/* Internal Notes */}
            <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <FileText size={13} className="text-seafoam shrink-0"/>
                <h2 className="text-[11px] font-black text-pine dark:text-zinc-100 uppercase tracking-widest">Internal Notes</h2>
              </div>

              {notes.length > 0 && (
                <ul className="space-y-1">
                  {notes.map((note, idx) => (
                    <li key={idx} className="flex items-start gap-2 group">
                      <span className="text-seafoam font-black mt-0.5 shrink-0">•</span>
                      <span className="text-sm text-pine dark:text-zinc-200 flex-1">{note}</span>
                      <button
                        type="button"
                        onClick={() => removeNote(idx)}
                        className="text-slate-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                      >
                        <X size={13} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex gap-2">
                <input
                  type="text"
                  value={noteInput}
                  onChange={e => setNoteInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addNote(); } }}
                  className="field-input flex-1 min-w-0"
                  placeholder="Add a note…"
                />
                <button
                  type="button"
                  onClick={addNote}
                  className="flex items-center gap-1 px-2.5 bg-seafoam/10 border border-seafoam/30 text-seafoam rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-seafoam/20 transition-all shrink-0"
                >
                  <Plus size={12} /> Add
                </button>
              </div>
            </div>
          </div>

          {/* ─────────── DIVIDER + RIGHT COLUMN ─────────── */}
          <div className="space-y-4 mt-4 pt-4 border-t border-slate-100 dark:border-zinc-800 lg:mt-0 lg:pt-0 lg:border-t-0 lg:border-l lg:border-slate-200 lg:dark:border-zinc-800 lg:pl-6">
            {/* Location Details */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Globe size={13} className="text-cyan shrink-0"/>
                <h2 className="text-[11px] font-black text-pine dark:text-zinc-100 uppercase tracking-widest">Location Details</h2>
              </div>

              <div>
                <label className="field-label">Country</label>
                <select
                  className="field-select"
                  value={formData.country}
                  onChange={e => {
                    const c = COUNTRIES.find(x => x.name === e.target.value);
                    setFormData({...formData, country: e.target.value, currency: c?.currency || 'KES'});
                  }}
                >
                  {COUNTRIES.map(c => <option key={c.code} value={c.name}>{c.name}</option>)}
                </select>
              </div>

              <button
                type="button"
                onClick={() => setUseCustomCurrency(!useCustomCurrency)}
                className="flex items-center gap-2 group transition-all"
              >
                {useCustomCurrency
                  ? <CheckSquare className="text-seafoam shrink-0" size={16}/>
                  : <Square className="text-slate-300 group-hover:text-seafoam transition-colors shrink-0" size={16}/>}
                <span className="text-[10px] font-black uppercase text-pine dark:text-zinc-300 tracking-widest">Custom currency</span>
              </button>

              {useCustomCurrency && (
                <div className="animate-in slide-in-from-top-4">
                  <label className="field-label">Currency</label>
                  <div className="field-input flex items-center gap-2">
                    <Coins size={13} className="text-seafoam shrink-0"/>
                    <select className="bg-transparent outline-none flex-1 min-w-0 font-bold appearance-none cursor-pointer text-sm" value={formData.currency} onChange={e => setFormData({...formData, currency: e.target.value})}>
                      {COUNTRIES.map(c => <option key={c.currency} value={c.currency}>{c.currency} ({c.name})</option>)}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Risk & Credit */}
            <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <ShieldAlert size={13} className="text-orange-500 shrink-0" />
                <h2 className="text-[11px] font-black text-pine dark:text-zinc-100 uppercase tracking-widest">Risk &amp; Credit</h2>
              </div>

              <div>
                <label className="field-label">Client Type</label>
                <div className="flex flex-wrap gap-1.5">
                  {CLIENT_TYPES.map(t => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setClientType(clientType === t.value ? null : t.value)}
                      className={`flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wider border transition-all ${
                        clientType === t.value
                          ? `${t.bg} ${t.color} shadow-sm`
                          : 'bg-slate-50 dark:bg-zinc-800 text-slate-400 border-slate-200 dark:border-zinc-700 hover:border-slate-400'
                      }`}
                    >
                      {t.icon}{t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="field-label">Notes / Description</label>
                <div className="bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 flex flex-wrap items-center gap-1 focus-within:ring-2 focus-within:ring-seafoam/20 focus-within:border-seafoam transition-colors">
                  {clientTypeNotes.map((note, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded text-xs text-pine dark:text-zinc-100 font-medium max-w-full">
                      <span className="truncate">{note}</span>
                      <button
                        type="button"
                        onClick={() => setClientTypeNotes(arr => arr.filter((_, i) => i !== idx))}
                        className="text-slate-400 hover:text-red-500 shrink-0"
                        aria-label="Remove"
                      >
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                  <input
                    type="text"
                    value={clientTypeNoteInput}
                    onChange={e => setClientTypeNoteInput(e.target.value)}
                    onKeyDown={e => {
                      if ((e.key === 'Enter' || e.key === ',' || e.key === ';') && clientTypeNoteInput.trim()) {
                        e.preventDefault();
                        setClientTypeNotes(arr => [...arr, clientTypeNoteInput.trim()]);
                        setClientTypeNoteInput('');
                      } else if (e.key === 'Backspace' && !clientTypeNoteInput && clientTypeNotes.length) {
                        setClientTypeNotes(arr => arr.slice(0, -1));
                      }
                    }}
                    onBlur={() => {
                      if (clientTypeNoteInput.trim()) {
                        setClientTypeNotes(arr => [...arr, clientTypeNoteInput.trim()]);
                        setClientTypeNoteInput('');
                      }
                    }}
                    placeholder={clientTypeNotes.length === 0 ? (CLIENT_TYPES.find(t => t.value === clientType)?.description || 'e.g. Aggressive, doesn\'t pay on time…') : ''}
                    className="flex-1 min-w-[80px] bg-transparent text-sm text-pine dark:text-zinc-100 font-medium outline-none placeholder:text-slate-400 dark:placeholder:text-zinc-500 placeholder:font-medium py-0.5"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="min-w-0">
                  <label className="field-label truncate">Max Debt ({formData.currency})</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="field-input"
                    placeholder="0.00"
                    value={maxDebt}
                    onChange={e => setMaxDebt(e.target.value)}
                  />
                </div>
                <div className="min-w-0">
                  <label className="field-label truncate">Risk (0–100)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    className="field-input"
                    placeholder="0"
                    value={clientRiskRate}
                    onChange={e => setClientRiskRate(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className="p-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-xs font-bold text-red-600 dark:text-red-400 text-center">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-pine dark:bg-zinc-100 text-white dark:text-pine py-2.5 rounded-lg font-black text-[10px] sm:text-xs uppercase tracking-widest shadow-md transition-all flex items-center justify-center gap-2 active:scale-95 group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  PROCESSING...
                </>
              ) : (
                <>
                  REGISTER CLIENT <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
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
