'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import {
  getStats,
  getRevenueChart,
  getTopVendors,
  getRecentOrders,
  formatKobo,
  formatDate,
} from '@/lib/api';
import type {
  DashboardStats,
  RevenuePoint,
  TopVendor,
  RecentOrder,
} from '@/lib/api';

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  PAID: 'bg-blue-100 text-blue-800',
  CONFIRMED: 'bg-green-100 text-green-800',
  FULFILLED: 'bg-green-100 text-green-800',
  EXPIRED: 'bg-gray-100 text-gray-600',
  CANCELLED: 'bg-red-100 text-red-800',
  REFUNDED: 'bg-gray-100 text-gray-600',
};

export default function DashboardPage() {
  const { token } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [revenue, setRevenue] = useState<RevenuePoint[]>([]);
  const [topVendors, setTopVendors] = useState<TopVendor[]>([]);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      getStats(token),
      getRevenueChart(token),
      getTopVendors(token),
      getRecentOrders(token),
    ])
      .then(([s, r, v, o]) => {
        setStats(s);
        setRevenue(r);
        setTopVendors(v);
        setRecentOrders(o);
      })
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-gray-900" />
      </div>
    );
  }

  if (!stats) return null;

  const maxRevenue = Math.max(...revenue.map((r) => r.amount), 1);

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Dashboard</h1>

      {/* Stats grid */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total Revenue"
          value={formatKobo(stats.totalRevenue)}
          sub={`Commission: ${formatKobo(stats.platformCommission)} (${stats.commissionPercentage}%)`}
        />
        <StatCard
          label="Total Orders"
          value={stats.totalOrders}
          sub={`Paid: ${stats.ordersByStatus.PAID ?? 0} | Pending: ${stats.ordersByStatus.PENDING ?? 0}`}
        />
        <StatCard
          label="Vendors"
          value={stats.totalVendors}
          sub={`Active: ${stats.activeVendors} | Suspended: ${stats.suspendedVendors}`}
        />
        <StatCard
          label="Products"
          value={stats.totalProducts}
          sub={`Active: ${stats.activeProducts} | Reports: ${stats.openReports} open`}
        />
      </div>

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        {/* Revenue chart (simple bar chart) */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-700">
            Revenue (30 days)
          </h2>
          <div className="flex h-40 items-end gap-px">
            {revenue.map((point) => (
              <div
                key={point.date}
                className="flex-1 rounded-t bg-gray-900 transition-all hover:bg-gray-700"
                style={{
                  height: `${(point.amount / maxRevenue) * 100}%`,
                  minHeight: point.amount > 0 ? 4 : 0,
                }}
                title={`${point.date}: ${formatKobo(point.amount)}`}
              />
            ))}
          </div>
          <div className="mt-2 flex justify-between text-xs text-gray-400">
            <span>{revenue[0]?.date ?? ''}</span>
            <span>{revenue[revenue.length - 1]?.date ?? ''}</span>
          </div>
        </div>

        {/* Top vendors */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-700">
            Top Vendors (30 days)
          </h2>
          {topVendors.length === 0 ? (
            <p className="text-sm text-gray-400">No data yet</p>
          ) : (
            <div className="space-y-3">
              {topVendors.slice(0, 5).map((tv, i) => (
                <div key={tv.vendor.id} className="flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-500">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {tv.vendor.storeName || tv.vendor.email}
                    </p>
                    <p className="text-xs text-gray-400">
                      {tv.orderCount} order{tv.orderCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">
                    {formatKobo(tv.totalRevenue)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent orders */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-700">
            Recent Orders
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                <th className="px-5 py-3 font-medium">Reference</th>
                <th className="px-5 py-3 font-medium">Customer</th>
                <th className="px-5 py-3 font-medium">Vendor</th>
                <th className="px-5 py-3 font-medium">Amount</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((order) => (
                <tr
                  key={order.id}
                  className="border-b border-gray-50 hover:bg-gray-50"
                >
                  <td className="px-5 py-3 font-mono text-xs">
                    {order.reference}
                  </td>
                  <td className="px-5 py-3">{order.customerName}</td>
                  <td className="px-5 py-3 text-gray-500">
                    {order.vendor.storeName || order.vendor.email}
                  </td>
                  <td className="px-5 py-3 font-medium">
                    {formatKobo(order.amount)}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[order.status] ?? ''}`}
                    >
                      {order.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-500">
                    {formatDate(order.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
