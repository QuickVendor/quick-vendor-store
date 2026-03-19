import { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    ActivityIndicator,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { colors } from '../../src/theme';
import { useAuthStore } from '../../src/features/auth/authStore';
import { register, login } from '../../src/features/auth/api';
import { getProfile } from '../../src/features/store/api';
import { AppError } from '../../src/core/api/errors';
import { toast } from '../../src/core/hooks/useToast';
import { isValidEmail, isValidNigerianPhone, normalizeNigerianPhone } from '../../src/core/utils/validators';

export default function RegisterScreen() {
    const router = useRouter();
    const { setAuth } = useAuthStore();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [storeName, setStoreName] = useState('');
    const [whatsappNumber, setWhatsappNumber] = useState('');
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    function validate(): boolean {
        const newErrors: Record<string, string> = {};

        // Email (required)
        if (!email.trim()) {
            newErrors.email = 'Email is required';
        } else if (!isValidEmail(email.trim())) {
            newErrors.email = 'Enter a valid email address';
        }

        // Password (required)
        if (!password) {
            newErrors.password = 'Password is required';
        } else if (password.length < 8) {
            newErrors.password = 'Password must be at least 8 characters';
        }

        // Confirm password (required)
        if (!confirmPassword) {
            newErrors.confirmPassword = 'Please confirm your password';
        } else if (confirmPassword !== password) {
            newErrors.confirmPassword = 'Passwords do not match';
        }

        // Store name (optional but validated if provided)
        if (storeName.trim() && storeName.trim().length < 2) {
            newErrors.storeName = 'Store name must be at least 2 characters';
        }

        // WhatsApp number (optional but validated if provided)
        if (whatsappNumber.trim() && !isValidNigerianPhone(whatsappNumber.trim())) {
            newErrors.whatsappNumber = 'Enter a valid Nigerian phone (e.g. 08012345678)';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }

    function clearError(field: string) {
        setErrors((prev) => {
            const next = { ...prev };
            delete next[field];
            return next;
        });
    }

    async function handleRegister() {
        if (!validate()) return;

        setLoading(true);
        try {
            await register({
                email: email.trim(),
                password,
                store_name: storeName.trim() || undefined,
                whatsapp_number: whatsappNumber.trim()
                    ? normalizeNigerianPhone(whatsappNumber.trim())
                    : undefined,
            });

            // Auto-login after successful registration
            const { access_token } = await login({
                email: email.trim(),
                password,
            });

            // Pass token explicitly — interceptor doesn't have it yet
            const profile = await getProfile(access_token);
            await setAuth(access_token, profile);
            router.replace('/(main)/dashboard' as any);
        } catch (err) {
            const appError = err instanceof AppError ? err : new AppError('UNKNOWN', 'An unexpected error occurred');
            toast.error(appError.userMessage, 'Registration Failed');
        } finally {
            setLoading(false);
        }
    }

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            {/* Blue header area */}
            <View style={styles.header}>
                <Text style={styles.brandName}>QuickVendor</Text>
                <Text style={styles.brandTagline}>Start selling in minutes</Text>
            </View>

            {/* White card form */}
            <ScrollView
                style={styles.formContainer}
                contentContainerStyle={styles.formContent}
                keyboardShouldPersistTaps="handled"
                bounces={false}
            >
                <Text style={styles.formTitle}>Sign Up</Text>

                {/* Email */}
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>
                        Email <Text style={styles.required}>*</Text>
                    </Text>
                    <TextInput
                        style={[styles.input, errors.email && styles.inputError]}
                        placeholder="Enter email"
                        placeholderTextColor={colors.textMuted}
                        value={email}
                        onChangeText={(t) => { setEmail(t); clearError('email'); }}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoComplete="email"
                        editable={!loading}
                    />
                    {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}
                </View>

                {/* Store Name */}
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Store Name</Text>
                    <TextInput
                        style={[styles.input, errors.storeName && styles.inputError]}
                        placeholder="e.g. Ada's Fashion Store"
                        placeholderTextColor={colors.textMuted}
                        value={storeName}
                        onChangeText={(t) => { setStoreName(t); clearError('storeName'); }}
                        autoCapitalize="words"
                        editable={!loading}
                    />
                    {errors.storeName ? <Text style={styles.errorText}>{errors.storeName}</Text> : null}
                </View>

                {/* WhatsApp Number */}
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>WhatsApp Number</Text>
                    <TextInput
                        style={[styles.input, errors.whatsappNumber && styles.inputError]}
                        placeholder="08012345678"
                        placeholderTextColor={colors.textMuted}
                        value={whatsappNumber}
                        onChangeText={(t) => { setWhatsappNumber(t); clearError('whatsappNumber'); }}
                        keyboardType="phone-pad"
                        maxLength={14}
                        editable={!loading}
                    />
                    {errors.whatsappNumber ? <Text style={styles.errorText}>{errors.whatsappNumber}</Text> : null}
                </View>

                {/* Password */}
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>
                        Password <Text style={styles.required}>*</Text>
                    </Text>
                    <TextInput
                        style={[styles.input, errors.password && styles.inputError]}
                        placeholder="Enter password"
                        placeholderTextColor={colors.textMuted}
                        value={password}
                        onChangeText={(t) => { setPassword(t); clearError('password'); }}
                        secureTextEntry
                        autoComplete="new-password"
                        editable={!loading}
                    />
                    {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}
                </View>

                {/* Confirm Password */}
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>
                        Confirm Password <Text style={styles.required}>*</Text>
                    </Text>
                    <TextInput
                        style={[styles.input, errors.confirmPassword && styles.inputError]}
                        placeholder="Enter password"
                        placeholderTextColor={colors.textMuted}
                        value={confirmPassword}
                        onChangeText={(t) => { setConfirmPassword(t); clearError('confirmPassword'); }}
                        secureTextEntry
                        editable={!loading}
                    />
                    {errors.confirmPassword ? <Text style={styles.errorText}>{errors.confirmPassword}</Text> : null}
                </View>

                {/* Sign Up button */}
                <TouchableOpacity
                    style={[styles.ctaButton, loading && styles.ctaButtonDisabled]}
                    onPress={handleRegister}
                    disabled={loading}
                    activeOpacity={0.85}
                >
                    {loading ? (
                        <ActivityIndicator color={colors.white} />
                    ) : (
                        <Text style={styles.ctaText}>Sign Up</Text>
                    )}
                </TouchableOpacity>

                {/* Toggle to login */}
                <View style={styles.toggleRow}>
                    <Text style={styles.toggleText}>Already have an account? </Text>
                    <Link href="/(auth)/login" asChild>
                        <TouchableOpacity>
                            <Text style={styles.toggleLink}>Sign In</Text>
                        </TouchableOpacity>
                    </Link>
                </View>

            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.primary,
    },

    // ── Header ──
    header: {
        paddingTop: Platform.OS === 'ios' ? 70 : 50,
        paddingBottom: 40,
        alignItems: 'center',
    },
    brandName: {
        fontSize: 34,
        fontWeight: '700',
        color: colors.white,
        letterSpacing: 1,
    },
    brandTagline: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.8)',
        marginTop: 6,
    },

    // ── Form Card ──
    formContainer: {
        flex: 1,
        backgroundColor: colors.white,
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
    },
    formContent: {
        padding: 32,
        paddingTop: 32,
        paddingBottom: 48,
    },
    formTitle: {
        fontSize: 26,
        fontWeight: '700',
        color: colors.text,
        marginBottom: 24,
    },

    // ── Inputs ──
    inputGroup: {
        marginBottom: 18,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text,
        marginBottom: 8,
    },
    required: {
        color: colors.error,
        fontSize: 14,
    },
    input: {
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        paddingVertical: 10,
        fontSize: 16,
        color: colors.text,
    },
    inputError: {
        borderBottomColor: colors.error,
    },
    errorText: {
        fontSize: 12,
        color: colors.error,
        marginTop: 4,
    },

    // ── CTA ──
    ctaButton: {
        backgroundColor: colors.primary,
        borderRadius: 28,
        paddingVertical: 16,
        alignItems: 'center',
        marginTop: 8,
        marginBottom: 20,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    ctaButtonDisabled: {
        opacity: 0.7,
    },
    ctaText: {
        color: colors.white,
        fontSize: 17,
        fontWeight: '700',
        letterSpacing: 0.5,
    },

    // ── Toggle ──
    toggleRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginBottom: 24,
    },
    toggleText: {
        fontSize: 14,
        color: colors.textSecondary,
    },
    toggleLink: {
        fontSize: 14,
        color: colors.primary,
        fontWeight: '600',
    },

});
