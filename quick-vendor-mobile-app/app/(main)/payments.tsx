import { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    FlatList,
    Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../../src/theme';
import { useAuthStore } from '../../src/features/auth/authStore';
import { getBanks, verifyAccount, setupPayment } from '../../src/features/payments';
import type { Bank } from '../../src/features/payments';
import { getProfile } from '../../src/features/store';
import { toast } from '../../src/core/hooks/useToast';

export default function PaymentsScreen() {
    const user = useAuthStore((state) => state.user);
    const setUser = useAuthStore((state) => state.setUser);

    const [banks, setBanks] = useState<Bank[]>([]);
    const [loadingBanks, setLoadingBanks] = useState(true);

    const [selectedBank, setSelectedBank] = useState<Bank | null>(null);
    const [accountNumber, setAccountNumber] = useState('');
    const [accountName, setAccountName] = useState<string | null>(null);
    const [verifying, setVerifying] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const [bankModalVisible, setBankModalVisible] = useState(false);
    const [bankSearch, setBankSearch] = useState('');

    const isSetup = user?.payment_setup_complete;

    // Load banks on mount
    useEffect(() => {
        getBanks()
            .then(setBanks)
            .catch(() => toast.error('Failed to load banks'))
            .finally(() => setLoadingBanks(false));
    }, []);

    // Auto-verify when account number is 10 digits and bank is selected
    const handleVerifyAccount = useCallback(async () => {
        if (!selectedBank || accountNumber.length !== 10) return;
        setVerifying(true);
        setAccountName(null);
        try {
            const result = await verifyAccount(selectedBank.code, accountNumber);
            setAccountName(result.accountName);
        } catch {
            toast.error('Could not verify account. Check your details.');
            setAccountName(null);
        } finally {
            setVerifying(false);
        }
    }, [selectedBank, accountNumber]);

    useEffect(() => {
        if (selectedBank && accountNumber.length === 10) {
            handleVerifyAccount();
        } else {
            setAccountName(null);
        }
    }, [selectedBank, accountNumber, handleVerifyAccount]);

    const handleSetup = async () => {
        if (!selectedBank || !accountName) return;

        setSubmitting(true);
        try {
            await setupPayment(selectedBank.code, accountNumber);
            // Refresh user profile to get updated payment fields
            const updatedUser = await getProfile();
            setUser(updatedUser);
            toast.success('Payment setup complete! You can now receive orders.');
        } catch {
            toast.error('Failed to set up payment. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const filteredBanks = bankSearch
        ? banks.filter((b) => b.name.toLowerCase().includes(bankSearch.toLowerCase()))
        : banks;

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
                    <Text style={styles.title}>Payment Setup</Text>
                    <Text style={styles.subtitle}>
                        Connect your bank account to receive payments from customers
                    </Text>
                </View>

                {/* Status Banner */}
                {isSetup && (
                    <View style={styles.successBanner}>
                        <Ionicons name="checkmark-circle" size={24} color="#16a34a" />
                        <View style={{ flex: 1 }}>
                            <Text style={styles.successTitle}>Payments Active</Text>
                            <Text style={styles.successText}>
                                Your store can receive orders. Update your bank details below if needed.
                            </Text>
                        </View>
                    </View>
                )}

                {/* Bank Selection */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Bank Details</Text>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Bank</Text>
                        <TouchableOpacity
                            style={styles.selectButton}
                            onPress={() => setBankModalVisible(true)}
                            disabled={loadingBanks}
                        >
                            {loadingBanks ? (
                                <ActivityIndicator size="small" color={colors.textMuted} />
                            ) : (
                                <>
                                    <Text
                                        style={[
                                            styles.selectButtonText,
                                            !selectedBank && { color: colors.textMuted },
                                        ]}
                                    >
                                        {selectedBank?.name ?? 'Select your bank'}
                                    </Text>
                                    <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
                                </>
                            )}
                        </TouchableOpacity>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Account Number</Text>
                        <TextInput
                            style={styles.input}
                            value={accountNumber}
                            onChangeText={(text) => setAccountNumber(text.replace(/\D/g, '').slice(0, 10))}
                            placeholder="0123456789"
                            placeholderTextColor={colors.textMuted}
                            keyboardType="number-pad"
                            maxLength={10}
                        />
                    </View>

                    {/* Verification Result */}
                    {verifying && (
                        <View style={styles.verifyRow}>
                            <ActivityIndicator size="small" color={colors.primary} />
                            <Text style={styles.verifyText}>Verifying account...</Text>
                        </View>
                    )}

                    {accountName && !verifying && (
                        <View style={styles.verifiedRow}>
                            <Ionicons name="checkmark-circle" size={20} color="#16a34a" />
                            <Text style={styles.verifiedText}>{accountName}</Text>
                        </View>
                    )}

                    {/* Submit */}
                    <TouchableOpacity
                        style={[
                            styles.saveButton,
                            (!accountName || submitting) && styles.buttonDisabled,
                        ]}
                        onPress={handleSetup}
                        disabled={!accountName || submitting}
                    >
                        {submitting ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.saveButtonText}>
                                {isSetup ? 'Update Bank Details' : 'Set Up Payments'}
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Info */}
                <View style={styles.infoBox}>
                    <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
                    <Text style={styles.infoText}>
                        Payments are processed via Paystack. A small platform fee is deducted from each transaction.
                        Funds settle directly into your bank account.
                    </Text>
                </View>
            </ScrollView>

            {/* Bank Picker Modal */}
            <Modal
                visible={bankModalVisible}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setBankModalVisible(false)}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Select Bank</Text>
                        <TouchableOpacity onPress={() => setBankModalVisible(false)}>
                            <Ionicons name="close" size={24} color={colors.text} />
                        </TouchableOpacity>
                    </View>
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search banks..."
                        placeholderTextColor={colors.textMuted}
                        value={bankSearch}
                        onChangeText={setBankSearch}
                        autoFocus
                    />
                    <FlatList
                        data={filteredBanks}
                        keyExtractor={(item, index) => `${item.code}-${index}`}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={[
                                    styles.bankItem,
                                    selectedBank?.code === item.code && styles.bankItemSelected,
                                ]}
                                onPress={() => {
                                    setSelectedBank(item);
                                    setBankModalVisible(false);
                                    setBankSearch('');
                                }}
                            >
                                <Text
                                    style={[
                                        styles.bankItemText,
                                        selectedBank?.code === item.code && styles.bankItemTextSelected,
                                    ]}
                                >
                                    {item.name}
                                </Text>
                                {selectedBank?.code === item.code && (
                                    <Ionicons name="checkmark" size={20} color={colors.primary} />
                                )}
                            </TouchableOpacity>
                        )}
                        ItemSeparatorComponent={() => <View style={styles.separator} />}
                    />
                </View>
            </Modal>
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
    successBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        backgroundColor: '#dcfce7',
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        marginBottom: spacing.lg,
        borderWidth: 1,
        borderColor: '#bbf7d0',
    },
    successTitle: {
        ...typography.subtitle,
        color: '#16a34a',
    },
    successText: {
        ...typography.caption,
        color: '#15803d',
        marginTop: 2,
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
        marginBottom: spacing.md,
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
    selectButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        backgroundColor: colors.background,
    },
    selectButtonText: {
        ...typography.body,
        color: colors.text,
    },
    verifyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginBottom: spacing.lg,
    },
    verifyText: {
        ...typography.caption,
        color: colors.textMuted,
    },
    verifiedRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        backgroundColor: '#dcfce7',
        padding: spacing.md,
        borderRadius: borderRadius.md,
        marginBottom: spacing.lg,
    },
    verifiedText: {
        ...typography.body,
        color: '#16a34a',
        fontWeight: '600',
    },
    saveButton: {
        backgroundColor: colors.primary,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        alignItems: 'center',
        marginTop: spacing.md,
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    saveButtonText: {
        ...typography.button,
        color: '#fff',
    },
    infoBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.sm,
        backgroundColor: '#e0e7ff',
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: '#c7d2fe',
    },
    infoText: {
        ...typography.caption,
        color: '#3730a3',
        flex: 1,
        lineHeight: 20,
    },
    // Modal styles
    modalContainer: {
        flex: 1,
        backgroundColor: colors.background,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    modalTitle: {
        ...typography.h3,
        color: colors.text,
    },
    searchInput: {
        ...typography.body,
        color: colors.text,
        margin: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        backgroundColor: colors.surface,
    },
    bankItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
    },
    bankItemSelected: {
        backgroundColor: '#e0e7ff',
    },
    bankItemText: {
        ...typography.body,
        color: colors.text,
    },
    bankItemTextSelected: {
        color: colors.primary,
        fontWeight: '600',
    },
    separator: {
        height: 1,
        backgroundColor: colors.border,
        marginHorizontal: spacing.lg,
    },
});
