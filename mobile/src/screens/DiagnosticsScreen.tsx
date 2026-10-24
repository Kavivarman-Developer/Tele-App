import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Linking,
  PermissionsAndroid,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Cpu,
  Wifi,
  Database,
  Battery,
  ShieldCheck,
  Activity as ActivityIcon,
} from 'lucide-react-native';
import { apiClient } from '../api/client';
import { useOutboxStore } from '../store/outboxStore';
import { colors } from '../theme';

interface PermissionStatus {
  readCallLog: boolean;
  readPhoneState: boolean;
  callPhone: boolean;
}

export const DiagnosticsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { isOnline, items, processOutbox } = useOutboxStore();

  const [loading, setLoading] = useState(false);
  const [apiLatency, setApiLatency] = useState<number | null>(null);
  const [apiStatus, setApiStatus] = useState<'ONLINE' | 'OFFLINE' | 'CHECKING'>('CHECKING');
  const [permissions, setPermissions] = useState<PermissionStatus>({
    readCallLog: false,
    readPhoneState: false,
    callPhone: false,
  });

  const pendingOutboxCount = items.filter((i) => i.status === 'PENDING' || i.status === 'SYNCING').length;
  const failedOutboxCount = items.filter((i) => i.status === 'FAILED').length;

  const runDiagnostics = async () => {
    setLoading(true);

    // 1. Check Permissions on Android
    if (Platform.OS === 'android') {
      try {
        const hasCallLog = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_CALL_LOG);
        const hasPhoneState = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE);
        const hasCall = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CALL_PHONE);
        setPermissions({
          readCallLog: hasCallLog,
          readPhoneState: hasPhoneState,
          callPhone: hasCall,
        });
      } catch {
        // Ignored
      }
    }

    // 2. Measure API Latency
    const t0 = Date.now();
    try {
      const res = await apiClient.get('/health', { timeout: 5000 });
      const elapsed = Date.now() - t0;
      setApiLatency(elapsed);
      setApiStatus(res.status === 200 ? 'ONLINE' : 'OFFLINE');
    } catch {
      setApiLatency(null);
      setApiStatus('OFFLINE');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={22} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>System Diagnostics</Text>
        <TouchableOpacity onPress={runDiagnostics} disabled={loading} style={styles.refreshBtn}>
          {loading ? (
            <ActivityIndicator size="small" color="#2563EB" />
          ) : (
            <RefreshCw size={18} color="#2563EB" />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Card 1: Device & Hardware Environment */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Cpu size={18} color="#2563EB" />
            <Text style={styles.cardTitle}>Runtime Environment</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Platform OS</Text>
            <Text style={styles.val}>{Platform.OS.toUpperCase()} {Platform.Version}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>React Native Engine</Text>
            <Text style={styles.val}>0.86 (Hermes)</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Network Reachability</Text>
            <View style={styles.badgeRow}>
              {isOnline ? <CheckCircle2 size={14} color="#16A34A" /> : <XCircle size={14} color="#DC2626" />}
              <Text style={[styles.val, { color: isOnline ? '#16A34A' : '#DC2626' }]}>
                {isOnline ? 'Connected' : 'Offline'}
              </Text>
            </View>
          </View>
        </View>

        {/* Card 2: Android Call Permissions */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <ShieldCheck size={18} color="#16A34A" />
            <Text style={styles.cardTitle}>Android Hardware Permissions</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Read Call Log (Reconciliation)</Text>
            <View style={styles.badgeRow}>
              {permissions.readCallLog ? (
                <CheckCircle2 size={15} color="#16A34A" />
              ) : (
                <XCircle size={15} color="#DC2626" />
              )}
              <Text style={styles.val}>{permissions.readCallLog ? 'Granted' : 'Missing'}</Text>
            </View>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Read Phone State (Duration)</Text>
            <View style={styles.badgeRow}>
              {permissions.readPhoneState ? (
                <CheckCircle2 size={15} color="#16A34A" />
              ) : (
                <XCircle size={15} color="#DC2626" />
              )}
              <Text style={styles.val}>{permissions.readPhoneState ? 'Granted' : 'Missing'}</Text>
            </View>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Call Phone (Direct Intent)</Text>
            <View style={styles.badgeRow}>
              {permissions.callPhone ? (
                <CheckCircle2 size={15} color="#16A34A" />
              ) : (
                <XCircle size={15} color="#DC2626" />
              )}
              <Text style={styles.val}>{permissions.callPhone ? 'Granted' : 'Missing'}</Text>
            </View>
          </View>
          {(!permissions.readCallLog || !permissions.readPhoneState || !permissions.callPhone) && (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => Linking.openSettings()}
            >
              <Text style={styles.actionBtnText}>Open Device App Settings</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Card 3: Backend API Latency & Health */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <ActivityIcon size={18} color="#D97706" />
            <Text style={styles.cardTitle}>Backend Server Health</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>API Server Status</Text>
            <Text style={[styles.val, { color: apiStatus === 'ONLINE' ? '#16A34A' : '#DC2626', fontWeight: '700' }]}>
              {apiStatus}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Round-Trip Latency</Text>
            <Text style={styles.val}>{apiLatency !== null ? `${apiLatency} ms` : 'Unreachable'}</Text>
          </View>
        </View>

        {/* Card 4: Durable Offline Outbox */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Database size={18} color="#9333EA" />
            <Text style={styles.cardTitle}>Durable Offline Mutation Outbox</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Pending Mutations</Text>
            <Text style={[styles.val, { color: pendingOutboxCount > 0 ? '#2563EB' : '#16A34A', fontWeight: '700' }]}>
              {pendingOutboxCount}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Failed Syncs</Text>
            <Text style={[styles.val, { color: failedOutboxCount > 0 ? '#DC2626' : '#64748B', fontWeight: '700' }]}>
              {failedOutboxCount}
            </Text>
          </View>
          {pendingOutboxCount > 0 && isOnline && (
            <TouchableOpacity style={styles.actionBtn} onPress={() => processOutbox()}>
              <Text style={styles.actionBtnText}>Force Flush Outbox Now</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Card 5: Battery Optimization Guidance */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Battery size={18} color="#059669" />
            <Text style={styles.cardTitle}>Battery Optimization Guidance</Text>
          </View>
          <Text style={styles.cardDesc}>
            Xiaomi, Samsung, Vivo, and Oppo devices often terminate CRM apps in the background during long phone calls.
          </Text>
          <TouchableOpacity
            style={styles.actionBtnSecondary}
            onPress={() => Linking.openSettings()}
          >
            <Text style={styles.actionBtnSecondaryText}>Review Battery Restrictions</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: { padding: 4 },
  refreshBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#0F172A' },
  content: { padding: 16, gap: 14 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
  cardDesc: { fontSize: 12.5, color: '#64748B', lineHeight: 18, marginBottom: 12 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { fontSize: 13, color: '#475569' },
  val: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
  actionBtn: {
    backgroundColor: '#2563EB',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  actionBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  actionBtnSecondary: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionBtnSecondaryText: { color: '#1E293B', fontSize: 13, fontWeight: '600' },
});
