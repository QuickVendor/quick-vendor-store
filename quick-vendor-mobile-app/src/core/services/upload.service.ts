import * as ImageManipulator from 'expo-image-manipulator';
import { apiClient } from '../api/client';
import { normalizeError, AppError } from '../api/errors';

const MAX_IMAGE_WIDTH = 1200;
const MAX_IMAGE_SIZE_BYTES = 500 * 1024; // 500KB — critical for Nigerian data costs
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

interface UploadResult {
    uri: string;
    success: boolean;
    error?: string;
}

export interface StoreBannerUploadResult {
    uri: string;
    success: boolean;
    error?: string;
}

interface UploadProgress {
    loaded: number;
    total: number;
    percentage: number;
}

/**
 * Compress an image to reduce size for upload.
 * Targets max 500KB to respect Nigerian data costs.
 */
export async function compressImage(uri: string): Promise<string> {
    const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: MAX_IMAGE_WIDTH } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
    );

    return result.uri;
}

/**
 * Upload a product image with compression, retry logic, and progress tracking.
 *
 * @param productId - The product UUID to attach the image to
 * @param imageUri - Local file URI from image picker
 * @param slot - Image slot (1-5)
 * @param onProgress - Optional progress callback
 * @param signal - Optional AbortController signal for cancellation
 */
export async function uploadProductImage(
    productId: string,
    imageUri: string,
    slot: number = 1,
    onProgress?: (progress: UploadProgress) => void,
    signal?: AbortSignal,
): Promise<UploadResult> {
    // Step 1: Compress
    let compressedUri: string;
    try {
        compressedUri = await compressImage(imageUri);
    } catch {
        compressedUri = imageUri; // Fallback to original if compression fails
    }

    // Step 2: Upload with retry
    let lastError: AppError | undefined;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            if (signal?.aborted) {
                return { uri: '', success: false, error: 'Upload cancelled' };
            }

            const formData = new FormData();
            const filename = compressedUri.split('/').pop() ?? 'image.jpg';

            formData.append('file', {
                uri: compressedUri,
                name: filename,
                type: 'image/jpeg',
            } as unknown as Blob);

            const { data } = await apiClient.post(
                `/api/products/${productId}/images/s3?slot=${slot}`,
                formData,
                {
                    headers: { 'Content-Type': 'multipart/form-data' },
                    signal,
                    onUploadProgress: (event) => {
                        if (onProgress && event.total) {
                            onProgress({
                                loaded: event.loaded,
                                total: event.total,
                                percentage: Math.round((event.loaded / event.total) * 100),
                            });
                        }
                    },
                },
            );

            // Extract the image URL from the response
            const uploadedUrl = data.url ?? '';

            return { uri: uploadedUrl, success: true };
        } catch (error) {
            lastError = normalizeError(error);

            // Don't retry on client errors (4xx) — only on network/server errors
            if (lastError.statusCode && lastError.statusCode >= 400 && lastError.statusCode < 500) {
                return { uri: '', success: false, error: lastError.userMessage };
            }

            // Wait before retrying (exponential backoff)
            if (attempt < MAX_RETRIES) {
                await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * attempt));
            }
        }
    }

    return {
        uri: '',
        success: false,
        error: lastError?.userMessage ?? 'Upload failed after multiple attempts. Please try again.',
    };
}

/**
 * Delete a product image.
 */
export async function deleteProductImage(productId: string, slot: number): Promise<void> {
    await apiClient.delete(`/api/products/${productId}/images/s3/${slot}`);
}

/**
 * Upload a store banner image.
 */
export async function uploadStoreBanner(
    imageUri: string,
    onProgress?: (progress: UploadProgress) => void,
    signal?: AbortSignal,
): Promise<StoreBannerUploadResult> {
    let compressedUri: string;
    try {
        compressedUri = await compressImage(imageUri);
    } catch {
        compressedUri = imageUri;
    }

    let lastError: AppError | undefined;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            if (signal?.aborted) {
                return { uri: '', success: false, error: 'Upload cancelled' };
            }

            const formData = new FormData();
            const filename = compressedUri.split('/').pop() ?? 'banner.jpg';

            formData.append('banner', {
                uri: compressedUri,
                name: filename,
                type: 'image/jpeg',
            } as unknown as Blob);

            const { data } = await apiClient.post(
                '/api/users/me/banner',
                formData,
                {
                    headers: { 'Content-Type': 'multipart/form-data' },
                    signal,
                    onUploadProgress: (event) => {
                        if (onProgress && event.total) {
                            onProgress({
                                loaded: event.loaded,
                                total: event.total,
                                percentage: Math.round((event.loaded / event.total) * 100),
                            });
                        }
                    },
                },
            );

            // API returns the updated UserProfileDto.
            // Ensure the backend sends back the updated bannerUrl, or derive it.
            // For now, the service returns success status.
            return { uri: data.banner_url || data.store_banner_url || '', success: true };
        } catch (error) {
            lastError = normalizeError(error);

            if (lastError.statusCode && lastError.statusCode >= 400 && lastError.statusCode < 500) {
                return { uri: '', success: false, error: lastError.userMessage };
            }

            if (attempt < MAX_RETRIES) {
                await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * attempt));
            }
        }
    }

    return {
        uri: '',
        success: false,
        error: lastError?.userMessage ?? 'Banner upload failed.',
    };
}
