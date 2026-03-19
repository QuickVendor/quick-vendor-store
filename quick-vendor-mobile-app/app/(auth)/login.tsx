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
import { login } from '../../src/features/auth/api';
import { getProfile } from '../../src/features/store/api';
import { AppError } from '../../src/core/api/errors';
import { toast } from '../../src/core/hooks/useToast';

export default function LoginScreen() {
    const router = useRouter();
    const { setAuth } = useAuthStore();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

    function validate(): boolean {
        const newErrors: typeof errors = {};

        if (!email.trim()) {
            newErrors.email = 'Email is required';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            newErrors.email = 'Enter a valid email address';
        }

        if (!password) {
            newErrors.password = 'Password is required';
        } else if (password.length < 6) {
            newErrors.password = 'Password must be at least 6 characters';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }

    async function handleLogin() {
        if (!validate()) return;

        setLoading(true);
        try {
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
            toast.error(appError.userMessage, 'Login Failed');
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
                <Text style={styles.brandTagline}>Manage your store on the go</Text>
            </View>

            {/* White card form */}
            <ScrollView
                style={styles.formContainer}
                contentContainerStyle={styles.formContent}
                keyboardShouldPersistTaps="handled"
                bounces={false}
            >
                <Text style={styles.formTitle}>Sign In</Text>

                {/* Email */}
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Email</Text>
                    <TextInput
                        style={[styles.input, errors.email && styles.inputError]}
                        placeholder="Enter email"
                        placeholderTextColor={colors.textMuted}
                        value={email}
                        onChangeText={(t) => { setEmail(t); setErrors((e) => ({ ...e, email: undefined })); }}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoComplete="email"
                        editable={!loading}
                    />
                    {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}
                </View>

                {/* Password */}
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Password</Text>
                    <TextInput
                        style={[styles.input, errors.password && styles.inputError]}
                        placeholder="Enter password"
                        placeholderTextColor={colors.textMuted}
                        value={password}
                        onChangeText={(t) => { setPassword(t); setErrors((e) => ({ ...e, password: undefined })); }}
                        secureTextEntry
                        autoComplete="password"
                        editable={!loading}
                    />
                    {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}
                </View>

                {/* Forgot password */}
                <TouchableOpacity style={styles.forgotRow}>
                    <Text style={styles.forgotText}>Forgot password?</Text>
                </TouchableOpacity>

                {/* Sign In button */}
                <TouchableOpacity
                    style={[styles.ctaButton, loading && styles.ctaButtonDisabled]}
                    onPress={handleLogin}
                    disabled={loading}
                    activeOpacity={0.85}
                >
                    {loading ? (
                        <ActivityIndicator color={colors.white} />
                    ) : (
                        <Text style={styles.ctaText}>Sign In</Text>
                    )}
                </TouchableOpacity>

                {/* Toggle to register */}
                <View style={styles.toggleRow}>
                    <Text style={styles.toggleText}>Don't have an account? </Text>
                    <Link href="/(auth)/register" asChild>
                        <TouchableOpacity>
                            <Text style={styles.toggleLink}>Sign Up</Text>
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
        paddingTop: Platform.OS === 'ios' ? 80 : 60,
        paddingBottom: 50,
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
        paddingTop: 36,
        paddingBottom: 48,
    },
    formTitle: {
        fontSize: 26,
        fontWeight: '700',
        color: colors.text,
        marginBottom: 28,
    },

    // ── Inputs ──
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text,
        marginBottom: 8,
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

    // ── Forgot ──
    forgotRow: {
        alignItems: 'flex-end',
        marginBottom: 28,
        marginTop: 4,
    },
    forgotText: {
        fontSize: 13,
        color: colors.textSecondary,
    },

    // ── CTA ──
    ctaButton: {
        backgroundColor: colors.primary,
        borderRadius: 28,
        paddingVertical: 16,
        alignItems: 'center',
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
