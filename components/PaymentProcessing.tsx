
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  CreditCard, Calendar, Download, CheckCircle, XCircle, 
  Plus, Trash2, Shield, Lock, AlertCircle
} from 'lucide-react';
import { SubscriptionPackage, ClinicSubscription } from '../types';

interface PaymentMethod {
  id: string;
  type: 'card' | 'paypal';
  last4?: string;
  brand?: string;
  expiryMonth?: number;
  expiryYear?: number;
  email?: string;
  isDefault: boolean;
}

interface Invoice {
  id: string;
  date: string;
  amount: number;
  status: 'paid' | 'pending' | 'failed';
  description: string;
  downloadUrl?: string;
}

interface Props {
  subscription: ClinicSubscription;
  paymentMethods: PaymentMethod[];
  invoices: Invoice[];
  onAddPaymentMethod: (method: Omit<PaymentMethod, 'id'>) => Promise<void>;
  onRemovePaymentMethod: (methodId: string) => Promise<void>;
  onSetDefaultPaymentMethod: (methodId: string) => Promise<void>;
  onProcessPayment: (amount: number, methodId: string) => Promise<void>;
}

const PaymentProcessing: React.FC<Props> = ({
  subscription,
  paymentMethods,
  invoices,
  onAddPaymentMethod,
  onRemovePaymentMethod,
  onSetDefaultPaymentMethod,
  onProcessPayment
}) => {
  const [showAddCard, setShowAddCard] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'methods' | 'history'>('methods');

  const [newCard, setNewCard] = useState({
    cardNumber: '',
    cardName: '',
    expiryMonth: '',
    expiryYear: '',
    cvv: '',
    isDefault: false
  });

  const handleAddCard = async () => {
    if (!newCard.cardNumber || !newCard.cardName || !newCard.expiryMonth || !newCard.expiryYear || !newCard.cvv) {
      return;
    }

    setIsProcessing(true);
    try {
      await onAddPaymentMethod({
        type: 'card',
        last4: newCard.cardNumber.slice(-4),
        brand: 'Visa', // In real app, detect from card number
        expiryMonth: parseInt(newCard.expiryMonth),
        expiryYear: parseInt(newCard.expiryYear),
        isDefault: newCard.isDefault
      });
      setNewCard({
        cardNumber: '',
        cardName: '',
        expiryMonth: '',
        expiryYear: '',
        cvv: '',
        isDefault: false
      });
      setShowAddCard(false);
    } catch (error) {
      console.error('Failed to add payment method:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemoveCard = async (methodId: string) => {
    if (confirm('Are you sure you want to remove this payment method?')) {
      try {
        await onRemovePaymentMethod(methodId);
      } catch (error) {
        console.error('Failed to remove payment method:', error);
      }
    }
  };

  const getStatusBadge = (status: Invoice['status']) => {
    const base = "px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest ";
    switch (status) {
      case 'paid':
        return base + "bg-emerald-500/10 text-emerald-500";
      case 'pending':
        return base + "bg-amber-500/10 text-amber-500";
      case 'failed':
        return base + "bg-red-500/10 text-red-500";
    }
  };

  const getStatusIcon = (status: Invoice['status']) => {
    switch (status) {
      case 'paid':
        return <CheckCircle className="text-emerald-500" size={16} />;
      case 'pending':
        return <AlertCircle className="text-amber-500" size={16} />;
      case 'failed':
        return <XCircle className="text-red-500" size={16} />;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6 pb-20"
    >
      {/* Header */}
      <header>
        <h1 className="page-header">Payment & Billing</h1>
        <p className="page-subheader mt-1">Manage payment methods and view billing history</p>
      </header>

      {/* Security Notice */}
      <div className="compact-card bg-gradient-to-br from-seafoam/10 to-cyan/10 border-seafoam/20">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-seafoam/20 flex items-center justify-center flex-shrink-0">
            <Shield className="text-seafoam" size={20} />
          </div>
          <div>
            <h3 className="font-black text-pine dark:text-zinc-100 mb-1">Secure Payment Processing</h3>
            <p className="text-sm text-slate-600 dark:text-zinc-400 font-bold">
              All payment information is encrypted and processed securely through our PCI-compliant payment partners.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-zinc-800">
        <button
          onClick={() => setActiveTab('methods')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-black uppercase tracking-wider transition-all ${
            activeTab === 'methods'
              ? 'text-pine dark:text-zinc-100 border-b-2 border-pine dark:border-zinc-100'
              : 'text-slate-400 hover:text-pine dark:hover:text-zinc-100'
          }`}
        >
          <CreditCard size={16} />
          Payment Methods
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-black uppercase tracking-wider transition-all ${
            activeTab === 'history'
              ? 'text-pine dark:text-zinc-100 border-b-2 border-pine dark:border-zinc-100'
              : 'text-slate-400 hover:text-pine dark:hover:text-zinc-100'
          }`}
        >
          <Calendar size={16} />
          Billing History
        </button>
      </div>

      {/* Payment Methods Tab */}
      {activeTab === 'methods' && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-6"
        >
          <div className="flex items-center justify-between">
            <h2 className="section-header">Saved Payment Methods</h2>
            <button
              onClick={() => setShowAddCard(true)}
              className="compact-button bg-seafoam text-white flex items-center gap-2"
            >
              <Plus size={14} />
              Add Payment Method
            </button>
          </div>

          {/* Add Card Form */}
          {showAddCard && (
            <div className="compact-card bg-slate-50 dark:bg-zinc-800">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-400">Add New Card</h3>
                <button
                  onClick={() => setShowAddCard(false)}
                  className="text-slate-400 hover:text-pine dark:hover:text-zinc-100"
                >
                  <XCircle size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    Card Number *
                  </label>
                  <input
                    type="text"
                    value={newCard.cardNumber}
                    onChange={(e) => setNewCard({ ...newCard, cardNumber: e.target.value.replace(/\s/g, '') })}
                    maxLength={16}
                    placeholder="1234 5678 9012 3456"
                    className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    Cardholder Name *
                  </label>
                  <input
                    type="text"
                    value={newCard.cardName}
                    onChange={(e) => setNewCard({ ...newCard, cardName: e.target.value })}
                    placeholder="John Doe"
                    className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none font-bold"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                      Month *
                    </label>
                    <input
                      type="text"
                      value={newCard.expiryMonth}
                      onChange={(e) => setNewCard({ ...newCard, expiryMonth: e.target.value })}
                      maxLength={2}
                      placeholder="MM"
                      className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                      Year *
                    </label>
                    <input
                      type="text"
                      value={newCard.expiryYear}
                      onChange={(e) => setNewCard({ ...newCard, expiryYear: e.target.value })}
                      maxLength={4}
                      placeholder="YYYY"
                      className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                      CVV *
                    </label>
                    <input
                      type="text"
                      value={newCard.cvv}
                      onChange={(e) => setNewCard({ ...newCard, cvv: e.target.value })}
                      maxLength={4}
                      placeholder="123"
                      className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none font-bold"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="setDefault"
                    checked={newCard.isDefault}
                    onChange={(e) => setNewCard({ ...newCard, isDefault: e.target.checked })}
                    className="w-4 h-4 text-seafoam bg-slate-100 border-slate-300 rounded focus:ring-seafoam/20"
                  />
                  <label htmlFor="setDefault" className="text-sm font-bold text-pine dark:text-zinc-100">
                    Set as default payment method
                  </label>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setShowAddCard(false)}
                    className="flex-1 compact-button bg-slate-100 dark:bg-zinc-900 text-pine dark:text-zinc-100"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddCard}
                    disabled={isProcessing}
                    className="flex-1 compact-button bg-seafoam text-white disabled:opacity-50"
                  >
                    {isProcessing ? 'Adding...' : 'Add Card'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Payment Methods List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {paymentMethods.length === 0 ? (
              <div className="md:col-span-2 compact-card text-center py-12">
                <CreditCard className="mx-auto text-slate-300 dark:text-zinc-700 mb-4" size={64} />
                <p className="text-slate-400 font-bold">No payment methods added</p>
                <p className="text-sm text-slate-400 mt-1">Add a payment method to manage your subscription</p>
              </div>
            ) : (
              paymentMethods.map((method, index) => (
                <motion.div
                  key={method.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className={`compact-card ${method.isDefault ? 'ring-2 ring-seafoam' : ''}`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-seafoam to-cyan rounded-xl flex items-center justify-center">
                        <CreditCard className="text-white" size={20} />
                      </div>
                      <div>
                        <div className="font-black text-pine dark:text-zinc-100">
                          {method.type === 'card' ? method.brand : 'PayPal'}
                        </div>
                        <div className="text-sm text-slate-400 font-bold">
                          {method.type === 'card' ? `•••• ${method.last4}` : method.email}
                        </div>
                      </div>
                    </div>
                    {method.isDefault && (
                      <span className="px-2 py-1 bg-seafoam/10 text-seafoam text-[8px] font-black uppercase tracking-wider rounded-lg">
                        Default
                      </span>
                    )}
                  </div>

                  {method.type === 'card' && method.expiryMonth && method.expiryYear && (
                    <div className="text-sm text-slate-500 dark:text-zinc-400 font-bold mb-4">
                      Expires {method.expiryMonth.toString().padStart(2, '0')}/{method.expiryYear}
                    </div>
                  )}

                  <div className="flex gap-2">
                    {!method.isDefault && (
                      <button
                        onClick={() => onSetDefaultPaymentMethod(method.id)}
                        className="flex-1 compact-button bg-slate-100 dark:bg-zinc-800 text-pine dark:text-zinc-100 text-[9px]"
                      >
                        Set as Default
                      </button>
                    )}
                    <button
                      onClick={() => handleRemoveCard(method.id)}
                      className="compact-button bg-red-500/10 text-red-500 hover:bg-red-500/20"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>
      )}

      {/* Billing History Tab */}
      {activeTab === 'history' && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-6"
        >
          <h2 className="section-header">Billing History</h2>

          <div className="space-y-3">
            {invoices.length === 0 ? (
              <div className="compact-card text-center py-12">
                <Calendar className="mx-auto text-slate-300 dark:text-zinc-700 mb-4" size={64} />
                <p className="text-slate-400 font-bold">No billing history</p>
                <p className="text-sm text-slate-400 mt-1">Your invoices will appear here</p>
              </div>
            ) : (
              invoices.map((invoice, index) => (
                <motion.div
                  key={invoice.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className="compact-card"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-slate-100 dark:bg-zinc-800 rounded-xl flex items-center justify-center">
                        {getStatusIcon(invoice.status)}
                      </div>
                      <div>
                        <div className="font-black text-pine dark:text-zinc-100 mb-1">
                          {invoice.description}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-slate-400 font-bold">
                            {new Date(invoice.date).toLocaleDateString()}
                          </span>
                          <span className={getStatusBadge(invoice.status)}>
                            {invoice.status}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-2xl font-black text-pine dark:text-zinc-100">
                          ${invoice.amount.toFixed(2)}
                        </div>
                      </div>
                      {invoice.status === 'paid' && invoice.downloadUrl && (
                        <button className="compact-button bg-slate-100 dark:bg-zinc-800 text-pine dark:text-zinc-100">
                          <Download size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

export default PaymentProcessing;

