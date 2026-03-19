import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getProduct, formatPrice, buildWhatsAppUrl, resolveImageUrl } from '@/lib/api';

interface Props {
  params: Promise<{ slug: string; productId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, productId } = await params;
  const data = await getProduct(slug, productId);
  if (!data) return { title: 'Product not found' };

  const { store, product } = data;
  return {
    title: `${product.name} — ${store.store_name ?? 'QuickVendor'}`,
    description: product.description ?? `Buy ${product.name} on QuickVendor`,
    openGraph: {
      title: `${product.name} — ${store.store_name ?? 'QuickVendor'}`,
      description: product.description ?? `Buy ${product.name} for ${formatPrice(product.price)}`,
      images: product.image_urls[0] ? [resolveImageUrl(product.image_urls[0]) ?? ''] : [],
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug, productId } = await params;
  const data = await getProduct(slug, productId);
  if (!data) notFound();

  const { store, product } = data;
  const whatsappUrl = buildWhatsAppUrl(store.whatsapp_number, product.name);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-2xl px-4 py-6">
        {/* Back link */}
        <Link
          href={`/${slug}`}
          className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
        >
          ← Back to store
        </Link>

        {/* Product images */}
        {product.image_urls.length > 0 && (
          <div className="mb-6 overflow-hidden rounded-2xl bg-gray-100">
            <div className="relative aspect-square w-full">
              <Image
                src={resolveImageUrl(product.image_urls[0])!}
                alt={product.name}
                fill
                className="object-cover"
                quality={75}
                priority
                sizes="(max-width: 672px) 100vw, 672px"
              />
            </div>
            {product.image_urls.length > 1 && (
              <div className="flex gap-2 p-2">
                {product.image_urls.slice(1).map((url, i) => resolveImageUrl(url) && (
                  <div key={i} className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-gray-200">
                    <Image
                      src={resolveImageUrl(url)!}
                      alt={`${product.name} image ${i + 2}`}
                      fill
                      className="object-cover"
                      quality={50}
                      sizes="64px"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Product info */}
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h1 className="text-xl font-bold text-gray-900">{product.name}</h1>
          <p className="mt-1 text-2xl font-bold text-green-600">{formatPrice(product.price)}</p>

          {product.description && (
            <p className="mt-3 text-sm leading-relaxed text-gray-600">{product.description}</p>
          )}

          <div className="mt-6 flex flex-col gap-3">
            <Link
              href={`/${slug}/${productId}/checkout`}
              className="block w-full rounded-xl bg-gray-900 py-3 text-center text-sm font-bold text-white hover:bg-gray-700 transition-colors"
            >
              Buy Now — {formatPrice(product.price)}
            </Link>

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full rounded-xl border-2 border-green-500 py-3 text-center text-sm font-bold text-green-600 hover:bg-green-50 transition-colors"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              Ask about this on WhatsApp
            </a>
          </div>
        </div>

        {/* Vendor info */}
        <div className="mt-4 rounded-xl bg-white px-4 py-3 shadow-sm text-sm text-gray-500">
          Sold by{' '}
          <Link href={`/${slug}`} className="font-semibold text-gray-800 hover:underline">
            {store.store_name ?? store.vendor_email}
          </Link>
        </div>
      </div>
    </div>
  );
}
