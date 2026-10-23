import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Alert,
  useWindowDimensions,
  AppState,
  AppStateStatus,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import {
  PhoneCall,
  Phone,
  MessageCircle,
  Search,
  X,
  Calendar,
  Clock,
  Clock3,
  Flame,
  Sun,
  Snowflake,
  ArrowUpRight,
  CheckCircle2,
  PhoneOff,
  RotateCw,
  TrendingUp,
  PhoneOutgoing,
} from 'lucide-react-native';

import { CrmShell } from '../components/CrmShell';
import { useLeadHistoryStore } from '../store/leadHistoryStore';
import { useAuthStore } from '../store/authStore';
import { fetchUserActivities } from '../api/leadApi';
import { Activity, CustomerTemperature, Lead } from '../types';
import { formatDisplayPhone } from '../utils/phoneUtils';
import { WhatsAppTemplateModal } from '../components/WhatsAppTemplateModal';
import { LeadQuickModal } from '../components/LeadQuickModal';
import { CrmDateTimePickerModal } from '../components/CrmDateTimePickerModal';
import { callService } from '../services/call.service';
import { toast } from '../store/toastStore';
import { colors } from '../theme';

type DateFilter = 'TODAY' | 'CUSTOM' | 'ALL';
type StageFilter = 'ALL' | 'CONNECTED' | 'INTERESTED' | 'FOLLOW_UP' | 'NOT_CONNECTED';

// Safe initials helper (guaranteed zero crash)
const getInitials = (name?: string, fallback = 'CL') => {
  if (!name || typeof name !== 'string') return fallback;
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

const formatActivityTime = (isoString: string) => {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday) {
      return `Today, ${timeStr}`;
    }
    return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeStr}`;
  } catch {
    return isoString;
  }
};

const formatDuration = (seconds?: number, connected?: boolean) => {
  if (!connected) return 'Not connected';
  if (!seconds || seconds <= 0) return 'Connected (0s)';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
};

// ======================================================================
// MEMOIZED NEODOVE-GRADE CALL CARD
// ======================================================================
interface CallCardProps {
  act: Activity;
  onCallAgain: (act: Activity) => void;
  onOpenWhatsApp: (act: Activity) => void;
  onOpenLead: (act: Activity) => void;
}

const CallHistoryCard = React.memo<CallCardProps>(
  ({ act, onCallAgain, onOpenWhatsApp, onOpenLead }) => {
    const isHot = act.temperature === 'HOT' || act.tag === 'HOT';
    const isCold = act.temperature === 'COLD' || act.tag === 'COLD';
    const displayName =
      act.customerName ||
      (act.phone ? `Customer (${formatDisplayPhone(act.phone)})` : 'Lead Contact');
    const initials = getInitials(act.customerName);
    const isConnected = Boolean(act.connected);

    return (
      <View style={styles.callCard}>
        {/* Card Header: Avatar + Customer Info + Time & Duration */}
        <View style={styles.callCardHeader}>
          {/* Avatar with direction indicator */}
          <View style={styles.avatarWrap}>
            <View style={[styles.avatarCircle, isConnected ? styles.avatarConnected : styles.avatarMissed]}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <View style={[styles.directionDot, isConnected ? styles.directionConnected : styles.directionMissed]}>
              {isConnected ? (
                <PhoneOutgoing size={9} color="#FFFFFF" strokeWidth={2.5} />
              ) : (
                <PhoneOff size={9} color="#FFFFFF" strokeWidth={2.5} />
              )}
            </View>
          </View>

          {/* Customer Info */}
          <View style={styles.customerInfoCol}>
            <View style={styles.nameRow}>
              <Text style={styles.customerNameText} numberOfLines={1}>
                {displayName}
              </Text>

              {/* Temperature Pill */}
              <View
                style={[
                  styles.tempPill,
                  isHot ? styles.tempHot : isCold ? styles.tempCold : styles.tempWarm,
                ]}
              >
                {isHot ? (
                  <Flame size={10} color="#DC2626" fill="#DC2626" />
                ) : isCold ? (
                  <Snowflake size={10} color="#2563EB" />
                ) : (
                  <Sun size={10} color="#D97706" />
                )}
                <Text
                  style={[
                    styles.tempPillText,
                    { color: isHot ? '#DC2626' : isCold ? '#2563EB' : '#D97706' },
                  ]}
                >
                  {isHot ? 'Hot' : isCold ? 'Cold' : 'Warm'}
                </Text>
              </View>
            </View>

            {/* Phone Number */}
            <TouchableOpacity
              style={styles.phoneClickableRow}
              onPress={() => onCallAgain(act)}
              activeOpacity={0.7}
            >
              <Phone size={12} color="#0F9D58" />
              <Text style={styles.customerPhoneText}>
                {act.phone ? formatDisplayPhone(act.phone) : 'No phone'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Time & Duration Column */}
          <View style={styles.timeDurationCol}>
            <View style={styles.callTimePill}>
              <Clock size={11} color="#64748B" />
              <Text style={styles.callTimeText}>{formatActivityTime(act.createdAt)}</Text>
            </View>

            <View
              style={[
                styles.durationBadge,
                isConnected ? styles.durationConnected : styles.durationMissed,
              ]}
            >
              {isConnected ? (
                <Phone size={10} color="#0F9D58" />
              ) : (
                <PhoneOff size={10} color="#DC2626" />
              )}
              <Text
                style={[
                  styles.durationText,
                  isConnected ? { color: '#0F9D58' } : { color: '#DC2626' },
                ]}
              >
                {formatDuration(act.durationSeconds, isConnected)}
              </Text>
            </View>
          </View>
        </View>

        {/* Metadata Row: Stage Pill, Follow-up tag */}
        <View style={styles.cardMetaRow}>
          <View style={[styles.stageBadge, isConnected ? styles.stageBadgeConnected : styles.stageBadgeNeutral]}>
            <Text style={[styles.stageBadgeText, isConnected ? styles.stageTextConnected : styles.stageTextNeutral]}>
              {act.stage || (isConnected ? 'Connected' : 'Not Connected')}
            </Text>
          </View>

          {act.notConnectedReason && !isConnected ? (
            <View style={styles.reasonBadge}>
              <Text style={styles.reasonBadgeText}>
                {act.notConnectedReason.replace(/_/g, ' ')}
              </Text>
            </View>
          ) : null}

          {act.followUpAt ? (
            <View style={styles.followUpScheduledTag}>
              <Calendar size={11} color="#0D9488" />
              <Text style={styles.followUpScheduledText}>Callback scheduled</Text>
            </View>
          ) : null}
        </View>

        {/* Remark / Notes (if present) */}
        {act.remark && act.remark !== 'Call completed' && act.remark !== 'Call not answered' ? (
          <View style={styles.remarkBox}>
            <Text style={styles.remarkText} numberOfLines={2}>
              "{act.remark}"
            </Text>
          </View>
        ) : null}

        {/* Action Buttons Row: [ 📞 Call Again ] [ 💬 WhatsApp ] [ 📋 Lead Details ] */}
        <View style={styles.cardActionsRow}>
          {/* Call Again (Triggers full AppState & Duration tracking) */}
          <TouchableOpacity
            style={styles.callAgainBtn}
            onPress={() => onCallAgain(act)}
            activeOpacity={0.8}
          >
            <Phone size={13} color="#FFFFFF" strokeWidth={2.5} />
            <Text style={styles.callAgainBtnText}>Call Again</Text>
          </TouchableOpacity>

          {/* WhatsApp */}
          <TouchableOpacity
            style={styles.whatsAppBtn}
            onPress={() => onOpenWhatsApp(act)}
            activeOpacity={0.8}
          >
            <MessageCircle size={13} color="#0F9D58" strokeWidth={2.5} />
            <Text style={styles.whatsAppBtnText}>WhatsApp</Text>
          </TouchableOpacity>

          {/* Open Lead */}
          <TouchableOpacity
            style={styles.openLeadBtn}
            onPress={() => onOpenLead(act)}
            activeOpacity={0.8}
          >
            <Text style={styles.openLeadBtnText}>Lead Details</Text>
            <ArrowUpRight size={13} color="#0284C7" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }
);

// ======================================================================
// MAIN CALL HISTORY SCREEN
// ======================================================================
export const CallHistoryScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { width } = useWindowDimensions();
  const isWide = width >= 860;

  const { user } = useAuthStore();
  const isAgent = user?.role === 'AGENT';

  const { getAllActivities, loadHistory } = useLeadHistoryStore();

  // Redial Tracking Refs (NeoDove-Grade Tracking)
  const isCallingRef = useRef(false);
  const callStartTimeRef = useRef<number | null>(null);
  const callingActRef = useRef<Activity | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // Filters
  const [dateFilter, setDateFilter] = useState<DateFilter>('TODAY');
  const [selectedCustomDate, setSelectedCustomDate] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [stageFilter, setStageFilter] = useState<StageFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [whatsAppData, setWhatsAppData] = useState<{
    visible: boolean;
    name: string;
    phone: string;
  }>({
    visible: false,
    name: '',
    phone: '',
  });

  const [quickLead, setQuickLead] = useState<Lead | null>(null);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const {
    data: serverActivities = [],
    isLoading: isLoadingServer,
    refetch: refetchServer,
  } = useQuery({
    queryKey: ['myCallActivities', user?._id],
    queryFn: () => fetchUserActivities(),
    staleTime: 1000 * 15,
  });

  // ⚡ CRITICAL NEODOVE-GRADE TRACKING:
  // AppState Listener to detect when user returns from phone dialer after "Call Again"
  useEffect(() => {
    const handleAppStateChange = async (nextState: AppStateStatus) => {
      const prevState = appStateRef.current;
      appStateRef.current = nextState;

      if (
        (prevState === 'background' || prevState === 'inactive') &&
        nextState === 'active' &&
        isCallingRef.current &&
        callStartTimeRef.current !== null &&
        callingActRef.current !== null
      ) {
        const startTime = callStartTimeRef.current;
        const dialedAct = callingActRef.current;
        isCallingRef.current = false;
        callStartTimeRef.current = null;
        callingActRef.current = null;

        let result: { connected: boolean; durationSeconds: number };
        try {
          result = await callService.getCallResult(dialedAct.phone || '', startTime);
        } catch {
          result = { connected: false, durationSeconds: 0 };
        }

        const syntheticLead: Lead = {
          _id: dialedAct.leadId || `lead-${dialedAct._id}`,
          name: dialedAct.customerName || 'Customer',
          phone: dialedAct.phone || '',
          campaignId: dialedAct.campaignId || 'default-camp',
          stage: dialedAct.stage || 'New',
          source: 'DIRECT_CALL',
          customProperties: {},
          status: 'OPEN',
          attemptCount: 1,
          createdAt: '',
          updatedAt: '',
        };

        // ⚡ Auto-log this redial outreach immediately into store (so count increases!)
        useLeadHistoryStore.getState().addActivity(syntheticLead._id, {
          phone: syntheticLead.phone,
          customerName: syntheticLead.name,
          agentName: user?.name,
          agentId: user?._id,
          branch: user?.branch,
          connected: result.connected,
          type: 'CALL',
          notConnectedReason: result.connected ? undefined : 'DID_NOT_PICK',
          stage: result.connected ? (dialedAct.stage === 'New' ? 'Connected' : dialedAct.stage) : 'Not Connected',
          durationSeconds: result.connected ? result.durationSeconds : 0,
          remark: result.connected ? 'Call completed' : 'Call not answered',
        });

        // Refetch query to update list
        refetchServer();

        // Navigate to Dispose so agent can update notes or schedule callback
        navigation.navigate('Dispose', {
          lead: syntheticLead,
          initialTab: 'DISPOSE LEAD',
          callDurationSeconds: result.connected ? result.durationSeconds : 0,
          isCallConnected: result.connected,
          callAttempt: true,
          detectionMethod: 'AUTOMATIC',
        });
      }
    };

    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, [navigation, user, refetchServer]);

  // Combined activities (Server DB + Local Store)
  const userActivities = useMemo(() => {
    const cleanId = (user?._id || '').toLowerCase();
    const cleanName = (user?.name || '').toLowerCase();

    const matchesMe = (a: Activity) => {
      if (!isAgent) return true;
      const uId = typeof a.userId === 'object' && a.userId ? (a.userId as any)._id : a.userId;
      const uName = typeof a.userId === 'object' && a.userId ? (a.userId as any).name : '';
      return Boolean(
        (cleanId && uId && String(uId).toLowerCase() === cleanId) ||
        (cleanId && a.agentId && String(a.agentId).toLowerCase() === cleanId) ||
        (cleanName && uName && String(uName).toLowerCase() === cleanName) ||
        (cleanName && a.agentName && String(a.agentName).toLowerCase() === cleanName)
      );
    };

    const targetAgentId = isAgent ? (user?._id || user?.name) : undefined;
    const local = getAllActivities(targetAgentId).filter(
      (activity) => activity.type === 'CALL' && matchesMe(activity),
    );
    const map = new Map<string, Activity>();

    for (const a of serverActivities) {
      if (a && a._id && a.type === 'CALL' && matchesMe(a)) {
        map.set(a._id, a);
      }
    }

    for (const a of local) {
      if (a && a._id && !map.has(a._id)) {
        map.set(a._id, a);
      }
    }

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [serverActivities, getAllActivities, user, isAgent]);

  const startOfToday = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  }, []);

  const customDateDisplay = useMemo(() => {
    if (!selectedCustomDate) return null;
    const d = new Date(selectedCustomDate);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
  }, [selectedCustomDate]);

  // Filter activities strictly by date, stage, and search query
  const filteredActivities = useMemo(() => {
    return userActivities.filter((act) => {
      const actTime = new Date(act.createdAt).getTime();

      // Date Filter
      if (dateFilter === 'TODAY') {
        if (actTime < startOfToday) return false;
      } else if (dateFilter === 'CUSTOM' && selectedCustomDate) {
        const cd = new Date(selectedCustomDate);
        const startOfCustom = new Date(cd.getFullYear(), cd.getMonth(), cd.getDate()).getTime();
        const endOfCustom = startOfCustom + 24 * 60 * 60 * 1000 - 1;
        if (actTime < startOfCustom || actTime > endOfCustom) return false;
      }

      // Stage / Connection Filter
      if (stageFilter === 'CONNECTED' && !act.connected) return false;
      if (stageFilter === 'NOT_CONNECTED' && act.connected) return false;
      if (stageFilter === 'INTERESTED' && !act.stage.toLowerCase().includes('interested')) return false;
      if (stageFilter === 'FOLLOW_UP' && !act.stage.toLowerCase().includes('follow')) return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = (act.customerName || '').toLowerCase().includes(q);
        const phoneMatch = (act.phone || '').toLowerCase().includes(q);
        const remarkMatch = (act.remark || '').toLowerCase().includes(q);
        const stageMatch = (act.stage || '').toLowerCase().includes(q);
        return nameMatch || phoneMatch || remarkMatch || stageMatch;
      }

      return true;
    });
  }, [userActivities, dateFilter, selectedCustomDate, stageFilter, searchQuery, startOfToday]);

  const todayCount = useMemo(() => {
    return userActivities.filter(
      (a) => new Date(a.createdAt).getTime() >= startOfToday,
    ).length;
  }, [userActivities, startOfToday]);

  // Computed metrics for currently filtered call activities
  const callStats = useMemo(() => {
    const total = filteredActivities.length;
    const connected = filteredActivities.filter((a) => a.connected).length;
    const missed = total - connected;
    const rate = total > 0 ? Math.round((connected / total) * 100) : 0;
    const totalDurationSec = filteredActivities
      .filter((a) => a.connected)
      .reduce((sum, a) => sum + (a.durationSeconds || 0), 0);

    const formatSec = (sec: number) => {
      if (!sec || sec <= 0) return '0s';
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      if (m === 0) return `${s}s`;
      return `${m}m ${s}s`;
    };

    return {
      total,
      connected,
      missed,
      rate,
      totalDuration: formatSec(totalDurationSec),
    };
  }, [filteredActivities]);

  // Redial handler with NeoDove tracking
  const handleCallAgain = (act: Activity) => {
    if (!act.phone) {
      Alert.alert('No Number', 'Customer phone number is unavailable.');
      return;
    }

    isCallingRef.current = true;
    callStartTimeRef.current = Date.now();
    callingActRef.current = act;

    toast.info(`Dialing ${act.customerName || act.phone}...`, 'Calling');

    const syntheticLead: Lead = {
      _id: act.leadId || `lead-${act._id}`,
      name: act.customerName || 'Customer',
      phone: act.phone,
      campaignId: act.campaignId || 'default-camp',
      stage: act.stage || 'New',
      source: 'DIRECT_CALL',
      customProperties: {},
      status: 'OPEN',
      attemptCount: 1,
      createdAt: '',
      updatedAt: '',
    };

    callService.startCall(syntheticLead).catch(() => {
      isCallingRef.current = false;
      callStartTimeRef.current = null;
      callingActRef.current = null;
      Alert.alert('Call Error', 'Unable to launch dialer on this device.');
    });
  };

  const handleOpenWhatsApp = (act: Activity) => {
    if (!act.phone) return;
    setWhatsAppData({
      visible: true,
      name: act.customerName || 'Customer',
      phone: act.phone,
    });
  };

  const handleOpenLead = (act: Activity) => {
    const syntheticLead: Lead = {
      _id: act.leadId || `lead-${Date.now()}`,
      campaignId: act.campaignId || '',
      name: act.customerName || 'Customer',
      phone: act.phone || '',
      source: 'DIRECT_CALL',
      stage: act.stage || 'Follow Up',
      tag: act.tag || act.temperature || 'WARM',
      temperature: (act.temperature || act.tag || 'WARM') as CustomerTemperature,
      status: 'OPEN',
      attemptCount: 1,
      customProperties: {},
      nextFollowUpAt: act.followUpAt || undefined,
      createdAt: act.createdAt,
      updatedAt: act.updatedAt,
    };
    setQuickLead(syntheticLead);
  };

  // Header Component for Virtualized FlatList
  const renderListHeader = () => (
    <View style={styles.headerContainer}>
      {/* Top Search Bar & Refresh */}
      <View style={styles.topSearchRow}>
        <View style={styles.searchInputWrap}>
          <Search size={16} color="#64748B" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search customer or phone..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={15} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={styles.iconRefreshBtn}
          onPress={() => {
            loadHistory();
            refetchServer();
            toast.info('Refreshed call history');
          }}
          activeOpacity={0.7}
        >
          <RotateCw size={15} color="#475569" />
        </TouchableOpacity>
      </View>

      {/* 4-Card NeoDove KPI Strip */}
      <View style={styles.kpiRow}>
        <View style={[styles.kpiCard, { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}>
          <View style={[styles.kpiIconWrap, { backgroundColor: '#EFF6FF' }]}>
            <Phone size={13} color="#2563EB" />
          </View>
          <Text style={styles.kpiValue}>{callStats.total}</Text>
          <Text style={styles.kpiLabel}>Total Dials</Text>
        </View>

        <View style={[styles.kpiCard, { backgroundColor: '#F0FDF4', borderColor: '#DCFCE7' }]}>
          <View style={[styles.kpiIconWrap, { backgroundColor: '#DCFCE7' }]}>
            <CheckCircle2 size={13} color="#16A34A" />
          </View>
          <Text style={[styles.kpiValue, { color: '#16A34A' }]}>{callStats.connected}</Text>
          <Text style={styles.kpiLabel}>Connected ({callStats.rate}%)</Text>
        </View>

        <View style={[styles.kpiCard, { backgroundColor: '#F5F3FF', borderColor: '#EDE9FE' }]}>
          <View style={[styles.kpiIconWrap, { backgroundColor: '#EDE9FE' }]}>
            <Clock3 size={13} color="#7C3AED" />
          </View>
          <Text style={[styles.kpiValue, { color: '#6D28D9' }]}>{callStats.totalDuration}</Text>
          <Text style={styles.kpiLabel}>Talk Time</Text>
        </View>

        <View style={[styles.kpiCard, { backgroundColor: '#FEF2F2', borderColor: '#FEE2E2' }]}>
          <View style={[styles.kpiIconWrap, { backgroundColor: '#FEE2E2' }]}>
            <PhoneOff size={13} color="#DC2626" />
          </View>
          <Text style={[styles.kpiValue, { color: '#DC2626' }]}>{callStats.missed}</Text>
          <Text style={styles.kpiLabel}>Not Connected</Text>
        </View>
      </View>

      {/* Date Filter Tabs */}
      <View style={styles.dateTabsRow}>
        <TouchableOpacity
          style={[styles.dateTab, dateFilter === 'TODAY' && styles.dateTabActive]}
          onPress={() => {
            setDateFilter('TODAY');
            setSelectedCustomDate(null);
          }}
          activeOpacity={0.7}
        >
          <Text style={[styles.dateTabText, dateFilter === 'TODAY' && styles.dateTabTextActive]}>
            Today
          </Text>
          <View style={[styles.tabBadge, dateFilter === 'TODAY' && styles.tabBadgeActive]}>
            <Text style={[styles.tabBadgeText, dateFilter === 'TODAY' && styles.tabBadgeTextActive]}>
              {todayCount}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.dateTab, dateFilter === 'ALL' && styles.dateTabActive]}
          onPress={() => {
            setDateFilter('ALL');
            setSelectedCustomDate(null);
          }}
          activeOpacity={0.7}
        >
          <Text style={[styles.dateTabText, dateFilter === 'ALL' && styles.dateTabTextActive]}>
            All Time
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.dateTab,
            dateFilter === 'CUSTOM' && styles.dateTabActive,
            styles.datePickerTab,
          ]}
          onPress={() => setShowDatePicker(true)}
          activeOpacity={0.7}
        >
          <Calendar size={13} color={dateFilter === 'CUSTOM' ? '#FFFFFF' : '#475569'} />
          <Text
            style={[styles.dateTabText, dateFilter === 'CUSTOM' && styles.dateTabTextActive]}
            numberOfLines={1}
          >
            {dateFilter === 'CUSTOM' && customDateDisplay ? customDateDisplay : 'Choose Date'}
          </Text>
          {dateFilter === 'CUSTOM' ? (
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                setDateFilter('TODAY');
                setSelectedCustomDate(null);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{ marginLeft: 2 }}
            >
              <X size={12} color="#FFFFFF" strokeWidth={2.5} />
            </TouchableOpacity>
          ) : null}
        </TouchableOpacity>
      </View>

      {/* Stage / Status Chips */}
      <View style={styles.stageChipsRow}>
        {(['ALL', 'CONNECTED', 'NOT_CONNECTED', 'INTERESTED', 'FOLLOW_UP'] as StageFilter[]).map(
          (stg) => {
            const isSelected = stageFilter === stg;
            const labelMap: Record<StageFilter, string> = {
              ALL: 'All Calls',
              CONNECTED: 'Connected',
              NOT_CONNECTED: 'Not Connected',
              INTERESTED: 'Interested',
              FOLLOW_UP: 'Follow-up',
            };
            return (
              <TouchableOpacity
                key={stg}
                style={[styles.stageChip, isSelected && styles.stageChipActive]}
                onPress={() => setStageFilter(stg)}
                activeOpacity={0.7}
              >
                <Text style={[styles.stageChipText, isSelected && styles.stageChipTextActive]}>
                  {labelMap[stg]}
                </Text>
              </TouchableOpacity>
            );
          },
        )}
      </View>
    </View>
  );

  // Empty State Component
  const renderEmptyState = () => (
    <View style={styles.emptyStateBox}>
      <View style={styles.emptyIconCircle}>
        <Clock3 size={32} color="#94A3B8" />
      </View>
      <Text style={styles.emptyTitle}>No Calls Recorded</Text>
      <Text style={styles.emptySub}>
        {dateFilter === 'TODAY'
          ? "You haven't placed any calls today yet. Calls you make will automatically appear here with duration and connection status."
          : 'No calls match the selected date and filter criteria.'}
      </Text>
      <TouchableOpacity
        style={styles.emptyResetBtn}
        onPress={() => {
          setDateFilter('TODAY');
          setStageFilter('ALL');
          setSearchQuery('');
        }}
        activeOpacity={0.7}
      >
        <Text style={styles.emptyResetBtnText}>Reset to Today's Calls</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <CrmShell
      title="Call History"
      headerIcon={<PhoneCall size={15} color={colors.textSecondary} />}
      breadcrumb="Workspace"
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FlatList
          data={filteredActivities}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <CallHistoryCard
              act={item}
              onCallAgain={handleCallAgain}
              onOpenWhatsApp={handleOpenWhatsApp}
              onOpenLead={handleOpenLead}
            />
          )}
          ListHeaderComponent={renderListHeader}
          ListEmptyComponent={renderEmptyState}
          contentContainerStyle={styles.listContainer}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={Platform.OS === 'android'}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={true}
          showsVerticalScrollIndicator={false}
        />
      </KeyboardAvoidingView>

      {/* WhatsApp Template Modal */}
      <WhatsAppTemplateModal
        visible={whatsAppData.visible}
        onClose={() => setWhatsAppData((prev) => ({ ...prev, visible: false }))}
        customerName={whatsAppData.name}
        customerPhone={whatsAppData.phone}
      />

      {/* Lead Quick Modal */}
      <LeadQuickModal
        visible={Boolean(quickLead)}
        onClose={() => setQuickLead(null)}
        lead={quickLead}
      />

      {/* Custom Date Picker Modal */}
      <CrmDateTimePickerModal
        visible={showDatePicker}
        mode="date"
        initialDate={selectedCustomDate ? new Date(selectedCustomDate) : new Date()}
        onClose={() => setShowDatePicker(false)}
        onConfirm={(isoDate: string) => {
          setSelectedCustomDate(isoDate);
          setDateFilter('CUSTOM');
          setShowDatePicker(false);
        }}
      />
    </CrmShell>
  );
};

const styles = StyleSheet.create({
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  headerContainer: {
    paddingTop: 12,
    marginBottom: 8,
  },

  // Top Search
  topSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    color: '#0F172A',
    padding: 0,
  },
  iconRefreshBtn: {
    width: 42,
    height: 42,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // 4 KPI Cards
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  kpiCard: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  kpiIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
    textAlign: 'center',
  },

  // Date Tabs
  dateTabsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  dateTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    gap: 6,
  },
  dateTabActive: {
    backgroundColor: '#0F9D58',
  },
  dateTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  dateTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  datePickerTab: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabBadge: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  tabBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  tabBadgeTextActive: {
    color: '#FFFFFF',
  },

  // Stage Chips
  stageChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  stageChip: {
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  stageChipActive: {
    backgroundColor: '#E6F4EA',
    borderColor: '#0F9D58',
  },
  stageChipText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748B',
  },
  stageChipTextActive: {
    color: '#0F9D58',
    fontWeight: '700',
  },

  // Call Card
  callCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 10,
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  callCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarConnected: {
    backgroundColor: '#E6F4EA',
  },
  avatarMissed: {
    backgroundColor: '#FEE2E2',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E293B',
  },
  directionDot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  directionConnected: {
    backgroundColor: '#0F9D58',
  },
  directionMissed: {
    backgroundColor: '#DC2626',
  },
  customerInfoCol: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  customerNameText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#0F172A',
    flexShrink: 1,
  },
  phoneClickableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  customerPhoneText: {
    fontSize: 12.5,
    color: '#0F9D58',
    fontWeight: '600',
  },

  // Time & Duration Col
  timeDurationCol: {
    alignItems: 'flex-end',
    gap: 4,
  },
  callTimePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  callTimeText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    gap: 4,
  },
  durationConnected: {
    backgroundColor: '#E6F4EA',
  },
  durationMissed: {
    backgroundColor: '#FEE2E2',
  },
  durationText: {
    fontSize: 10.5,
    fontWeight: '700',
  },

  // Temp Pills
  tempPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
    gap: 3,
  },
  tempHot: {
    backgroundColor: '#FEF2F2',
  },
  tempWarm: {
    backgroundColor: '#FEF3C7',
  },
  tempCold: {
    backgroundColor: '#EFF6FF',
  },
  tempPillText: {
    fontSize: 10,
    fontWeight: '700',
  },

  // Meta Row
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    flexWrap: 'wrap',
  },
  stageBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  stageBadgeConnected: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  stageBadgeNeutral: {
    backgroundColor: '#F1F5F9',
  },
  stageBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  stageTextConnected: {
    color: '#15803D',
  },
  stageTextNeutral: {
    color: '#475569',
  },
  reasonBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  reasonBadgeText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#DC2626',
    textTransform: 'capitalize',
  },
  followUpScheduledTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0FDFA',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  followUpScheduledText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#0D9488',
  },

  // Remark Box
  remarkBox: {
    backgroundColor: '#F8FAFC',
    borderLeftWidth: 3,
    borderLeftColor: '#0F9D58',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    marginTop: 8,
  },
  remarkText: {
    fontSize: 12,
    color: '#475569',
    fontStyle: 'italic',
  },

  // Card Actions
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  callAgainBtn: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F9D58',
    paddingVertical: 7.5,
    borderRadius: 8,
    gap: 5,
    shadowColor: '#0F9D58',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 1,
  },
  callAgainBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  whatsAppBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    paddingVertical: 7,
    borderRadius: 8,
    gap: 4,
  },
  whatsAppBtnText: {
    color: '#15803D',
    fontSize: 12,
    fontWeight: '700',
  },
  openLeadBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    paddingVertical: 7,
    borderRadius: 8,
    gap: 3,
  },
  openLeadBtnText: {
    color: '#0284C7',
    fontSize: 12,
    fontWeight: '700',
  },

  // Empty State
  emptyStateBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
  },
  emptyResetBtn: {
    backgroundColor: '#0F9D58',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
  },
  emptyResetBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
});
