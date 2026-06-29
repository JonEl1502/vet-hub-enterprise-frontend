import React, { useEffect, useMemo, useState } from 'react';
import { Pill, Search, Plus, Minus, Trash2, Loader2, CheckCircle2, UserPlus, X, Wallet, AlertTriangle, CalendarClock, PackageSearch, ClipboardList, TrendingDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { useData } from '../../../contexts/DataContext';
import { petshopAPI, walletAPI, stockMovementsAPI } from '../../../services';
import type { Wallet as WalletData } from '../../../services';
import type { InventoryItem } from '../../../services/modules/inventory.api';
import type { StockMovement } from '../../../services/modules/stockMovements.api';

interface DispenseLine { item: InventoryItem; qty: number; unitPrice: number }
interface Props { activeClinic?: { id: number | string; currency?: string } }

const CASH_OPTION = '__cash__';

// A wallet "is" a payment method by where the money lands.
const walletTypeToMethod = (t: WalletData['walletType']): string => {
  switch (t) {
    case 'MPESA_POCHI': case 'TILL': case 'MPESA_PAYBILL': return 'M_PESA';
    case 'BANK': case 'BANK_PAYBILL': return 'BANK_TRANSFER';
    case 'DIGITAL_WALLET': return 'CARD';
    default: return 'CASH';
  }
};

// Identify medication/drug inventory items: a dispensable pharmaceutical form,
// or a drug-ish category/name. Non-drug stock (food, accessories) is excluded
// unless the user flips "All items" on.
const DRUG_FORMS = new Set(['TABLET', 'CAPSULE', 'VIAL', 'BOTTLE', 'AMPOULE', 'TUBE', 'SACHET']);
const MED_KEYWORDS = /(drug|medic|pharma|antibiotic|antib|vaccine|analges|nsaid|dewormer|antiparasit|steroid|injectable|injection|syrup|ointment|antifungal|antiviral|sedative|anaesth|anesth)/i;
const looksMedicinal = (name?: string, category?: string) => MED_KEYWORDS.test(name || '') || MED_KEYWORDS.test(category || '');
const isMedication = (i: InventoryItem) => (!!i.form && DRUG_FORMS.has(i.form)) || looksMedicinal(i.name, i.category);

const daysUntil = (iso?: string): number | null => {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / 86400000);
};

const PharmacyView: React.FC<Props> = ({ activeClinic }) => {
  const { inventory, clients, ensureInventory, ensureClients, refreshInventory } = useData() as any;
  useEffect(() => { ensureInventory?.(); ensureClients?.(); }, [ensureInventory, ensureClients]);

  const currency = activeClinic?.currency || 'KES';
  const [tab, setTab] = useState<'stock' | 'dispensing'>('stock');
  const [medsOnly, setMedsOnly] = useState(true);

  // ── Stock + dispense cart ──────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<DispenseLine[]>([]);
  const [discountType, setDiscountType] = useState<'NONE' | 'PERCENTAGE' | 'FIXED'>('NONE');
  const [discountValue, setDiscountValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<string | null>(null);

  const [clientId, setClientId] = useState('');
  const [clientQuery, setClientQuery] = useState('');
  const [showClientList, setShowClientList] = useState(false);
  const [walkIn, setWalkIn] = useState(false);
  const [walkInName, setWalkInName] = useState('');
  const [walkInPhone, setWalkInPhone] = useState('');
  const [notes, setNotes] = useState('');

  const [wallets, setWallets] = useState<WalletData[]>([]);
  const [selectedWalletId, setSelectedWalletId] = useState<string>(CASH_OPTION);

  useEffect(() => {
    if (!activeClinic?.id) return;
    let cancelled = false;
    (async () => {
      try {
        await walletAPI.ensure('CLINIC', String(activeClinic.id)).catch(() => {});
        const res = await walletAPI.getByEntity('CLINIC', String(activeClinic.id));
        if (cancelled || !res.success) return;
        const active = (res.data.wallets || []).filter(w => w.isActive !== false);
        setWallets(active);
        const main = active.find(w => (w as any).isMain) || active[0];
        if (main) setSelectedWalletId(String(main.id));
      } catch { /* empty state shows Cash only */ }
    })();
    return () => { cancelled = true; };
  }, [activeClinic?.id]);

  const paymentMethod = useMemo(() => {
    if (selectedWalletId === CASH_OPTION) return 'CASH';
    const w = wallets.find(x => String(x.id) === selectedWalletId);
    return w ? walletTypeToMethod(w.walletType) : 'CASH';
  }, [selectedWalletId, wallets]);

  const meds = useMemo(() => {
    const all = (inventory || []) as InventoryItem[];
    return medsOnly ? all.filter(isMedication) : all.filter(i => i.billable !== false);
  }, [inventory, medsOnly]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q ? meds.filter(i => i.name.toLowerCase().includes(q) || (i.sku || '').toLowerCase().includes(q) || (i.category || '').toLowerCase().includes(q)) : meds;
    return list.slice(0, 80);
  }, [meds, search]);

  // ── Stock summary tiles ────────────────────────────────────────────────
  const stats = useMemo(() => {
    let low = 0, expiring = 0, value = 0;
    for (const i of meds) {
      if (i.quantity <= 0 || i.quantity <= i.minThreshold) low++;
      const d = daysUntil(i.expiryDate);
      if (d !== null && d <= 30) expiring++;
      value += (i.price || 0) * (i.quantity || 0);
    }
    return { count: meds.length, low, expiring, value };
  }, [meds]);

  const clientMatches = useMemo(() => {
    const q = clientQuery.trim().toLowerCase();
    if (!q) return (clients || []).slice(0, 8);
    return (clients || []).filter((c: any) => (c.name || '').toLowerCase().includes(q) || (c.phone || '').toLowerCase().includes(q)).slice(0, 8);
  }, [clients, clientQuery]);
  const selectedClient = useMemo(() => (clients || []).find((c: any) => String(c.id) === clientId), [clients, clientId]);

  const inCart = (id: string) => cart.find(l => l.item.id === id);
  const addToCart = (item: InventoryItem) => {
    if (item.quantity <= 0) { toast.error(`${item.name} is out of stock`); return; }
    setCart(prev => {
      const ex = prev.find(l => l.item.id === item.id);
      if (ex) {
        if (ex.qty + 1 > item.quantity) { toast.error(`Only ${item.quantity} ${item.unit} of ${item.name} in stock`); return prev; }
        return prev.map(l => l.item.id === item.id ? { ...l, qty: l.qty + 1 } : l);
      }
      return [...prev, { item, qty: 1, unitPrice: item.price }];
    });
  };
  const setQty = (id: string, qty: number) => setCart(prev => prev.flatMap(l => {
    if (l.item.id !== id) return [l];
    if (qty <= 0) return [];
    if (qty > l.item.quantity) { toast.error(`Only ${l.item.quantity} in stock`); return [l]; }
    return [{ ...l, qty }];
  }));
  const setLinePrice = (id: string, price: number) => setCart(prev => prev.map(l => l.item.id === id ? { ...l, unitPrice: price } : l));
  const removeLine = (id: string) => setCart(prev => prev.filter(l => l.item.id !== id));

  const subtotal = cart.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const discountAmount = useMemo(() => {
    const v = Number(discountValue) || 0;
    if (discountType === 'PERCENTAGE') return Math.min(subtotal, (subtotal * v) / 100);
    if (discountType === 'FIXED') return Math.min(subtotal, v);
    return 0;
  }, [discountType, discountValue, subtotal]);
  const total = subtotal - discountAmount;

  const dispense = async () => {
    if (!cart.length) { toast.error('Add medication to dispense'); return; }
    if (walkIn && !walkInName.trim()) { toast.error('Enter the walk-in customer name'); return; }
    setSaving(true);
    try {
      // Reuse the counter-sale path: it deducts stock + issues a receipt and
      // records a stock movement, which is exactly a dispensing event.
      const res = await petshopAPI.checkout({
        clientId: !walkIn && clientId ? clientId : undefined,
        walkInData: walkIn ? { firstName: walkInName.trim(), phone: walkInPhone.trim() || undefined } : undefined,
        items: cart.map(l => ({ inventoryItemId: l.item.id, quantity: l.qty, unitPrice: l.unitPrice })),
        paymentMethod,
        walletId: selectedWalletId !== CASH_OPTION ? selectedWalletId : undefined,
        discountType: discountType === 'NONE' ? undefined : discountType,
        discountValue: discountType === 'NONE' ? undefined : Number(discountValue) || 0,
        notes: notes.trim() || undefined,
      } as any);
      if (res.success && res.data) {
        setLastReceipt(res.data.receiptNumber);
        toast.success(`Dispensed · ${res.data.receiptNumber}`);
        setCart([]); setDiscountType('NONE'); setDiscountValue(''); setNotes('');
        setClientId(''); setClientQuery(''); setWalkIn(false); setWalkInName(''); setWalkInPhone('');
        (refreshInventory || ensureInventory)?.();
        if (tab === 'dispensing') loadLog();
      }
    } catch (e: any) { toast.error(e?.message || 'Dispense failed'); }
    finally { setSaving(false); }
  };

  // ── Dispensing log ─────────────────────────────────────────────────────
  const [log, setLog] = useState<StockMovement[]>([]);
  const [logLoading, setLogLoading] = useState(false);
  const [startDate, setStartDate] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10); });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));

  const invById = useMemo(() => {
    const m: Record<string, InventoryItem> = {};
    for (const i of (inventory || []) as InventoryItem[]) m[String(i.id)] = i;
    return m;
  }, [inventory]);

  const loadLog = async () => {
    setLogLoading(true);
    try {
      const res = await stockMovementsAPI.getAll({ startDate, endDate, page: 1, limit: 200 } as any, { cache: false });
      const rows = ((res.data as any)?.data || []) as StockMovement[];
      // Dispensing = stock leaving the shelf to a patient/customer: used in a
      // visit, or sold/dispensed over the counter. (SOLD isn't in the FE union
      // yet but the backend emits it for counter sales.)
      const dispensed = rows.filter(r => ['USED_IN_APPOINTMENT', 'SOLD'].includes(String(r.movementType)));
      setLog(dispensed);
    } catch (e: any) { toast.error(e?.message || 'Failed to load dispensing log'); }
    finally { setLogLoading(false); }
  };
  useEffect(() => { if (tab === 'dispensing') loadLog(); /* eslint-disable-next-line */ }, [tab, startDate, endDate]);

  const logRows = useMemo(() => {
    if (!medsOnly) return log;
    return log.filter(r => {
      const inv = invById[String(r.inventoryItemId)];
      if (inv) return isMedication(inv);
      return looksMedicinal(r.inventoryItem?.name, r.inventoryItem?.category);
    });
  }, [log, medsOnly, invById]);

  const fieldCls = 'w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam';

  return (
    <div className="space-y-6 pb-20">
      <header className="flex flex-wrap items-center gap-3 pb-6 border-b border-slate-200 dark:border-zinc-800">
        <div className="w-12 h-12 rounded-xl bg-seafoam/10 flex items-center justify-center text-seafoam"><Pill size={22} /></div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-black text-pine dark:text-zinc-100 tracking-tighter uppercase leading-none">Pharmacy</h1>
          <p className="text-slate-400 dark:text-zinc-500 font-black text-[10px] uppercase tracking-widest mt-1">Dispensing &amp; medication stock {lastReceipt ? `· last: ${lastReceipt}` : ''}</p>
        </div>
        <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500 cursor-pointer select-none">
          <input type="checkbox" checked={medsOnly} onChange={e => setMedsOnly(e.target.checked)} className="accent-seafoam" /> Medications only
        </label>
      </header>

      {/* Tabs */}
      <div className="flex gap-1.5 bg-slate-100 dark:bg-zinc-900 rounded-xl p-1 w-fit">
        {([['stock', 'Stock', PackageSearch], ['dispensing', 'Dispensing log', ClipboardList]] as const).map(([id, label, Icon]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all ${tab === id ? 'bg-white dark:bg-zinc-800 text-pine dark:text-zinc-100 shadow-sm' : 'text-slate-400'}`}>
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {tab === 'stock' && (
        <>
          {/* Summary tiles */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Medications', value: stats.count.toLocaleString(), icon: Pill, tone: 'text-seafoam' },
              { label: 'Low / out of stock', value: stats.low.toLocaleString(), icon: TrendingDown, tone: 'text-amber-500' },
              { label: 'Expiring ≤30d', value: stats.expiring.toLocaleString(), icon: AlertTriangle, tone: 'text-rose-500' },
              { label: 'Stock value', value: `${currency} ${Math.round(stats.value).toLocaleString()}`, icon: Wallet, tone: 'text-pine dark:text-zinc-100' },
            ].map(s => (
              <div key={s.label} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-3.5">
                <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-slate-400"><s.icon size={12} /> {s.label}</div>
                <p className={`text-xl font-black mt-1 ${s.tone}`}>{s.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Catalogue */}
            <div className="lg:col-span-2 space-y-3">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input className={`${fieldCls} pl-9`} placeholder="Search medication by name, SKU, category…" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {filtered.map(item => {
                  const out = item.quantity <= 0;
                  const low = !out && item.quantity <= item.minThreshold;
                  const exp = daysUntil(item.expiryDate);
                  const expiringSoon = exp !== null && exp <= 30;
                  const sel = inCart(item.id);
                  return (
                    <button key={item.id} onClick={() => addToCart(item)} disabled={out}
                      className={`text-left p-3 rounded-xl border transition-all ${out ? 'opacity-40 cursor-not-allowed border-slate-200 dark:border-zinc-800' : sel ? 'border-seafoam bg-seafoam/5' : 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-seafoam'}`}>
                      <p className="text-xs font-black text-pine dark:text-zinc-100 truncate">{item.name}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider truncate">{item.form || item.category}</p>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-sm font-black font-mono text-seafoam">{item.price.toLocaleString()}</span>
                        <span className={`text-[8px] font-black uppercase ${out ? 'text-rose-500' : low ? 'text-amber-500' : 'text-slate-400'}`}>{out ? 'Out' : `${item.quantity} ${item.unit}`}</span>
                      </div>
                      {expiringSoon && !out && (
                        <p className={`text-[8px] font-black uppercase mt-1 flex items-center gap-1 ${exp !== null && exp < 0 ? 'text-rose-500' : 'text-amber-500'}`}>
                          <CalendarClock size={9} /> {exp !== null && exp < 0 ? 'Expired' : `Exp ${exp}d`}
                        </p>
                      )}
                    </button>
                  );
                })}
                {filtered.length === 0 && <div className="col-span-full py-16 text-center text-[10px] font-black uppercase tracking-widest text-slate-300 flex flex-col items-center gap-2"><Pill size={24} /> No medications {medsOnly ? '— try “Medications only” off' : ''}</div>}
              </div>
            </div>

            {/* Dispense cart */}
            <div className="space-y-3">
              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm space-y-3">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Pill size={12} /> Dispense ({cart.length})</p>
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {cart.length === 0 && <p className="text-[10px] text-slate-400 py-4 text-center">Tap a medication to dispense it.</p>}
                  {cart.map(l => (
                    <div key={l.item.id} className="border border-slate-100 dark:border-zinc-800 rounded-xl p-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] font-black text-pine dark:text-zinc-100 truncate flex-1">{l.item.name}</p>
                        <button onClick={() => removeLine(l.item.id)} className="text-slate-400 hover:text-rose-500"><Trash2 size={12} /></button>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-1.5">
                        <div className="flex items-center gap-1">
                          <button onClick={() => setQty(l.item.id, l.qty - 1)} className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-500"><Minus size={11} /></button>
                          <input value={l.qty} onChange={e => setQty(l.item.id, Number(e.target.value) || 0)} className="w-10 text-center text-xs font-black bg-transparent text-pine dark:text-zinc-100" />
                          <button onClick={() => setQty(l.item.id, l.qty + 1)} className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-500"><Plus size={11} /></button>
                        </div>
                        <input type="number" value={l.unitPrice} onChange={e => setLinePrice(l.item.id, Number(e.target.value) || 0)} className="w-20 px-2 py-1 text-right text-xs font-mono font-bold bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg" />
                        <span className="text-xs font-black font-mono text-pine dark:text-zinc-100 w-16 text-right">{(l.unitPrice * l.qty).toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Patient/Client — searchable */}
                <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 space-y-2">
                  {!walkIn ? (
                    selectedClient ? (
                      <div className="flex items-center justify-between gap-2 px-3 py-2.5 bg-seafoam/10 border border-seafoam/30 rounded-xl">
                        <span className="text-sm font-bold text-pine dark:text-zinc-100 truncate">{selectedClient.name}</span>
                        <button onClick={() => { setClientId(''); setClientQuery(''); }} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-rose-500 shrink-0">Change</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input className={`${fieldCls} pl-9`} placeholder="Search client (or leave blank for walk-in)…"
                            value={clientQuery}
                            onChange={e => { setClientQuery(e.target.value); setShowClientList(true); }}
                            onFocus={() => setShowClientList(true)}
                            onBlur={() => setTimeout(() => setShowClientList(false), 150)} />
                          {showClientList && clientMatches.length > 0 && (
                            <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-lg">
                              {clientMatches.map((c: any) => (
                                <button key={c.id} onMouseDown={() => { setClientId(String(c.id)); setShowClientList(false); }}
                                  className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-zinc-800 font-bold text-pine dark:text-zinc-100">
                                  {c.name} {c.phone && <span className="text-slate-400 text-xs font-normal">· {c.phone}</span>}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <button onClick={() => setWalkIn(true)} title="New walk-in customer" className="p-2.5 bg-slate-100 dark:bg-zinc-800 rounded-xl text-slate-500 shrink-0"><UserPlus size={15} /></button>
                      </div>
                    )
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">New walk-in customer</span>
                        <button onClick={() => setWalkIn(false)} className="text-slate-400 hover:text-rose-500"><X size={13} /></button>
                      </div>
                      <input className={fieldCls} placeholder="Name" value={walkInName} onChange={e => setWalkInName(e.target.value)} />
                      <input className={fieldCls} placeholder="Phone (optional)" value={walkInPhone} onChange={e => setWalkInPhone(e.target.value)} />
                    </div>
                  )}
                </div>

                {/* Dispensing note */}
                <input className={fieldCls} placeholder="Dispensing note (e.g. dosage, indication)…" value={notes} onChange={e => setNotes(e.target.value)} />

                {/* Discount */}
                <div className="grid grid-cols-2 gap-2">
                  <select className={fieldCls} value={discountType} onChange={e => setDiscountType(e.target.value as any)}>
                    <option value="NONE">No discount</option>
                    <option value="PERCENTAGE">% off</option>
                    <option value="FIXED">Amount off</option>
                  </select>
                  <input className={fieldCls} type="number" placeholder="Discount" disabled={discountType === 'NONE'} value={discountValue} onChange={e => setDiscountValue(e.target.value)} />
                </div>

                {/* Wallet / payment destination */}
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 mb-1"><Wallet size={11} /> Pay to wallet</label>
                  <select className={fieldCls} value={selectedWalletId} onChange={e => setSelectedWalletId(e.target.value)}>
                    <option value={CASH_OPTION}>Cash drawer (CASH)</option>
                    {wallets.map(w => <option key={w.id} value={String(w.id)}>{w.name} · {walletTypeToMethod(w.walletType).replace('_', '-')}</option>)}
                  </select>
                </div>

                {/* Totals */}
                <div className="space-y-1 pt-2 border-t border-slate-100 dark:border-zinc-800 text-xs">
                  <div className="flex justify-between text-slate-500"><span>Subtotal</span><span className="font-mono font-bold">{currency} {subtotal.toLocaleString()}</span></div>
                  {discountAmount > 0 && <div className="flex justify-between text-amber-600"><span>Discount</span><span className="font-mono font-bold">-{discountAmount.toLocaleString()}</span></div>}
                  <div className="flex justify-between text-pine dark:text-zinc-100 text-base font-black"><span>Total</span><span className="font-mono">{currency} {total.toLocaleString()}</span></div>
                </div>

                <button onClick={dispense} disabled={saving || cart.length === 0} className="w-full py-3 bg-pine dark:bg-zinc-100 text-white dark:text-pine rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50">
                  {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} Dispense · {currency} {total.toLocaleString()}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {tab === 'dispensing' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">From</label>
              <input type="date" className={fieldCls} value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">To</label>
              <input type="date" className={fieldCls} value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
            <button onClick={loadLog} className="px-4 py-2.5 bg-slate-100 dark:bg-zinc-800 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-zinc-300 hover:bg-slate-200">Refresh</button>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
            <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-slate-50 dark:bg-zinc-950/50 text-[9px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-200 dark:border-zinc-800">
              <span className="col-span-3">Date</span>
              <span className="col-span-4">Medication</span>
              <span className="col-span-2 text-right">Qty</span>
              <span className="col-span-3">Source</span>
            </div>
            {logLoading ? (
              <div className="py-16 flex items-center justify-center text-slate-400"><Loader2 size={20} className="animate-spin" /></div>
            ) : logRows.length === 0 ? (
              <div className="py-16 text-center text-[10px] font-black uppercase tracking-widest text-slate-300 flex flex-col items-center gap-2"><ClipboardList size={24} /> No dispensing in this period</div>
            ) : logRows.map(r => (
              <div key={r.id} className="grid grid-cols-12 gap-2 px-4 py-2.5 text-xs border-b border-slate-50 dark:border-zinc-800/50 last:border-0">
                <span className="col-span-3 text-slate-500 dark:text-zinc-400">{new Date(r.createdAt).toLocaleDateString()} <span className="text-slate-300">{new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></span>
                <span className="col-span-4 font-bold text-pine dark:text-zinc-100 truncate">{r.inventoryItem?.name || '—'}</span>
                <span className="col-span-2 text-right font-mono font-black text-pine dark:text-zinc-100">{r.quantity} <span className="text-slate-400 font-normal">{r.inventoryItem?.unit || ''}</span></span>
                <span className="col-span-3 text-slate-500 dark:text-zinc-400 truncate">
                  {r.appointment?.petName ? `Visit · ${r.appointment.petName}` : String(r.movementType) === 'SOLD' ? 'Counter' : 'Dispensed'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PharmacyView;
