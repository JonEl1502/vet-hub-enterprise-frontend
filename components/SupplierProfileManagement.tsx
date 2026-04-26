
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Building2, Mail, Phone, MapPin, Globe, Edit, Save, X, 
  Package, Plus, Trash2, Eye, EyeOff, Award, Users, Settings
} from 'lucide-react';
import { Supplier } from '../services/modules/suppliers.api';
import { SupplierProduct } from '../services/modules/supplierProducts.api';
import { dialog } from '../services';

interface Props {
  supplier: Supplier;
  products: SupplierProduct[];
  onUpdateProfile: (data: Partial<Supplier>) => Promise<void>;
  onAddProduct: (product: Omit<SupplierProduct, 'id' | 'supplierId' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onUpdateProduct: (productId: string, data: Partial<SupplierProduct>) => Promise<void>;
  onDeleteProduct: (productId: string) => Promise<void>;
}

const SupplierProfileManagement: React.FC<Props> = ({
  supplier,
  products,
  onUpdateProfile,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'products' | 'settings'>('profile');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [profileData, setProfileData] = useState({
    name: supplier.name,
    category: supplier.category || '',
    contactEmail: supplier.contactEmail || '',
    contactPhone: supplier.contactPhone || '',
    address: supplier.address || '',
  });

  const [newProduct, setNewProduct] = useState({
    name: '',
    description: '',
    category: 'Pharmaceuticals',
    sku: '',
    unitPrice: 0,
    unit: 'Units',
    minOrderQty: 1,
    isAvailable: true
  });

  const productCategories = [
    'Pharmaceuticals',
    'Medical Equipment',
    'Laboratory Supplies',
    'Surgical Instruments',
    'Veterinary Nutrition',
    'Diagnostic Tools',
    'Pet Care Products',
    'Other'
  ];

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      await onUpdateProfile(profileData);
      setIsEditingProfile(false);
    } catch (error) {
      console.error('Failed to update profile:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddProduct = async () => {
    if (!newProduct.name || !newProduct.sku || newProduct.unitPrice <= 0) return;

    setIsSaving(true);
    try {
      await onAddProduct(newProduct);
      setNewProduct({
        name: '',
        description: '',
        category: 'Pharmaceuticals',
        sku: '',
        unitPrice: 0,
        unit: 'Units',
        minOrderQty: 1,
        isAvailable: true
      });
      setIsAddingProduct(false);
    } catch (error) {
      console.error('Failed to add product:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleProductAvailability = async (productId: string, currentStatus: boolean) => {
    try {
      await onUpdateProduct(productId, { isAvailable: !currentStatus });
    } catch (error) {
      console.error('Failed to update product availability:', error);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    const ok = await dialog.confirmDelete({
      title: 'Delete Product',
      message: 'This will permanently remove the product from the supplier catalogue. This action cannot be undone.',
      entityName: `Product #${productId}`,
    });
    if (!ok) return;
    try {
      await onDeleteProduct(productId);
    } catch (error) {
      console.error('Failed to delete product:', error);
    }
  };

  const tabs = [
    { id: 'profile' as const, label: 'Profile', icon: Building2 },
    { id: 'products' as const, label: 'Products', icon: Package },
    { id: 'settings' as const, label: 'Settings', icon: Settings }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6 pb-20"
    >
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="page-header">Supplier Profile</h1>
          <p className="page-subheader mt-1">Manage your company profile and products</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-sm font-black text-emerald-500 uppercase tracking-wider">Active</span>
          </div>
          <div className="flex items-center gap-2 text-sm font-bold text-slate-400">
            <Award size={16} />
            Rating: {supplier.rating || 0}/5
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-zinc-800">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-black uppercase tracking-wider transition-all ${
                activeTab === tab.id
                  ? 'text-pine dark:text-zinc-100 border-b-2 border-pine dark:border-zinc-100'
                  : 'text-slate-400 hover:text-pine dark:hover:text-zinc-100'
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'profile' && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-6"
        >
          <div className="compact-card">
            <div className="flex items-center justify-between mb-6">
              <h2 className="section-header">Company Information</h2>
              {!isEditingProfile ? (
                <button
                  onClick={() => setIsEditingProfile(true)}
                  className="compact-button bg-pine dark:bg-zinc-100 text-white dark:text-pine flex items-center gap-2"
                >
                  <Edit size={12} />
                  Edit Profile
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setIsEditingProfile(false);
                      setProfileData({
                        name: supplier.name,
                        category: supplier.category || '',
                        contactEmail: supplier.contactEmail || '',
                        contactPhone: supplier.contactPhone || '',
                        address: supplier.address || '',
                      });
                    }}
                    className="compact-button bg-slate-100 dark:bg-zinc-800 text-pine dark:text-zinc-100 flex items-center gap-2"
                  >
                    <X size={12} />
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveProfile}
                    disabled={isSaving}
                    className="compact-button bg-seafoam text-white flex items-center gap-2 disabled:opacity-50"
                  >
                    <Save size={12} />
                    {isSaving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                  Company Name
                </label>
                {isEditingProfile ? (
                  <input
                    type="text"
                    value={profileData.name}
                    onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none font-bold"
                  />
                ) : (
                  <div className="flex items-center gap-2 text-pine dark:text-zinc-100 font-bold">
                    <Building2 size={16} className="text-slate-400" />
                    {supplier.name}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                  Category
                </label>
                {isEditingProfile ? (
                  <select
                    value={profileData.category}
                    onChange={(e) => setProfileData({ ...profileData, category: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none font-bold"
                  >
                    {productCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                ) : (
                  <div className="text-pine dark:text-zinc-100 font-bold">{supplier.category}</div>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                  Contact Email
                </label>
                {isEditingProfile ? (
                  <input
                    type="email"
                    value={profileData.contactEmail}
                    onChange={(e) => setProfileData({ ...profileData, contactEmail: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none font-bold"
                  />
                ) : (
                  <div className="flex items-center gap-2 text-pine dark:text-zinc-100 font-bold">
                    <Mail size={16} className="text-slate-400" />
                    {supplier.contactEmail}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                  Contact Phone
                </label>
                {isEditingProfile ? (
                  <input
                    type="tel"
                    value={profileData.contactPhone}
                    onChange={(e) => setProfileData({ ...profileData, contactPhone: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none font-bold"
                  />
                ) : (
                  <div className="flex items-center gap-2 text-pine dark:text-zinc-100 font-bold">
                    <Phone size={16} className="text-slate-400" />
                    {supplier.contactPhone}
                  </div>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                  Address
                </label>
                {isEditingProfile ? (
                  <input
                    type="text"
                    value={profileData.address}
                    onChange={(e) => setProfileData({ ...profileData, address: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none font-bold"
                  />
                ) : (
                  <div className="flex items-center gap-2 text-pine dark:text-zinc-100 font-bold">
                    <MapPin size={16} className="text-slate-400" />
                    {supplier.address}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Account Information */}
          <div className="compact-card">
            <h2 className="section-header mb-4">Account Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1">User ID</div>
                <div className="font-bold text-pine dark:text-zinc-100">{supplier.userId || 'N/A'}</div>
              </div>
              <div>
                <div className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1">Account Status</div>
                <div className="font-bold text-emerald-500">{supplier.isActive ? 'Active' : 'Inactive'}</div>
              </div>
              <div>
                <div className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1">Member Since</div>
                <div className="font-bold text-pine dark:text-zinc-100">
                  {new Date(supplier.createdAt).toLocaleDateString()}
                </div>
              </div>
              <div>
                <div className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1">Last Updated</div>
                <div className="font-bold text-pine dark:text-zinc-100">
                  {new Date(supplier.updatedAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Products Tab */}
      {activeTab === 'products' && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-6"
        >
          <div className="flex items-center justify-between">
            <h2 className="section-header">Product Catalog ({products.length})</h2>
            <button
              onClick={() => setIsAddingProduct(true)}
              className="compact-button bg-seafoam text-white flex items-center gap-2"
            >
              <Plus size={14} />
              Add Product
            </button>
          </div>

          {/* Add Product Form */}
          {isAddingProduct && (
            <div className="compact-card bg-slate-50 dark:bg-zinc-800">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-400">New Product</h3>
                <button
                  onClick={() => setIsAddingProduct(false)}
                  className="text-slate-400 hover:text-pine dark:hover:text-zinc-100"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    Product Name *
                  </label>
                  <input
                    type="text"
                    value={newProduct.name}
                    onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                    className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-2 text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none font-bold text-sm"
                    placeholder="Product name"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    Category *
                  </label>
                  <select
                    value={newProduct.category}
                    onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                    className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-2 text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none font-bold text-sm"
                  >
                    {productCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    SKU *
                  </label>
                  <input
                    type="text"
                    value={newProduct.sku}
                    onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })}
                    className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-2 text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none font-bold text-sm"
                    placeholder="SKU-001"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    Unit Price *
                  </label>
                  <input
                    type="number"
                    value={newProduct.unitPrice || ''}
                    onChange={(e) => setNewProduct({ ...newProduct, unitPrice: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-2 text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none font-bold text-sm"
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    Unit
                  </label>
                  <input
                    type="text"
                    value={newProduct.unit}
                    onChange={(e) => setNewProduct({ ...newProduct, unit: e.target.value })}
                    className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-2 text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none font-bold text-sm"
                    placeholder="Units, Boxes, Bottles"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    Min Order Qty
                  </label>
                  <input
                    type="number"
                    value={newProduct.minOrderQty}
                    onChange={(e) => setNewProduct({ ...newProduct, minOrderQty: parseInt(e.target.value) || 1 })}
                    className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-2 text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none font-bold text-sm"
                    min="1"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    Description
                  </label>
                  <textarea
                    value={newProduct.description}
                    onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                    rows={2}
                    className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-2 text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none font-bold text-sm resize-none"
                    placeholder="Product description..."
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={() => setIsAddingProduct(false)}
                  className="compact-button bg-slate-100 dark:bg-zinc-900 text-pine dark:text-zinc-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddProduct}
                  disabled={isSaving || !newProduct.name || !newProduct.sku || newProduct.unitPrice <= 0}
                  className="compact-button bg-seafoam text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? 'Adding...' : 'Add Product'}
                </button>
              </div>
            </div>
          )}

          {/* Products List */}
          <div className="grid grid-cols-1 gap-4">
            {products.length === 0 ? (
              <div className="compact-card text-center py-12">
                <Package className="mx-auto text-slate-300 dark:text-zinc-700 mb-4" size={64} />
                <p className="text-slate-400 font-bold">No products added yet</p>
                <p className="text-sm text-slate-400 mt-1">Add your first product to get started</p>
              </div>
            ) : (
              products.map((product, index) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className="compact-card"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="w-14 h-14 bg-seafoam/10 dark:bg-cyan/20 rounded-xl flex items-center justify-center">
                        <Package className="text-seafoam dark:text-cyan" size={24} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="card-title text-lg">{product.name}</h3>
                          <span className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider ${
                            product.isAvailable
                              ? 'bg-emerald-500/10 text-emerald-500'
                              : 'bg-slate-100 text-slate-400'
                          }`}>
                            {product.isAvailable ? 'Available' : 'Unavailable'}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-[10px] text-slate-500 dark:text-zinc-400 font-bold mb-3">
                          <span>{product.category}</span>
                          <span>•</span>
                          <span>SKU: {product.sku}</span>
                        </div>
                        {product.description && (
                          <p className="text-sm text-slate-600 dark:text-zinc-400 font-bold mb-3">
                            {product.description}
                          </p>
                        )}
                        <div className="flex items-center gap-6 text-sm">
                          <div>
                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Price</span>
                            <div className="font-black text-pine dark:text-zinc-100">
                              ${product.unitPrice.toFixed(2)} / {product.unit}
                            </div>
                          </div>
                          <div>
                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Min Order</span>
                            <div className="font-black text-pine dark:text-zinc-100">{product.minOrderQty}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleToggleProductAvailability(product.id, product.isAvailable)}
                        className="compact-button bg-slate-100 dark:bg-zinc-800 text-pine dark:text-zinc-100"
                        title={product.isAvailable ? 'Mark as unavailable' : 'Mark as available'}
                      >
                        {product.isAvailable ? <EyeOff size={12} /> : <Eye size={12} />}
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(product.id)}
                        className="compact-button bg-red-500/10 text-red-500 hover:bg-red-500/20"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-6"
        >
          <div className="compact-card">
            <h2 className="section-header mb-4">Account Settings</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-slate-200 dark:border-zinc-800">
                <div>
                  <div className="font-bold text-pine dark:text-zinc-100">Email Notifications</div>
                  <div className="text-sm text-slate-400">Receive email updates about orders and inquiries</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" defaultChecked />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-seafoam/20 rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-zinc-600 peer-checked:bg-seafoam"></div>
                </label>
              </div>

              <div className="flex items-center justify-between py-3 border-b border-slate-200 dark:border-zinc-800">
                <div>
                  <div className="font-bold text-pine dark:text-zinc-100">Order Alerts</div>
                  <div className="text-sm text-slate-400">Get notified when you receive new orders</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" defaultChecked />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-seafoam/20 rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-zinc-600 peer-checked:bg-seafoam"></div>
                </label>
              </div>

              <div className="flex items-center justify-between py-3">
                <div>
                  <div className="font-bold text-pine dark:text-zinc-100">Marketing Communications</div>
                  <div className="text-sm text-slate-400">Receive updates about new features and promotions</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-seafoam/20 rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-zinc-600 peer-checked:bg-seafoam"></div>
                </label>
              </div>
            </div>
          </div>

          <div className="compact-card bg-red-500/5 border-red-500/20">
            <h2 className="section-header text-red-500 mb-4">Danger Zone</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-pine dark:text-zinc-100">Deactivate Account</div>
                  <div className="text-sm text-slate-400">Temporarily disable your supplier account</div>
                </div>
                <button className="compact-button bg-red-500/10 text-red-500 hover:bg-red-500/20">
                  Deactivate
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

export default SupplierProfileManagement;

