const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export interface PublicProduct {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_urls: string[];
  is_available: boolean;
  click_count: number;
}

export interface Store {
  vendor_id: string;
  store_name: string | null;
  store_slug: string | null;
  banner_url: string | null;
  vendor_email: string;
  whatsapp_number: string;
  whatsapp_verified?: boolean;
  products: PublicProduct[];
}

export type ReportCategory =
  | 'FRAUD'
  | 'COUNTERFEIT_GOODS'
  | 'NON_DELIVERY'
  | 'POOR_QUALITY'
  | 'HARASSMENT'
  | 'WRONG_ITEM'
  | 'OTHER';

export interface OrderVerifyResponse {
  status: string;
  order: {
    id: string;
    reference: string;
    status: string;
    quantity: number;
    amount: number;
    customerName: string;
    customerEmail: string;
    product: {
      id: string;
      name: string;
      price: number;
      imageUrl: string | null;
    };
    paidAt: string | null;
    createdAt: string;
  } | null;
}

export async function getStore(slug: string): Promise<Store | null> {
  try {
    const res = await fetch(`${API_URL}/api/store/${slug}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return res.json() as Promise<Store>;
  } catch {
    return null;
  }
}

export async function getProduct(slug: string, productId: string): Promise<{ store: Store; product: PublicProduct } | null> {
  const store = await getStore(slug);
  if (!store) return null;
  const product = store.products.find((p) => p.id === productId) ?? null;
  if (!product) return null;
  return { store, product };
}

export async function createOrder(data: {
  productId: string;
  quantity: number;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
}): Promise<{ reference: string; authorizationUrl: string }> {
  const res = await fetch(`${API_URL}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const error = (await res.json()) as { message?: string };
    throw new Error(error.message ?? 'Failed to create order');
  }

  return res.json() as Promise<{ reference: string; authorizationUrl: string }>;
}

export async function verifyOrder(reference: string): Promise<OrderVerifyResponse> {
  const res = await fetch(`${API_URL}/api/orders/${reference}/verify`);
  if (!res.ok) throw new Error('Failed to verify order');
  return res.json() as Promise<OrderVerifyResponse>;
}

export function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  // Relative path from backend — prepend API URL
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
  return `${apiUrl}${url}`;
}

export function formatPrice(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export async function submitReport(data: {
  vendorId: string;
  category: ReportCategory;
  description: string;
  customerEmail: string;
  customerPhone?: string;
  orderId?: string;
}): Promise<void> {
  const res = await fetch(`${API_URL}/api/reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const error = (await res.json()) as { message?: string };
    throw new Error(error.message ?? 'Failed to submit report');
  }
}

export function buildWhatsAppUrl(phone: string, productName: string): string {
  const normalized = phone.startsWith('+') ? phone : `+${phone}`;
  const text = encodeURIComponent(`Hi, I'm interested in ${productName}`);
  return `https://wa.me/${normalized.replace(/\D/g, '')}?text=${text}`;
}
