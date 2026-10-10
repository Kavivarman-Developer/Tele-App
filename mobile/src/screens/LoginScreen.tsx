import React, { useState } from 'react';
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ShieldCheck, Phone, Eye, EyeOff, AlertCircle, Mail, Lock } from 'lucide-react-native';

import { useAuthStore } from '../store/authStore';

export const LoginScreen: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login, isLoading, error, clearError } = useAuthStore();

  const handleLogin = async () => {
    if (!email.trim() || !password) return;
    await login(email.trim(), password);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC', paddingTop: Platform.OS === 'android' ? 8 : 0 }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Brand Logo & Header */}
          <View style={{ alignItems: 'center', marginBottom: 28 }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 20,
                backgroundColor: '#10B981',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 14,
                shadowColor: '#10B981',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.3,
                shadowRadius: 10,
                elevation: 6,
              }}
            >
              <Phone size={30} color="#FFFFFF" strokeWidth={2.5} />
            </View>
            <Text style={{ fontSize: 26, fontWeight: '900', color: '#0F172A', letterSpacing: -0.5 }}>
              Hi Talk
            </Text>
            <Text style={{ fontSize: 13, color: '#64748B', marginTop: 3, fontWeight: '500' }}>
              High-Velocity Calling & Lead Management
            </Text>
          </View>

          {/* Minimal Card Surface */}
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 20,
              padding: 24,
              borderWidth: 1,
              borderColor: '#E2E8F0',
              shadowColor: '#0F172A',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.06,
              shadowRadius: 8,
              elevation: 3,
              marginBottom: 24,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#0F172A', marginBottom: 4 }}>
              Sign In to Your Desk
            </Text>
            <Text style={{ fontSize: 12.5, color: '#64748B', marginBottom: 20 }}>
              Enter your agent or manager credentials to start calling
            </Text>

            {/* Soft Red Error Banner */}
            {error ? (
              <View
                style={{
                  backgroundColor: '#FEF2F2',
                  borderWidth: 1,
                  borderColor: '#FECACA',
                  borderRadius: 12,
                  padding: 12,
                  marginBottom: 18,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <AlertCircle size={16} color="#DC2626" />
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#DC2626', flex: 1 }}>
                  {error}
                </Text>
              </View>
            ) : null}

            {/* Email Field */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#475569', textTransform: 'uppercase', marginBottom: 6 }}>
                Email Address
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: '#F8FAFC',
                  borderWidth: 1,
                  borderColor: '#E2E8F0',
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  height: 48,
                  gap: 10,
                }}
              >
                <Mail size={16} color="#94A3B8" />
                <TextInput
                  style={{ flex: 1, fontSize: 13.5, color: '#0F172A', padding: 0 }}
                  placeholder="name@company.com"
                  placeholderTextColor="#94A3B8"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (error) clearError();
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            {/* Password Field with Show/Hide Icon */}
            <View style={{ marginBottom: 22 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#475569', textTransform: 'uppercase', marginBottom: 6 }}>
                Password
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: '#F8FAFC',
                  borderWidth: 1,
                  borderColor: '#E2E8F0',
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  height: 48,
                  gap: 10,
                }}
              >
                <Lock size={16} color="#94A3B8" />
                <TextInput
                  style={{ flex: 1, fontSize: 13.5, color: '#0F172A', padding: 0 }}
                  placeholder="Enter your password"
                  placeholderTextColor="#94A3B8"
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (error) clearError();
                  }}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  activeOpacity={0.7}
                  style={{ padding: 4 }}
                >
                  {showPassword ? (
                    <EyeOff size={18} color="#64748B" />
                  ) : (
                    <Eye size={18} color="#64748B" />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Sign In CTA Button */}
            <TouchableOpacity
              onPress={handleLogin}
              disabled={isLoading || !email.trim() || !password}
              activeOpacity={0.8}
              style={{
                height: 52,
                backgroundColor: !email.trim() || !password || isLoading ? '#94A3B8' : '#10B981',
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: '#10B981',
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: !email.trim() || !password || isLoading ? 0 : 0.25,
                shadowRadius: 6,
                elevation: !email.trim() || !password || isLoading ? 0 : 3,
              }}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={{ fontSize: 15, fontWeight: '800', color: '#FFFFFF' }}>
                  Sign In to Workspace ➔
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Security & Branch Isolation Badge */}
          <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
            <ShieldCheck size={15} color="#10B981" />
            <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '500' }}>
              Encrypted Session · Strict Branch Isolation
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};
