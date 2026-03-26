import React, { useState, useEffect } from 'react';
import { X, User, Mail, Phone, MapPin, Globe, Calendar, Loader2, Save, ShieldAlert, ChevronDown, Map, Navigation, Plus, FileText } from 'lucide-react';
import ClickableMap from './ClickableMap';
import { Client, ClientRegion, ClientType } from '../types';
import { COUNTRIES, CLIENT_TYPES } from '../constants';
import { clientsAPI } from '../services';
import { CacheInvalidators } from '../services/utils/cache';
import { useData } from '../contexts/DataContext';

interface EditClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client;
}

const REGIONS: ClientRegion[] = [
  'Local', 'African', 'European', 'North American', 'South American',
  'Australian', 'Arabic', 'East Asian', 'Southeast Asian', 'Indian/Pakistani/Bangladeshi'
];

const TITLES = ['', 'Mr', 'Mrs', 'Ms', 'Miss', 'Dr', 'Prof', 'Rev', 'Eng', 'Hon', 'Sir', 'Maj', 'Capt', 'Col'];

const EditClientModal: React.FC<EditClientModalProps> = ({ isOpen, onClose, client }) => {
  const { refreshClients } = useData();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const formatDob = (dob: string | undefined): string => {
    if (!dob) return '1990-01-01';
    return dob.includes('T') ? dob.split('T')[0] : dob;
  };

  const [formData, setFormData] = useState({
    title: client.title || '',
    firstName: client.firstName || '',
    secondName: client.secondName || '',
    surname: client.surname || '',
    email: client.email || '',
    phone: client.phone,
    address: client.address || '',
    country: client.country || 'Kenya',
    gender: client.gender || 'Female',
    region: (client.region || 'Local') as ClientRegion,
    dob: formatDob(client.dob),
    lat: client.lat ?? null as number | null,
    lng: client.lng ?? null as number | null,
  });
  const [clientType, setClientType] = useState<ClientType | null>((client.clientType as ClientType) || null);
  const [clientTypeNote, setClientTypeNote] = useState(client.clientTypeNote || '');
  const [maxDebt, setMaxDebt] = useState(client.maxDebt != null ? String(client.maxDebt) : '');
  const [clientRiskRate, setClientRiskRate] = useState(client.clientRiskRate != null ? String(client.clientRiskRate) : '');
  const [notes, setNotes] = useState<string[]>(
    client.internalNotes ? client.internalNotes.split(',').map(n => n.trim()).filter(Boolean) : []
  );
  const [noteInput, setNoteInput] = useState('');

  useEffect(() => {
    if (isOpen) {
      setFormData({
        title: client.title || '',
        firstName: client.firstName || '',
        secondName: client.secondName || '',
        surname: client.surname || '',
        email: client.email || '',
        phone: client.phone,
        address: client.address || '',
        country: client.country || 'Kenya',
        gender: client.gender || 'Female',
        region: (client.region || 'Local') as ClientRegion,
        dob: formatDob(client.dob),
        lat: client.lat ?? null,
        lng: client.lng ?? null,
      });
      setClientType((client.clientType as ClientType) || null);
      setClientTypeNote(client.clientTypeNote || '');
      setMaxDebt(client.maxDebt != null ? String(client.maxDebt) : '');
      setClientRiskRate(client.clientRiskRate != null ? String(client.clientRiskRate) : '');
      setNotes(client.internalNotes ? client.internalNotes.split(',').map(n => n.trim()).filter(Boolean) : []);
      setNoteInput('');
      setError(null);
    }
  }, [isOpen, client]);

  const addNote = () => {
    const trimmed = noteInput.trim();
    if (trimmed) {
      setNotes(n => [...n, trimmed]);
      setNoteInput('');
    }
  };

  const removeNote = (idx: number) => setNotes(n => n.filter((_, i) => i !== idx));

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) return;
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setFormData(f => ({ ...f, lat: pos.coords.latitude, lng: pos.coords.longitude }));
        setGeoLoading(false);
      },
      () => setGeoLoading(false),
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const updateData: any = {
        title: formData.title || null,
        firstName: formData.firstName,
        secondName: formData.secondName || null,
        surname: formData.surname,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        country: formData.country,
        gender: formData.gender,
        dob: formData.dob ? new Date(formData.dob).toISOString() : undefined,
        clientType: clientType || null,
        clientTypeNote: clientTypeNote.trim() || null,
        maxDebt: maxDebt !== '' ? parseFloat(maxDebt) : null,
        clientRiskRate: clientRiskRate !== '' ? parseFloat(clientRiskRate) : null,
        internalNotes: notes.length > 0 ? notes.join(',') : null,
        ...(formData.lat != null && { lat: formData.lat, lng: formData.lng }),
      };

      const response: any = await clientsAPI.update(client.id, updateData);

      if (response.success) {
        console.log('✅ Client updated successfully:', response.data.client);
        CacheInvalidators.invalidateClients(String(client.id));
        await refreshClients();
        onClose();
      } else {
        throw new Error(response.message || 'Failed to update client');
      }
    } catch (err: any) {
      console.error('Failed to update client:', err);
      setError(err.message || 'Failed to update client. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-zinc-900 z-10 flex items-center justify-between p-6 border-b border-slate-200 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
              <User size={20} className="text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-lg font-black text-pine dark:text-zinc-100 uppercase tracking-tight">
              Edit Client
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
            disabled={isSubmitting}
          >
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 rounded-2xl">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Name fields */}
            <div className="md:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-2">Title</label>
                <div className="relative">
                  <select
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam appearance-none font-black"
                  >
                    {TITLES.map(t => <option key={t} value={t}>{t || '—'}</option>)}
                  </select>
                  <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-2">First Name *</label>
                <input
                  type="text"
                  required
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam"
                  placeholder="Alice"
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-2">Second Name</label>
                <input
                  type="text"
                  value={formData.secondName}
                  onChange={(e) => setFormData({ ...formData, secondName: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam"
                  placeholder="Wanjiru"
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-2">Surname *</label>
                <input
                  type="text"
                  required
                  value={formData.surname}
                  onChange={(e) => setFormData({ ...formData, surname: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam"
                  placeholder="Mwikali"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-2">
                Email
              </label>
              <div className="relative">
                <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam"
                  placeholder="email@example.com"
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-2">
                Phone *
              </label>
              <div className="relative">
                <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam"
                  placeholder="+254 700 000000"
                />
              </div>
            </div>

            {/* Address */}
            <div className="md:col-span-2">
              <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-2">
                Address
              </label>
              <div className="relative">
                <MapPin size={18} className="absolute left-4 top-4 text-slate-400" />
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam resize-none"
                  rows={2}
                  placeholder="Enter address"
                />
              </div>
            </div>

            {/* Country */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-2">
                Country
              </label>
              <div className="relative">
                <Globe size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <select
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam appearance-none"
                >
                  {COUNTRIES.map(c => <option key={c.code} value={c.name}>{c.name}</option>)}
                </select>
              </div>
            </div>

            {/* Gender */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-2">
                Gender
              </label>
              <select
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value as 'Male' | 'Female' | 'Other' })}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam appearance-none"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* Date of Birth */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-2">
                Date of Birth
              </label>
              <div className="relative">
                <Calendar size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="date"
                  value={formData.dob}
                  onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam"
                />
              </div>
            </div>

            {/* Region */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-2">
                Region
              </label>
              <select
                value={formData.region}
                onChange={(e) => setFormData({ ...formData, region: e.target.value as ClientRegion })}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam appearance-none"
              >
                {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>

          {/* GPS Location */}
          <div className="md:col-span-2 pt-2 border-t border-slate-100 dark:border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Map size={15} className="text-cyan-500" />
                <span className="text-xs font-black text-pine dark:text-zinc-300 uppercase tracking-widest">GPS Location</span>
              </div>
              <button
                type="button"
                onClick={handleUseMyLocation}
                disabled={geoLoading}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 text-cyan-600 dark:text-cyan-400 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-cyan-100 transition-all disabled:opacity-50"
              >
                {geoLoading ? <Loader2 size={10} className="animate-spin"/> : <Navigation size={10}/>}
                My Location
              </button>
            </div>

            <ClickableMap
              lat={formData.lat}
              lng={formData.lng}
              height={200}
              onPick={(lat, lng) => setFormData(f => ({ ...f, lat, lng }))}
            />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-1.5">Latitude</label>
                <input
                  type="number" step="any"
                  value={formData.lat ?? ''}
                  onChange={e => setFormData(f => ({ ...f, lat: e.target.value ? parseFloat(e.target.value) : null }))}
                  placeholder="-1.286389"
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-pine dark:text-zinc-100 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400/30"
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-1.5">Longitude</label>
                <input
                  type="number" step="any"
                  value={formData.lng ?? ''}
                  onChange={e => setFormData(f => ({ ...f, lng: e.target.value ? parseFloat(e.target.value) : null }))}
                  placeholder="36.817223"
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-pine dark:text-zinc-100 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400/30"
                />
              </div>
            </div>
          </div>

          {/* Internal Notes */}
          <div className="md:col-span-2 pt-2 border-t border-slate-100 dark:border-zinc-800 space-y-3">
            <div className="flex items-center gap-2">
              <FileText size={15} className="text-seafoam" />
              <span className="text-xs font-black text-pine dark:text-zinc-300 uppercase tracking-widest">Internal Notes</span>
            </div>

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

            <div className="flex gap-2">
              <input
                type="text"
                value={noteInput}
                onChange={e => setNoteInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addNote(); } }}
                className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam/20"
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

          {/* Risk & Credit */}
          <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 space-y-4">
            <div className="flex items-center gap-2">
              <ShieldAlert size={15} className="text-orange-500" />
              <span className="text-xs font-black text-pine dark:text-zinc-300 uppercase tracking-widest">Risk & Credit</span>
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-2">Client Type</label>
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

            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-2">Notes / Description</label>
              <textarea
                rows={2}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam resize-none text-sm"
                placeholder={CLIENT_TYPES.find(t => t.value === clientType)?.description || 'e.g. Aggressive, doesn\'t pay on time…'}
                value={clientTypeNote}
                onChange={e => setClientTypeNote(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-2">Max Debt ({client.currency || 'KES'})</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam"
                  placeholder="0.00"
                  value={maxDebt}
                  onChange={e => setMaxDebt(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-2">Risk Score (0–100)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam"
                  placeholder="0"
                  value={clientRiskRate}
                  onChange={e => setClientRiskRate(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-6 py-3 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 rounded-xl font-black text-sm uppercase tracking-wide hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-6 py-3 bg-seafoam text-white rounded-xl font-black text-sm uppercase tracking-wide hover:bg-seafoam/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-seafoam/20 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={18} />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditClientModal;
