import { apiClient } from '../../core/api/client';
import type { User, UpdateStoreRequest } from '../../types';

/**
 * Get the authenticated user's profile.
 * @param token — Pass explicitly during login/register, when the
 *                interceptor does not yet have the token in Zustand.
 */
export async function getProfile(token?: string): Promise<User> {
    const { data } = await apiClient.get<User>('/api/users/me', {
        ...(token && { headers: { Authorization: `Bearer ${token}` } }),
    });
    return data;
}

/**
 * Update store settings (name, slug, WhatsApp number).
 * NOTE: The PUT /api/users/me endpoint must be implemented in the backend.
 */
export async function updateStoreSettings(payload: UpdateStoreRequest): Promise<User> {
    const { data } = await apiClient.put<User>('/api/users/me', payload);
    return data;
}
