import { create } from 'zustand';

// ── Types ──────────────────────────────────────────────────
export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastData {
    /** Unique identifier (auto-generated). */
    id: string;
    /** Visual variant — controls colour and icon. */
    type: ToastType;
    /** Bold headline, e.g. "Login Failed". */
    title: string;
    /** Optional body text with more detail. */
    message?: string;
    /** Auto-dismiss delay in ms.  Pass 0 to keep it until dismissed. */
    duration?: number;
}

interface ToastState {
    /** Currently visible toast (null when hidden). */
    toast: ToastData | null;
    /** FIFO queue — next toast is shown when the current one is dismissed. */
    queue: ToastData[];
    /** Show a toast. If one is already visible it gets queued. */
    showToast: (data: Omit<ToastData, 'id'>) => void;
    /** Dismiss the current toast and show the next in queue. */
    hideToast: () => void;
}

let _id = 0;

// ── Store ──────────────────────────────────────────────────
export const useToastStore = create<ToastState>((set, get) => ({
    toast: null,
    queue: [],

    showToast: (data) => {
        const entry: ToastData = { ...data, id: String(++_id) };

        if (get().toast) {
            // A toast is already visible — enqueue
            set((s) => ({ queue: [...s.queue, entry] }));
        } else {
            set({ toast: entry });
        }
    },

    hideToast: () => {
        const next = get().queue[0] ?? null;
        set((s) => ({
            toast: next,
            queue: next ? s.queue.slice(1) : [],
        }));
    },
}));

// ── Shorthand helpers (importable anywhere) ────────────────
export const toast = {
    success: (message: string, title = 'Success') =>
        useToastStore.getState().showToast({ type: 'success', title, message }),

    error: (message: string, title = 'Error') =>
        useToastStore.getState().showToast({ type: 'error', title, message }),

    warning: (message: string, title = 'Warning') =>
        useToastStore.getState().showToast({ type: 'warning', title, message }),

    info: (message: string, title = 'Info') =>
        useToastStore.getState().showToast({ type: 'info', title, message }),
};
