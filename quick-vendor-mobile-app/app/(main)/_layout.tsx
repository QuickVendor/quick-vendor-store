import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../src/theme';

export default function MainLayout() {
    const insets = useSafeAreaInsets();
    // Fallbacks ensuring it's always raised slightly, especially on Android devices with physical/on-screen buttons
    const bottomPadding = Math.max(insets.bottom, Platform.OS === 'ios' ? 24 : 16);

    return (
        <Tabs
            screenOptions={{
                tabBarActiveTintColor: colors.primary,
                tabBarInactiveTintColor: colors.textMuted,
                tabBarStyle: {
                    backgroundColor: colors.white,
                    borderTopColor: colors.border,
                    paddingBottom: bottomPadding,
                    paddingTop: 8,
                    height: 60 + bottomPadding,
                },
                tabBarLabelStyle: {
                    fontSize: 12,
                    fontWeight: '500',
                },
                headerStyle: { backgroundColor: colors.white },
                headerTintColor: colors.text,
                headerTitleStyle: { fontWeight: '600' },
            }}
        >
            <Tabs.Screen
                name="dashboard"
                options={{
                    title: 'Dashboard',
                    headerShown: false,
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="grid-outline" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="products"
                options={{
                    title: 'Products',
                    headerShown: false,
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="cube-outline" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="orders"
                options={{
                    title: 'Orders',
                    headerShown: false,
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="receipt-outline" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="payments"
                options={{
                    title: 'Payments',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="card-outline" size={size} color={color} />
                    ),
                    headerLeft: () => (
                        <Ionicons
                            name="arrow-back"
                            size={24}
                            color={colors.text}
                            style={{ marginLeft: 16 }}
                            onPress={() => {
                                const { router } = require('expo-router');
                                router.back();
                            }}
                        />
                    ),
                }}
            />
            <Tabs.Screen
                name="settings"
                options={{
                    title: 'Settings',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="settings-outline" size={size} color={color} />
                    ),
                    headerLeft: () => (
                        <Ionicons
                            name="arrow-back"
                            size={24}
                            color={colors.text}
                            style={{ marginLeft: 16 }}
                            onPress={() => {
                                const { router } = require('expo-router');
                                router.back();
                            }}
                        />
                    ),
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: 'My Profile',
                    href: null, // Hide from bottom tab bar
                    headerLeft: () => (
                        <Ionicons
                            name="arrow-back"
                            size={24}
                            color={colors.text}
                            style={{ marginLeft: 16 }}
                            onPress={() => {
                                const { router } = require('expo-router');
                                router.back();
                            }}
                        />
                    ),
                }}
            />
        </Tabs>
    );
}
