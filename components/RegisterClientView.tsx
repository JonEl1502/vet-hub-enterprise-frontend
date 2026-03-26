
import React, { useState } from 'react';
import { MapPin, Mail, Phone, ArrowRight, X, User as UserIcon, Globe, Calendar, CheckSquare, Square, Coins, Loader2, Navigation, Map, ShieldAlert, ChevronDown, Plus, FileText } from 'lucide-react';
import ClickableMap from './ClickableMap';
import { Client, ClientRegion, ClientType } from '../types';
import { COUNTRIES, CLIENT_TYPES } from '../constants';
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
  const [clientTypeNote, setClientTypeNote] = useState('');
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
      if (clientTypeNote.trim()) clientData.clientTypeNote = clientTypeNote.trim();
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
              {/* Name fields */}
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-seafoam uppercase tracking-widest px-1">Title</label>
                  <div className="relative">
                    <select
                      className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-3 text-pine dark:text-zinc-100 font-black outline-none appearance-none focus:ring-2 focus:ring-seafoam/20"
                      value={formData.title}
                      onChange={e => setFormData({...formData, title: e.target.value})}
                    >
                      {TITLES.map(t => <option key={t} value={t}>{t || '—'}</option>)}
                    </select>
                    <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>
                <div className="col-span-2 sm:col-span-1 space-y-1.5">
                  <label className="text-[10px] font-black text-seafoam uppercase tracking-widest px-1">First Name *</label>
                  <input required className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-pine dark:text-zinc-100 font-bold outline-none focus:ring-2 focus:ring-seafoam/20" placeholder="Alice" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} />
                </div>
                <div className="col-span-3 sm:col-span-1 space-y-1.5">
                  <label className="text-[10px] font-black text-seafoam uppercase tracking-widest px-1">Second Name</label>
                  <input className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-pine dark:text-zinc-100 font-bold outline-none focus:ring-2 focus:ring-seafoam/20" placeholder="Wanjiru" value={formData.secondName} onChange={e => setFormData({...formData, secondName: e.target.value})} />
                </div>
                <div className="col-span-3 sm:col-span-1 space-y-1.5">
                  <label className="text-[10px] font-black text-seafoam uppercase tracking-widest px-1">Surname *</label>
                  <input required className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-pine dark:text-zinc-100 font-bold outline-none focus:ring-2 focus:ring-seafoam/20" placeholder="Mwikali" value={formData.surname} onChange={e => setFormData({...formData, surname: e.target.value})} />
                </div>
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

            <ClickableMap
              lat={hasCoords ? parseFloat(formData.lat) : null}
              lng={hasCoords ? parseFloat(formData.lng) : null}
              height={220}
              onPick={(lat, lng) => setFormData(f => ({ ...f, lat: String(lat), lng: String(lng) }))}
            />

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
          </div>

          {/* Internal Notes */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-8 shadow-lg space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-50 dark:border-zinc-800 pb-4">
              <div className="p-2.5 bg-seafoam/20 text-seafoam rounded-xl"><FileText size={18}/></div>
              <h2 className="text-lg font-black text-pine dark:text-zinc-100 tracking-tight uppercase">Internal Notes</h2>
            </div>

            {/* Bullet list of existing notes */}
            {notes.length > 0 && (
              <ul className="space-y-1.5">
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

            {/* Add note input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={noteInput}
                onChange={e => setNoteInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addNote(); } }}
                className="flex-1 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-seafoam/20"
              />
              <button
                type="button"
                onClick={addNote}
                className="flex items-center gap-1.5 px-3 py-2.5 bg-seafoam/10 border border-seafoam/30 text-seafoam rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-seafoam/20 transition-all"
              >
                <Plus size={13} /> Add
              </button>
            </div>
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

            {/* Risk & Credit */}
            <div className="pt-4 border-t border-slate-50 dark:border-zinc-800 space-y-4">
              <div className="flex items-center gap-2">
                <ShieldAlert size={15} className="text-orange-500" />
                <span className="text-[10px] font-black text-pine dark:text-zinc-300 uppercase tracking-widest">Risk & Credit</span>
              </div>

              {/* Client Type chips */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Client Type</label>
                <div className="flex flex-wrap gap-1.5">
                  {CLIENT_TYPES.map(t => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setClientType(clientType === t.value ? null : t.value)}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${
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

              {/* Note */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Notes / Description</label>
                <textarea
                  rows={2}
                  className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-seafoam/20 resize-none"
                  placeholder={CLIENT_TYPES.find(t => t.value === clientType)?.description || 'e.g. Aggressive, doesn\'t pay on time…'}
                  value={clientTypeNote}
                  onChange={e => setClientTypeNote(e.target.value)}
                />
              </div>

              {/* Max Debt + Risk Rate */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Max Debt ({formData.currency})</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-seafoam/20"
                    placeholder="0.00"
                    value={maxDebt}
                    onChange={e => setMaxDebt(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Risk Score (0–100)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-seafoam/20"
                    placeholder="0"
                    value={clientRiskRate}
                    onChange={e => setClientRiskRate(e.target.value)}
                  />
                </div>
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
