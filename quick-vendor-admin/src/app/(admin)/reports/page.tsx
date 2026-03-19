'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import {
  getReports,
  getEscalatedVendors,
  updateReport,
  suspendVendorFromReport,
  formatDate,
} from '@/lib/api';
import type { Report, PaginatedResponse, Vendor } from '@/lib/api';

const STATUS_STYLES: Record<string, string> = {
  OPEN: 'bg-red-100 text-red-800',
  UNDER_REVIEW: 'bg-yellow-100 text-yellow-800',
  RESOLVED: 'bg-green-100 text-green-800',
  DISMISSED: 'bg-gray-100 text-gray-600',
};

const CATEGORY_LABELS: Record<string, string> = {
  FRAUD: 'Fraud',
  COUNTERFEIT_GOODS: 'Counterfeit',
  NON_DELIVERY: 'Non-delivery',
  POOR_QUALITY: 'Poor quality',
  HARASSMENT: 'Harassment',
  WRONG_ITEM: 'Wrong item',
  OTHER: 'Other',
};

export default function ReportsPage() {
  const { token } = useAuth();
  const [data, setData] = useState<PaginatedResponse<Report> | null>(null);
  const [escalated, setEscalated] = useState<
    { vendor: Vendor; recentReportCount: number }[]
  >([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Report | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [newStatus, setNewStatus] = useState('');

  const fetchAll = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [reports, esc] = await Promise.all([
        getReports(token, {
          page,
          limit: 20,
          status: statusFilter || undefined,
        }),
        getEscalatedVendors(token),
      ]);
      setData(reports);
      setEscalated(esc);
    } finally {
      setLoading(false);
    }
  }, [token, page, statusFilter]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleUpdate = async () => {
    if (!token || !selected) return;
    try {
      await updateReport(token, selected.id, {
        status: newStatus || undefined,
        adminNotes: adminNotes || undefined,
      });
      setSelected(null);
      fetchAll();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Update failed');
    }
  };

  const handleSuspendFromReport = async (reportId: string) => {
    if (!token || !confirm('Suspend vendor and resolve this report?')) return;
    try {
      await suspendVendorFromReport(token, reportId);
      fetchAll();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Action failed');
    }
  };

  const totalPages = data ? Math.ceil(data.total / data.limit) : 0;

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Reports</h1>

      {/* Escalated vendors alert */}
      {escalated.length > 0 && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
          <h3 className="mb-2 text-sm font-semibold text-red-800">
            Escalated Vendors ({escalated.length})
          </h3>
          <div className="space-y-1">
            {escalated.map((e) => (
              <p key={e.vendor.id} className="text-sm text-red-700">
                <span className="font-medium">
                  {e.vendor.storeName || e.vendor.email}
                </span>
                {' '}— {e.recentReportCount} reports in last 30 days
              </p>
            ))}
          </div>
        </div>
      )}

      <div className="mb-4 flex items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="OPEN">Open</option>
          <option value="UNDER_REVIEW">Under Review</option>
          <option value="RESOLVED">Resolved</option>
          <option value="DISMISSED">Dismissed</option>
        </select>
        {data && (
          <span className="text-sm text-gray-400">
            {data.total} report{data.total !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white overflow-x-auto">
        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-gray-200 border-t-gray-900" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                <th className="px-5 py-3 font-medium">Category</th>
                <th className="px-5 py-3 font-medium">Vendor</th>
                <th className="px-5 py-3 font-medium">Reporter</th>
                <th className="px-5 py-3 font-medium">Description</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data?.data.map((report) => (
                <tr
                  key={report.id}
                  className="border-b border-gray-50 hover:bg-gray-50"
                >
                  <td className="px-5 py-3 font-medium">
                    {CATEGORY_LABELS[report.category] ?? report.category}
                  </td>
                  <td className="px-5 py-3 text-gray-700">
                    {report.vendor.storeName || report.vendor.email}
                  </td>
                  <td className="px-5 py-3 text-gray-500">
                    {report.customerEmail}
                  </td>
                  <td className="max-w-xs truncate px-5 py-3 text-gray-600">
                    {report.description}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[report.status] ?? ''}`}
                    >
                      {report.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-500">
                    {formatDate(report.createdAt)}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setSelected(report);
                          setAdminNotes(report.adminNotes ?? '');
                          setNewStatus(report.status);
                        }}
                        className="text-xs font-medium text-blue-600 hover:underline"
                      >
                        Review
                      </button>
                      {report.status !== 'RESOLVED' &&
                        report.status !== 'DISMISSED' && (
                          <button
                            onClick={() =>
                              handleSuspendFromReport(report.id)
                            }
                            className="text-xs font-medium text-red-600 hover:underline"
                          >
                            Suspend
                          </button>
                        )}
                    </div>
                  </td>
                </tr>
              ))}
              {data?.data.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-8 text-center text-gray-400"
                  >
                    No reports found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

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

      {/* Review modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
            <h3 className="mb-1 text-lg font-semibold text-gray-900">
              Review Report
            </h3>
            <p className="mb-4 text-sm text-gray-500">
              {CATEGORY_LABELS[selected.category] ?? selected.category} —{' '}
              {selected.vendor.storeName || selected.vendor.email}
            </p>

            <div className="mb-4 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
              {selected.description}
            </div>

            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Status
              </label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="OPEN">Open</option>
                <option value="UNDER_REVIEW">Under Review</option>
                <option value="RESOLVED">Resolved</option>
                <option value="DISMISSED">Dismissed</option>
              </select>
            </div>

            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Admin Notes
              </label>
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none"
                placeholder="Internal notes..."
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setSelected(null)}
                className="rounded-lg border px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdate}
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
              >
                Update
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
