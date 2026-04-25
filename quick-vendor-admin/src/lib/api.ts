import { getApiUrl } from './env';

const API_URL = getApiUrl();

type FetchOptions = RequestInit & { token?: string };

async function apiFetch<T>(path: string, opts: FetchOptions = {}): Promise<T> {
  const { token, headers, ...rest } = opts;
  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, (body as { message?: string }).message ?? 'Request failed');
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// ── Auth ──

export async function login(email: string, password: string) {
  return apiFetch<{ access_token: string; token_type: string }>(
    '/api/auth/login',
    { method: 'POST', body: JSON.stringify({ email, password }) },
  );
}

// ── Dashboard ──

export interface DashboardStats {
  totalVendors: number;
  activeVendors: number;
  suspendedVendors: number;
  totalOrders: number;
  ordersByStatus: Record<string, number>;
  totalRevenue: number;
  platformCommission: number;
  commissionPercentage: number;
  openReports: number;
  totalProducts: number;
  activeProducts: number;
}

export interface RevenuePoint {
  date: string;
  amount: number;
}

export interface TopVendor {
  vendor: { id: string; email: string; storeName: string; storeSlug: string };
  totalRevenue: number;
  orderCount: number;
}

export interface RecentOrder {
  id: string;
  reference: string;
  amount: number;
  status: string;
  customerEmail: string;
  customerName: string;
  createdAt: string;
  vendor: { id: string; email: string; storeName: string };
  product: { id: string; name: string };
}

export function getStats(token: string) {
  return apiFetch<DashboardStats>('/api/admin/dashboard/stats', { token });
}

export function getRevenueChart(token: string, period = '30d') {
  return apiFetch<RevenuePoint[]>(
    `/api/admin/dashboard/revenue-chart?period=${period}`,
    { token },
  );
}

export function getTopVendors(token: string) {
  return apiFetch<TopVendor[]>('/api/admin/dashboard/top-vendors', { token });
}

export function getRecentOrders(token: string) {
  return apiFetch<RecentOrder[]>('/api/admin/dashboard/recent-orders', {
    token,
  });
}

// ── Vendors ──

export interface Vendor {
  id: string;
  email: string;
  storeName: string;
  storeSlug: string;
  status: string;
  whatsappNumber: string;
  whatsappVerified: boolean | null;
  paymentSetupComplete: boolean;
  bannerUrl: string | null;
  bankAccountName: string | null;
  suspendedAt: string | null;
  suspensionReason: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  totalRevenue?: number;
  _count: { products: number; orders: number; reportsAgainst: number };
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export function getVendors(
  token: string,
  params: { page?: number; limit?: number; search?: string; status?: string } = {},
) {
  const qs = new URLSearchParams();
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.search) qs.set('search', params.search);
  if (params.status) qs.set('status', params.status);
  return apiFetch<PaginatedResponse<Vendor>>(
    `/api/admin/vendors?${qs.toString()}`,
    { token },
  );
}

export function getVendor(token: string, id: string) {
  return apiFetch<Vendor>(`/api/admin/vendors/${id}`, { token });
}

export function suspendVendor(token: string, id: string, reason: string) {
  return apiFetch<Vendor>(`/api/admin/vendors/${id}/suspend`, {
    token,
    method: 'PATCH',
    body: JSON.stringify({ reason }),
  });
}

export function unsuspendVendor(token: string, id: string) {
  return apiFetch<Vendor>(`/api/admin/vendors/${id}/unsuspend`, {
    token,
    method: 'PATCH',
  });
}

export function deleteVendor(token: string, id: string) {
  return apiFetch<void>(`/api/admin/vendors/${id}`, {
    token,
    method: 'DELETE',
  });
}

// ── Orders ──

export interface AdminOrder {
  id: string;
  reference: string;
  amount: number;
  quantity: number;
  status: string;
  customerEmail: string;
  customerName: string;
  customerPhone: string | null;
  paidAt: string | null;
  confirmedAt: string | null;
  fulfilledAt: string | null;
  createdAt: string;
  vendor: { id: string; email: string; storeName: string };
  product: { id: string; name: string };
}

export function getOrders(
  token: string,
  params: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
  } = {},
) {
  const qs = new URLSearchParams();
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.status) qs.set('status', params.status);
  if (params.search) qs.set('search', params.search);
  return apiFetch<PaginatedResponse<AdminOrder>>(
    `/api/admin/orders?${qs.toString()}`,
    { token },
  );
}

export function refundOrder(token: string, id: string) {
  return apiFetch<{ message: string }>(`/api/admin/orders/${id}/refund`, {
    token,
    method: 'POST',
  });
}

// ── Reports ──

export interface Report {
  id: string;
  vendorId: string;
  category: string;
  description: string;
  customerEmail: string;
  customerPhone: string | null;
  orderId: string | null;
  status: string;
  adminNotes: string | null;
  resolvedAt: string | null;
  createdAt: string;
  vendor: { id: string; email: string; storeName: string };
  order: { id: string; reference: string; amount: number } | null;
}

export function getReports(
  token: string,
  params: { page?: number; limit?: number; status?: string; category?: string } = {},
) {
  const qs = new URLSearchParams();
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.status) qs.set('status', params.status);
  if (params.category) qs.set('category', params.category);
  return apiFetch<PaginatedResponse<Report>>(
    `/api/admin/reports?${qs.toString()}`,
    { token },
  );
}

export function getEscalatedVendors(token: string) {
  return apiFetch<
    { vendor: Vendor; recentReportCount: number }[]
  >('/api/admin/reports/escalated', { token });
}

export function updateReport(
  token: string,
  id: string,
  data: { status?: string; adminNotes?: string },
) {
  return apiFetch<Report>(`/api/admin/reports/${id}`, {
    token,
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function suspendVendorFromReport(token: string, reportId: string) {
  return apiFetch<{ message: string }>(
    `/api/admin/reports/${reportId}/suspend-vendor`,
    { token, method: 'POST' },
  );
}

// ── Audit ──

export interface AuditEntry {
  id: string;
  adminId: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export function getAuditLogs(
  token: string,
  params: { page?: number; limit?: number; action?: string } = {},
) {
  const qs = new URLSearchParams();
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.action) qs.set('action', params.action);
  return apiFetch<PaginatedResponse<AuditEntry>>(
    `/api/admin/audit?${qs.toString()}`,
    { token },
  );
}

// ── Settings ──

export interface PlatformSettings {
  id: string;
  commissionPercentage: number;
  orderExpirationMinutes: number;
  escalationThreshold: number;
  escalationWindowDays: number;
  updatedAt: string;
}

export function getSettings(token: string) {
  return apiFetch<PlatformSettings>('/api/admin/settings', { token });
}

export function updateSettings(
  token: string,
  data: Partial<Omit<PlatformSettings, 'id' | 'updatedAt'>>,
) {
  return apiFetch<PlatformSettings>('/api/admin/settings', {
    token,
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

// ── Helpers ──

export function formatKobo(kobo: number): string {
  return `\u20A6${(kobo / 100).toLocaleString('en-NG', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

export function formatDate(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
