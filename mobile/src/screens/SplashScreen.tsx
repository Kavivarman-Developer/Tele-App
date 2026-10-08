import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export const SplashScreen: React.FC = () => {
  return (
    <SafeAreaView className="flex-1 bg-slate-900 justify-center items-center px-6">
      <View className="w-20 h-20 bg-blue-600 rounded-3xl justify-center items-center mb-6 shadow-xl shadow-blue-500/20">
        <Text className="text-4xl">📞</Text>
      </View>
      <Text className="text-3xl font-extrabold text-white tracking-tight mb-2">Tele CRM</Text>
      <Text className="text-sm text-slate-400 mb-8 text-center">
        Mobile Lead Management Platform
      </Text>
      <ActivityIndicator size="large" color="#3B82F6" />
    </SafeAreaView>
  );
};
