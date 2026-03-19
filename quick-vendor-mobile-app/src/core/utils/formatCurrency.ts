/**
 * Format a number as Nigerian Naira (₦).
 * Uses 'en-NG' locale for comma-separated thousands.
 */
export function formatNaira(amount: number): string {
    return `₦${amount.toLocaleString('en-NG', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    })}`;
}
