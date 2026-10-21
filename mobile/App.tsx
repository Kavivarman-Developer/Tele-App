import './global.css';
import React, { useEffect } from 'react';
import { StatusBar as RNStatusBar } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RootNavigator } from './src/navigation/RootNavigator';
import { CrmToast } from './src/components/CrmToast';
import { apiClient } from './src/api/client';
import { notificationService } from './src/services/notification.service';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes client-side cache TTL: eliminates redundant DB traffic
      gcTime: 1000 * 60 * 15, // 15 minutes memory retention
      refetchOnWindowFocus: false, // Prevents sudden DB queries when switching tabs/apps
      retry: 1,
    },
  },
});

export default function App(): React.JSX.Element {
  useEffect(() => {
    // 1. Initialize Android push & local reminder notification channels & request permission
    notificationService.requestPermissions().catch(() => {});

    // 2. Eager server warm-up pinger: ping /health asynchronously on app launch to wake Render instance
    apiClient.get('/health').catch(() => {
      // Silently catch network errors during offline launch
    });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <RNStatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />
        <StatusBar style="dark" />
        <RootNavigator />
        <CrmToast />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
