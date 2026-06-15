import React, { useState, useEffect } from 'react';
import LoadingSpinner from '../common/LoadingSpinner';
import { ArrowLeft, Plus, Trash2, ShoppingCart, Package, Search, X, Building2 } from 'lucide-react';
import { Clinic, User } from '../../../types';
import { suppliersAPI, supplierProductsAPI, purchaseOrderAPI, toast, Supplier, SupplierProduct } from '../../../services';
import { PurchaseOrderStatus } from '../../../services/modules/purchaseOrders.api';
import { useAuth } from '../../../contexts/AuthContext';

interface Props {
  clinic: Clinic;
  purchaseOrderId?: string;
  initialSupplierId?: string;
  initialProducts?: SupplierProduct[];
  staffMembers?: User[];
  onBack: () => void;
  onSuccess: () => void;
}

interface POItem {
  tempId: string;
  productId?: string;
  name: string;
  sku: string;
  category: string;
  quantity: number;
  unitPrice: number;
}

const PurchaseOrderFormView: React.FC<Props> = ({ clinic, purchaseOrderId, initialSupplierId, initialProducts, staffMembers = [], onBack, onSuccess }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<SupplierProduct[]>([]);
  const [showProductCatalog, setShowProductCatalog] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [poStatus, setPoStatus] = useState<PurchaseOrderStatus | null>(null);
  const [createdByName, setCreatedByName] = useState<string>(user?.name || '');

  const [formData, setFormData] = useState({
    supplierId: initialSupplierId || '',
    notes: '',
    expectedAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days from now
  });

  const [items, setItems] = useState<POItem[]>([]);

  // Fetch existing PO for edit mode
  useEffect(() => {
    if (!purchaseOrderId) return;
    const load = async () => {
      try {
        const res = await purchaseOrderAPI.getById(purchaseOrderId);
        const po = res.data.purchaseOrder;
        setFormData({
          supplierId: po.supplierId,
          notes: po.notes || '',
          expectedAt: po.expectedAt
            ? new Date(po.expectedAt).toISOString().split('T')[0]
            : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        });
        setPoStatus(po.status);
        // Keep existing creator if available, otherwise fall back to logged-in user
        setCreatedByName(po.creator?.name || user?.name || '');
        if (po.items && po.items.length > 0) {
          setItems(po.items.map(item => ({
            tempId: item.id,
            productId: item.supplierProductId,
            name: item.name,
            sku: item.sku,
            category: item.category,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
          })));
        }
      } catch (err) {
        toast.error('Failed to load purchase order');
      }
    };
    load();
  }, [purchaseOrderId]);

  // Initialize items from initialProducts if provided (create flow)
  useEffect(() => {
    if (purchaseOrderId || !initialProducts || initialProducts.length === 0) return;
    setItems(initialProducts.map(product => ({
      tempId: `temp-${Date.now()}-${product.id}`,
      productId: product.id,
      name: product.name,
      sku: product.sku,
      category: product.category,
      quantity: Number(product.minOrderQty) || 1,
      unitPrice: Number(product.unitPrice) || 0,
    })));
  }, [initialProducts]);

  // Fetch suppliers on mount
  useEffect(() => {
    fetchSuppliers();
  }, []);

  // Fetch products when supplier changes
  useEffect(() => {
    if (formData.supplierId) {
      fetchProducts(formData.supplierId);
    } else {
      setProducts([]);
    }
  }, [formData.supplierId]);

  const fetchSuppliers = async () => {
    setLoadingSuppliers(true);
    try {
      const response = await suppliersAPI.getAll({ limit: 100 });
      setSuppliers(response.data.data || []);
    } catch (error: any) {
      console.error('[PurchaseOrderFormView] Failed to load suppliers:', error);
      toast.error(error.message || 'Failed to load suppliers');
    } finally {
      setLoadingSuppliers(false);
    }
  };

  const fetchProducts = async (supplierId: string) => {
    setLoadingProducts(true);
    try {
      console.log('[PurchaseOrderFormView] Fetching products for supplier:', supplierId);
      const response = await supplierProductsAPI.getBySupplierId(Number(supplierId), {
        isAvailable: true,
        limit: 100
      });
      console.log('[PurchaseOrderFormView] Products fetched:', response.data.data?.length || 0);
      setProducts(response.data.data || []);
    } catch (error: any) {
      console.error('[PurchaseOrderFormView] Failed to load products:', error);
      toast.error(error.message || 'Failed to load products');
    } finally {
      setLoadingProducts(false);
    }
  };

  const addProductFromCatalog = (product: SupplierProduct) => {
    console.log('[PurchaseOrderFormView] Adding product from catalog:', product);
    const existingItem = items.find(item => item.sku === product.sku);
    if (existingItem) {
      toast.error('Product already added to order');
      return;
    }

    const newItem: POItem = {
      tempId: `temp-${Date.now()}`,
      productId: product.id,
      name: product.name,
      sku: product.sku,
      category: product.category,
      quantity: Number(product.minOrderQty) || 1,
      unitPrice: Number(product.unitPrice) || 0,
    };

    console.log('[PurchaseOrderFormView] New item created:', newItem);
    setItems(prevItems => {
      const updatedItems = [...prevItems, newItem];
      console.log('[PurchaseOrderFormView] Items after adding:', updatedItems);
      return updatedItems;
    });
    // Don't close modal - allow adding multiple products
    // setShowProductCatalog(false);
    // setProductSearch('');
    toast.success(`Added ${product.name} to order`);
  };

  const addCustomItem = () => {
    console.log('[PurchaseOrderFormView] Adding custom item');
    const newItem: POItem = {
      tempId: `temp-${Date.now()}`,
      name: '',
      sku: '',
      category: '',
      quantity: 1,
      unitPrice: 0,
    };
    console.log('[PurchaseOrderFormView] Custom item created:', newItem);
    setItems([...items, newItem]);
    console.log('[PurchaseOrderFormView] Items after adding custom:', [...items, newItem]);
  };

  const updateItem = (tempId: string, field: keyof POItem, value: any) => {
    setItems(items.map(item => 
      item.tempId === tempId ? { ...item, [field]: value } : item
    ));
  };

  const removeItem = (tempId: string) => {
    setItems(items.filter(item => item.tempId !== tempId));
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => {
      const qty = Number(item.quantity) || 0;
      const price = Number(item.unitPrice) || 0;
      return sum + qty * price;
    }, 0);
  };

  const validateForm = () => {
    if (!formData.supplierId) {
      toast.error('Please select a supplier');
      return false;
    }
    if (items.length === 0) {
      toast.error('Please add at least one item');
      return false;
    }
    for (const item of items) {
      if (!item.name || !item.sku || !item.category) {
        toast.error('All items must have name, SKU, and category');
        return false;
      }
      if (item.quantity <= 0 || item.unitPrice < 0) {
        toast.error('Invalid quantity or price');
        return false;
      }
    }
    return true;
  };

  const handleSaveDraft = async () => {
    if (!validateForm()) return;
    setLoading(true);
    try {
      const itemsPayload = items.map(item => ({
        name: item.name,
        sku: item.sku,
        category: item.category,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      }));

      if (purchaseOrderId) {
        await purchaseOrderAPI.update(purchaseOrderId, {
          supplierId: formData.supplierId,
          notes: formData.notes,
          expectedAt: formData.expectedAt,
          items: itemsPayload,
        });
        toast.success('Purchase order updated');
      } else {
        await purchaseOrderAPI.create({
          supplierId: formData.supplierId,
          notes: formData.notes,
          expectedAt: formData.expectedAt,
          items: itemsPayload,
        });
        toast.success('Purchase order saved as draft');
      }
      onSuccess();
      onBack();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save purchase order');
    } finally {
      setLoading(false);
    }
  };

  const handlePlaceOrder = async () => {
    if (!validateForm()) return;
    setLoading(true);
    try {
      const itemsPayload = items.map(item => ({
        name: item.name,
        sku: item.sku,
        category: item.category,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      }));

      if (purchaseOrderId) {
        // Update draft then place it
        await purchaseOrderAPI.update(purchaseOrderId, {
          supplierId: formData.supplierId,
          notes: formData.notes,
          expectedAt: formData.expectedAt,
          items: itemsPayload,
        });
        await purchaseOrderAPI.updateStatus(purchaseOrderId, 'SUBMITTED');
        await purchaseOrderAPI.updateStatus(purchaseOrderId, 'APPROVED');
      } else {
        await purchaseOrderAPI.create({
          supplierId: formData.supplierId,
          notes: formData.notes,
          expectedAt: formData.expectedAt,
          autoOrder: true,
          items: itemsPayload,
        });
      }
      toast.success('Order placed successfully');
      onSuccess();
      onBack();
    } catch (error: any) {
      toast.error(error.message || 'Failed to place order');
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    product.sku.toLowerCase().includes(productSearch.toLowerCase()) ||
    product.category.toLowerCase().includes(productSearch.toLowerCase())
  );

  const selectedSupplier = suppliers.find(s => s.id === formData.supplierId);

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-20">
      {/* Compact header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 rounded-xl text-slate-500 dark:text-zinc-400 hover:text-pine dark:hover:text-zinc-100 hover:bg-white dark:hover:bg-zinc-800 transition-all"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-widest">
          {purchaseOrderId ? 'Edit Purchase Order' : 'New Purchase'}
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-4">
          {/* Branch display */}
          <div className="bg-seafoam/5 border border-seafoam/20 rounded-2xl px-4 py-3 flex items-center gap-3">
            <Building2 size={16} className="text-seafoam shrink-0" />
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Ordering for Branch</p>
              <p className="text-sm font-black text-pine dark:text-zinc-100">{clinic.name}</p>
            </div>
          </div>

          {/* Supplier Selection */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
            <h2 className="text-xs font-black text-pine dark:text-zinc-100 uppercase tracking-widest mb-4">Supplier Information</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-600 dark:text-zinc-400 uppercase mb-2">
                  Supplier *
                </label>
                <select
                  value={formData.supplierId}
                  onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                  disabled={loadingSuppliers}
                  className="w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none font-bold"
                >
                  <option value="">Select a supplier...</option>
                  {suppliers.map(supplier => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name} {supplier.category ? `- ${supplier.category}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-600 dark:text-zinc-400 uppercase mb-2">
                  Expected Delivery Date
                </label>
                <input
                  type="date"
                  value={formData.expectedAt}
                  onChange={(e) => setFormData({ ...formData, expectedAt: e.target.value })}
                  className="w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-600 dark:text-zinc-400 uppercase mb-2">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  placeholder="Add any notes or special instructions..."
                  className="w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none font-bold resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-600 dark:text-zinc-400 uppercase mb-2">
                  Created By
                </label>
                {(!poStatus || poStatus === 'DRAFT') && staffMembers.length > 0 ? (
                  <select
                    value={createdByName}
                    onChange={(e) => setCreatedByName(e.target.value)}
                    className="w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none font-bold"
                  >
                    {staffMembers.map(s => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                ) : (
                  <p className="px-4 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-bold text-pine dark:text-zinc-100">
                    {createdByName || user?.name || '—'}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Items Section */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h2 className="text-xs font-black text-pine dark:text-zinc-100 uppercase tracking-widest">Order Items</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowProductCatalog(true)}
                  disabled={!formData.supplierId || loadingProducts}
                  className="px-4 py-2 rounded-xl bg-seafoam/10 text-seafoam border border-seafoam/20 font-black text-xs uppercase tracking-wider hover:bg-seafoam/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Package size={16} />
                  Add from Catalog
                </button>
                <button
                  onClick={addCustomItem}
                  className="px-4 py-2 rounded-xl bg-pine dark:bg-zinc-100 text-white dark:text-pine font-black text-xs uppercase tracking-wider hover:opacity-90 transition-all flex items-center gap-2"
                >
                  <Plus size={16} />
                  Add Custom Item
                </button>
              </div>
            </div>

            {items.length === 0 ? (
              <div className="text-center py-12 text-slate-400 dark:text-zinc-500">
                <ShoppingCart size={48} className="mx-auto mb-4 opacity-50" />
                <p className="font-bold">No items added yet</p>
                <p className="text-sm mt-1">Add items from the supplier catalog or create custom items</p>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item) => (
                  <div key={item.tempId} className="border border-slate-200 dark:border-zinc-700 rounded-xl p-4 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 dark:text-zinc-500 uppercase mb-1">
                          Item Name *
                        </label>
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => updateItem(item.tempId, 'name', e.target.value)}
                          placeholder="Product name"
                          className="w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 dark:text-zinc-500 uppercase mb-1">
                          SKU *
                        </label>
                        <input
                          type="text"
                          value={item.sku}
                          onChange={(e) => updateItem(item.tempId, 'sku', e.target.value)}
                          placeholder="SKU code"
                          className="w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none font-bold"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 dark:text-zinc-500 uppercase mb-1">
                          Category *
                        </label>
                        <input
                          type="text"
                          value={item.category}
                          onChange={(e) => updateItem(item.tempId, 'category', e.target.value)}
                          placeholder="Category"
                          className="w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 dark:text-zinc-500 uppercase mb-1">
                          Quantity *
                        </label>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateItem(item.tempId, 'quantity', parseInt(e.target.value) || 0)}
                          min="1"
                          className="w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 dark:text-zinc-500 uppercase mb-1">
                          Unit Price *
                        </label>
                        <input
                          type="number"
                          value={item.unitPrice}
                          onChange={(e) => updateItem(item.tempId, 'unitPrice', parseFloat(e.target.value) || 0)}
                          min="0"
                          step="0.01"
                          className="w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none font-bold"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-zinc-700">
                      <div className="text-sm font-black text-pine dark:text-zinc-100">
                        Total: KES {((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <button
                        onClick={() => removeItem(item.tempId)}
                        className="text-red-500 hover:text-red-600 transition-colors p-2"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar - Summary */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm lg:sticky lg:top-4">
            <h2 className="text-xs font-black text-pine dark:text-zinc-100 uppercase tracking-widest mb-4">Order Summary</h2>

            <div className="space-y-4">
              {selectedSupplier && (
                <div>
                  <p className="text-xs font-black text-slate-500 dark:text-zinc-500 uppercase mb-1">Supplier</p>
                  <p className="text-sm font-bold text-pine dark:text-zinc-100">{selectedSupplier.name}</p>
                  {selectedSupplier.category && (
                    <p className="text-xs text-slate-500 dark:text-zinc-500">{selectedSupplier.category}</p>
                  )}
                </div>
              )}

              <div>
                <p className="text-xs font-black text-slate-500 dark:text-zinc-500 uppercase mb-1">Expected Delivery</p>
                <p className="text-sm font-bold text-pine dark:text-zinc-100">
                  {new Date(formData.expectedAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>

              <div className="border-t border-slate-200 dark:border-zinc-700 pt-4">
                <p className="text-xs font-black text-slate-500 dark:text-zinc-500 uppercase mb-2">Items</p>
                <p className="text-2xl font-black text-pine dark:text-zinc-100">{items.length}</p>
              </div>

              <div className="border-t border-slate-200 dark:border-zinc-700 pt-4">
                <p className="text-xs font-black text-slate-500 dark:text-zinc-500 uppercase mb-2">Total Amount</p>
                <p className="text-2xl font-black text-pine dark:text-zinc-100">
                  KES {calculateTotal().toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>

              <div className="border-t border-slate-200 dark:border-zinc-700 pt-4 space-y-2">
                <button
                  onClick={handlePlaceOrder}
                  disabled={loading || items.length === 0}
                  className="w-full px-6 py-3 rounded-xl bg-pine dark:bg-zinc-100 text-white dark:text-pine font-black text-xs uppercase tracking-wider hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Placing...' : 'Place Order'}
                </button>
                {(!purchaseOrderId || poStatus === 'DRAFT') && (
                  <button
                    onClick={handleSaveDraft}
                    disabled={loading || items.length === 0}
                    className="w-full px-6 py-3 rounded-xl bg-slate-100 dark:bg-zinc-800 text-pine dark:text-zinc-100 font-black text-xs uppercase tracking-wider hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Saving...' : 'Save as Draft'}
                  </button>
                )}
                <button
                  onClick={onBack}
                  disabled={loading}
                  className="w-full px-6 py-3 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 font-black text-xs uppercase tracking-wider hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Product Catalog Modal */}
      {showProductCatalog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden border border-slate-200 dark:border-zinc-800">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 dark:border-zinc-800">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-widest truncate pr-4">
                  {selectedSupplier?.name} — Catalog
                </h2>
                <button
                  onClick={() => {
                    setShowProductCatalog(false);
                    setProductSearch('');
                  }}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Search products by name, SKU, or category..."
                  className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl pl-12 pr-6 py-3 text-sm text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none font-bold"
                />
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-4 overflow-y-auto max-h-[calc(80vh-160px)]">
              {loadingProducts ? (
                <div className="text-center py-12">
                  <LoadingSpinner contentArea message="Loading products..." />
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-center py-12 text-slate-400 dark:text-zinc-500">
                  <Package size={48} className="mx-auto mb-4 opacity-50" />
                  <p className="font-bold">No products found</p>
                  <p className="text-sm mt-1">Try adjusting your search or select a different supplier</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredProducts.map((product) => (
                    <div
                      key={product.id}
                      className="border border-slate-200 dark:border-zinc-700 rounded-xl p-4 hover:border-seafoam transition-all group"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-black text-pine dark:text-zinc-100 text-sm mb-1">{product.name}</h3>
                          <p className="text-xs text-slate-500 dark:text-zinc-500">SKU: {product.sku}</p>
                        </div>
                        <span className="px-2 py-1 rounded-lg text-[8px] font-black bg-seafoam/10 text-seafoam border border-seafoam/20 uppercase">
                          {product.category}
                        </span>
                      </div>

                      {product.description && (
                        <p className="text-xs text-slate-600 dark:text-zinc-400 mb-3 line-clamp-2">
                          {product.description}
                        </p>
                      )}

                      <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-zinc-700">
                        <div>
                          <p className="text-xs text-slate-500 dark:text-zinc-500">Unit Price</p>
                          <p className="text-lg font-black text-pine dark:text-zinc-100">
                            KES {product.unitPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </p>
                          {product.minOrderQty > 1 && (
                            <p className="text-[10px] text-slate-500 dark:text-zinc-500">
                              Min. order: {product.minOrderQty} {product.unit}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => addProductFromCatalog(product)}
                          className="px-4 py-2 rounded-lg bg-pine dark:bg-zinc-100 text-white dark:text-pine font-black text-xs uppercase tracking-wider hover:opacity-90 transition-all"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseOrderFormView;

