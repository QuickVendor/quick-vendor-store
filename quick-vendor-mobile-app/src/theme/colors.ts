/**
 * QuickVendor brand color palette.
 * Primary: #F63E50 (vibrant red) — CTAs, headers, active states.
 * Background: #F3F1EB (warm cream) — main screen backgrounds.
 */
export const colors = {
    // Brand
    primary: '#F63E50',
    primaryLight: '#FEE2E5',
    primaryDark: '#D92F40',

    // Semantic
    secondary: '#10B981',
    secondaryLight: '#D1FAE5',
    success: '#22C55E',
    warning: '#F59E0B',
    error: '#EF4444',
    errorLight: '#FEE2E2',

    // Neutrals
    white: '#FFFFFF',
    background: '#F3F1EB',
    surface: '#FFFFFF',
    border: '#E0DDD4',
    borderLight: '#EAE8E0',

    // Text
    text: '#0F172A',
    textSecondary: '#475569',
    textMuted: '#94A3B8',
    textInverse: '#FFFFFF',

    // Platform
    whatsapp: '#25D366',

    // Overlay
    overlay: 'rgba(15, 23, 42, 0.5)',
} as const;
