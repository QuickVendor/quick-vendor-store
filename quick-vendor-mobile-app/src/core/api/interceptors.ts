import type { InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { env } from '../config/env';
import { normalizeError } from './errors';

/**
 * Attach JWT token to every outgoing request.
 * Token is read lazily from the auth store to avoid circular imports.
 */
export function authRequestInterceptor(config: InternalAxiosRequestConfig) {
    // Lazy import to break circular dependency (authStore → client → authStore)
    const { useAuthStore } = require('../../features/auth/authStore');
    const token = useAuthStore.getState().token;

    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}

/**
 * Log outgoing requests in development.
 */
export function loggingRequestInterceptor(config: InternalAxiosRequestConfig) {
    if (env.enableApiLogging) {
        console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`);
    }
    return config;
}

/**
 * Pass through successful responses.
 */
export function responseSuccessInterceptor(response: AxiosResponse) {
    return response;
}

/**
 * Guard flag — prevents multiple concurrent logout calls when several
 * requests fail with 401 at the same time.
 */
let isLoggingOut = false;

/**
 * Handle error responses:
 * - 401 → auto-logout (only if user was previously authenticated)
 * - Normalize all errors into AppError before re-throwing
 * - Log errors in dev
 */
export function responseErrorInterceptor(error: AxiosError) {
    if (error.response?.status === 401) {
        const { useAuthStore } = require('../../features/auth/authStore');
        const { token } = useAuthStore.getState();

        // Only auto-logout when:
        // 1. A token existed (user was authenticated — genuine session expiry)
        // 2. We are not already in a logout flow (prevent cascade)
        if (token && !isLoggingOut) {
            isLoggingOut = true;
            useAuthStore
                .getState()
                .logout()
                .finally(() => {
                    isLoggingOut = false;
                });
        }
    }

    if (env.enableApiLogging) {
        console.warn(
            `[API] ${error.response?.status ?? 'NETWORK'} ${error.config?.url}`,
            error.response?.data ?? error.message,
        );
    }

    // Normalize into AppError so every catch block gets a typed, user-friendly error
    return Promise.reject(normalizeError(error));
}

