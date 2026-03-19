import React, { useEffect, useRef, useCallback } from 'react';
import {
    Animated,
    Text,
    TouchableOpacity,
    StyleSheet,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useToastStore, type ToastType } from '../hooks/useToast';
import { colors, typography, spacing, borderRadius } from '../../theme';

// ── Config ─────────────────────────────────────────────────
const DEFAULT_DURATION = 4000;
const SLIDE_DURATION = 300;
const TOP_OFFSET = Platform.OS === 'ios' ? 56 : 40;

const VARIANTS: Record<
    ToastType,
    { bg: string; border: string; icon: keyof typeof Ionicons.glyphMap; iconColor: string }
> = {
    success: {
        bg: '#F0FDF4',
        border: '#BBF7D0',
        icon: 'checkmark-circle',
        iconColor: colors.success,
    },
    error: {
        bg: '#FEF2F2',
        border: '#FECACA',
        icon: 'alert-circle',
        iconColor: colors.error,
    },
    warning: {
        bg: '#FFFBEB',
        border: '#FDE68A',
        icon: 'warning',
        iconColor: colors.warning,
    },
    info: {
        bg: '#EFF6FF',
        border: '#BFDBFE',
        icon: 'information-circle',
        iconColor: '#3B82F6',
    },
};

// ── Component ──────────────────────────────────────────────
export function Toast() {
    const toast = useToastStore((s) => s.toast);
    const hideToast = useToastStore((s) => s.hideToast);

    const translateY = useRef(new Animated.Value(-120)).current;
    const opacity = useRef(new Animated.Value(0)).current;
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const dismiss = useCallback(() => {
        Animated.parallel([
            Animated.timing(translateY, {
                toValue: -120,
                duration: SLIDE_DURATION,
                useNativeDriver: true,
            }),
            Animated.timing(opacity, {
                toValue: 0,
                duration: SLIDE_DURATION,
                useNativeDriver: true,
            }),
        ]).start(() => {
            hideToast();
        });
    }, [hideToast, translateY, opacity]);

    useEffect(() => {
        if (!toast) return;

        // Slide in
        Animated.parallel([
            Animated.spring(translateY, {
                toValue: 0,
                useNativeDriver: true,
                tension: 80,
                friction: 10,
            }),
            Animated.timing(opacity, {
                toValue: 1,
                duration: SLIDE_DURATION,
                useNativeDriver: true,
            }),
        ]).start();

        // Auto-dismiss
        const duration = toast.duration ?? DEFAULT_DURATION;
        if (duration > 0) {
            timerRef.current = setTimeout(dismiss, duration);
        }

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [toast?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    if (!toast) return null;

    const variant = VARIANTS[toast.type];

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    backgroundColor: variant.bg,
                    borderColor: variant.border,
                    transform: [{ translateY }],
                    opacity,
                },
            ]}
            pointerEvents="box-none"
        >
            <Ionicons
                name={variant.icon}
                size={22}
                color={variant.iconColor}
                style={styles.icon}
            />

            <TouchableOpacity
                style={styles.body}
                onPress={dismiss}
                activeOpacity={0.8}
            >
                <Text style={styles.title} numberOfLines={1}>
                    {toast.title}
                </Text>
                {toast.message ? (
                    <Text style={styles.message} numberOfLines={2}>
                        {toast.message}
                    </Text>
                ) : null}
            </TouchableOpacity>

            <TouchableOpacity onPress={dismiss} hitSlop={8}>
                <Ionicons name="close" size={18} color={colors.textMuted} />
            </TouchableOpacity>
        </Animated.View>
    );
}

// ── Styles ─────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: TOP_OFFSET,
        left: spacing.md,
        right: spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: spacing.md,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        zIndex: 9999,
        elevation: 10,

        // Shadow
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
    },
    icon: {
        marginRight: 10,
    },
    body: {
        flex: 1,
        marginRight: 8,
    },
    title: {
        ...typography.bodyBold,
        fontSize: 14,
        color: colors.text,
    },
    message: {
        ...typography.body,
        fontSize: 13,
        color: colors.textSecondary,
        marginTop: 2,
        lineHeight: 18,
    },
});
