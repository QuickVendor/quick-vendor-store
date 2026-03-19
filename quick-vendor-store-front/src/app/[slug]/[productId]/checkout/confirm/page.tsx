'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useParams } from 'next/navigation';
import Link from 'next/link';
import { verifyOrder, formatPrice } from '@/lib/api';
import type { OrderVerifyResponse } from '@/lib/api';

export default function ConfirmPage() {
  const searchParams = useSearchParams();
  const params = useParams<{ slug: string; productId: string }>();
  const reference = searchParams.get('ref') ?? searchParams.get('reference') ?? '';

  const [state, setState] = useState<'loading' | 'success' | 'pending' | 'failed'>('loading');
  const [order, setOrder] = useState<OrderVerifyResponse['order']>(null);
  const attempts = useRef(0);
  const maxAttempts = 12; // 12 × 3s = 36s max

  useEffect(() => {
    if (!reference) {
      setState('failed');
      return;
    }

    const poll = async () => {
      try {
        const result = await verifyOrder(reference);

        if (result.status === 'PAID' || result.status === 'CONFIRMED' || result.status === 'FULFILLED') {
          setOrder(result.order);
          setState('success');
          return;
        }

        if (result.status === 'EXPIRED' || result.status === 'CANCELLED' || result.status === 'REFUNDED') {
          setState('failed');
          return;
        }

        // Still PENDING — keep polling
        attempts.current += 1;
        if (attempts.current >= maxAttempts) {
          setState('pending');
          return;
        }

        setTimeout(poll, 3000);
      } catch {
        setState('failed');
      }
    };

    void poll();
  }, [reference]);

  if (state === 'loading') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 px-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-gray-900" />
        <p className="text-center text-gray-600">Confirming your payment…</p>
        <p className="text-center text-sm text-gray-400">This may take a few seconds</p>
      </div>
    );
  }

  if (state === 'success' && order) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <svg className="h-8 w-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Payment confirmed!</h1>
          <p className="mt-2 text-sm text-gray-500">
            Thank you, {order.customerName}. Your order has been placed.
          </p>

          <div className="mt-6 rounded-xl bg-gray-50 p-4 text-left text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Order ref</span>
              <span className="font-mono text-xs text-gray-700">{order.reference}</span>
            </div>
            <div className="mt-2 flex justify-between">
              <span className="text-gray-500">Product</span>
              <span className="font-medium text-gray-900">{order.product.name}</span>
            </div>
            <div className="mt-2 flex justify-between">
              <span className="text-gray-500">Amount paid</span>
              <span className="font-bold text-green-600">{formatPrice(order.amount)}</span>
            </div>
          </div>

          <p className="mt-4 text-xs text-gray-400">
            A confirmation email has been sent to {order.customerEmail}
          </p>

          <Link
            href={`/${params.slug}`}
            className="mt-6 block w-full rounded-xl bg-gray-900 py-3 text-center text-sm font-semibold text-white hover:bg-gray-700 transition-colors"
          >
            Continue shopping
          </Link>
        </div>
      </div>
    );
  }

  if (state === 'pending') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100">
            <svg className="h-8 w-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Payment pending</h1>
          <p className="mt-2 text-sm text-gray-500">
            Your payment is still processing. If you completed payment, it should be confirmed shortly.
          </p>
          <p className="mt-2 text-xs text-gray-400">Order reference: {reference}</p>
          <button
            onClick={() => {
              setState('loading');
              attempts.current = 0;
            }}
            className="mt-6 block w-full rounded-xl bg-gray-900 py-3 text-center text-sm font-semibold text-white hover:bg-gray-700 transition-colors"
          >
            Check again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
          <svg className="h-8 w-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-gray-900">Payment unsuccessful</h1>
        <p className="mt-2 text-sm text-gray-500">
          {!reference
            ? 'No order reference found.'
            : 'Your payment could not be confirmed. Please try again or contact the vendor.'}
        </p>
        <Link
          href={`/${params.slug}/${params.productId}`}
          className="mt-6 block w-full rounded-xl bg-gray-900 py-3 text-center text-sm font-semibold text-white hover:bg-gray-700 transition-colors"
        >
          Try again
        </Link>
      </div>
    </div>
  );
}
