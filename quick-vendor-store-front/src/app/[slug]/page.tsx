import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getStore, formatPrice, buildWhatsAppUrl, resolveImageUrl } from '@/lib/api';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const store = await getStore(slug);
  if (!store) return { title: 'Store not found' };

  return {
    title: store.store_name ?? 'QuickVendor Store',
    description: `Shop from ${store.store_name ?? 'this vendor'} on QuickVendor`,
    openGraph: {
      title: store.store_name ?? 'QuickVendor Store',
      description: `Browse and buy from ${store.store_name ?? 'this vendor'}`,
      images: store.banner_url ? [resolveImageUrl(store.banner_url) ?? ''] : [],
    },
  };
}

export default async function StorePage({ params }: Props) {
  const { slug } = await params;
  const store = await getStore(slug);
  if (!store) notFound();

  const whatsappUrl = buildWhatsAppUrl(store.whatsapp_number, store.store_name ?? 'products');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Banner */}
      {store.banner_url && resolveImageUrl(store.banner_url) && (
        <div className="relative h-48 w-full overflow-hidden bg-gray-200 sm:h-64">
          <Image
            src={resolveImageUrl(store.banner_url)!}
            alt={`${store.store_name ?? 'Store'} banner`}
            fill
            className="object-cover"
            priority
            quality={60}
          />
        </div>
      )}

      <div className="mx-auto max-w-4xl px-4 py-6">
        {/* Store header */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold text-gray-900">
            {store.store_name ?? 'QuickVendor Store'}
          </h1>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-green-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-600"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            Chat on WhatsApp
            {store.whatsapp_verified && (
              <span className="ml-1 rounded-full bg-white px-1.5 py-0.5 text-xs font-bold text-green-600">✓</span>
            )}
          </a>
        </div>

        {/* Products grid */}
        {store.products.length === 0 ? (
          <p className="text-center text-gray-500 py-12">No products listed yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {store.products.map((product) => (
              <Link
                key={product.id}
                href={`/${slug}/${product.id}`}
                className="group rounded-xl bg-white shadow-sm hover:shadow-md transition-shadow overflow-hidden"
              >
                <div className="relative aspect-square bg-gray-100">
                  {resolveImageUrl(product.image_urls[0]) ? (
                    <Image
                      src={resolveImageUrl(product.image_urls[0])!}
                      alt={product.name}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-200"
                      quality={60}
                      sizes="(max-width: 640px) 50vw, 33vw"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-gray-300">
                      <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="text-sm font-semibold text-gray-900 line-clamp-2">{product.name}</p>
                  <p className="mt-1 text-sm font-bold text-green-600">{formatPrice(product.price)}</p>
                  <button className="mt-2 w-full rounded-lg bg-gray-900 py-1.5 text-xs font-semibold text-white hover:bg-gray-700 transition-colors">
                    Buy Now
                  </button>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Footer */}
        <footer className="mt-12 flex flex-col items-center gap-2 border-t border-gray-200 pt-6 text-sm text-gray-400">
          <Link
            href={`/report/${slug}`}
            className="text-red-400 hover:text-red-500 underline"
          >
            Report this vendor
          </Link>
          <p>Powered by QuickVendor</p>
        </footer>
      </div>
    </div>
  );
}
