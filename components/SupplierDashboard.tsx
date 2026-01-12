import React, { useState, useEffect } from 'react';
import {
  Package,
  DollarSign,
  ShoppingCart,
  AlertCircle,
  CheckCircle,
  Clock
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supplierProductsAPI } from '../services/modules/supplierProducts.api';
import { supplierOrdersAPI } from '../services/modules/supplierOrders.api';
import { toast } from '../services/utils/toast';

const SupplierDashboard: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalRevenue: 0,
    pendingPayments: 0,
    totalProducts: 0,
    activeOrders: 0,
    lowStockItems: 0,
    completedOrders: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSupplierStats = async () => {
      try {
        setLoading(true);

        // Fetch products
        const productsResponse = await supplierProductsAPI.getMyProducts({ limit: 1000 });
        const products = productsResponse.data.data || [];
        const totalProducts = products.length;
        const lowStockItems = 0; // Supplier products don't have stock tracking

        // Fetch orders
        const ordersResponse = await supplierOrdersAPI.getMyOrders({ limit: 1000 });
        const orders = ordersResponse.data.data || [];

        // Calculate order stats
        const activeOrders = orders.filter(order =>
          ['SUBMITTED', 'APPROVED', 'ORDERED', 'PARTIALLY_RECEIVED'].includes(order.status)
        ).length;

        const completedOrders = orders.filter(order =>
          ['RECEIVED', 'COMPLETED'].includes(order.status)
        ).length;

        // Calculate revenue (sum of completed orders)
        const totalRevenue = orders
          .filter(order => ['RECEIVED', 'COMPLETED'].includes(order.status))
          .reduce((sum, order) => sum + parseFloat(order.totalAmount.toString()), 0);

        // Calculate pending payments (sum of active orders)
        const pendingPayments = orders
          .filter(order => ['SUBMITTED', 'APPROVED', 'ORDERED', 'PARTIALLY_RECEIVED'].includes(order.status))
          .reduce((sum, order) => sum + parseFloat(order.totalAmount.toString()), 0);

        setStats({
          totalRevenue,
          pendingPayments,
          totalProducts,
          activeOrders,
          lowStockItems,
          completedOrders
        });
      } catch (error: any) {
        console.error('Error fetching supplier stats:', error);
        toast.error('Failed to load supplier statistics');
      } finally {
        setLoading(false);
      }
    };

    if (user?.supplier) {
      fetchSupplierStats();
    }
  }, [user]);

  const statCards = [
    {
      label: 'Total Revenue',
      value: `$${stats.totalRevenue.toLocaleString()}`,
      icon: DollarSign,
      color: 'text-green-500',
      bg: 'bg-green-500/10',
      border: 'border-green-500/20'
    },
    {
      label: 'Pending Payments',
      value: `$${stats.pendingPayments.toLocaleString()}`,
      icon: Clock,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20'
    },
    {
      label: 'Total Products',
      value: stats.totalProducts,
      icon: Package,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/20'
    },
    {
      label: 'Active Orders',
      value: stats.activeOrders,
      icon: ShoppingCart,
      color: 'text-purple-500',
      bg: 'bg-purple-500/10',
      border: 'border-purple-500/20'
    },
    {
      label: 'Low Stock Items',
      value: stats.lowStockItems,
      icon: AlertCircle,
      color: 'text-red-500',
      bg: 'bg-red-500/10',
      border: 'border-red-500/20'
    },
    {
      label: 'Completed Orders',
      value: stats.completedOrders,
      icon: CheckCircle,
      color: 'text-seafoam',
      bg: 'bg-seafoam/10',
      border: 'border-seafoam/20'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header with Supplier Info */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-black text-pine dark:text-zinc-100 uppercase tracking-tight">
              {user?.supplier?.name || 'Supplier Dashboard'}
            </h1>
            <p className="text-seafoam dark:text-zinc-500 text-sm font-bold mt-1">
              Welcome back, {user?.name}
            </p>
            {user?.supplier && (
              <div className="mt-3 space-y-1 text-sm text-slate-600 dark:text-zinc-400">
                {user.supplier.category && (
                  <p className="font-semibold">
                    Category: <span className="text-pine dark:text-zinc-300">{user.supplier.category}</span>
                  </p>
                )}
                {user.supplier.contactEmail && (
                  <p>
                    Email: <span className="text-pine dark:text-zinc-300">{user.supplier.contactEmail}</span>
                  </p>
                )}
                {user.supplier.contactPhone && (
                  <p>
                    Phone: <span className="text-pine dark:text-zinc-300">{user.supplier.contactPhone}</span>
                  </p>
                )}
                {user.supplier.address && (
                  <p>
                    Address: <span className="text-pine dark:text-zinc-300">{user.supplier.address}</span>
                  </p>
                )}
              </div>
            )}
          </div>
          {user?.supplier && (
            <div className="flex items-center gap-2">
              <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                user.supplier.isActive
                  ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                  : 'bg-red-500/10 text-red-600 dark:text-red-400'
              }`}>
                {user.supplier.isActive ? 'Active' : 'Inactive'}
              </div>
              <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-amber-500/10">
                <span className="text-amber-600 dark:text-amber-400 text-xs font-bold">
                  ⭐ {user.supplier.rating.toFixed(1)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, idx) => (
            <div
              key={idx}
              className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm animate-pulse"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="h-3 bg-slate-200 dark:bg-zinc-800 rounded w-24 mb-3"></div>
                  <div className="h-8 bg-slate-200 dark:bg-zinc-800 rounded w-32"></div>
                </div>
                <div className="w-14 h-14 bg-slate-200 dark:bg-zinc-800 rounded-xl"></div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {statCards.map((stat, idx) => (
            <div
              key={idx}
              className={`bg-white dark:bg-zinc-900 border-2 ${stat.border} rounded-2xl p-6 shadow-sm hover:shadow-lg transition-all`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-black text-slate-500 dark:text-zinc-500 uppercase tracking-wider">
                    {stat.label}
                  </p>
                  <p className="text-3xl font-black text-pine dark:text-zinc-100 mt-2">
                    {stat.value}
                  </p>
                </div>
                <div className={`p-4 ${stat.bg} rounded-xl`}>
                  <stat.icon className={stat.color} size={28} />
                </div>
              </div>
          </div>
        ))}
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-black text-pine dark:text-zinc-100 uppercase tracking-tight mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="px-6 py-4 bg-pine dark:bg-zinc-100 text-white dark:text-pine rounded-xl font-black text-sm uppercase tracking-wider hover:opacity-90 transition-all">
            Add New Product
          </button>
          <button className="px-6 py-4 bg-seafoam text-white rounded-xl font-black text-sm uppercase tracking-wider hover:opacity-90 transition-all">
            View Orders
          </button>
          <button className="px-6 py-4 bg-slate-100 dark:bg-zinc-800 text-pine dark:text-zinc-100 rounded-xl font-black text-sm uppercase tracking-wider hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all">
            Manage Inventory
          </button>
        </div>
      </div>

      {/* Recent Activity Placeholder */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-black text-pine dark:text-zinc-100 uppercase tracking-tight mb-4">
          Recent Activity
        </h2>
        <p className="text-slate-500 dark:text-zinc-500 text-sm">
          No recent activity to display
        </p>
      </div>
    </div>
  );
};

export default SupplierDashboard;

