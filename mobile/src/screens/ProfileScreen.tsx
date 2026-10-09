import React from 'react';
import { View, Text, ScrollView, Alert, Platform, TouchableOpacity } from 'react-native';
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
  Radio,
  Wifi,
  MessageCircle,
} from 'lucide-react-native';

import { useAuthStore } from '../store/authStore';
import { CrmShell } from '../components/CrmShell';
import { CrmAvatar } from '../components/CrmAvatar';

export const ProfileScreen: React.FC = () => {
  const { user, logout } = useAuthStore();

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

  const role = user?.role || 'AGENT';
  const roleBg = role === 'ADMIN' ? '#EFF6FF' : role === 'MANAGER' ? '#F5F3FF' : '#ECFDF5';
  const roleBorder = role === 'ADMIN' ? '#BFDBFE' : role === 'MANAGER' ? '#DDD6FE' : '#A7F3D0';
  const roleText = role === 'ADMIN' ? '#1D4ED8' : role === 'MANAGER' ? '#6D28D9' : '#047857';

  return (
    <CrmShell title="My Account" breadcrumb="Workspace">
      <ScrollView
        style={{ flex: 1, backgroundColor: '#F8FAFC' }}
        contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Identity Card: Avatar, Name, Role Badge & Branch Badge */}
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 18,
            padding: 20,
            borderWidth: 1,
            borderColor: '#E2E8F0',
            alignItems: 'center',
            marginBottom: 16,
            shadowColor: '#0F172A',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 4,
            elevation: 2,
          }}
        >
          <View style={{ position: 'relative', marginBottom: 12 }}>
            <CrmAvatar name={user?.name || 'Agent'} size={72} />
            <View
              style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: 20,
                height: 20,
                borderRadius: 10,
                backgroundColor: '#10B981',
                borderWidth: 2.5,
                borderColor: '#FFFFFF',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFFFFF' }} />
            </View>
          </View>

          <Text style={{ fontSize: 20, fontWeight: '800', color: '#0F172A' }}>
            {user?.name || 'Agent User'}
          </Text>
          <Text style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>
            {user?.email}
          </Text>

          {/* Badges Row: Role + Branch */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            {/* Role Badge */}
            <View
              style={{
                backgroundColor: roleBg,
                borderWidth: 1,
                borderColor: roleBorder,
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 8,
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '800', color: roleText }}>
                {role}
              </Text>
            </View>

            {/* Branch Badge */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                backgroundColor: '#F0FDFA',
                borderWidth: 1,
                borderColor: '#99F6E4',
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 8,
              }}
            >
              <MapPin size={11} color="#0F766E" />
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#0F766E' }}>
                {user?.branch ? `${user.branch} Branch` : 'Headquarters / All Branches'}
              </Text>
            </View>

            {/* Status Dot Pill */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                backgroundColor: '#F8FAFC',
                borderWidth: 1,
                borderColor: '#E2E8F0',
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 8,
              }}
            >
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' }} />
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#334155' }}>
                Online & Ready
              </Text>
            </View>
          </View>
        </View>

        {/* Permission & Device Health Rows */}
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 16,
            padding: 18,
            borderWidth: 1,
            borderColor: '#E2E8F0',
            marginBottom: 16,
            shadowColor: '#0F172A',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.04,
            shadowRadius: 3,
            elevation: 2,
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 12 }}>
            Permission & Device Health
          </Text>

          <View style={{ gap: 10 }}>
            {/* Health Row 1: Phone / Dialer */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' }} />
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>
                    Phone & System Dialer
                  </Text>
                  <Text style={{ fontSize: 11, color: '#64748B' }}>1-Tap Calling Ready (tel: protocol)</Text>
                </View>
              </View>
              <Text style={{ fontSize: 11.5, fontWeight: '800', color: '#059669' }}>
                Active
              </Text>
            </View>

            {/* Health Row 2: Inbound Lead Push Alerts */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' }} />
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>
                    Inbound Lead Push Alerts
                  </Text>
                  <Text style={{ fontSize: 11, color: '#64748B' }}>Firebase Notification Stream</Text>
                </View>
              </View>
              <Text style={{ fontSize: 11.5, fontWeight: '800', color: '#059669' }}>
                Synced
              </Text>
            </View>

            {/* Health Row 3: Network & Offline Storage */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' }} />
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>
                    Database & Cloud Sync
                  </Text>
                  <Text style={{ fontSize: 11, color: '#64748B' }}>MongoDB Atlas (Render Cloud)</Text>
                </View>
              </View>
              <Text style={{ fontSize: 11.5, fontWeight: '800', color: '#059669' }}>
                Connected
              </Text>
            </View>

            {/* Health Row 4: WhatsApp Integration */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' }} />
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>
                    WhatsApp Quick Dispatch
                  </Text>
                  <Text style={{ fontSize: 11, color: '#64748B' }}>Auto-Formatted Templates</Text>
                </View>
              </View>
              <Text style={{ fontSize: 11.5, fontWeight: '800', color: '#059669' }}>
                Ready
              </Text>
            </View>
          </View>
        </View>

        {/* Account Details Card */}
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 16,
            padding: 18,
            borderWidth: 1,
            borderColor: '#E2E8F0',
            marginBottom: 20,
            shadowColor: '#0F172A',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.04,
            shadowRadius: 3,
            elevation: 2,
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 12 }}>
            Account Profile
          </Text>

          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
              <Text style={{ fontSize: 12.5, color: '#64748B' }}>Official Phone</Text>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>
                {user?.phone || 'Not provided'}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
              <Text style={{ fontSize: 12.5, color: '#64748B' }}>Inbound Queue Distribution</Text>
              <Text style={{ fontSize: 12.5, fontWeight: '700', color: user?.canReceiveLeads ? '#059669' : '#64748B' }}>
                {user?.canReceiveLeads ? '🟢 Receiving Leads' : '⏸️ Queue Paused'}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
              <Text style={{ fontSize: 12.5, color: '#64748B' }}>Member Since</Text>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>
                {memberSince}
              </Text>
            </View>
          </View>
        </View>

        {/* Outline Red Sign Out Button with Confirm Dialog */}
        <TouchableOpacity
          onPress={handleLogout}
          activeOpacity={0.8}
          style={{
            height: 50,
            backgroundColor: '#FEF2F2',
            borderWidth: 1.5,
            borderColor: '#FECACA',
            borderRadius: 12,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <LogOut size={16} color="#DC2626" />
          <Text style={{ fontSize: 14, fontWeight: '800', color: '#DC2626' }}>
            Sign Out of Workspace
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </CrmShell>
  );
};
