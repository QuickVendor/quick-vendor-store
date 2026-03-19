import { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Image,
    Share,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Linking,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../../src/theme';
import { useAuthStore } from '../../src/features/auth/authStore';
import { useUpdateStore, useUpdateBanner } from '../../src/features/store';
import { toast } from '../../src/core/hooks/useToast';
import { env } from '../../src/core/config/env';

export default function SettingsScreen() {
    const user = useAuthStore((state) => state.user);
    const { mutateAsync: updateStore, isPending: isUpdatingStore } = useUpdateStore();
    const { mutateAsync: updateBanner, isPending: isUploadingBanner } = useUpdateBanner();

    // Form State
    const [storeName, setStoreName] = useState('');
    const [storeSlug, setStoreSlug] = useState('');
    const [whatsappNumber, setWhatsappNumber] = useState('');
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);

    // Initialize form with user data
    useEffect(() => {
        if (user) {
            setStoreName(user.store_name || '');
            setStoreSlug(user.store_slug || '');
            setWhatsappNumber(user.whatsapp_number || '');
        }
    }, [user]);

    const bannerUrl = user?.banner_url || user?.store_banner_url;
    // Resolve relative paths if local dev
    const resolvedBannerUrl = bannerUrl
        ? (bannerUrl.startsWith('http') ? bannerUrl : `${env.apiUrl}${bannerUrl}`)
        : null;

    const storefrontLink = user?.store_slug
        ? `${env.frontendUrl}/${user.store_slug}`
        : null;

    const handleSave = async () => {
        if (!storeName.trim() || !storeSlug.trim() || !whatsappNumber.trim()) {
            toast.error('Store Name, Slug, and WhatsApp are required');
            return;
        }

        try {
            await updateStore({
                store_name: storeName.trim(),
                store_slug: storeSlug.trim(),
                whatsapp_number: whatsappNumber.trim(),
            });
            toast.success('Store settings updated!');
        } catch (error) {
            // Error is handled by the hook
        }
    };

    const handlePickBanner = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [16, 9],
            quality: 1,
        });

        if (!result.canceled && result.assets[0]) {
            try {
                setUploadProgress(0);
                await updateBanner({
                    imageUri: result.assets[0].uri,
                    onProgress: (p) => setUploadProgress(p.percentage),
                });
                toast.success('Banner updated successfully!');
            } catch (error) {
                // Handled in hook
            } finally {
                setUploadProgress(null);
            }
        }
    };

    const handleShare = async () => {
        if (!storefrontLink) {
            toast.error('Set a store slug and save first to share your store');
            return;
        }

        try {
            await Share.share({
                message: `Check out my store on QuickVendor!\n\n${storefrontLink}`,
                url: storefrontLink, // iOS only
            });
        } catch (error: any) {
            toast.error(error.message || 'Failed to share branch');
        }
    };

    return (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
        >
            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
            >
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>Store Settings</Text>
                    <Text style={styles.subtitle}>Manage your public storefront details</Text>
                </View>

                {/* Banner Upload Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Store Banner</Text>
                    <Text style={styles.sectionDesc}>This image appears at the top of your public store (16:9 ratio recommended).</Text>

                    <TouchableOpacity
                        style={styles.bannerContainer}
                        onPress={handlePickBanner}
                        disabled={isUploadingBanner}
                    >
                        {resolvedBannerUrl ? (
                            <Image
                                source={{ uri: resolvedBannerUrl }}
                                style={styles.bannerImage}
                                resizeMode="cover"
                            />
                        ) : (
                            <View style={styles.bannerPlaceholder}>
                                <Ionicons name="image-outline" size={48} color={colors.textMuted} />
                                <Text style={styles.bannerPlaceholderText}>Tap to add banner</Text>
                            </View>
                        )}

                        {isUploadingBanner && (
                            <View style={styles.bannerOverlay}>
                                <ActivityIndicator size="large" color="#ffffff" />
                                <Text style={styles.uploadText}>
                                    {uploadProgress !== null ? `${uploadProgress}%` : 'Uploading...'}
                                </Text>
                            </View>
                        )}

                        {resolvedBannerUrl && !isUploadingBanner && (
                            <View style={styles.editBannerBadge}>
                                <Ionicons name="pencil" size={16} color="#fff" />
                            </View>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Store Details Form */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Store Details</Text>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Store Name</Text>
                        <TextInput
                            style={styles.input}
                            value={storeName}
                            onChangeText={setStoreName}
                            placeholder="e.g. Ade's Fashion Hub"
                            placeholderTextColor={colors.textMuted}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Store Slug (URL)</Text>
                        <View style={styles.slugContainer}>
                            <Text style={styles.slugPrefix}>{env.frontendUrl.replace(/^https?:\/\//, '')}/store/</Text>
                            <TextInput
                                style={styles.slugInput}
                                value={storeSlug}
                                onChangeText={setStoreSlug}
                                placeholder="ades-fashion"
                                placeholderTextColor={colors.textMuted}
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                        </View>
                        <Text style={styles.hintText}>Only letters, numbers, and hyphens permitted.</Text>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>WhatsApp Number</Text>
                        <TextInput
                            style={styles.input}
                            value={whatsappNumber}
                            onChangeText={setWhatsappNumber}
                            placeholder="+2348000000000"
                            placeholderTextColor={colors.textMuted}
                            keyboardType="phone-pad"
                        />
                        <Text style={styles.hintText}>Customers will use this to contact you.</Text>
                    </View>

                    <TouchableOpacity
                        style={[styles.saveButton, isUpdatingStore && styles.buttonDisabled]}
                        onPress={handleSave}
                        disabled={isUpdatingStore}
                    >
                        {isUpdatingStore ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.saveButtonText}>Save Changes</Text>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Store Sharing Section */}
                <View style={styles.shareSection}>
                    <View style={styles.shareHeader}>
                        <Ionicons name="share-social-outline" size={24} color={colors.primary} />
                        <Text style={styles.shareTitle}>Share Your Store</Text>
                    </View>

                    {storefrontLink ? (
                        <>
                            <TouchableOpacity style={styles.linkBox} onPress={() => Linking.openURL(storefrontLink!)}>
                                <Text style={[styles.linkText, { textDecorationLine: 'underline' }]} numberOfLines={1} ellipsizeMode="tail">
                                    {storefrontLink}
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
                                <Ionicons name="share" size={20} color="#fff" />
                                <Text style={styles.shareButtonText}>Share Link</Text>
                            </TouchableOpacity>
                        </>
                    ) : (
                        <View style={styles.warningBox}>
                            <Ionicons name="information-circle" size={20} color={colors.warning} />
                            <Text style={styles.warningText}>
                                Save your Store Slug first to get your shareable link.
                            </Text>
                        </View>
                    )}
                </View>

            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    content: {
        padding: spacing.lg,
        paddingBottom: spacing.xxl,
    },
    header: {
        marginBottom: spacing.xl,
    },
    title: {
        ...typography.h1,
        color: colors.text,
    },
    subtitle: {
        ...typography.body,
        color: colors.textMuted,
        marginTop: spacing.xs,
    },
    section: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        marginBottom: spacing.lg,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
    },
    sectionTitle: {
        ...typography.h3,
        color: colors.text,
        marginBottom: spacing.xs,
    },
    sectionDesc: {
        ...typography.caption,
        color: colors.textMuted,
        marginBottom: spacing.md,
    },
    bannerContainer: {
        width: '100%',
        aspectRatio: 16 / 9,
        backgroundColor: colors.background,
        borderRadius: borderRadius.md,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.border,
        justifyContent: 'center',
        alignItems: 'center',
    },
    bannerImage: {
        width: '100%',
        height: '100%',
    },
    bannerPlaceholder: {
        alignItems: 'center',
    },
    bannerPlaceholderText: {
        ...typography.body,
        color: colors.textMuted,
        marginTop: spacing.sm,
    },
    bannerOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    uploadText: {
        ...typography.caption,
        color: '#ffffff',
        marginTop: spacing.sm,
    },
    editBannerBadge: {
        position: 'absolute',
        bottom: spacing.sm,
        right: spacing.sm,
        backgroundColor: 'rgba(0,0,0,0.6)',
        padding: spacing.xs,
        borderRadius: 20,
    },
    inputGroup: {
        marginBottom: spacing.lg,
    },
    label: {
        ...typography.subtitle,
        color: colors.text,
        marginBottom: spacing.xs,
    },
    input: {
        ...typography.body,
        color: colors.text,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        backgroundColor: colors.background,
    },
    slugContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: borderRadius.md,
        backgroundColor: colors.background,
        overflow: 'hidden',
    },
    slugPrefix: {
        ...typography.body,
        color: colors.textMuted,
        paddingHorizontal: spacing.sm,
        backgroundColor: '#f1f5f9',
        borderRightWidth: 1,
        borderRightColor: colors.border,
        paddingVertical: spacing.md,
    },
    slugInput: {
        ...typography.body,
        color: colors.primary,
        flex: 1,
        padding: spacing.md,
    },
    hintText: {
        ...typography.caption,
        color: colors.textMuted,
        marginTop: spacing.xs,
    },
    saveButton: {
        backgroundColor: colors.primary,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        alignItems: 'center',
        marginTop: spacing.md,
    },
    buttonDisabled: {
        opacity: 0.7,
    },
    saveButtonText: {
        ...typography.button,
        color: '#fff',
    },
    shareSection: {
        backgroundColor: '#e0e7ff', // Indigo 100
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: '#c7d2fe', // Indigo 200
        marginBottom: spacing.xl,
    },
    shareHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginBottom: spacing.md,
    },
    shareTitle: {
        ...typography.h3,
        color: colors.primary, // Indigo 600
    },
    linkBox: {
        backgroundColor: '#fff',
        padding: spacing.md,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: '#c7d2fe',
        marginBottom: spacing.md,
    },
    linkText: {
        ...typography.body,
        color: colors.primary, // Indigo 600
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    shareButton: {
        backgroundColor: colors.primary,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
    },
    shareButtonText: {
        ...typography.button,
        color: '#fff',
    },
    warningBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        backgroundColor: '#fef3c7', // Amber 50
        padding: spacing.md,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: '#fde68a', // Amber 200
    },
    warningText: {
        ...typography.caption,
        color: '#92400e', // Amber 800
        flex: 1,
    }
});
