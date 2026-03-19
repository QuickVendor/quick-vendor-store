import { useCallback, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    RefreshControl,
    TouchableOpacity,
    Animated,
    Platform,
    Dimensions,
    Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, typography, spacing, borderRadius } from '../../src/theme';
import { useStoreSummary } from '../../src/features/store';
import { useAuthStore } from '../../src/features/auth/authStore';

import { env } from '../../src/core/config/env';

const { width } = Dimensions.get('window');

// ── Helpers ──

function getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
}

function getFirstName(fullName: string | null | undefined): string {
    if (!fullName) return 'there';
    return fullName.split(' ')[0];
}

function getInitials(name: string | null | undefined): string {
    if (!name) return 'QV';
    const parts = name.trim().split(' ');
    if (parts.length > 1) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

// ── Skeleton shimmer ──

function SkeletonBox({ w, h, br = borderRadius.md }: { w: number | string; h: number, br?: number }) {
    const opacity = useRef(new Animated.Value(0.3)).current;

    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
                Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
            ]),
        );
        loop.start();
        return () => loop.stop();
    }, [opacity]);

    return (
        <Animated.View
            style={[
                styles.skeleton,
                { width: w as any, height: h, opacity, borderRadius: br },
            ]}
        />
    );
}

// ── Main Screen ──

export default function DashboardScreen() {
    const router = useRouter();
    const cachedUser = useAuthStore((s) => s.user);
    const { data, isLoading, isError, refetch, isRefetching } = useStoreSummary();

    const profile = data?.profile ?? cachedUser;
    const productCount = data?.productCount ?? 0;
    const totalClicks = data?.totalClicks ?? 0;
    const storeSlug = profile?.store_slug;
    const storeName = profile?.store_name || profile?.email || 'Store';

    const storeUrl = storeSlug ? `${env.frontendUrl}/${storeSlug}` : '';

    const handleCopyLink = useCallback(async () => {
        if (!storeUrl) return;
        await Clipboard.setStringAsync(storeUrl);
        // Could easily add a toast here calling `toast.success('Link copied!')`
    }, [storeUrl]);

    const handleShareLink = useCallback(async () => {
        if (!storeUrl) return;
        try {
            const { Share } = await import('react-native');
            await Share.share({
                message: `Check out my store on QuickVendor!\n\n${storeUrl}`,
                url: storeUrl, // iOS only
            });
        } catch (error) {
            console.error('Failed to share', error);
        }
    }, [storeUrl]);

    // ── Loading state ──
    if (isLoading) {
        return (
            <ScrollView style={styles.container} contentContainerStyle={styles.content}>
                <View style={styles.headerRow}>
                    <View>
                        <SkeletonBox w={120} h={24} />
                        <View style={{ height: 8 }} />
                        <SkeletonBox w={180} h={32} />
                    </View>
                    <SkeletonBox w={48} h={48} br={24} />
                </View>

                <View style={{ marginTop: spacing.xl }}>
                    <SkeletonBox w="100%" h={160} br={borderRadius.xl} />
                </View>

                <View style={{ marginTop: spacing.xl }}>
                    <SkeletonBox w={100} h={24} />
                    <View style={{ height: spacing.md }} />
                    <View style={styles.actionsRow}>
                        <SkeletonBox w={(width - spacing.lg * 2 - spacing.md * 2) / 3} h={96} br={borderRadius.xl} />
                        <SkeletonBox w={(width - spacing.lg * 2 - spacing.md * 2) / 3} h={96} br={borderRadius.xl} />
                        <SkeletonBox w={(width - spacing.lg * 2 - spacing.md * 2) / 3} h={96} br={borderRadius.xl} />
                    </View>
                </View>
            </ScrollView>
        );
    }

    // ── Error state ──
    if (isError) {
        return (
            <View style={[styles.container, styles.centeredState]}>
                <View style={styles.errorIconContainer}>
                    <Ionicons name="cloud-offline" size={56} color={colors.textMuted} />
                </View>
                <Text style={styles.errorTitle}>Oops! Connection Lost</Text>
                <Text style={styles.errorSubtitle}>We couldn't load your store dashboard. Please check your internet and try again.</Text>
                <TouchableOpacity style={styles.retryButton} onPress={() => refetch()} activeOpacity={0.8}>
                    <Text style={styles.retryText}>Try Again</Text>
                </TouchableOpacity>
            </View>
        );
    }

    // ── Loaded state ──
    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            refreshControl={
                <RefreshControl
                    refreshing={isRefetching}
                    onRefresh={refetch}
                    tintColor={colors.primary}
                    colors={[colors.primary]}
                />
            }
            showsVerticalScrollIndicator={false}
        >
            {/* Header / Avatar */}
            <View style={styles.headerRow}>
                <View style={styles.headerTextContainer}>
                    <Text style={styles.greetingText}>{getGreeting()},</Text>
                    <Text style={styles.nameText}>{getFirstName(profile?.store_name)}</Text>
                </View>
                <TouchableOpacity
                    style={styles.avatarContainer}
                    activeOpacity={0.8}
                    onPress={() => router.navigate('/(main)/profile' as any)}
                >
                    <Text style={styles.avatarText}>{getInitials(profile?.store_name)}</Text>
                </TouchableOpacity>
            </View>

            {/* Premium Store Performance Card */}
            <View style={styles.premiumCardContainer}>
                <LinearGradient
                    colors={[colors.primary, colors.primaryDark]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.premiumCard}
                >
                    {/* Decorative Background Shapes */}
                    <View style={styles.decorativeCircle1} />
                    <View style={styles.decorativeCircle2} />

                    <View style={styles.cardHeaderRow}>
                        <Text style={styles.cardTitle}>Store Performance</Text>
                        <View style={styles.liveIndicator}>
                            <View style={styles.liveDot} />
                            <Text style={styles.liveText}>Live</Text>
                        </View>
                    </View>

                    <View style={styles.metricsRow}>
                        <View style={styles.metricBlock}>
                            <Text style={styles.metricValue}>{totalClicks}</Text>
                            <Text style={styles.metricLabel}>Total Views</Text>
                        </View>
                        <View style={styles.metricDivider} />
                        <View style={styles.metricBlock}>
                            <Text style={styles.metricValue}>{productCount}</Text>
                            <Text style={styles.metricLabel}>Products</Text>
                        </View>
                    </View>
                </LinearGradient>
            </View>

            {/* Quick Actions (Squarcles) */}
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Quick Actions</Text>
            </View>
            <View style={styles.actionsRow}>
                <TouchableOpacity
                    style={styles.squarcleCard}
                    onPress={() => router.push('/(main)/products/add')}
                    activeOpacity={0.7}
                >
                    <View style={[styles.squarcleIcon, { backgroundColor: colors.primaryLight }]}>
                        <Ionicons name="add" size={28} color={colors.primary} />
                    </View>
                    <Text style={styles.actionLabel}>Add</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.squarcleCard}
                    onPress={() => router.push('/(main)/products')}
                    activeOpacity={0.7}
                >
                    <View style={[styles.squarcleIcon, { backgroundColor: colors.secondaryLight }]}>
                        <Ionicons name="cube" size={26} color={colors.secondary} />
                    </View>
                    <Text style={styles.actionLabel}>Products</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.squarcleCard}
                    onPress={() => router.push('/(main)/settings')}
                    activeOpacity={0.7}
                >
                    <View style={[styles.squarcleIcon, { backgroundColor: '#F3F0FF' }]}>
                        <Ionicons name="settings" size={24} color="#7C3AED" />
                    </View>
                    <Text style={styles.actionLabel}>Settings</Text>
                </TouchableOpacity>
            </View>

            {/* Share Your Store */}
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Share Your Store</Text>
            </View>

            {storeSlug ? (
                <View style={styles.shareNotificationCard}>
                    <View style={styles.shareIconContainer}>
                        <Ionicons name="storefront" size={24} color={colors.primary} />
                    </View>
                    <View style={styles.shareInfoContainer}>
                        <Text style={styles.shareStoreName}>{storeName}</Text>
                        <Text
                            style={[styles.shareLinkText, { textDecorationLine: 'underline' }]}
                            numberOfLines={1}
                            onPress={() => Linking.openURL(storeUrl)}
                        >
                            {storeUrl.replace(/^https?:\/\//, '')}
                        </Text>
                    </View>
                    <View style={styles.shareActions}>
                        <TouchableOpacity style={styles.actionPill} onPress={handleCopyLink} activeOpacity={0.7}>
                            <Ionicons name="copy-outline" size={14} color={colors.primary} />
                            <Text style={styles.actionPillText}>Copy</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.actionPill, styles.actionPillPrimary]} onPress={handleShareLink} activeOpacity={0.7}>
                            <Ionicons name="share-social-outline" size={14} color={colors.white} />
                            <Text style={[styles.actionPillText, { color: colors.white }]}>Share</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            ) : (
                <View style={styles.setupStoreCard}>
                    <View style={styles.setupIconContainer}>
                        <Ionicons name="storefront" size={32} color={colors.warning} />
                    </View>
                    <View style={styles.setupTextContainer}>
                        <Text style={styles.setupTitle}>Missing Store Link</Text>
                        <Text style={styles.setupSubtitle}>Set up your store slug to share your shop with customers.</Text>
                    </View>
                    <TouchableOpacity
                        style={styles.setupCtaButton}
                        onPress={() => router.push('/(main)/settings')}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.setupCtaText}>Set up now</Text>
                    </TouchableOpacity>
                </View>
            )}

            <View style={{ height: 40 }} />
        </ScrollView>
    );
}

// ── Styles ──

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    content: {
        padding: spacing.lg,
        paddingTop: Platform.OS === 'ios' ? 60 : spacing.xxl,
    },
    centeredState: {
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xl,
    },

    // Header items
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.xl,
    },
    headerTextContainer: {
        flex: 1,
    },
    greetingText: {
        ...typography.body,
        fontSize: 18,
        color: colors.textSecondary,
        marginBottom: 2,
    },
    nameText: {
        ...typography.h1,
        color: colors.text,
    },
    avatarContainer: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: colors.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: colors.white,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
    },
    avatarText: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.primaryDark,
        letterSpacing: 1,
    },

    // Premium Card
    premiumCardContainer: {
        shadowColor: colors.primaryDark,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
        elevation: 8,
        marginBottom: spacing.xxl,
    },
    premiumCard: {
        borderRadius: borderRadius.xl,
        padding: spacing.xl,
        overflow: 'hidden',
        position: 'relative',
    },
    decorativeCircle1: {
        position: 'absolute',
        top: -40,
        right: -30,
        width: 140,
        height: 140,
        borderRadius: 70,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    decorativeCircle2: {
        position: 'absolute',
        bottom: -60,
        left: -20,
        width: 180,
        height: 180,
        borderRadius: 90,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
    cardHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.xl,
    },
    cardTitle: {
        ...typography.bodyBold,
        color: 'rgba(255,255,255,0.9)',
    },
    liveIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 6,
    },
    liveDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#10B981', // green
    },
    liveText: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.white,
    },
    metricsRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    metricBlock: {
        flex: 1,
    },
    metricValue: {
        fontSize: 38,
        fontWeight: '800',
        color: colors.white,
        marginBottom: 4,
        letterSpacing: -1,
    },
    metricLabel: {
        ...typography.body,
        color: 'rgba(255,255,255,0.8)',
    },
    metricDivider: {
        width: 1,
        height: 50,
        backgroundColor: 'rgba(255,255,255,0.2)',
        marginHorizontal: spacing.md,
    },

    // Quick Actions
    sectionHeader: {
        marginBottom: spacing.md,
    },
    sectionTitle: {
        ...typography.h3,
        color: colors.text,
    },
    actionsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: spacing.xl,
        gap: spacing.md,
    },
    squarcleCard: {
        flex: 1,
        backgroundColor: colors.surface,
        borderRadius: borderRadius.xl,
        paddingVertical: spacing.lg,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 10,
        elevation: 2,
    },
    squarcleIcon: {
        width: 52,
        height: 52,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    actionLabel: {
        ...typography.bodyBold,
        fontSize: 14,
        color: colors.text,
    },

    // Share Notification Card
    shareNotificationCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 3,
        borderLeftWidth: 4,
        borderLeftColor: colors.primary,
    },
    shareIconContainer: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    shareInfoContainer: {
        flex: 1,
        marginRight: spacing.sm,
    },
    shareStoreName: {
        ...typography.bodyBold,
        color: colors.text,
        marginBottom: 2,
    },
    shareLinkText: {
        ...typography.caption,
        color: colors.primary,
    },
    shareActions: {
        flexDirection: 'row',
        gap: spacing.xs,
    },
    actionPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 16,
        backgroundColor: colors.primaryLight,
    },
    actionPillPrimary: {
        backgroundColor: colors.primary,
    },
    actionPillText: {
        ...typography.caption,
        fontWeight: '600',
        color: colors.primary,
    },

    // Setup Store Prompt
    setupStoreCard: {
        backgroundColor: '#FFFBEB', // Warning light
        borderRadius: borderRadius.xl,
        padding: spacing.lg,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#FEF3C7',
    },
    setupIconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#FEF3C7',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    setupTextContainer: {
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    setupTitle: {
        ...typography.h3,
        color: '#92400E',
        marginBottom: 4,
    },
    setupSubtitle: {
        ...typography.body,
        color: '#B45309',
        textAlign: 'center',
        paddingHorizontal: spacing.md,
    },
    setupCtaButton: {
        backgroundColor: '#D97706',
        paddingHorizontal: spacing.xl,
        paddingVertical: 12,
        borderRadius: borderRadius.full,
    },
    setupCtaText: {
        ...typography.button,
        color: colors.white,
    },

    // Error State
    errorIconContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: colors.borderLight,
        justifyContent: 'center',
        alignItems: 'center',
    },
    errorTitle: {
        ...typography.h2,
        color: colors.text,
        marginTop: spacing.xl,
        marginBottom: spacing.xs,
    },
    errorSubtitle: {
        ...typography.body,
        color: colors.textSecondary,
        textAlign: 'center',
        paddingHorizontal: spacing.lg,
        marginBottom: spacing.xl,
    },
    retryButton: {
        backgroundColor: colors.primary,
        paddingHorizontal: spacing.xxl,
        paddingVertical: 14,
        borderRadius: borderRadius.full,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    retryText: {
        ...typography.button,
        color: colors.white,
    },

    // Skeleton
    skeleton: {
        backgroundColor: colors.borderLight,
    },
});
