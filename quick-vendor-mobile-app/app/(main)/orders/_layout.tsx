import { Stack } from 'expo-router';
import { colors } from '../../../src/theme';

export default function OrdersLayout() {
    return (
        <Stack
            screenOptions={{
                headerStyle: { backgroundColor: colors.white },
                headerTintColor: colors.text,
                headerTitleStyle: { fontWeight: '600' },
            }}
        >
            <Stack.Screen name="index" options={{ title: 'Orders' }} />
            <Stack.Screen name="[id]" options={{ title: 'Order Details' }} />
        </Stack>
    );
}
