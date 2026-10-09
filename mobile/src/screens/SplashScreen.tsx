import React from 'react';
import { View, Text, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export const SplashScreen: React.FC = () => {
  return (
    <SafeAreaView className="flex-1 bg-[#F8FAFC] justify-center items-center px-6">
      {/* Brand Icon Badge with generated Tell icon */}
      <View className="w-24 h-24 rounded-3xl overflow-hidden mb-5 shadow-xl shadow-emerald-500/25 border border-emerald-100">
        <Image
          source={require('../../assets/icon.png')}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
        />
      </View>

      {/* App Title & Subtitle */}
      <Text className="text-3xl font-black text-slate-900 tracking-tight mb-1.5">Tell</Text>
      <Text className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-8 text-center">
        Smart Calling & Lead Automation
      </Text>

      {/* Emerald Activity Spinner */}
      <ActivityIndicator size="large" color="#10B981" />

      {/* Bottom Status Pill */}
      <View className="absolute bottom-10 flex-row items-center bg-white px-4 py-2 rounded-full border border-slate-200 shadow-sm">
        <View className="w-2 h-2 rounded-full bg-emerald-500 mr-2" />
        <Text className="text-xs font-semibold text-slate-600">Connecting to calling desk...</Text>
      </View>
    </SafeAreaView>
  );
};
