import React, { useEffect, useMemo, useState } from 'react';
import { ShoppingCart, Search, Plus, Minus, Trash2, Loader2, CheckCircle2, UserPlus, X, Package, Wallet } from 'lucide-react';
import toast from 'react-hot-toast';
import { useData } from '../../../contexts/DataContext';
import { petshopAPI, walletAPI } from '../../../services';
import type { Wallet as WalletData } from '../../../services';
import type { InventoryItem } from '../../../services/modules/inventory.api';

interface CartLine { item: InventoryItem; qty: number; unitPrice: number }
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

const PetshopView: React.FC<Props> = ({ activeClinic }) => {
  const { inventory, clients, ensureInventory, ensureClients, refreshInventory } = useData() as any;
  useEffect(() => { ensureInventory?.(); ensureClients?.(); }, [ensureInventory, ensureClients]);

  const currency = activeClinic?.currency || 'KES';

  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discountType, setDiscountType] = useState<'NONE' | 'PERCENTAGE' | 'FIXED'>('NONE');
  const [discountValue, setDiscountValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<string | null>(null);

  // Customer — searchable combobox or walk-in.
  const [clientId, setClientId] = useState('');
  const [clientQuery, setClientQuery] = useState('');
  const [showClientList, setShowClientList] = useState(false);
  const [walkIn, setWalkIn] = useState(false);
  const [walkInName, setWalkInName] = useState('');
  const [walkInPhone, setWalkInPhone] = useState('');

  // Wallets — the money destination, which also decides the payment method.
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

  const sellable = useMemo(() => (inventory || []).filter((i: InventoryItem) => i.billable !== false), [inventory]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q ? sellable.filter((i: InventoryItem) => i.name.toLowerCase().includes(q) || (i.sku || '').toLowerCase().includes(q) || (i.category || '').toLowerCase().includes(q)) : sellable;
    return list.slice(0, 60);
  }, [sellable, search]);

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

  const checkout = async () => {
    if (!cart.length) { toast.error('Cart is empty'); return; }
    if (walkIn && !walkInName.trim()) { toast.error('Enter the walk-in customer name'); return; }
    setSaving(true);
    try {
      const res = await petshopAPI.checkout({
        clientId: !walkIn && clientId ? clientId : undefined,
        walkInData: walkIn ? { firstName: walkInName.trim(), phone: walkInPhone.trim() || undefined } : undefined,
        items: cart.map(l => ({ inventoryItemId: l.item.id, quantity: l.qty, unitPrice: l.unitPrice })),
        paymentMethod,
        walletId: selectedWalletId !== CASH_OPTION ? selectedWalletId : undefined,
        discountType: discountType === 'NONE' ? undefined : discountType,
        discountValue: discountType === 'NONE' ? undefined : Number(discountValue) || 0,
      });
      if (res.success && res.data) {
        setLastReceipt(res.data.receiptNumber);
        toast.success(`Sale complete · ${res.data.receiptNumber}`);
        setCart([]); setDiscountType('NONE'); setDiscountValue('');
        setClientId(''); setClientQuery(''); setWalkIn(false); setWalkInName(''); setWalkInPhone('');
        (refreshInventory || ensureInventory)?.();
      }
    } catch (e: any) { toast.error(e?.message || 'Checkout failed'); }
    finally { setSaving(false); }
  };

  const fieldCls = 'w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam';

  return (
    <div className="space-y-6 pb-20">
      <header className="flex items-center gap-3 pb-6 border-b border-slate-200 dark:border-zinc-800">
        <div className="w-12 h-12 rounded-xl bg-seafoam/10 flex items-center justify-center text-seafoam"><ShoppingCart size={22} /></div>
        <div>
          <h1 className="text-2xl font-black text-pine dark:text-zinc-100 tracking-tighter uppercase leading-none">Petshop</h1>
          <p className="text-slate-400 dark:text-zinc-500 font-black text-[10px] uppercase tracking-widest mt-1">Point of sale {lastReceipt ? `· last: ${lastReceipt}` : ''}</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Catalogue */}
        <div className="lg:col-span-2 space-y-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className={`${fieldCls} pl-9`} placeholder="Search products by name, SKU, category…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {filtered.map((item: InventoryItem) => {
              const out = item.quantity <= 0;
              const sel = inCart(item.id);
              return (
                <button key={item.id} onClick={() => addToCart(item)} disabled={out}
                  className={`text-left p-3 rounded-xl border transition-all ${out ? 'opacity-40 cursor-not-allowed border-slate-200 dark:border-zinc-800' : sel ? 'border-seafoam bg-seafoam/5' : 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-seafoam'}`}>
                  <p className="text-xs font-black text-pine dark:text-zinc-100 truncate">{item.name}</p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider truncate">{item.category}</p>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-sm font-black font-mono text-seafoam">{item.price.toLocaleString()}</span>
                    <span className={`text-[8px] font-black uppercase ${out ? 'text-rose-500' : item.quantity <= item.minThreshold ? 'text-amber-500' : 'text-slate-400'}`}>{out ? 'Out' : `${item.quantity} ${item.unit}`}</span>
                  </div>
                </button>
              );
            })}
            {filtered.length === 0 && <div className="col-span-full py-16 text-center text-[10px] font-black uppercase tracking-widest text-slate-300 flex flex-col items-center gap-2"><Package size={24} /> No products</div>}
          </div>
        </div>

        {/* Cart */}
        <div className="space-y-3">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm space-y-3">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><ShoppingCart size={12} /> Cart ({cart.length})</p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {cart.length === 0 && <p className="text-[10px] text-slate-400 py-4 text-center">Tap products to add them.</p>}
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

            {/* Customer — searchable */}
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

            <button onClick={checkout} disabled={saving || cart.length === 0} className="w-full py-3 bg-pine dark:bg-zinc-100 text-white dark:text-pine rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} Checkout · {currency} {total.toLocaleString()}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PetshopView;
