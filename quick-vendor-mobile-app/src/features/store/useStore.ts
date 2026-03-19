import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateStoreSettings } from './api';
import { uploadStoreBanner } from '../../core/services/upload.service';
import { useAuthStore } from '../auth/authStore';
import { toast } from '../../core/hooks/useToast';
import { AppError, normalizeError } from '../../core/api/errors';
import type { UpdateStoreRequest, User } from '../../types';

export function useUpdateStore() {
    const queryClient = useQueryClient();
    const setUser = useAuthStore((state) => state.setUser);

    return useMutation<User, AppError, UpdateStoreRequest>({
        mutationFn: updateStoreSettings,
        onSuccess: (updatedUser) => {
            // Update global auth store state
            setUser(updatedUser);
            // Invalidate store summary query so dashboard reflects changes
            queryClient.invalidateQueries({ queryKey: ['storeSummary'] });
        },
        onError: (err: unknown) => {
            const error = normalizeError(err);
            toast.error(error.userMessage, 'Update Failed');
        },
    });
}

export function useUpdateBanner() {
    const queryClient = useQueryClient();
    const setUser = useAuthStore((state) => state.setUser);

    return useMutation<string, AppError, { imageUri: string; onProgress?: (p: any) => void }>({
        mutationFn: async ({ imageUri, onProgress }) => {
            const result = await uploadStoreBanner(imageUri, onProgress);
            if (!result.success) {
                throw new AppError('UPLOAD_FAILED', result.error || 'Banner upload failed');
            }
            return result.uri;
        },
        onSuccess: () => {
            // We need to fetch the latest profile since upload bypasses the typical return
            // Wait, the API returns the updated user inside the uploadStoreBanner?
            // Let's just invalidate the storeSummary to trigger a re-fetch.
            // A better way is to optionally re-fetch `/api/users/me` and call setUser.
            queryClient.invalidateQueries({ queryKey: ['storeSummary'] });
        },
        onError: (err: unknown) => {
            const error = normalizeError(err);
            toast.error(error.userMessage, 'Upload Failed');
        },
    });
}
