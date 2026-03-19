import { apiClient } from '../../core/api/client';
import type { LoginResponse, RegisterRequest, RegisterResponse } from '../../types';

/**
 * Login — sends email + password as JSON.
 */
export async function login(credentials: { email: string; password: string }): Promise<LoginResponse> {
    const { data } = await apiClient.post<LoginResponse>('/api/auth/login', {
        email: credentials.email,
        password: credentials.password,
    });
    return data;
}

/**
 * Logout — invalidates the token server-side.
 * Must be called BEFORE clearing local auth state.
 */
export async function logout(): Promise<void> {
    try {
        await apiClient.post('/api/auth/logout');
    } catch {
        // Swallow errors — we still want to clear local state even if the API fails
    }
}

/**
 * Register a new vendor account.
 * NestJS returns { access_token, token_type, user } for auto-login.
 */
export async function register(payload: RegisterRequest): Promise<RegisterResponse> {
    const { data } = await apiClient.post<RegisterResponse>('/api/users/register', payload);
    return data;
}
