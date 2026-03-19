'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import {
  getVendors,
  suspendVendor,
  unsuspendVendor,
  formatDate,
} from '@/lib/api';
import type { Vendor, PaginatedResponse } from '@/lib/api';

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  SUSPENDED: 'bg-red-100 text-red-800',
  CLOSED: 'bg-gray-100 text-gray-600',
  DELETED: 'bg-gray-100 text-gray-400',
};

export default function VendorsPage() {
  const { token } = useAuth();
  const [data, setData] = useState<PaginatedResponse<Vendor> | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [suspendModal, setSuspendModal] = useState<string | null>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchVendors = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await getVendors(token, {
        page,
        limit: 20,
        search: search || undefined,
        status: statusFilter || undefined,
      });
      setData(res);
    } finally {
      setLoading(false);
    }
  }, [token, page, search, statusFilter]);

  useEffect(() => {
    fetchVendors();
  }, [fetchVendors]);

  const handleSuspend = async () => {
    if (!token || !suspendModal || !suspendReason) return;
    setActionLoading(true);
    try {
      await suspendVendor(token, suspendModal, suspendReason);
      setSuspendModal(null);
      setSuspendReason('');
      fetchVendors();
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnsuspend = async (id: string) => {
    if (!token) return;
    setActionLoading(true);
    try {
      await unsuspendVendor(token, id);
      fetchVendors();
    } finally {
      setActionLoading(false);
    }
  };

  const totalPages = data ? Math.ceil(data.total / data.limit) : 0;

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Vendors</h1>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search email or store name..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="w-64 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
        />
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="CLOSED">Closed</option>
          <option value="DELETED">Deleted</option>
        </select>
        {data && (
          <span className="text-sm text-gray-400">
            {data.total} vendor{data.total !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-x-auto">
        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-gray-200 border-t-gray-900" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                <th className="px-5 py-3 font-medium">Vendor</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Products</th>
                <th className="px-5 py-3 font-medium">Orders</th>
                <th className="px-5 py-3 font-medium">Reports</th>
                <th className="px-5 py-3 font-medium">Payment</th>
                <th className="px-5 py-3 font-medium">Joined</th>
                <th className="px-5 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data?.data.map((vendor) => (
                <tr
                  key={vendor.id}
                  className="border-b border-gray-50 hover:bg-gray-50"
                >
                  <td className="px-5 py-3">
                    <p className="font-medium text-gray-900">
                      {vendor.storeName || '-'}
                    </p>
                    <p className="text-xs text-gray-400">{vendor.email}</p>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[vendor.status] ?? ''}`}
                    >
                      {vendor.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-center">
                    {vendor._count.products}
                  </td>
                  <td className="px-5 py-3 text-center">
                    {vendor._count.orders}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <span
                      className={
                        vendor._count.reportsAgainst > 0
                          ? 'font-semibold text-red-600'
                          : ''
                      }
                    >
                      {vendor._count.reportsAgainst}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    {vendor.paymentSetupComplete ? (
                      <span className="text-green-600">Setup</span>
                    ) : (
                      <span className="text-gray-400">Pending</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-gray-500">
                    {formatDate(vendor.createdAt)}
                  </td>
                  <td className="px-5 py-3">
                    {vendor.status === 'ACTIVE' && (
                      <button
                        onClick={() => setSuspendModal(vendor.id)}
                        disabled={actionLoading}
                        className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
                      >
                        Suspend
                      </button>
                    )}
                    {vendor.status === 'SUSPENDED' && (
                      <button
                        onClick={() => handleUnsuspend(vendor.id)}
                        disabled={actionLoading}
                        className="text-xs font-medium text-blue-600 hover:underline disabled:opacity-50"
                      >
                        Unsuspend
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {data?.data.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-5 py-8 text-center text-gray-400"
                  >
                    No vendors found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40"
          >
            Prev
          </button>
          <span className="text-sm text-gray-500">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}

      {/* Suspend modal */}
      {suspendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">
              Suspend Vendor
            </h3>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Reason
            </label>
            <textarea
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              rows={3}
              className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none resize-none"
              placeholder="Why is this vendor being suspended?"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setSuspendModal(null);
                  setSuspendReason('');
                }}
                className="rounded-lg border px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSuspend}
                disabled={!suspendReason || actionLoading}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {actionLoading ? 'Suspending...' : 'Suspend'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
