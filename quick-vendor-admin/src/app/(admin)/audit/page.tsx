'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { getAuditLogs, formatDate } from '@/lib/api';
import type { AuditEntry, PaginatedResponse } from '@/lib/api';

const ACTION_STYLES: Record<string, string> = {
  VENDOR_SUSPENDED: 'text-red-700 bg-red-50',
  VENDOR_UNSUSPENDED: 'text-blue-700 bg-blue-50',
  VENDOR_DELETED: 'text-red-700 bg-red-50',
  PRODUCT_HIDDEN: 'text-yellow-700 bg-yellow-50',
  PRODUCT_UNHIDDEN: 'text-green-700 bg-green-50',
  PRODUCT_DELETED: 'text-red-700 bg-red-50',
  ORDER_REFUNDED: 'text-orange-700 bg-orange-50',
  REPORT_UPDATED: 'text-blue-700 bg-blue-50',
  VENDOR_SUSPENDED_FROM_REPORT: 'text-red-700 bg-red-50',
  SETTINGS_UPDATED: 'text-purple-700 bg-purple-50',
};

export default function AuditPage() {
  const { token } = useAuth();
  const [data, setData] = useState<PaginatedResponse<AuditEntry> | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await getAuditLogs(token, { page, limit: 30 });
      setData(res);
    } finally {
      setLoading(false);
    }
  }, [token, page]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const totalPages = data ? Math.ceil(data.total / data.limit) : 0;

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Audit Log</h1>

      <div className="rounded-xl border border-gray-200 bg-white">
        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-gray-200 border-t-gray-900" />
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {data?.data.map((entry) => (
              <div
                key={entry.id}
                className="flex items-start gap-4 px-5 py-4 hover:bg-gray-50"
              >
                <span
                  className={`mt-0.5 inline-block rounded px-2 py-0.5 text-xs font-medium ${
                    ACTION_STYLES[entry.action] ?? 'text-gray-700 bg-gray-50'
                  }`}
                >
                  {entry.action.replace(/_/g, ' ')}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">{entry.targetType}</span>{' '}
                    <span className="font-mono text-xs text-gray-400">
                      {entry.targetId.slice(0, 8)}...
                    </span>
                  </p>
                  {entry.metadata && (
                    <p className="mt-1 text-xs text-gray-400 truncate">
                      {JSON.stringify(entry.metadata)}
                    </p>
                  )}
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap">
                  {formatDate(entry.createdAt)}
                </span>
              </div>
            ))}
            {data?.data.length === 0 && (
              <p className="px-5 py-8 text-center text-gray-400">
                No audit entries yet
              </p>
            )}
          </div>
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
    </div>
  );
}
