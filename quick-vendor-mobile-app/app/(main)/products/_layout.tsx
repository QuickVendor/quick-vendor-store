import { Stack } from 'expo-router';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../src/theme';

export default function ProductsLayout() {
    return (
        <Stack
            screenOptions={{
                headerStyle: { backgroundColor: colors.white },
                headerTintColor: colors.text,
                headerTitleStyle: { fontWeight: '600' as const },
                headerShadowVisible: false,
            }}
        >
            <Stack.Screen
                name="index"
                options={{
                    title: 'Products',
                    headerRight: () => {
                        const { useRouter } = require('expo-router');
                        const router = useRouter();
                        return (
                            <TouchableOpacity
                                onPress={() => router.push('/(main)/products/add')}
                                style={{ marginRight: 16 }}
                            >
                                <Ionicons name="add" size={26} color={colors.primary} />
                            </TouchableOpacity>
                        );
                    }
                }}
            />
            <Stack.Screen name="add" options={{ title: 'Add Product' }} />
            <Stack.Screen name="[id]" options={{ title: 'Edit Product' }} />
        </Stack>
    );
}
