import React, { useState, useMemo } from 'react';
import { Transition } from '@headlessui/react';
import { X, Search, Pill, AlertCircle, Loader2, Trash2, RefreshCw } from 'lucide-react';
import { InventoryItem } from '../../services';
import { motion, AnimatePresence } from 'framer-motion';

interface TaskMedication {
  id: string;
  inventoryItem: InventoryItem;
  quantity: number;
  notes?: string;
  isDeducted: boolean;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  taskName: string;
  availableMedications: InventoryItem[];
  currentMedications: TaskMedication[];
  loading: boolean;
  error?: string;
  onAddMedication: (medicationId: string, quantity: number, notes: string) => void;
  onRemoveMedication: (medicationId: string) => void;
  onRefresh: () => void;
}

const MedicationPanel: React.FC<Props> = ({
  isOpen,
  onClose,
  taskName,
  availableMedications,
  currentMedications,
  loading,
  error,
  onAddMedication,
  onRemoveMedication,
  onRefresh,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMedicationId, setSelectedMedicationId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');

  const filteredMedications = useMemo(() => {
    if (!searchQuery) return availableMedications;
    const query = searchQuery.toLowerCase();
    return availableMedications.filter(m =>
      m.name.toLowerCase().includes(query) ||
      m.sku?.toLowerCase().includes(query) ||
      m.category?.toLowerCase().includes(query)
    );
  }, [availableMedications, searchQuery]);

  const handleAdd = () => {
    if (selectedMedicationId && quantity > 0) {
      onAddMedication(selectedMedicationId, quantity, notes);
      setSelectedMedicationId('');
      setQuantity(1);
      setNotes('');
    }
  };

  const selectedMedication = availableMedications.find(m => m.id === selectedMedicationId);

  return (
    <Transition show={isOpen} as={React.Fragment}>
      <div className="fixed inset-0 z-50 overflow-hidden">
        {/* Backdrop */}
        <Transition.Child
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        </Transition.Child>

        {/* Panel */}
        <Transition.Child
          enter="transform transition ease-out duration-300"
          enterFrom="translate-x-full"
          enterTo="translate-x-0"
          leave="transform transition ease-in duration-200"
          leaveFrom="translate-x-0"
          leaveTo="translate-x-full"
        >
          <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white dark:bg-zinc-900 shadow-2xl flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500/10 rounded-xl">
                    <Pill size={20} className="text-purple-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-pine dark:text-zinc-100 uppercase">
                      Medications
                    </h3>
                    <p className="text-[9px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-widest">
                      {taskName}
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-lg transition-all"
                >
                  <X size={20} className="text-slate-400" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Current Medications */}
              {currentMedications.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-widest">
                    Current Medications
                  </h4>
                  <AnimatePresence>
                    {currentMedications.map((med) => (
                      <motion.div
                        key={med.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-xl p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <p className="font-bold text-sm text-pine dark:text-zinc-100">
                              {med.inventoryItem?.name || 'Unknown'}
                            </p>
                            <p className="text-[9px] text-slate-400 dark:text-zinc-500 font-mono mt-0.5">
                              ID: {med.inventoryItem?.id ?? med.inventoryItemId}
                              {med.inventoryItem?.sku ? ` · SKU: ${med.inventoryItem.sku}` : ''}
                            </p>
                            <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                              Qty used: {med.quantity} {med.inventoryItem?.unit || 'units'}
                            </p>
                            {med.notes && (
                              <p className="text-[10px] text-slate-600 dark:text-zinc-400 mt-1">
                                {med.notes}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => onRemoveMedication(med.id)}
                            className="p-1.5 hover:bg-red-100 dark:hover:bg-red-950/30 rounded-lg transition-all"
                          >
                            <Trash2 size={14} className="text-red-500" />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}

              {/* Add Medication */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-widest">
                    Add Medication
                  </h4>
                  <button
                    onClick={onRefresh}
                    disabled={loading}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-all"
                  >
                    <RefreshCw size={14} className={`text-slate-400 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                {/* Search */}
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search medications..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-purple-500/20"
                  />
                </div>

                {/* Error */}
                {error && (
                  <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl p-3 flex items-start gap-2">
                    <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
                  </div>
                )}

                {/* Medication List */}
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 size={32} className="animate-spin text-purple-500" />
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                    {filteredMedications.length === 0 ? (
                      <div className="text-center py-12">
                        <Pill size={48} className="mx-auto mb-4 text-slate-300 dark:text-zinc-700" />
                        <p className="font-bold text-slate-400">No medications found</p>
                      </div>
                    ) : (
                      filteredMedications.map((med) => (
                        <button
                          key={med.id}
                          onClick={() => setSelectedMedicationId(med.id)}
                          className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                            selectedMedicationId === med.id
                              ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/20'
                              : 'border-slate-200 dark:border-zinc-800 hover:border-purple-300 dark:hover:border-purple-700'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <p className="font-bold text-sm text-pine dark:text-zinc-100">
                                {med.name}
                              </p>
                              <p className="text-[9px] text-slate-400 dark:text-zinc-500 font-mono mt-0.5">
                                ID: {med.id}{med.sku ? ` · SKU: ${med.sku}` : ''}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                                {med.category} • {med.quantity} {med.unit} available
                              </p>
                              {med.status === 'LOW_STOCK' && (
                                <span className="inline-block mt-1 px-2 py-0.5 bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 text-[8px] font-black uppercase rounded">
                                  Low Stock
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}

                {/* Quantity & Notes */}
                {selectedMedication && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-3 p-4 bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700"
                  >
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                        Quantity
                      </label>
                      <input
                        type="number"
                        min="1"
                        max={selectedMedication.quantity}
                        value={quantity}
                        onChange={(e) => setQuantity(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg text-sm text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-purple-500/20"
                      />
                      <p className="text-[9px] text-slate-500 dark:text-zinc-400 mt-1">
                        Max: {selectedMedication.quantity} {selectedMedication.unit}
                      </p>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                        Notes (Optional)
                      </label>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Administration instructions..."
                        rows={2}
                        className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg text-sm text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-purple-500/20 resize-none"
                      />
                    </div>

                    <button
                      onClick={handleAdd}
                      className="w-full bg-purple-500 hover:bg-purple-600 text-white px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all active:scale-95"
                    >
                      Add to Task
                    </button>
                  </motion.div>
                )}
              </div>
            </div>
          </div>
        </Transition.Child>
      </div>
    </Transition>
  );
};

export default MedicationPanel;

