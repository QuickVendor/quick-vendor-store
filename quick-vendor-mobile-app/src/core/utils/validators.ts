/**
 * Validation helpers with Nigerian phone number support.
 */

const NG_PHONE_REGEX = /^(\+234|0)(70|80|81|90|91|70|71)\d{8}$/;

/**
 * Validate a Nigerian phone number.
 * Accepts formats: +2348012345678, 08012345678
 */
export function isValidNigerianPhone(phone: string): boolean {
    return NG_PHONE_REGEX.test(phone.replace(/\s/g, ''));
}

/**
 * Normalize a Nigerian phone number to +234 format.
 * 08012345678 → +2348012345678
 */
export function normalizeNigerianPhone(phone: string): string {
    const stripped = phone.replace(/\s/g, '');
    if (stripped.startsWith('0') && stripped.length === 11) {
        return `+234${stripped.slice(1)}`;
    }
    if (stripped.startsWith('+234')) {
        return stripped;
    }
    return stripped;
}

/** Validate email format. */
export function isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Validate store slug: lowercase letters, numbers, hyphens.
 * 3–30 characters, no leading/trailing hyphens.
 */
export function isValidStoreSlug(slug: string): boolean {
    return /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])?$/.test(slug);
}
