import React from 'react';
import { View, Text, ScrollView, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/authStore';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';

export const ProfileScreen: React.FC = () => {
  const { user, logout } = useAuthStore();

  const getRoleVariant = (role?: string) => {
    if (role === 'ADMIN') return 'danger';
    if (role === 'MANAGER') return 'warning';
    return 'success';
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
    : 'N/A';

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      <ScrollView className="flex-1 px-5 pt-4" contentContainerStyle={{ paddingBottom: 40 }}>
        <Text className="text-xl font-black text-slate-900 mb-4">My Account</Text>

        {/* User Card */}
        <Card className="mb-4 items-center py-6">
          <View className="w-20 h-20 bg-blue-600 rounded-full justify-center items-center mb-3 shadow-md shadow-blue-500/20">
            <Text className="text-2xl text-white font-extrabold">
              {user?.name ? user.name.slice(0, 2).toUpperCase() : 'U'}
            </Text>
          </View>
          <Text className="text-xl font-bold text-slate-900 mb-0.5">{user?.name}</Text>
          <Text className="text-sm text-slate-500 mb-3">{user?.email}</Text>
          <Badge label={user?.role || 'AGENT'} variant={getRoleVariant(user?.role)} />
        </Card>

        {/* Account Details */}
        <Card className="mb-4">
          <Text className="text-slate-900 font-bold text-sm mb-3">Account Details</Text>

          <View className="py-2.5 border-b border-slate-100 flex-row justify-between items-center">
            <Text className="text-slate-500 text-sm">Phone Number</Text>
            <Text className="text-slate-900 text-sm font-semibold">{user?.phone || 'Not set'}</Text>
          </View>

          <View className="py-2.5 border-b border-slate-100 flex-row justify-between items-center">
            <Text className="text-slate-500 text-sm">User Role</Text>
            <Text className="text-slate-900 text-sm font-semibold">{user?.role}</Text>
          </View>

          <View className="py-2.5 border-b border-slate-100 flex-row justify-between items-center">
            <Text className="text-slate-500 text-sm">Lead Distribution</Text>
            <Text
              className={`text-sm font-bold ${
                user?.canReceiveLeads ? 'text-emerald-600' : 'text-slate-400'
              }`}
            >
              {user?.canReceiveLeads ? 'Active & Receiving' : 'Disabled'}
            </Text>
          </View>

          <View className="py-2.5 border-b border-slate-100 flex-row justify-between items-center">
            <Text className="text-slate-500 text-sm">Account Status</Text>
            <Text
              className={`text-sm font-bold ${
                user?.isActive ? 'text-emerald-600' : 'text-red-500'
              }`}
            >
              {user?.isActive ? 'Active' : 'Deactivated'}
            </Text>
          </View>

          <View className="py-2.5 flex-row justify-between items-center">
            <Text className="text-slate-500 text-sm">Member Since</Text>
            <Text className="text-slate-700 text-sm font-medium">{memberSince}</Text>
          </View>
        </Card>

        {/* Application Info */}
        <Card className="mb-6">
          <View className="flex-row items-center mb-2">
            <Text className="text-base mr-2">📞</Text>
            <Text className="text-slate-900 font-bold text-sm">Tele App CRM</Text>
          </View>
          <Text className="text-slate-500 text-xs mb-1 font-medium">Version: 1.0.0 (Production Build)</Text>
          <Text className="text-slate-500 text-xs leading-4">
            Mobile telecalling system with automated call queueing, intelligent retry scheduler, and engagement forms.
          </Text>
        </Card>

        {/* Sign Out Button */}
        <Button title="Sign Out" onPress={handleLogout} variant="danger" />
      </ScrollView>
    </SafeAreaView>
  );
};
