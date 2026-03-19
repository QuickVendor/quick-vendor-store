import { useEffect } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '../src/core/components/ErrorBoundary';
import { Toast } from '../src/core/components/Toast';
import { useAuthStore } from '../src/features/auth/authStore';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 2, staleTime: 1000 * 60 * 5 },
  },
});

/** Redirects user based on auth state. */
function AuthGate() {
  const { token, isRehydrated } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!isRehydrated) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!token && !inAuthGroup) {
      router.replace('/(auth)/welcome');
    } else if (token && inAuthGroup) {
      router.replace('/(main)/dashboard');
    }
  }, [token, isRehydrated, segments]);

  return <Slot />;
}

export default function RootLayout() {
  const { rehydrate } = useAuthStore();

  useEffect(() => {
    rehydrate();
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        <AuthGate />
        <Toast />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

