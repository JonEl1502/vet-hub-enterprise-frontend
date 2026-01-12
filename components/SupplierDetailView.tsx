
import React, { useState, useMemo, useEffect } from 'react';
import { Clinic, Transaction } from '../types';
import { Building2, MapPin, Mail, Phone, ShoppingCart, History, Info, ExternalLink, ChevronRight, Package, ArrowLeft, Star, Globe, Plus, Search, Tag, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { supplierProductsAPI, SupplierProduct, Supplier } from '../services';

interface Props {
  supplier: Supplier;
  clinic: Clinic;
  transactions: Transaction[];
  onBack: () => void;
  onAddToOrder?: (supplierId: string, product: SupplierProduct) => void;
}

// Helper function to safely convert rating to number
const getRatingAsNumber = (rating: any): number => {
  if (rating === null || rating === undefined) {
    return 0;
  }
  if (typeof rating === 'number') {
    return rating;
  }
  // Handle Prisma Decimal object
  if (typeof rating === 'object' && rating.toNumber) {
    return rating.toNumber();
  }
  const numRating = Number(rating);
  return isNaN(numRating) ? 0 : numRating;
};

const SupplierDetailView: React.FC<Props> = ({ supplier, clinic, transactions, onBack, onAddToOrder }) => {
  const [activeTab, setActiveTab] = useState<'info' | 'catalog' | 'history' | 'orders'>('info');
  const [searchQuery, setSearchQuery] = useState('');
  const [supplierProducts, setSupplierProducts] = useState<SupplierProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  const fulfilledTransactions = useMemo(() =>
    transactions.filter(tx => tx.toId === supplier.id && tx.status === 'SETTLED'),
    [transactions, supplier.id]
  );

  const activeOrders = useMemo(() =>
    transactions.filter(tx => tx.toId === supplier.id && tx.status === 'PENDING'),
    [transactions, supplier.id]
  );

  // Load supplier products when catalog tab is active
  useEffect(() => {
    if (activeTab === 'catalog') {
      loadSupplierProducts();
    }
  }, [activeTab, supplier.id]);

  const loadSupplierProducts = async () => {
    setLoadingProducts(true);
    try {
      const response = await supplierProductsAPI.getBySupplierId(Number(supplier.id));
      // Backend returns paginated response: { data: { data: [...], meta: {...} } }
      setSupplierProducts(response.data.data || []);
    } catch (error) {
      console.error('Failed to load supplier products:', error);
      setSupplierProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  };

  const filteredProducts = useMemo(() => {
    if (!searchQuery) return supplierProducts;
    return supplierProducts.filter(p =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [supplierProducts, searchQuery]);

  const renderInfo = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
       <div className="lg:col-span-2 space-y-8">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2.5rem] p-10 shadow-sm space-y-10">
             <div className="flex items-center gap-4 border-b border-slate-100 dark:border-zinc-800 pb-6">
                <Info className="text-seafoam" size={24}/>
                <h3 className="text-xl font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Node Identity</h3>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-6">
                   {[
                     { label: 'Corporate Entity', val: supplier.name, icon: Building2 },
                     { label: 'HQ Protocol', val: 'Nairobi HQ, Westlands Phase II', icon: MapPin },
                     { label: 'Category Node', val: supplier.category, icon: Package },
                   ].map(i => (
                     <div key={i.label} className="flex items-center gap-4">
                        <div className="p-3 bg-slate-50 dark:bg-zinc-800 rounded-2xl text-slate-400 aspect-square"><i.icon size={18}/></div>
                        <div className="min-w-0">
                           <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{i.label}</p>
                           <p className="text-pine dark:text-zinc-100 font-bold text-base leading-tight truncate uppercase">{i.val}</p>
                        </div>
                     </div>
                   ))}
                </div>
                <div className="space-y-6">
                   {[
                     { label: 'Digital Frequency', val: supplier.contactEmail || 'N/A', icon: Mail },
                     { label: 'Secure Line', val: supplier.contactPhone || 'N/A', icon: Phone },
                     { label: 'Cloud Interface', val: 'www.vetmedglobal.com', icon: Globe },
                   ].map(i => (
                     <div key={i.label} className="flex items-center gap-4">
                        <div className="p-3 bg-slate-50 dark:bg-zinc-800 rounded-2xl text-slate-400 aspect-square"><i.icon size={18}/></div>
                        <div className="min-w-0">
                           <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{i.label}</p>
                           <p className="text-pine dark:text-zinc-100 font-bold text-base leading-tight truncate">{i.val}</p>
                        </div>
                     </div>
                   ))}
                </div>
             </div>
          </div>
       </div>

       <div className="space-y-8">
          <div className="bg-pine rounded-[2rem] p-8 text-white shadow-2xl relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-125 transition-transform duration-1000"><Star size={100} /></div>
             <p className="text-mist/40 text-[10px] font-black uppercase tracking-[0.4em] mb-4">Supplier Rating</p>
             <div className="flex items-center gap-4 mb-8">
                <span className="text-6xl font-black tracking-tighter">{getRatingAsNumber(supplier.rating).toFixed(1)}</span>
                <div className="flex gap-1 text-amber-400">
                   {[1,2,3,4,5].map(s => <Star key={s} size={16} fill={s <= Math.floor(getRatingAsNumber(supplier.rating)) ? "currentColor" : "none"}/>)}
                </div>
             </div>
             <p className="text-mist/60 text-[10px] font-bold uppercase tracking-widest">Global VetHub Trust Index</p>
          </div>
          
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2rem] p-8 shadow-sm">
             <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Status Node</h4>
             <div className="flex items-center gap-4">
                <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-[11px] font-black text-pine dark:text-zinc-100 uppercase tracking-widest">Active Partner</span>
             </div>
          </div>
       </div>
    </div>
  );

  const renderCatalog = () => (
    <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
       <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2.5rem] p-10 shadow-sm">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-10">
             <div>
                <h3 className="text-2xl font-black text-pine dark:text-zinc-100 uppercase tracking-tighter">Product Catalog</h3>
                <p className="text-seafoam text-[9px] font-black uppercase tracking-widest">Available inventory matrix • {filteredProducts.length} products</p>
             </div>
             <div className="relative group w-full md:w-96">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-seafoam" size={18}/>
                <input
                  placeholder="Search catalog..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl pl-12 pr-6 py-4 text-sm font-bold outline-none text-pine dark:text-zinc-100"
                />
             </div>
          </div>

          {loadingProducts ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600"></div>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-20">
              <AlertCircle className="mx-auto mb-4 text-slate-400" size={64} />
              <p className="font-bold text-slate-400 text-lg">No products found</p>
              <p className="text-sm text-slate-400 mt-2">This supplier has no products in the catalog yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
               {filteredProducts.map(p => (
                 <div key={p.id} className="bg-slate-50 dark:bg-zinc-950 border border-slate-100 dark:border-zinc-800 rounded-[2rem] p-6 hover:border-seafoam transition-all group shadow-inner">
                    <div className="flex justify-between items-start mb-6">
                       <div className="p-3 bg-white dark:bg-zinc-900 rounded-2xl shadow-sm text-seafoam"><Package size={24}/></div>
                       <span className="bg-white dark:bg-zinc-800 text-pine dark:text-zinc-400 px-3 py-1 rounded-lg text-[8px] font-black uppercase border border-slate-100 dark:border-zinc-700">{p.category}</span>
                    </div>
                    <h4 className="text-lg font-black text-pine dark:text-zinc-100 uppercase leading-tight mb-2 truncate">{p.name}</h4>
                    <p className="text-xs text-slate-500 dark:text-zinc-500 font-mono mb-4">SKU: {p.sku}</p>
                    <div className="flex justify-between items-baseline mb-6">
                       <p className="text-2xl font-black font-mono text-emerald-600 tracking-tighter">KES {Number(p.unitPrice).toLocaleString()}</p>
                       <p className="text-[9px] font-black text-slate-400 uppercase">per {p.unit}</p>
                    </div>
                    <div className="pt-6 border-t border-slate-100 dark:border-zinc-800 space-y-3">
                       <div className="flex items-center justify-between text-[10px] font-black text-slate-500 uppercase tracking-widest">
                         <span>Min Order:</span>
                         <span className="text-pine dark:text-zinc-100">{p.minOrderQty} {p.unit}</span>
                       </div>
                       <button
                         onClick={() => onAddToOrder?.(supplier.id, p)}
                         className="w-full bg-pine dark:bg-zinc-100 text-white dark:text-pine px-6 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 mt-4 hover:opacity-90"
                       >
                          <ShoppingCart size={14}/> Add to Order
                       </button>
                    </div>
                 </div>
               ))}
            </div>
          )}
       </div>
    </div>
  );

  return (
    <div className="space-y-8 pb-20">
       <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-slate-200 dark:border-zinc-800">
        <div className="flex items-center gap-6">
           <button onClick={onBack} className="w-12 h-12 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[1.25rem] flex items-center justify-center text-seafoam hover:text-pine transition-all shadow-lg active:scale-95">
             <ArrowLeft size={20}/>
           </button>
           <div className="flex items-center gap-6">
              <div className="w-20 h-20 rounded-[2.5rem] bg-indigo-50 dark:bg-indigo-500/10 border-4 border-white dark:border-zinc-900 flex items-center justify-center text-4xl shadow-xl shrink-0">
                🏢
              </div>
              <div className="min-w-0">
                <h1 className="text-4xl font-black text-pine dark:text-zinc-100 tracking-tighter leading-none mb-1 uppercase truncate">{supplier.name}</h1>
                <p className="text-slate-400 dark:text-zinc-500 font-black text-[10px] uppercase tracking-widest flex items-center gap-2 truncate">
                   Supplier Account Profile
                   <span className="w-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-zinc-800 shrink-0"></span>
                   ID: SP-{supplier.id}
                </p>
              </div>
           </div>
        </div>

        <div className="flex bg-slate-50 dark:bg-zinc-900 p-1 rounded-[1.5rem] border border-slate-200 dark:border-zinc-800 shadow-xl overflow-x-auto no-scrollbar scroll-smooth">
           {[
             { id: 'info', label: 'Company Info', icon: Building2 },
             { id: 'catalog', label: 'Products Catalog', icon: ShoppingCart },
             { id: 'history', label: 'Procurement History', icon: History },
             { id: 'orders', label: 'Current Orders', icon: Clock },
           ].map(tab => (
             <button
               key={tab.id}
               onClick={() => setActiveTab(tab.id as any)}
               className={`flex items-center gap-2 px-6 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                 activeTab === tab.id 
                   ? 'bg-pine dark:bg-zinc-100 text-white dark:text-pine shadow-lg' 
                   : 'text-slate-400 dark:text-zinc-500 hover:text-pine'
               }`}
             >
               <tab.icon size={12} />
               {tab.label}
             </button>
           ))}
        </div>
      </header>

      <div className="min-h-[50vh]">
         {activeTab === 'info' && renderInfo()}
         {activeTab === 'catalog' && renderCatalog()}
         
         {activeTab === 'history' && (
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[3rem] overflow-hidden shadow-xl animate-in slide-in-from-right-4">
                <div className="px-10 py-8 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center">
                   <h3 className="text-lg font-black text-pine dark:text-zinc-100 uppercase">Fulfilled Ingress Nodes</h3>
                </div>
                <table className="w-full text-left">
                  <thead className="bg-slate-50/50 dark:bg-zinc-800/50 border-b border-slate-100 dark:border-zinc-800">
                    <tr>
                      <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ledger ID</th>
                      <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Asset Category</th>
                      <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date Settled</th>
                      <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                    {fulfilledTransactions.length > 0 ? fulfilledTransactions.map(tx => (
                      <tr key={tx.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/40 transition-colors group">
                        <td className="px-10 py-8"><span className="text-[11px] font-black text-pine dark:text-zinc-100 uppercase tracking-tight">TRX-#{tx.id}</span></td>
                        <td className="px-10 py-8"><span className="bg-slate-100 dark:bg-zinc-800 px-3 py-1 rounded-lg text-[8px] font-black uppercase text-slate-500">{tx.type}</span></td>
                        <td className="px-10 py-8 text-[11px] font-bold text-slate-400 uppercase">{tx.date}</td>
                        <td className="px-10 py-8 text-right">
                           <p className="font-mono font-black text-emerald-600 text-lg">KES {tx.amount.toLocaleString()}</p>
                           <button className="text-[8px] font-black text-seafoam uppercase tracking-widest hover:underline mt-1 flex items-center gap-1 justify-end ml-auto"><Plus size={8}/> Reorder Node</button>
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan={4} className="py-40 text-center opacity-20 font-black uppercase tracking-[0.4em] text-sm">Registry Clear</td></tr>
                    )}
                  </tbody>
                </table>
            </div>
         )}

         {activeTab === 'orders' && (
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[3rem] overflow-hidden shadow-xl animate-in slide-in-from-right-4">
                <div className="px-10 py-8 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center">
                   <h3 className="text-lg font-black text-pine dark:text-zinc-100 uppercase">Pending Deployment Nodes</h3>
                </div>
                <table className="w-full text-left">
                  <thead className="bg-slate-50/50 dark:bg-zinc-800/50 border-b border-slate-100 dark:border-zinc-800">
                    <tr>
                      <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Order Node</th>
                      <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Expected Epoch</th>
                      <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">State</th>
                      <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Commitment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                    {activeOrders.length > 0 ? activeOrders.map(tx => (
                      <tr key={tx.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/40 transition-colors group">
                        <td className="px-10 py-8"><span className="text-[11px] font-black text-pine dark:text-zinc-100 uppercase tracking-tight">ORD-#{tx.id}</span></td>
                        <td className="px-10 py-8 text-[11px] font-bold text-slate-400 uppercase">{tx.date}</td>
                        <td className="px-10 py-8">
                           <span className="flex items-center gap-2 text-amber-500 text-[10px] font-black uppercase tracking-widest">
                              <Clock size={12}/> Processing
                           </span>
                        </td>
                        <td className="px-10 py-8 text-right font-mono font-black text-pine dark:text-zinc-100 text-lg">KES {tx.amount.toLocaleString()}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan={4} className="py-40 text-center opacity-20 font-black uppercase tracking-[0.4em] text-sm">Deployment Pipe Clear</td></tr>
                    )}
                  </tbody>
                </table>
            </div>
         )}
      </div>
    </div>
  );
};

export default SupplierDetailView;
