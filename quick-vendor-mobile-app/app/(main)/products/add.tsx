import { useState } from 'react';
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
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../../../src/theme';
import { useCreateProduct } from '../../../src/features/products';
import { useQueryClient } from '@tanstack/react-query';
import { uploadProductImage } from '../../../src/core/services/upload.service';
import { toast } from '../../../src/core/hooks/useToast';
import { AppError } from '../../../src/core/api/errors';

const MAX_IMAGES = 4;

export default function AddProductScreen() {
    const router = useRouter();
    const { mutateAsync: createProduct } = useCreateProduct();
    const queryClient = useQueryClient();

    // Form State
    const [name, setName] = useState('');
    const [price, setPrice] = useState('');
    const [description, setDescription] = useState('');
    const [isAvailable, setIsAvailable] = useState(true);
    const [images, setImages] = useState<string[]>([]);

    // UI State
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
    const [errors, setErrors] = useState<{ name?: string; price?: string; images?: string }>({});

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

    // ── Validation & Submit ──

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
        if (!validate()) return;
        setIsSubmitting(true);
        setUploadProgress(null);

        try {
            // 1. Create product first (needs text details)
            const newProduct = await createProduct({
                name: name.trim(),
                price: Number(price.replace(/,/g, '')),
                description: description.trim() || undefined,
                is_available: isAvailable,
            });

            // 2. Upload images sequentially
            setUploadProgress({ current: 0, total: images.length });

            for (let i = 0; i < images.length; i++) {
                const uri = images[i];
                const slot = i + 1; // slots are 1-based (1 to 5 backend limit, we use 4)

                const uploadResult = await uploadProductImage(newProduct.id, uri, slot);

                if (!uploadResult.success) {
                    throw new AppError('UPLOAD_FAILED', `Failed to upload image ${i + 1}: ${uploadResult.error}`);
                }

                setUploadProgress({ current: i + 1, total: images.length });
            }

            // 3. Re-fetch products so list has the updated image URLs
            await queryClient.invalidateQueries({ queryKey: ['products'] });

            toast.success('Product added successfully!');
            router.back();
        } catch (err) {
            const appError = err instanceof AppError ? err : new AppError('UNKNOWN', 'Failed to save product');
            toast.error(appError.userMessage, 'Error');
        } finally {
            setIsSubmitting(false);
            setUploadProgress(null);
        }
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
                                >
                                    <Ionicons name="close" size={16} color={colors.white} />
                                </TouchableOpacity>
                            </View>
                        ))}

                        {images.length < MAX_IMAGES && (
                            <TouchableOpacity style={styles.addImageBtn} onPress={pickImage}>
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
                        />
                    </View>
                </View>

            </ScrollView>

            {/* Footer Action */}
            <View style={styles.footer}>
                <TouchableOpacity
                    style={[styles.saveButton, isSubmitting && styles.saveButtonDisabled]}
                    onPress={handleSave}
                    disabled={isSubmitting}
                    activeOpacity={0.8}
                >
                    {isSubmitting ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <ActivityIndicator color={colors.white} />
                            {uploadProgress && (
                                <Text style={styles.saveButtonText}>
                                    Uploading {uploadProgress.current}/{uploadProgress.total}...
                                </Text>
                            )}
                        </View>
                    ) : (
                        <Text style={styles.saveButtonText}>Save Product</Text>
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
