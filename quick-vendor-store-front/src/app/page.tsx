import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md text-center">
        <h1 className="text-3xl font-bold text-gray-900">QuickVendor</h1>
        <p className="mt-3 text-gray-500">
          The simplest way to sell online. Create your store, add products, and start selling in minutes.
        </p>

        <div className="mt-8 flex flex-col gap-3">
          <Link
            href="https://quickvendor.app"
            className="block w-full rounded-xl bg-gray-900 py-3.5 text-sm font-bold text-white transition-colors hover:bg-gray-700"
          >
            Create your store
          </Link>
          <p className="text-xs text-gray-400">
            Already have a store? Share your link with customers: quickvendor.com/your-store
          </p>
        </div>
      </div>

      <footer className="absolute bottom-8 text-sm text-gray-400">
        Powered by QuickVendor
      </footer>
    </div>
  );
}
