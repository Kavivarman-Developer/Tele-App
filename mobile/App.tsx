import './global.css';
import React, { useEffect } from 'react';
import { StatusBar as RNStatusBar } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RootNavigator } from './src/navigation/RootNavigator';
import { CrmToast } from './src/components/CrmToast';
import { apiClient } from './src/api/client';

const queryClient = new QueryClient();

export default function App(): React.JSX.Element {
  useEffect(() => {
    // Eager server warm-up pinger: ping /health asynchronously on app launch to wake Render instance
    apiClient.get('/health').catch(() => {
      // Silently catch network errors during offline launch
    });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <RNStatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />
        <StatusBar style="dark" />
        <RootNavigator />
        <CrmToast />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
