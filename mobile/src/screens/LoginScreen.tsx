import React, { useState } from 'react';
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/authStore';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { Card } from '../components/Card';

export const LoginScreen: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading, error, clearError } = useAuthStore();

  const handleLogin = async () => {
    if (!email.trim() || !password) return;
    await login(email.trim(), password);
  };

  const handleFillDemoAdmin = () => {
    setEmail('admin@example.com');
    setPassword('Admin@123');
    clearError();
  };

  const handleFillDemoAgent = () => {
    setEmail('john@example.com');
    setPassword('Agent@123');
    clearError();
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
          className="px-6 py-8"
          keyboardShouldPersistTaps="handled"
        >
          <View className="items-center mb-8">
            <View className="w-16 h-16 bg-blue-600 rounded-2xl justify-center items-center mb-4 shadow-lg shadow-blue-500/20">
              <Text className="text-3xl">📞</Text>
            </View>
            <Text className="text-3xl font-extrabold text-slate-900 tracking-tight">Tele App CRM</Text>
            <Text className="text-slate-500 text-sm mt-1.5">Sign in to start calling and managing leads</Text>
          </View>

          <Card className="p-6 mb-6 bg-white border border-slate-200/90 shadow-lg shadow-slate-200/60 rounded-3xl">
            {error ? (
              <View className="bg-rose-50 border border-rose-200 rounded-xl p-3 mb-4">
                <Text className="text-rose-700 text-xs font-semibold text-center">{error}</Text>
              </View>
            ) : null}

            <Input
              label="Email Address"
              placeholder="name@company.com"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (error) clearError();
              }}
              keyboardType="email-address"
              autoComplete="email"
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

            <Button
              title="Sign In"
              onPress={handleLogin}
              loading={isLoading}
              disabled={!email.trim() || !password}
              className="mt-2"
            />
          </Card>

          {/* Quick Demo Credentials Helper */}
          <View className="items-center">
            <Text className="text-slate-400 text-xs mb-2.5 uppercase font-bold tracking-wider">
              Quick Demo Fill
            </Text>
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={handleFillDemoAdmin}
                className="bg-blue-50 px-3.5 py-2 rounded-xl border border-blue-200 shadow-sm"
              >
                <Text className="text-blue-700 text-xs font-semibold">Fill Admin</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleFillDemoAgent}
                className="bg-emerald-50 px-3.5 py-2 rounded-xl border border-emerald-200 shadow-sm"
              >
                <Text className="text-emerald-700 text-xs font-semibold">Fill Agent (John)</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};
