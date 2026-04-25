'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getProduct, createOrder, formatPrice } from '@/lib/api';
import type { PublicProduct, Store } from '@/lib/api';

export default function CheckoutPage() {
  const params = useParams<{ slug: string; productId: string }>();

  const [store, setStore] = useState<Store | null>(null);
  const [product, setProduct] = useState<PublicProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    quantity: 1,
  });

  useEffect(() => {
    getProduct(params.slug, params.productId)
      .then((data) => {
        if (data) {
          setStore(data.store);
          setProduct(data.product);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [params.slug, params.productId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;

    setSubmitting(true);
    setError(null);

    try {
      const result = await createOrder({
        productId: product.id,
        quantity: form.quantity,
        customerName: form.customerName,
        customerEmail: form.customerEmail,
        customerPhone: form.customerPhone || undefined,
      });

      // Redirect to Paystack payment page
      window.location.href = result.authorizationUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-gray-900" />
      </div>
    );
  }

  if (!product || !store) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-gray-600">Product not found.</p>
        <Link href={`/${params.slug}`} className="text-blue-600 underline">
          Back to store
        </Link>
      </div>
    );
  }

  const total = product.price * form.quantity;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-lg px-4 py-8">
        <Link
          href={`/${params.slug}/${params.productId}`}
          className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
        >
          ← Back to product
        </Link>

        <h1 className="mb-6 text-xl font-bold text-gray-900">Complete your order</h1>

        {/* Order summary */}
        <div className="mb-6 rounded-xl bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Ordering from</p>
          <p className="font-semibold text-gray-900">{store.store_name ?? store.vendor_email}</p>
          <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
            <div>
              <p className="font-medium text-gray-900">{product.name}</p>
              <p className="text-sm text-gray-500">{formatPrice(product.price)} each</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, quantity: Math.max(1, f.quantity - 1) }))}
                className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-300 text-gray-600 hover:bg-gray-50"
              >
                −
              </button>
              <span className="w-6 text-center font-semibold">{form.quantity}</span>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, quantity: f.quantity + 1 }))}
                className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-300 text-gray-600 hover:bg-gray-50"
              >
                +
              </button>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
            <p className="font-semibold text-gray-900">Total</p>
            <p className="text-lg font-bold text-green-600">{formatPrice(total)}</p>
          </div>
        </div>

        {/* Customer form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="mb-1 block text-sm font-medium text-gray-700">
              Full name <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              type="text"
              required
              value={form.customerName}
              onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))}
              placeholder="John Doe"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
            />
          </div>

          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">
              Email address <span className="text-red-500">*</span>
            </label>
            <input
              id="email"
              type="email"
              required
              value={form.customerEmail}
              onChange={(e) => setForm((f) => ({ ...f, customerEmail: e.target.value }))}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
            />
          </div>

          <div>
            <label htmlFor="phone" className="mb-1 block text-sm font-medium text-gray-700">
              Phone number <span className="text-gray-400">(optional)</span>
            </label>
            <input
              id="phone"
              type="tel"
              value={form.customerPhone}
              onChange={(e) => setForm((f) => ({ ...f, customerPhone: e.target.value }))}
              placeholder="+234 801 234 5678"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-gray-900 py-3.5 text-sm font-bold text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Processing...' : `Pay ${formatPrice(total)} securely`}
          </button>

          <p className="text-center text-xs text-gray-400">
            Secured by Paystack · Your payment info is safe
          </p>
        </form>
      </div>
    </div>
  );
}
