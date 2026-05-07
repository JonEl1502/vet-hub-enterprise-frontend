import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Transition } from '@headlessui/react';
import { X, Search, Pill, AlertCircle, Loader2, Trash2, RefreshCw, Minus, Plus } from 'lucide-react';
import { InventoryItem } from '../../../../services';
import { motion, AnimatePresence } from 'framer-motion';

// Units that typically take fractional doses
const FRACTIONAL_UNITS = new Set(['ml', 'mg', 'g', 'l', 'cc', 'mcg', 'iu']);
const stepFor = (unit?: string) => (unit && FRACTIONAL_UNITS.has(unit.toLowerCase()) ? 0.1 : 1);
const formatQty = (n: number) => (Number.isInteger(n) ? n.toString() : n.toFixed(2).replace(/\.?0+$/, ''));

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

  const searchInputRef = useRef<HTMLInputElement>(null);
  const selectedCardRef = useRef<HTMLButtonElement>(null);

  // Reset state and focus search when the panel reopens.
  useEffect(() => {
    if (isOpen) {
      setSelectedMedicationId('');
      setQuantity(1);
      setNotes('');
      setSearchQuery('');
      // Defer to allow the slide-in transition to complete.
      const t = setTimeout(() => searchInputRef.current?.focus(), 250);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  const filteredMedications = useMemo(() => {
    if (!searchQuery) return availableMedications;
    const query = searchQuery.toLowerCase();
    return availableMedications.filter(m =>
      m.name.toLowerCase().includes(query) ||
      m.sku?.toLowerCase().includes(query) ||
      m.category?.toLowerCase().includes(query) ||
      m.unit?.toLowerCase().includes(query)
    );
  }, [availableMedications, searchQuery]);

  const selectedMedication = availableMedications.find(m => m.id === selectedMedicationId);

  // Reset quantity to a unit-appropriate default when selection changes.
  useEffect(() => {
    if (selectedMedication) {
      setQuantity(stepFor(selectedMedication.unit));
    }
  }, [selectedMedicationId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll the selected card into view so the user can confirm their pick
  // before adjusting quantity below.
  useEffect(() => {
    if (selectedMedicationId) {
      selectedCardRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedMedicationId]);

  const isExpired = !!(selectedMedication?.expiryDate && new Date(selectedMedication.expiryDate) < new Date());
  const overStock = !!(selectedMedication && quantity > selectedMedication.quantity);
  const invalidQty = quantity <= 0;
  const canAdd = !!selectedMedicationId && !invalidQty && !overStock && !isExpired;

  const subtotal = selectedMedication ? quantity * (selectedMedication.price || 0) : 0;
  const remainingAfter = selectedMedication ? Math.max(0, selectedMedication.quantity - quantity) : 0;

  const adjustQty = (delta: number) => {
    const step = stepFor(selectedMedication?.unit);
    setQuantity((q) => {
      const next = Math.max(0, +(q + delta * step).toFixed(2));
      return selectedMedication ? Math.min(next, selectedMedication.quantity) : next;
    });
  };

  const handleAdd = () => {
    if (!canAdd || !selectedMedication) return;
    onAddMedication(selectedMedicationId, quantity, notes);
    setSelectedMedicationId('');
    setQuantity(1);
    setNotes('');
  };

  // Enter in the search field selects the only result, or adds when one is selected.
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    if (selectedMedicationId && canAdd) {
      e.preventDefault();
      handleAdd();
    } else if (filteredMedications.length === 1) {
      e.preventDefault();
      setSelectedMedicationId(filteredMedications[0].id);
    }
  };

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
                              {med.inventoryItem?.sku ? `SKU: ${med.inventoryItem.sku}` : `ID: ${med.inventoryItem?.id ?? ''}`}
                            </p>
                            <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                              Qty used: {formatQty(med.quantity)} {med.inventoryItem?.unit || 'units'}
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
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search by name, SKU, category, unit…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    className="w-full pl-10 pr-9 py-2.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-purple-500/20"
                  />
                  {searchQuery && (
                    <button type="button" onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-pine dark:hover:text-zinc-100 transition-colors">
                      <X size={14} />
                    </button>
                  )}
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
                      filteredMedications.map((med) => {
                        const expired = !!(med.expiryDate && new Date(med.expiryDate) < new Date());
                        const out = med.status === 'OUT_OF_STOCK' || med.quantity <= 0;
                        const disabled = expired || out;
                        return (
                          <button
                            key={med.id}
                            ref={selectedMedicationId === med.id ? selectedCardRef : undefined}
                            onClick={() => !disabled && setSelectedMedicationId(med.id)}
                            disabled={disabled}
                            className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                              selectedMedicationId === med.id
                                ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/20'
                                : disabled
                                ? 'border-slate-200 dark:border-zinc-800 opacity-50 cursor-not-allowed'
                                : 'border-slate-200 dark:border-zinc-800 hover:border-purple-300 dark:hover:border-purple-700'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-sm text-pine dark:text-zinc-100 truncate">
                                  {med.name}
                                </p>
                                <p className="text-[9px] text-slate-400 dark:text-zinc-500 font-mono mt-0.5 truncate">
                                  {med.sku ? `SKU: ${med.sku}` : `ID: ${med.id}`}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                                  {med.category} • <span className="font-bold text-pine dark:text-zinc-200">{formatQty(med.quantity)} {med.unit}</span> in stock
                                  {med.price > 0 && ` • ${med.price}/${med.unit}`}
                                </p>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {expired && (
                                    <span className="px-2 py-0.5 bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400 text-[8px] font-black uppercase rounded">
                                      Expired
                                    </span>
                                  )}
                                  {out && !expired && (
                                    <span className="px-2 py-0.5 bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400 text-[8px] font-black uppercase rounded">
                                      Out of stock
                                    </span>
                                  )}
                                  {med.status === 'LOW_STOCK' && !out && !expired && (
                                    <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 text-[8px] font-black uppercase rounded">
                                      Low stock
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </button>
                        );
                      })
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
                      <div className="flex items-baseline justify-between mb-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          Amount ({selectedMedication.unit})
                        </label>
                        <span className="text-[9px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                          Step {formatQty(stepFor(selectedMedication.unit))}
                        </span>
                      </div>
                      <div className="flex items-stretch gap-2">
                        <button
                          type="button"
                          onClick={() => adjustQty(-1)}
                          disabled={quantity <= 0}
                          className="px-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-pine dark:text-zinc-100 hover:bg-purple-50 dark:hover:bg-purple-950/30 disabled:opacity-40 transition-all active:scale-95"
                          aria-label="Decrease amount"
                        >
                          <Minus size={14} />
                        </button>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          max={selectedMedication.quantity}
                          value={quantity}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value);
                            setQuantity(isNaN(v) ? 0 : v);
                          }}
                          className={`flex-1 min-w-0 px-3 py-2 bg-white dark:bg-zinc-900 border rounded-lg text-sm text-center text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-purple-500/20 ${
                            overStock || invalidQty
                              ? 'border-red-400 dark:border-red-700'
                              : 'border-slate-200 dark:border-zinc-800'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => adjustQty(1)}
                          disabled={quantity >= selectedMedication.quantity}
                          className="px-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-pine dark:text-zinc-100 hover:bg-purple-50 dark:hover:bg-purple-950/30 disabled:opacity-40 transition-all active:scale-95"
                          aria-label="Increase amount"
                        >
                          <Plus size={14} />
                        </button>
                      </div>

                      {/* Live preview: cost + remaining stock */}
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg px-2 py-1.5">
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Subtotal</p>
                          <p className="text-sm font-black text-pine dark:text-zinc-100">
                            {selectedMedication.price > 0
                              ? subtotal.toFixed(2)
                              : '—'}
                          </p>
                        </div>
                        <div className={`border rounded-lg px-2 py-1.5 ${
                          remainingAfter === 0
                            ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800'
                            : remainingAfter <= selectedMedication.minThreshold
                            ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800'
                            : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-700'
                        }`}>
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">After finalize</p>
                          <p className="text-sm font-black text-pine dark:text-zinc-100">
                            {formatQty(remainingAfter)} {selectedMedication.unit}
                          </p>
                        </div>
                      </div>

                      {/* Validation messages */}
                      {(overStock || invalidQty || isExpired) && (
                        <p className="text-[10px] font-bold text-red-600 dark:text-red-400 mt-2 flex items-center gap-1">
                          <AlertCircle size={11} />
                          {isExpired
                            ? 'This medication has expired and cannot be used.'
                            : overStock
                            ? `Exceeds available stock (${formatQty(selectedMedication.quantity)} ${selectedMedication.unit}).`
                            : 'Amount must be greater than zero.'}
                        </p>
                      )}
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
                      disabled={!canAdd}
                      className="w-full bg-purple-500 hover:bg-purple-600 disabled:bg-slate-300 dark:disabled:bg-zinc-700 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all active:scale-95"
                    >
                      Reserve & Add to Task
                    </button>
                    <p className="text-[9px] text-slate-500 dark:text-zinc-400 text-center -mt-1">
                      Stock will be deducted when the appointment is finalized.
                    </p>
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

