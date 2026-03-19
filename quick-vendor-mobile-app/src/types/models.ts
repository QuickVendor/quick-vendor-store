/**
 * Domain models matching the NestJS backend Prisma models.
 * IDs are UUIDs (strings), not auto-increment integers.
 */

import { env } from '../core/config/env';

export interface User {
    id: string;
    email: string;
    whatsapp_number: string | null;
    store_name: string | null;
    store_slug: string | null;
    store_url: string | null;
    /** Backend sends both `banner_url` and `store_banner_url`. */
    banner_url: string | null;
    store_banner_url: string | null;
    is_active: boolean;
    created_at: string;
    /** Payment fields */
    payment_setup_complete?: boolean;
    bank_account_name?: string | null;
    bank_code?: string | null;
    bank_account_number?: string | null;
}

export interface Product {
    id: string;
    name: string;
    description: string | null;
    price: number;
    is_available: boolean;
    click_count: number;
    /** Modern array of image URLs — preferred. */
    image_urls: string[];
    /** Legacy individual image fields for backward compat. */
    image_url: string | null;
    image_url_2: string | null;
    image_url_3: string | null;
    image_url_4: string | null;
    /** Owner reference — backend sends both user_id and owner_id. */
    user_id: string;
    owner_id: string;
    created_at: string;
}

/**
 * Resolve an image URL that may be relative (local storage)
 * or absolute (S3). Relative paths are prepended with the API base URL.
 */
function resolveImageUrl(url: string): string {
    if (url.startsWith('http://') || url.startsWith('https://')) {
        return url; // Already absolute (S3, production)
    }
    return `${env.apiUrl}${url}`; // Relative → prepend API host
}

export type OrderStatus =
    | 'PENDING'
    | 'PAID'
    | 'CONFIRMED'
    | 'FULFILLED'
    | 'EXPIRED'
    | 'CANCELLED'
    | 'REFUNDED';

export interface Order {
    id: string;
    reference: string;
    status: OrderStatus;
    quantity: number;
    amount: number;
    customerName: string;
    customerEmail: string;
    customerPhone: string | null;
    product: {
        id: string;
        name: string;
        price: number;
        imageUrl: string | null;
    };
    paidAt: string | null;
    confirmedAt: string | null;
    fulfilledAt: string | null;
    cancelledAt: string | null;
    createdAt: string;
}

/** Extract non-null image URLs from a product, fully resolved. */
export function getProductImages(product: Product): string[] {
    let urls: string[];

    // Prefer the modern array if populated
    if (product.image_urls && product.image_urls.length > 0) {
        urls = product.image_urls;
    } else {
        // Fall back to individual fields
        urls = [
            product.image_url,
            product.image_url_2,
            product.image_url_3,
            product.image_url_4,
        ].filter((url): url is string => url !== null && url !== '');
    }

    return urls.map(resolveImageUrl);
}
