import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import type { User } from '../../types';

const TOKEN_KEY = 'quickvendor_auth_token';

interface AuthState {
    token: string | null;
    user: User | null;
    isRehydrated: boolean;

    /** Rehydrate token from secure storage on app start. */
    rehydrate: () => Promise<void>;

    /** Set token + user after login/register. */
    setAuth: (token: string, user: User) => Promise<void>;

    /** Update the user profile in state. */
    setUser: (user: User) => void;

    /** Clear all auth state and remove stored token. */
    logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
    token: null,
    user: null,
    isRehydrated: false,

    rehydrate: async () => {
        try {
            const token = await SecureStore.getItemAsync(TOKEN_KEY);
            set({ token, isRehydrated: true });
        } catch {
            set({ isRehydrated: true });
        }
    },

    setAuth: async (token: string, user: User) => {
        await SecureStore.setItemAsync(TOKEN_KEY, token);
        set({ token, user });
    },

    setUser: (user: User) => set({ user }),

    logout: async () => {
        // Invalidate token server-side first
        const { logout: serverLogout } = await import('./api');
        await serverLogout();

        // Then clear local state
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        set({ token: null, user: null });
    },
}));
