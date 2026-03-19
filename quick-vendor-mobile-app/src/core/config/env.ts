/**
 * Environment configuration.
 * Uses __DEV__ flag for dev/prod switching.
 * For staging, use EAS build profiles with app.config.ts extras.
 */

import Constants from 'expo-constants';

/**
 * Auto-detect the development machine's LAN IP from Expo.
 * Expo Go connects to Metro bundler via the machine's IP,
 * so we reuse it for the API server (assumed to be on port 3000).
 * This works on any WiFi network / any device without manual IP edits.
 */
function getDevApiUrl(): string {
    const hostUri = Constants.expoConfig?.hostUri; // e.g. "192.168.0.18:8081"
    if (hostUri) {
        const host = hostUri.split(':')[0]; // strip Metro port
        return `http://${host}:3000`;
    }
    return 'http://localhost:3000'; // fallback (emulator / web)
}

function getDevFrontendUrl(): string {
    const hostUri = Constants.expoConfig?.hostUri;
    if (hostUri) {
        const host = hostUri.split(':')[0];
        return `http://${host}:3001`;
    }
    return 'http://localhost:3001';
}

export const env = {
    /** Current environment name. */
    name: __DEV__ ? 'development' : 'production',

    /** Backend API base URL. */
    apiUrl: __DEV__
        ? getDevApiUrl()
        : 'https://quickvendor-app.onrender.com',

    /** Public Frontend URL (used for sharing the store link). */
    frontendUrl: __DEV__
        ? getDevFrontendUrl()
        : 'https://quickvendor.com',

    /** Request timeout in milliseconds (longer for Nigerian 3G). */
    apiTimeout: 15_000,

    /** Enable verbose API logging in dev. */
    enableApiLogging: __DEV__,
} as const;
