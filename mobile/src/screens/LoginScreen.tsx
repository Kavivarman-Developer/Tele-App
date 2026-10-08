import React, { useState } from 'react';
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ShieldCheck } from 'lucide-react-native';

import { useAuthStore } from '../store/authStore';
import { Input } from '../components/Input';
import { Button } from '../components/Button';

export const LoginScreen: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading, error, clearError } = useAuthStore();

  const handleLogin = async () => {
    if (!email.trim() || !password) return;
    await login(email.trim(), password);
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F8FAFC]">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
          className="px-6 py-8"
          keyboardShouldPersistTaps="handled"
        >
          {/* Brand Header */}
          <View className="items-center mb-8">
            <View className="w-16 h-16 bg-indigo-600 rounded-2xl items-center justify-center mb-3 shadow-lg shadow-indigo-500/25">
              <Text className="text-white font-extrabold text-2xl tracking-tighter">OK</Text>
            </View>
            <Text className="text-2xl font-black text-slate-900 tracking-tight">Tele App CRM</Text>
            <Text className="text-slate-500 text-xs mt-1 text-center font-medium">
              Enterprise Telecalling & Multi-Branch CRM Platform
            </Text>
          </View>

          {/* Login Card */}
          <View className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm mb-6">
            <Text className="text-slate-900 font-bold text-lg mb-1">Welcome back</Text>
            <Text className="text-slate-500 text-xs font-medium mb-5">
              Enter your official email and password to access your branch dashboard
            </Text>

            {error ? (
              <View className="bg-rose-50 border border-rose-200 rounded-xl p-3 mb-4">
                <Text className="text-rose-700 text-xs font-semibold text-center">{error}</Text>
              </View>
            ) : null}

            <Input
              label="Email Address"
              placeholder="e.g. manager.pudukkottai@company.com"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (error) clearError();
              }}
              keyboardType="email-address"
              autoComplete="email"
              autoCapitalize="none"
            />

            <Input
              label="Password"
              placeholder="••••••••"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (error) clearError();
              }}
              isPassword
            />

            <View className="mt-2">
              <Button
                title={isLoading ? 'Authenticating...' : 'Sign In'}
                onPress={handleLogin}
                loading={isLoading}
                disabled={!email.trim() || !password}
                variant="primary"
              />
            </View>
          </View>

          {/* Security Footer */}
          <View className="items-center">
            <View className="flex-row items-center gap-1.5">
              <ShieldCheck size={14} color="#0D9488" />
              <Text className="text-[12px] text-slate-500 font-medium">
                Protected by End-to-End Role-Based Branch Isolation
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};
