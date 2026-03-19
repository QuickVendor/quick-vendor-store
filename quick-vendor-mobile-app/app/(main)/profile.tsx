import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../../src/theme';
import { useAuthStore } from '../../src/features/auth/authStore';
import { useStoreSummary } from '../../src/features/store';

function getInitials(name: string | null | undefined): string {
    if (!name) return 'QV';
    const parts = name.trim().split(' ');
    if (parts.length > 1) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

export default function ProfileScreen() {
    const router = useRouter();
    const logout = useAuthStore((s) => s.logout);
    const cachedUser = useAuthStore((s) => s.user);
    const { data } = useStoreSummary();

    const profile = data?.profile ?? cachedUser;
    const storeName = profile?.store_name || 'My Store';

    const handleLogout = () => {
        Alert.alert(
            'Log Out',
            'Are you sure you want to log out?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Log Out',
                    style: 'destructive',
                    onPress: async () => {
                        await logout();
                        router.replace('/(auth)/welcome');
                    },
                },
            ]
        );
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            {/* Header/Avatar Area */}
            <View style={styles.headerSection}>
                <View style={styles.avatarLarge}>
                    <Text style={styles.avatarTextLarge}>{getInitials(storeName)}</Text>
                </View>
                <Text style={styles.storeNameLabel}>{storeName}</Text>
                <Text style={styles.emailLabel}>{profile?.email}</Text>
            </View>

            {/* Profile Details */}
            <View style={styles.detailsCard}>
                <View style={styles.detailRow}>
                    <View style={styles.detailIconContainer}>
                        <Ionicons name="storefront-outline" size={20} color={colors.primary} />
                    </View>
                    <View style={styles.detailTextContainer}>
                        <Text style={styles.detailLabel}>Store Name</Text>
                        <Text style={styles.detailValue}>{storeName}</Text>
                    </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.detailRow}>
                    <View style={styles.detailIconContainer}>
                        <Ionicons name="link-outline" size={20} color={colors.primary} />
                    </View>
                    <View style={styles.detailTextContainer}>
                        <Text style={styles.detailLabel}>Store URL Slug</Text>
                        <Text style={styles.detailValue}>{profile?.store_slug || 'Not set'}</Text>
                    </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.detailRow}>
                    <View style={styles.detailIconContainer}>
                        <Ionicons name="logo-whatsapp" size={20} color={colors.whatsapp} />
                    </View>
                    <View style={styles.detailTextContainer}>
                        <Text style={styles.detailLabel}>WhatsApp Number</Text>
                        <Text style={styles.detailValue}>{profile?.whatsapp_number || 'Not set'}</Text>
                    </View>
                </View>
            </View>

            {/* Account Actions */}
            <View style={styles.sectionHeading}>
                <Text style={styles.sectionTitle}>Account</Text>
            </View>

            <TouchableOpacity
                style={styles.actionButton}
                onPress={() => router.navigate('/(main)/settings' as any)}
                activeOpacity={0.7}
            >
                <View style={styles.actionIconContainer}>
                    <Ionicons name="settings-outline" size={22} color={colors.textSecondary} />
                </View>
                <Text style={styles.actionButtonText}>Store Settings</Text>
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
                style={[styles.actionButton, styles.logoutButton]}
                onPress={handleLogout}
                activeOpacity={0.7}
            >
                <View style={[styles.actionIconContainer, { backgroundColor: colors.errorLight }]}>
                    <Ionicons name="log-out-outline" size={22} color={colors.error} />
                </View>
                <Text style={[styles.actionButtonText, { color: colors.error }]}>Log Out</Text>
            </TouchableOpacity>
        </ScrollView>
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
    headerSection: {
        alignItems: 'center',
        paddingVertical: spacing.xl,
    },
    avatarLarge: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: colors.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.md,
        borderWidth: 4,
        borderColor: colors.white,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 6,
    },
    avatarTextLarge: {
        fontSize: 36,
        fontWeight: '700',
        color: colors.primaryDark,
        letterSpacing: 2,
    },
    storeNameLabel: {
        ...typography.h2,
        color: colors.text,
        marginBottom: 4,
    },
    emailLabel: {
        ...typography.body,
        color: colors.textSecondary,
    },
    detailsCard: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.xl,
        padding: spacing.md,
        marginBottom: spacing.xl,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 10,
        elevation: 2,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.sm,
    },
    detailIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    detailTextContainer: {
        flex: 1,
    },
    detailLabel: {
        ...typography.caption,
        color: colors.textMuted,
        marginBottom: 2,
    },
    detailValue: {
        ...typography.bodyBold,
        color: colors.text,
    },
    divider: {
        height: 1,
        backgroundColor: colors.borderLight,
        marginVertical: spacing.xs,
        marginLeft: 40 + spacing.md, // align with text
    },
    sectionHeading: {
        marginBottom: spacing.md,
        marginLeft: spacing.sm,
    },
    sectionTitle: {
        ...typography.h3,
        fontSize: 16,
        color: colors.textSecondary,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        marginBottom: spacing.md,
    },
    actionIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.background,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    actionButtonText: {
        ...typography.bodyBold,
        color: colors.text,
        flex: 1,
    },
    logoutButton: {
        marginTop: spacing.sm,
        borderWidth: 1,
        borderColor: colors.errorLight,
    },
});
