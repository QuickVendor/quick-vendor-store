import { Platform } from 'react-native';

const fontFamily = Platform.select({
    ios: 'System',
    android: 'Roboto',
    default: 'System',
});

/**
 * Typography scale — uses system fonts for optimal rendering.
 * Includes a dedicated price style for ₦ Naira amounts.
 */
export const typography = {
    h1: { fontSize: 28, fontWeight: '700' as const, fontFamily, lineHeight: 36 },
    h2: { fontSize: 22, fontWeight: '600' as const, fontFamily, lineHeight: 28 },
    h3: { fontSize: 18, fontWeight: '600' as const, fontFamily, lineHeight: 24 },
    body: { fontSize: 16, fontWeight: '400' as const, fontFamily, lineHeight: 24 },
    bodyBold: { fontSize: 16, fontWeight: '600' as const, fontFamily, lineHeight: 24 },
    caption: { fontSize: 13, fontWeight: '400' as const, fontFamily, lineHeight: 18 },
    small: { fontSize: 11, fontWeight: '400' as const, fontFamily, lineHeight: 16 },
    button: { fontSize: 16, fontWeight: '600' as const, fontFamily, lineHeight: 20 },
    price: { fontSize: 18, fontWeight: '700' as const, fontFamily, lineHeight: 24 },
} as const;
