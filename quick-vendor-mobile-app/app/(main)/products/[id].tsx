import { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Switch,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Image,
    Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../../../src/theme';
import { useProduct, useUpdateProduct, useDeleteProduct } from '../../../src/features/products';
import { useQueryClient } from '@tanstack/react-query';
import { uploadProductImage, deleteProductImage } from '../../../src/core/services/upload.service';
import { getProductImages } from '../../../src/types';
import { toast } from '../../../src/core/hooks/useToast';
import { AppError } from '../../../src/core/api/errors';

const MAX_IMAGES = 4;

export default function EditProductScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();

    const { data: product, isLoading: isFetching } = useProduct(id);
    const { mutateAsync: updateProduct } = useUpdateProduct(id);
    const { mutateAsync: deleteProduct } = useDeleteProduct();
    const queryClient = useQueryClient();

    // Form State
    const [name, setName] = useState('');
    const [price, setPrice] = useState('');
    const [description, setDescription] = useState('');
    const [isAvailable, setIsAvailable] = useState(true);

    // Images — we track existing vs new locally to handle sync
    // For simplicity, we keep a flat array of valid URIs
    const [images, setImages] = useState<string[]>([]);

    // UI State
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number; type: string } | null>(null);
    const [errors, setErrors] = useState<{ name?: string; price?: string; images?: string }>({});

    // ── Hydrate Form ──
    useEffect(() => {
        if (product) {
            setName(product.name);
            setPrice(product.price.toString());
            setDescription(product.description || '');
            setIsAvailable(product.is_available);

            // Extract remote images
            setImages(getProductImages(product));
        }
    }, [product]);

    // ── Image Handling ──

    const pickImage = async () => {
        if (images.length >= MAX_IMAGES) return;

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: 'images',
            allowsEditing: true,
            aspect: [1, 1], // Square products look best
            quality: 0.8,
        });

        if (!result.canceled && result.assets[0]?.uri) {
            setImages((prev) => [...prev, result.assets[0].uri]);
            if (errors.images) setErrors((e) => ({ ...e, images: undefined }));
        }
    };

    const removeImage = (indexToRemove: number) => {
        setImages((prev) => prev.filter((_, idx) => idx !== indexToRemove));
    };

    // ── Validation & Save ──

    function validate() {
        const newErrors: typeof errors = {};
        if (!name.trim()) newErrors.name = 'Product name is required';

        const priceNum = Number(price.replace(/,/g, ''));
        if (!price || isNaN(priceNum) || priceNum < 0) {
            newErrors.price = 'Please enter a valid price';
        }

        if (images.length === 0) {
            newErrors.images = 'At least 1 image is required';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }

    async function handleSave() {
        if (!validate() || !product) return;
        setIsSaving(true);
        setUploadProgress(null);

        try {
            // 1. Update text details
            await updateProduct({
                name: name.trim(),
                price: Number(price.replace(/,/g, '')),
                description: description.trim() || undefined,
                is_available: isAvailable,
            });

            // 2. Sync Images (Simplified flow: Since backend uses fixed slots 1-5,
            // we delete old remote slots if the count shrunk, and upload new ones)

            const originalImages = getProductImages(product);

            // A naive but robust sync strategy:
            // For slots 1 to MAX, if the image changed, upload the new one.
            // If the image was removed (slot is now empty but was previously full), delete it.
            let syncTasks = [];

            for (let i = 0; i < MAX_IMAGES; i++) {
                const newUri = images[i];
                const oldUri = originalImages[i];
                const slot = i + 1;

                if (newUri && newUri !== oldUri) {
                    // It's a new local file or a shifted image — upload it to this slot
                    syncTasks.push(async () => {
                        setUploadProgress({ current: slot, total: images.length, type: 'Uploading' });
                        const res = await uploadProductImage(product.id, newUri, slot);
                        if (!res.success) throw new AppError('UPLOAD_FAILED', `Failed to upload image ${slot}`);
                    });
                } else if (!newUri && oldUri) {
                    // Slot was cleared
                    syncTasks.push(async () => {
                        setUploadProgress({ current: slot, total: originalImages.length, type: 'Removing' });
                        await deleteProductImage(product.id, slot);
                    });
                }
                // If it's the same, do nothing.
            }

            // Run sync tasks sequentially to avoid overwhelming the network
            for (const task of syncTasks) {
                await task();
            }

            // Re-fetch products so list has the updated image URLs
            await queryClient.invalidateQueries({ queryKey: ['products'] });

            toast.success('Product updated!');
            router.back();
        } catch (err) {
            const appError = err instanceof AppError ? err : new AppError('UNKNOWN', 'Failed to update product');
            toast.error(appError.userMessage, 'Update Failed');
        } finally {
            setIsSaving(false);
            setUploadProgress(null);
        }
    }

    function handleDeleteClick() {
        Alert.alert(
            'Delete Product',
            `Are you sure you want to delete "${product?.name}"? This cannot be undone.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        setIsDeleting(true);
                        try {
                            await deleteProduct(id);
                            toast.success('Product deleted.');
                            router.back();
                        } catch (err) {
                            toast.error('Failed to delete product.');
                            setIsDeleting(false);
                        }
                    },
                },
            ]
        );
    }

    if (isFetching) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
        >
            <ScrollView style={styles.container} contentContainerStyle={styles.content}>

                {/* Images Section */}
                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Product Images ({images.length}/{MAX_IMAGES}) *</Text>

                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScroll}>
                        {images.map((uri, idx) => (
                            <View key={idx} style={styles.imageWrapper}>
                                <Image source={{ uri }} style={styles.previewImage} />
                                <TouchableOpacity
                                    style={styles.removeImageBtn}
                                    onPress={() => removeImage(idx)}
                                    disabled={isSaving}
                                >
                                    <Ionicons name="close" size={16} color={colors.white} />
                                </TouchableOpacity>
                            </View>
                        ))}

                        {images.length < MAX_IMAGES && (
                            <TouchableOpacity style={styles.addImageBtn} onPress={pickImage} disabled={isSaving}>
                                <Ionicons name="camera-outline" size={32} color={colors.primary} />
                                <Text style={styles.addImageText}>Add</Text>
                            </TouchableOpacity>
                        )}
                    </ScrollView>
                    {errors.images && <Text style={styles.errorTextLarge}>{errors.images}</Text>}
                </View>

                {/* Form Section */}
                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Basic Info</Text>

                    {/* Name */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Product Name *</Text>
                        <TextInput
                            style={[styles.input, errors.name && styles.inputError]}
                            value={name}
                            onChangeText={(val) => {
                                setName(val);
                                if (errors.name) setErrors((e) => ({ ...e, name: undefined }));
                            }}
                            placeholder="e.g. Nike Air Max"
                            placeholderTextColor={colors.textMuted}
                            editable={!isSaving}
                        />
                        {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
                    </View>

                    {/* Price */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Price (₦) *</Text>
                        <TextInput
                            style={[styles.input, errors.price && styles.inputError]}
                            value={price}
                            onChangeText={(val) => {
                                setPrice(val);
                                if (errors.price) setErrors((e) => ({ ...e, price: undefined }));
                            }}
                            placeholder="0.00"
                            placeholderTextColor={colors.textMuted}
                            keyboardType="numeric"
                            editable={!isSaving}
                        />
                        {errors.price && <Text style={styles.errorText}>{errors.price}</Text>}
                    </View>

                    {/* Description */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Description (Optional)</Text>
                        <TextInput
                            style={[styles.input, styles.textArea]}
                            value={description}
                            onChangeText={setDescription}
                            placeholder="Describe your product..."
                            placeholderTextColor={colors.textMuted}
                            multiline
                            numberOfLines={4}
                            textAlignVertical="top"
                            editable={!isSaving}
                        />
                    </View>

                    {/* Availability Switch */}
                    <View style={styles.switchRow}>
                        <View>
                            <Text style={styles.label}>Available in Store</Text>
                            <Text style={styles.hintText}>Turn off to hide this product from customers</Text>
                        </View>
                        <Switch
                            value={isAvailable}
                            onValueChange={setIsAvailable}
                            trackColor={{ false: colors.border, true: colors.secondary }}
                            thumbColor={colors.white}
                            disabled={isSaving}
                        />
                    </View>
                </View>

                {/* Delete Section */}
                <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={handleDeleteClick}
                    disabled={isSaving || isDeleting}
                >
                    <Ionicons name="trash-outline" size={20} color={colors.error} />
                    <Text style={styles.deleteButtonText}>Delete Product</Text>
                </TouchableOpacity>

            </ScrollView>

            {/* Footer Action */}
            <View style={styles.footer}>
                <TouchableOpacity
                    style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
                    onPress={handleSave}
                    disabled={isSaving || isDeleting}
                    activeOpacity={0.8}
                >
                    {isSaving ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <ActivityIndicator color={colors.white} />
                            {uploadProgress && (
                                <Text style={styles.saveButtonText}>
                                    {uploadProgress.type} image {uploadProgress.current}...
                                </Text>
                            )}
                        </View>
                    ) : (
                        <Text style={styles.saveButtonText}>Save Changes</Text>
                    )}
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    content: {
        padding: spacing.md,
        paddingBottom: 40,
    },
    card: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        marginBottom: spacing.md,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    sectionTitle: {
        ...typography.h3,
        fontSize: 16,
        color: colors.text,
        marginBottom: spacing.md,
    },
    imageScroll: {
        flexDirection: 'row',
        marginBottom: spacing.xs,
    },
    imageWrapper: {
        width: 100,
        height: 100,
        marginRight: spacing.sm,
        borderRadius: borderRadius.md,
        overflow: 'hidden',
        position: 'relative',
    },
    previewImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    removeImageBtn: {
        position: 'absolute',
        top: 4,
        right: 4,
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderRadius: 12,
        padding: 4,
    },
    addImageBtn: {
        width: 100,
        height: 100,
        borderRadius: borderRadius.md,
        borderWidth: 2,
        borderColor: colors.primaryLight,
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.surface,
    },
    addImageText: {
        ...typography.caption,
        color: colors.primary,
        marginTop: 4,
        fontWeight: '600',
    },
    inputGroup: {
        marginBottom: spacing.md,
    },
    label: {
        ...typography.bodyBold,
        color: colors.textSecondary,
        marginBottom: spacing.xs,
    },
    input: {
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.borderLight,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        fontSize: 16,
        color: colors.text,
    },
    inputError: {
        borderColor: colors.error,
        backgroundColor: colors.errorLight,
    },
    errorText: {
        ...typography.caption,
        color: colors.error,
        marginTop: 4,
    },
    errorTextLarge: {
        ...typography.body,
        color: colors.error,
        marginTop: 8,
    },
    textArea: {
        minHeight: 100,
    },
    switchRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: colors.borderLight,
        marginTop: spacing.sm,
    },
    hintText: {
        ...typography.caption,
        color: colors.textMuted,
        marginTop: 2,
    },
    deleteButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.md,
        marginTop: spacing.sm,
        gap: spacing.sm,
    },
    deleteButtonText: {
        ...typography.button,
        color: colors.error,
    },
    footer: {
        padding: spacing.lg,
        backgroundColor: colors.surface,
        borderTopWidth: 1,
        borderTopColor: colors.borderLight,
    },
    saveButton: {
        backgroundColor: colors.primary,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 52,
    },
    saveButtonDisabled: {
        opacity: 0.7,
    },
    saveButtonText: {
        ...typography.button,
        color: colors.textInverse,
    },
});
