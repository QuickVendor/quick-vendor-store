import { useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../../../src/theme';
import { formatNaira } from '../../../src/core/utils/formatCurrency';
import { useOrders } from '../../../src/features/orders';
import type { Order, OrderStatus } from '../../../src/types';

const STATUS_CONFIG: Record<OrderStatus, { label: string; bg: string; text: string }> = {
    PENDING: { label: 'Pending', bg: '#FEF3C7', text: '#92400E' },
    PAID: { label: 'Paid', bg: '#DBEAFE', text: '#1E40AF' },
    CONFIRMED: { label: 'Confirmed', bg: '#D1FAE5', text: '#065F46' },
    FULFILLED: { label: 'Fulfilled', bg: '#D1FAE5', text: '#065F46' },
    EXPIRED: { label: 'Expired', bg: '#F3F4F6', text: '#6B7280' },
    CANCELLED: { label: 'Cancelled', bg: '#FEE2E2', text: '#991B1B' },
    REFUNDED: { label: 'Refunded', bg: '#F3F4F6', text: '#6B7280' },
};

function StatusBadge({ status }: { status: OrderStatus }) {
    const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.PENDING;
    return (
        <View style={[styles.badge, { backgroundColor: config.bg }]}>
            <Text style={[styles.badgeText, { color: config.text }]}>{config.label}</Text>
        </View>
    );
}

function OrderCard({ order, onPress }: { order: Order; onPress: () => void }) {
    return (
        <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
            <View style={styles.cardHeader}>
                <Text style={styles.productName} numberOfLines={1}>
                    {order.product.name}
                </Text>
                <StatusBadge status={order.status} />
            </View>
            <View style={styles.cardBody}>
                <View>
                    <Text style={styles.customerName}>{order.customerName}</Text>
                    <Text style={styles.orderRef}>Ref: {order.reference}</Text>
                </View>
                <View style={styles.amountContainer}>
                    <Text style={styles.amount}>{formatNaira(order.amount / 100)}</Text>
                    <Text style={styles.quantity}>Qty: {order.quantity}</Text>
                </View>
            </View>
            <View style={styles.cardFooter}>
                <Text style={styles.dateText}>
                    {new Date(order.createdAt).toLocaleDateString('en-NG', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                    })}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </View>
        </TouchableOpacity>
    );
}

export default function OrdersScreen() {
    const router = useRouter();
    const { data: orders, isLoading, isError, refetch, isRefetching } = useOrders();

    const handlePress = useCallback(
        (order: Order) => {
            router.push(`/(main)/orders/${order.id}` as any);
        },
        [router],
    );

    if (isLoading) {
        return (
            <View style={[styles.container, styles.centered]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    if (isError) {
        return (
            <View style={[styles.container, styles.centered]}>
                <Ionicons name="cloud-offline" size={48} color={colors.textMuted} />
                <Text style={styles.errorText}>Failed to load orders</Text>
                <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
                    <Text style={styles.retryText}>Try Again</Text>
                </TouchableOpacity>
            </View>
        );
    }

    if (!orders || orders.length === 0) {
        return (
            <View style={[styles.container, styles.centered]}>
                <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
                <Ionicons name="receipt-outline" size={56} color={colors.textMuted} />
                <Text style={styles.emptyTitle}>No orders yet</Text>
                <Text style={styles.emptySubtitle}>
                    When customers place orders, they&apos;ll appear here
                </Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <FlatList
                data={orders}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <OrderCard order={item} onPress={() => handlePress(item)} />
                )}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefetching}
                        onRefresh={refetch}
                        tintColor={colors.primary}
                        colors={[colors.primary]}
                    />
                }
                showsVerticalScrollIndicator={false}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    centered: {
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xl,
    },
    listContent: {
        padding: spacing.md,
        paddingBottom: spacing.xxl,
    },
    card: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        marginBottom: spacing.sm,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    productName: {
        ...typography.bodyBold,
        color: colors.text,
        flex: 1,
        marginRight: spacing.sm,
    },
    badge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: borderRadius.full,
    },
    badgeText: {
        fontSize: 12,
        fontWeight: '600',
    },
    cardBody: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: spacing.sm,
    },
    customerName: {
        ...typography.body,
        color: colors.textSecondary,
        fontSize: 14,
    },
    orderRef: {
        ...typography.caption,
        color: colors.textMuted,
        marginTop: 2,
    },
    amountContainer: {
        alignItems: 'flex-end',
    },
    amount: {
        ...typography.price,
        color: colors.secondary,
    },
    quantity: {
        ...typography.caption,
        color: colors.textMuted,
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: colors.borderLight,
        paddingTop: spacing.sm,
    },
    dateText: {
        ...typography.caption,
        color: colors.textMuted,
    },
    errorText: {
        ...typography.body,
        color: colors.textSecondary,
        marginTop: spacing.md,
        marginBottom: spacing.md,
    },
    retryButton: {
        backgroundColor: colors.primary,
        paddingHorizontal: spacing.xl,
        paddingVertical: 12,
        borderRadius: borderRadius.full,
    },
    retryText: {
        ...typography.button,
        color: colors.white,
    },
    emptyTitle: {
        ...typography.h3,
        color: colors.text,
        marginTop: spacing.lg,
        marginBottom: spacing.xs,
    },
    emptySubtitle: {
        ...typography.body,
        color: colors.textSecondary,
        textAlign: 'center',
    },
});
