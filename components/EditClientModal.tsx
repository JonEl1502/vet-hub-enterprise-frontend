import React, { useState, useEffect } from 'react';
import { X, User, Mail, Phone, MapPin, Globe, Calendar, Loader2, Save } from 'lucide-react';
import { Client, ClientRegion } from '../types';
import { COUNTRIES } from '../constants';
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

const EditClientModal: React.FC<EditClientModalProps> = ({ isOpen, onClose, client }) => {
  const { refreshClients } = useData();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formatDob = (dob: string | undefined): string => {
    if (!dob) return '1990-01-01';
    return dob.includes('T') ? dob.split('T')[0] : dob;
  };

  const [formData, setFormData] = useState({
    name: client.name,
    email: client.email || '',
    phone: client.phone,
    address: client.address || '',
    country: client.country || 'Kenya',
    gender: client.gender || 'Female',
    region: (client.region || 'Local') as ClientRegion,
    dob: formatDob(client.dob),
  });

  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: client.name,
        email: client.email || '',
        phone: client.phone,
        address: client.address || '',
        country: client.country || 'Kenya',
        gender: client.gender || 'Female',
        region: (client.region || 'Local') as ClientRegion,
        dob: formatDob(client.dob),
      });
      setError(null);
    }
  }, [isOpen, client]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const updateData = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        country: formData.country,
        gender: formData.gender,
        dob: formData.dob ? new Date(formData.dob).toISOString() : undefined,
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
            {/* Name */}
            <div className="md:col-span-2">
              <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-2">
                Full Name *
              </label>
              <div className="relative">
                <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam"
                  placeholder="Enter full name"
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
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
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
