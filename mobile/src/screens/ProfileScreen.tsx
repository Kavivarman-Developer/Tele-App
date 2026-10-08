import React from 'react';
import { View, Text, ScrollView, Alert, Platform, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  User as UserIcon,
  Mail,
  Phone,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  LogOut,
  Sparkles,
  Smartphone,
  Server,
  Zap,
  MapPin,
} from 'lucide-react-native';

import { useAuthStore } from '../store/authStore';
import { CrmShell } from '../components/CrmShell';
import { CrmAvatar } from '../components/CrmAvatar';
import { CrmBadge } from '../components/CrmBadge';
import { Button } from '../components/Button';

export const ProfileScreen: React.FC = () => {
  const { user, logout } = useAuthStore();

  const getRoleTone = (role?: string): 'rose' | 'amber' | 'indigo' => {
    if (role === 'ADMIN') return 'rose';
    if (role === 'MANAGER') return 'amber';
    return 'indigo';
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm('Are you sure you want to sign out of your account?');
      if (confirmed) {
        logout();
      }
      return;
    }

    Alert.alert('Sign Out', 'Are you sure you want to sign out of your account?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  };

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString([], {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : 'Oct 2026';

  return (
    <CrmShell
      title="My Account"
      breadcrumb="Workspace"
    >

      <ScrollView className="flex-1 px-5 pt-4" contentContainerStyle={{ paddingBottom: 50 }}>
        {/* User Hero Banner */}
        <View className="bg-white rounded-2xl p-6 border border-slate-200 mb-4 shadow-sm items-center">
          <View className="relative mb-3">
            <CrmAvatar name={user?.name || 'Agent'} size={72} />
            <View className="absolute bottom-0 right-0 w-5 h-5 bg-emerald-500 rounded-full border-2 border-white items-center justify-center">
              <View className="w-2 h-2 rounded-full bg-white" />
            </View>
          </View>

          <Text className="text-xl font-bold text-slate-900">{user?.name || 'Agent User'}</Text>
          <Text className="text-xs text-slate-500 mt-0.5">{user?.email}</Text>

          <View className="flex-row items-center gap-2 mt-3">
            <CrmBadge label={`Role: ${user?.role || 'AGENT'}`} tone={getRoleTone(user?.role)} />
            <CrmBadge
              label={user?.isActive ? 'Active' : 'Inactive'}
              tone={user?.isActive ? 'emerald' : 'rose'}
            />
          </View>
        </View>

        {/* Account Details List */}
        <View className="bg-white rounded-2xl p-5 border border-slate-200 mb-4 shadow-sm">
          <Text className="text-slate-900 font-bold text-sm mb-3">Account Details</Text>

          <View className="py-3 border-b border-slate-100 flex-row items-center justify-between">
            <View className="flex-row items-center gap-2.5">
              <Phone size={16} color="#64748B" />
              <Text className="text-slate-500 text-xs font-medium">Phone</Text>
            </View>
            <Text className="text-slate-900 text-xs font-bold">{user?.phone || 'Not provided'}</Text>
          </View>

          <View className="py-3 border-b border-slate-100 flex-row items-center justify-between">
            <View className="flex-row items-center gap-2.5">
              <Mail size={16} color="#64748B" />
              <Text className="text-slate-500 text-xs font-medium">Email</Text>
            </View>
            <Text className="text-slate-900 text-xs font-bold">{user?.email}</Text>
          </View>

          {user?.branch ? (
            <View className="py-3 border-b border-slate-100 flex-row items-center justify-between">
              <View className="flex-row items-center gap-2.5">
                <MapPin size={16} color="#0D9488" />
                <Text className="text-slate-500 text-xs font-medium">Assigned Branch</Text>
              </View>
              <Text className="text-emerald-700 text-xs font-bold">{user.branch} Branch</Text>
            </View>
          ) : null}

          <View className="py-3 border-b border-slate-100 flex-row items-center justify-between">
            <View className="flex-row items-center gap-2.5">
              <Zap size={16} color="#64748B" />
              <Text className="text-slate-500 text-xs font-medium">Lead Distribution</Text>
            </View>
            <View className="flex-row items-center gap-1.5">
              <View
                className={`w-2 h-2 rounded-full ${
                  user?.canReceiveLeads ? 'bg-emerald-500' : 'bg-slate-400'
                }`}
              />
              <Text
                className={`text-xs font-bold ${
                  user?.canReceiveLeads ? 'text-emerald-700' : 'text-slate-500'
                }`}
              >
                {user?.canReceiveLeads ? 'Receiving Leads' : 'Distribution Paused'}
              </Text>
            </View>
          </View>

          <View className="py-3 flex-row items-center justify-between">
            <View className="flex-row items-center gap-2.5">
              <Calendar size={16} color="#64748B" />
              <Text className="text-slate-500 text-xs font-medium">Member Since</Text>
            </View>
            <Text className="text-slate-900 text-xs font-bold">{memberSince}</Text>
          </View>
        </View>

        {/* Backend & Application Info */}
        <View className="bg-white rounded-2xl p-5 border border-slate-200 mb-6 shadow-sm">
          <View className="flex-row items-center gap-2 mb-3">
            <Server size={16} color="#4F46E5" />
            <Text className="text-slate-900 font-bold text-sm">System & Environment</Text>
          </View>

          <View className="bg-slate-50 p-3 rounded-xl border border-slate-200 mb-3">
            <View className="flex-row justify-between items-center mb-1">
              <Text className="text-[10px] text-slate-500 font-bold uppercase">Backend API</Text>
              <View className="flex-row items-center gap-1">
                <View className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <Text className="text-[10px] text-emerald-700 font-bold">Online</Text>
              </View>
            </View>
            <Text className="text-slate-900 font-semibold text-xs" numberOfLines={1}>
              https://tele-app-n9wu.onrender.com/api
            </Text>
          </View>

          <View className="flex-row items-center justify-between text-xs py-1">
            <Text className="text-slate-500 text-xs font-medium">App Version</Text>
            <Text className="text-slate-900 text-xs font-bold">1.0.0 (Lovable OKBOZ Edition)</Text>
          </View>
          <View className="flex-row items-center justify-between text-xs py-1">
            <Text className="text-slate-500 text-xs font-medium">Platform</Text>
            <Text className="text-slate-900 text-xs font-bold">
              {Platform.OS === 'web' ? 'Web Browser' : 'Android Standalone APK'}
            </Text>
          </View>
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity
          onPress={handleLogout}
          activeOpacity={0.8}
          className="bg-rose-50 border border-rose-200 py-3.5 px-4 rounded-xl flex-row items-center justify-center gap-2 active:bg-rose-100"
        >
          <LogOut size={16} color="#E11D48" />
          <Text className="text-rose-700 font-bold text-sm">Sign Out of Account</Text>
        </TouchableOpacity>
      </ScrollView>
    </CrmShell>
  );
};
