/**
 * Standardized application error.
 * All API errors are normalized into this shape before reaching UI.
 */
export class AppError extends Error {
    constructor(
        /** Machine-readable error code, e.g. 'INVALID_CREDENTIALS'. */
        public readonly code: string,
        /** User-facing message safe to display in UI. */
        public readonly userMessage: string,
        /** HTTP status code, if applicable. */
        public readonly statusCode?: number,
        /** Raw error detail from backend. */
        public readonly detail?: unknown,
    ) {
        super(userMessage);
        this.name = 'AppError';
    }
}

/**
 * Normalize any thrown error into an AppError.
 * Handles Axios errors, network errors, and unknown errors.
 */
export function normalizeError(error: unknown): AppError {
    // Already normalized
    if (error instanceof AppError) return error;

    // Axios error with backend response
    if (isAxiosError(error) && error.response) {
        const status = error.response.status;
        const data = error.response.data;

        const message = extractMessage(data, status);

        return new AppError(
            getErrorCode(status),
            message,
            status,
            data,
        );
    }

    // Network / timeout error
    if (isAxiosError(error) && !error.response) {
        const isTimeout = error.code === 'ECONNABORTED';
        return new AppError(
            isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR',
            isTimeout
                ? 'Request timed out. Please check your internet connection and try again.'
                : 'Unable to connect to server. Please check your internet connection.',
        );
    }

    // Unknown error
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    return new AppError('UNKNOWN', message);
}

/**
 * Extract a user-facing message from backend response data.
 *
 * Supports:
 *  - NestJS:  { message: string | string[], statusCode, error }
 *  - FastAPI: { detail: string | { msg, type }[] }
 *  - Fallback: generic message based on status code
 */
function extractMessage(data: Record<string, unknown> | undefined, status: number): string {
    if (!data) return getDefaultMessage(status);

    // NestJS format — `message` can be a string or an array (class-validator)
    if (typeof data.message === 'string') return data.message;
    if (Array.isArray(data.message)) {
        return (data.message as string[]).join('. ');
    }

    // FastAPI format — `detail` can be a string or array of validation objects
    if (typeof data.detail === 'string') return data.detail;
    if (Array.isArray(data.detail)) {
        return (data.detail as { msg: string }[]).map((d) => d.msg).join('. ');
    }

    return getDefaultMessage(status);
}

function getErrorCode(status: number): string {
    const map: Record<number, string> = {
        400: 'BAD_REQUEST',
        401: 'UNAUTHORIZED',
        403: 'FORBIDDEN',
        404: 'NOT_FOUND',
        409: 'CONFLICT',
        422: 'VALIDATION_ERROR',
        429: 'RATE_LIMITED',
        500: 'SERVER_ERROR',
    };
    return map[status] ?? 'HTTP_ERROR';
}

function getDefaultMessage(status: number): string {
    const map: Record<number, string> = {
        400: 'Invalid request. Please check your input.',
        401: 'Session expired. Please log in again.',
        403: 'You do not have permission to perform this action.',
        404: 'The requested resource was not found.',
        409: 'This resource already exists.',
        422: 'Please check your input and try again.',
        429: 'Too many requests. Please wait a moment.',
        500: 'Something went wrong on our end. Please try again later.',
    };
    return map[status] ?? 'An unexpected error occurred.';
}

// Minimal Axios error type check without importing Axios
function isAxiosError(error: unknown): error is {
    response?: { status: number; data?: Record<string, unknown> };
    code?: string;
    isAxiosError: boolean;
} {
    return (
        typeof error === 'object' &&
        error !== null &&
        'isAxiosError' in error &&
        (error as { isAxiosError: boolean }).isAxiosError === true
    );
}
