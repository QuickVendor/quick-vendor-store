import { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Linking,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../../../src/theme';
import { formatNaira } from '../../../src/core/utils/formatCurrency';
import {
    useOrder,
    useConfirmOrder,
    useFulfillOrder,
    useCancelOrder,
} from '../../../src/features/orders';
import type { OrderStatus } from '../../../src/types';

const STATUS_CONFIG: Record<
    OrderStatus,
    { label: string; bg: string; text: string; icon: string }
> = {
    PENDING: { label: 'Pending Payment', bg: '#FEF3C7', text: '#92400E', icon: 'time-outline' },
    PAID: { label: 'Paid — Awaiting Confirmation', bg: '#DBEAFE', text: '#1E40AF', icon: 'checkmark-circle-outline' },
    CONFIRMED: { label: 'Confirmed — Ready to Fulfill', bg: '#D1FAE5', text: '#065F46', icon: 'checkmark-done-outline' },
    FULFILLED: { label: 'Fulfilled', bg: '#D1FAE5', text: '#065F46', icon: 'bag-check-outline' },
    EXPIRED: { label: 'Expired', bg: '#F3F4F6', text: '#6B7280', icon: 'close-circle-outline' },
    CANCELLED: { label: 'Cancelled', bg: '#FEE2E2', text: '#991B1B', icon: 'close-circle-outline' },
    REFUNDED: { label: 'Refunded', bg: '#F3F4F6', text: '#6B7280', icon: 'return-down-back-outline' },
};

function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{label}</Text>
            <Text style={styles.infoValue}>{value}</Text>
        </View>
    );
}

export default function OrderDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const { data: order, isLoading, isError, refetch } = useOrder(id);
    const confirmMutation = useConfirmOrder();
    const fulfillMutation = useFulfillOrder();
    const cancelMutation = useCancelOrder();
    const [actionLoading, setActionLoading] = useState(false);

    const handleAction = (
        action: 'confirm' | 'fulfill' | 'cancel',
    ) => {
        const messages = {
            confirm: 'Confirm this order? The customer will be notified.',
            fulfill: 'Mark this order as fulfilled/delivered?',
            cancel: 'Cancel this order? This cannot be undone.',
        };

        Alert.alert(
            action.charAt(0).toUpperCase() + action.slice(1) + ' Order',
            messages[action],
            [
                { text: 'No', style: 'cancel' },
                {
                    text: 'Yes',
                    style: action === 'cancel' ? 'destructive' : 'default',
                    onPress: async () => {
                        setActionLoading(true);
                        try {
                            if (action === 'confirm') await confirmMutation.mutateAsync(id);
                            else if (action === 'fulfill') await fulfillMutation.mutateAsync(id);
                            else await cancelMutation.mutateAsync(id);
                            refetch();
                        } catch {
                            Alert.alert('Error', 'Failed to update order. Please try again.');
                        } finally {
                            setActionLoading(false);
                        }
                    },
                },
            ],
        );
    };

    if (isLoading) {
        return (
            <View style={[styles.container, styles.centered]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    if (isError || !order) {
        return (
            <View style={[styles.container, styles.centered]}>
                <Ionicons name="alert-circle-outline" size={48} color={colors.textMuted} />
                <Text style={styles.errorText}>Order not found</Text>
                <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
                    <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const status = order.status as OrderStatus;
    const statusConfig = STATUS_CONFIG[status] ?? STATUS_CONFIG.PENDING;

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('en-NG', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            {/* Status banner */}
            <View style={[styles.statusBanner, { backgroundColor: statusConfig.bg }]}>
                <Ionicons
                    name={statusConfig.icon as any}
                    size={24}
                    color={statusConfig.text}
                />
                <Text style={[styles.statusText, { color: statusConfig.text }]}>
                    {statusConfig.label}
                </Text>
            </View>

            {/* Product info */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Product</Text>
                <View style={styles.card}>
                    <InfoRow label="Name" value={order.product.name} />
                    <InfoRow label="Unit price" value={formatNaira(order.product.price / 100)} />
                    <InfoRow label="Quantity" value={String(order.quantity)} />
                    <View style={[styles.infoRow, styles.totalRow]}>
                        <Text style={styles.totalLabel}>Total</Text>
                        <Text style={styles.totalValue}>
                            {formatNaira(order.amount / 100)}
                        </Text>
                    </View>
                </View>
            </View>

            {/* Customer info */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Customer</Text>
                <View style={styles.card}>
                    <InfoRow label="Name" value={order.customerName} />
                    <InfoRow label="Email" value={order.customerEmail} />
                    {order.customerPhone && (
                        <TouchableOpacity
                            onPress={() => Linking.openURL(`tel:${order.customerPhone}`)}
                        >
                            <InfoRow label="Phone" value={order.customerPhone} />
                        </TouchableOpacity>
                    )}
                </View>

                {/* WhatsApp contact */}
                {order.customerPhone && (
                    <TouchableOpacity
                        style={styles.whatsappButton}
                        onPress={() => {
                            const phone = order.customerPhone!.replace(/\D/g, '');
                            const text = encodeURIComponent(
                                `Hi ${order.customerName}, regarding your order ${order.reference} for ${order.product.name}`,
                            );
                            Linking.openURL(`https://wa.me/${phone}?text=${text}`);
                        }}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="logo-whatsapp" size={20} color={colors.white} />
                        <Text style={styles.whatsappText}>Chat on WhatsApp</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Order timeline */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Timeline</Text>
                <View style={styles.card}>
                    <InfoRow label="Order placed" value={formatDate(order.createdAt)} />
                    <InfoRow label="Paid" value={formatDate(order.paidAt)} />
                    <InfoRow label="Confirmed" value={formatDate(order.confirmedAt)} />
                    <InfoRow label="Fulfilled" value={formatDate(order.fulfilledAt)} />
                    {order.cancelledAt && (
                        <InfoRow label="Cancelled" value={formatDate(order.cancelledAt)} />
                    )}
                </View>
                <Text style={styles.refText}>Ref: {order.reference}</Text>
            </View>

            {/* Action buttons */}
            {actionLoading ? (
                <ActivityIndicator
                    size="large"
                    color={colors.primary}
                    style={{ marginVertical: spacing.xl }}
                />
            ) : (
                <View style={styles.actions}>
                    {status === 'PAID' && (
                        <TouchableOpacity
                            style={[styles.actionButton, styles.confirmButton]}
                            onPress={() => handleAction('confirm')}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="checkmark-circle" size={20} color={colors.white} />
                            <Text style={styles.actionButtonText}>Confirm Order</Text>
                        </TouchableOpacity>
                    )}

                    {status === 'CONFIRMED' && (
                        <TouchableOpacity
                            style={[styles.actionButton, styles.fulfillButton]}
                            onPress={() => handleAction('fulfill')}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="bag-check" size={20} color={colors.white} />
                            <Text style={styles.actionButtonText}>Mark as Fulfilled</Text>
                        </TouchableOpacity>
                    )}

                    {['PENDING', 'PAID', 'CONFIRMED'].includes(status) && (
                        <TouchableOpacity
                            style={[styles.actionButton, styles.cancelButton]}
                            onPress={() => handleAction('cancel')}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="close-circle" size={20} color={colors.error} />
                            <Text style={[styles.actionButtonText, { color: colors.error }]}>
                                Cancel Order
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>
            )}

            <View style={{ height: spacing.xxl }} />
        </ScrollView>
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
    },
    content: {
        padding: spacing.md,
    },
    statusBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        marginBottom: spacing.md,
    },
    statusText: {
        ...typography.bodyBold,
        fontSize: 15,
    },
    section: {
        marginBottom: spacing.lg,
    },
    sectionTitle: {
        ...typography.caption,
        color: colors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: spacing.sm,
    },
    card: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: colors.borderLight,
    },
    infoLabel: {
        ...typography.body,
        color: colors.textSecondary,
        fontSize: 14,
    },
    infoValue: {
        ...typography.bodyBold,
        color: colors.text,
        fontSize: 14,
        textAlign: 'right',
        flex: 1,
        marginLeft: spacing.md,
    },
    totalRow: {
        borderBottomWidth: 0,
        paddingTop: spacing.sm,
    },
    totalLabel: {
        ...typography.bodyBold,
        color: colors.text,
    },
    totalValue: {
        ...typography.price,
        color: colors.secondary,
        fontSize: 20,
    },
    refText: {
        ...typography.caption,
        color: colors.textMuted,
        marginTop: spacing.xs,
        fontFamily: 'monospace',
    },
    whatsappButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        backgroundColor: colors.whatsapp,
        borderRadius: borderRadius.lg,
        paddingVertical: 12,
        marginTop: spacing.sm,
    },
    whatsappText: {
        ...typography.button,
        color: colors.white,
    },
    actions: {
        gap: spacing.sm,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        paddingVertical: 14,
        borderRadius: borderRadius.lg,
    },
    confirmButton: {
        backgroundColor: '#1E40AF',
    },
    fulfillButton: {
        backgroundColor: colors.secondary,
    },
    cancelButton: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.errorLight,
    },
    actionButtonText: {
        ...typography.button,
        color: colors.white,
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
    retryButtonText: {
        ...typography.button,
        color: colors.white,
    },
});
