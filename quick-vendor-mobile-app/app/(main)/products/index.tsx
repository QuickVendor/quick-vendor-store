import { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    RefreshControl,
    Image,
    ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../../../src/theme';
import { useProducts } from '../../../src/features/products';
import { getProductImages } from '../../../src/types';

function formatCurrency(amount: number) {
    return `₦${amount.toLocaleString('en-NG')}`;
}

export default function ProductListScreen() {
    const router = useRouter();
    const { data: products, isLoading, isError, refetch, isRefetching } = useProducts();

    if (isLoading && !isRefetching) {
        return (
            <View style={[styles.container, styles.center]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    if (isError) {
        return (
            <View style={[styles.container, styles.center]}>
                <Ionicons name="cloud-offline-outline" size={48} color={colors.textMuted} />
                <Text style={styles.errorText}>Failed to load products</Text>
                <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
                    <Text style={styles.retryButtonText}>Try Again</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const renderEmpty = () => (
        <View style={styles.empty}>
            <Ionicons name="cube-outline" size={64} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No products yet</Text>
            <Text style={styles.emptySubtitle}>
                Add your first product to start selling
            </Text>
            <TouchableOpacity
                style={styles.addButton}
                onPress={() => router.push('/(main)/products/add')}
            >
                <Ionicons name="add" size={20} color={colors.textInverse} />
                <Text style={styles.addButtonText}>Add Product</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={styles.container}>
            <FlatList
                data={products}
                keyExtractor={(item) => item.id}
                contentContainerStyle={products?.length ? styles.listContent : styles.flex1}
                refreshControl={
                    <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
                }
                ListEmptyComponent={renderEmpty}
                renderItem={({ item }) => {
                    const images = getProductImages(item);
                    const primaryImage = images.length > 0 ? images[0] : null;

                    return (
                        <TouchableOpacity
                            style={styles.productCard}
                            activeOpacity={0.7}
                            onPress={() => router.push(`/(main)/products/${item.id}`)}
                        >
                            <View style={styles.imageContainer}>
                                {primaryImage ? (
                                    <Image source={{ uri: primaryImage }} style={styles.productImage} />
                                ) : (
                                    <View style={styles.imagePlaceholder}>
                                        <Ionicons name="image-outline" size={24} color={colors.textMuted} />
                                    </View>
                                )}
                            </View>

                            <View style={styles.productDetails}>
                                <Text style={styles.productName} numberOfLines={2}>
                                    {item.name}
                                </Text>
                                <Text style={styles.productPrice}>{formatCurrency(item.price)}</Text>

                                <View style={styles.statusRow}>
                                    <View style={[
                                        styles.statusBadge,
                                        { backgroundColor: item.is_available ? colors.secondaryLight : colors.borderLight }
                                    ]}>
                                        <Text style={[
                                            styles.statusText,
                                            { color: item.is_available ? colors.secondary : colors.textMuted }
                                        ]}>
                                            {item.is_available ? 'In Stock' : 'Hidden'}
                                        </Text>
                                    </View>
                                    <Text style={styles.clicksText}>
                                        <Ionicons name="eye-outline" size={12} /> {item.click_count || 0}
                                    </Text>
                                </View>
                            </View>
                        </TouchableOpacity>
                    );
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    center: {
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xl,
    },
    listContent: {
        padding: spacing.md,
        paddingBottom: spacing.xxl,
    },
    flex1: {
        flex: 1,
    },
    productCard: {
        flexDirection: 'row',
        backgroundColor: colors.surface,
        borderRadius: borderRadius.lg,
        padding: spacing.sm,
        marginBottom: spacing.md,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    imageContainer: {
        width: 80,
        height: 80,
        borderRadius: borderRadius.md,
        backgroundColor: colors.background,
        overflow: 'hidden',
    },
    productImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    imagePlaceholder: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.borderLight,
    },
    productDetails: {
        flex: 1,
        marginLeft: spacing.md,
        justifyContent: 'space-between',
        paddingVertical: 4,
    },
    productName: {
        ...typography.bodyBold,
        color: colors.text,
        marginBottom: 2,
    },
    productPrice: {
        ...typography.body,
        color: colors.primaryDark,
        fontWeight: '600',
    },
    statusRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: spacing.xs,
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    statusText: {
        ...typography.caption,
        fontWeight: '600',
        fontSize: 10,
    },
    clicksText: {
        ...typography.caption,
        color: colors.textMuted,
    },
    empty: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.xl,
    },
    emptyTitle: {
        ...typography.h3,
        color: colors.text,
        marginTop: spacing.lg,
    },
    emptySubtitle: {
        ...typography.body,
        color: colors.textMuted,
        textAlign: 'center',
        marginTop: spacing.sm,
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.primary,
        paddingVertical: 12,
        paddingHorizontal: spacing.lg,
        borderRadius: borderRadius.md,
        marginTop: spacing.lg,
        gap: spacing.sm,
    },
    addButtonText: {
        ...typography.button,
        color: colors.textInverse,
    },
    errorText: {
        ...typography.body,
        color: colors.textSecondary,
        marginTop: spacing.md,
        marginBottom: spacing.lg,
    },
    retryButton: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        backgroundColor: colors.primaryLight,
        borderRadius: borderRadius.sm,
    },
    retryButtonText: {
        ...typography.button,
        color: colors.primaryDark,
    },
});
