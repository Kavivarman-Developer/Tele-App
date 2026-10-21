import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Linking,
  Alert,
  useWindowDimensions,
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
  User,
  ArrowUpRight,
  Filter,
  CheckCircle2,
  PhoneOff,
  History,
  RotateCw,
  Bell,
  Sparkles,
  TrendingUp,
} from 'lucide-react-native';

import { CrmShell } from '../components/CrmShell';
import { useLeadHistoryStore } from '../store/leadHistoryStore';
import { useAuthStore } from '../store/authStore';
import { fetchUserActivities } from '../api/leadApi';
import { Activity, CustomerTemperature, Lead } from '../types';
import { formatDisplayPhone, getDialerTelUrl } from '../utils/phoneUtils';
import { WhatsAppTemplateModal } from '../components/WhatsAppTemplateModal';
import { LeadQuickModal } from '../components/LeadQuickModal';
import { CrmDateTimePickerModal } from '../components/CrmDateTimePickerModal';
import { toast } from '../store/toastStore';
import { colors, borderRadius, shadows } from '../theme';

type DateFilter = 'TODAY' | 'CUSTOM' | 'ALL';
type StageFilter = 'ALL' | 'CONNECTED' | 'INTERESTED' | 'FOLLOW_UP' | 'NOT_CONNECTED';

export const CallHistoryScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { width } = useWindowDimensions();
  const isWide = width >= 860;

  const { user } = useAuthStore();
  const isAgent = user?.role === 'AGENT';

  const { getAllActivities, loadHistory } = useLeadHistoryStore();

  // Default to TODAY so the agent only sees today's calls by default
  const [dateFilter, setDateFilter] = useState<DateFilter>('TODAY');
  const [selectedCustomDate, setSelectedCustomDate] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [stageFilter, setStageFilter] = useState<StageFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // WhatsApp & Quick Modal States
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

  // Fetch activities combining server DB records and local history
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
    const local = getAllActivities(targetAgentId).filter((activity) => activity.type === 'CALL' && matchesMe(activity));
    const map = new Map<string, Activity>();

    // 1. Add server activities (synced from MongoDB)
    for (const a of serverActivities) {
      if (a && a._id && a.type === 'CALL' && matchesMe(a)) {
        map.set(a._id, a);
      }
    }

    // 2. Add local activities (e.g. offline logged calls before server sync)
    for (const a of local) {
      if (a && a._id && !map.has(a._id)) {
        map.set(a._id, a);
      }
    }

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [serverActivities, getAllActivities, user, isAgent]);

  // Start of Day timestamps
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

  // Today count strictly for today's tab counter
  const todayCount = useMemo(() => {
    return userActivities.filter(
      (a) => new Date(a.createdAt).getTime() >= startOfToday,
    ).length;
  }, [userActivities, startOfToday]);

  // Stage counts matching current date filter for stage pills
  const stageCounts = useMemo(() => {
    const base = userActivities.filter((act) => {
      const actTime = new Date(act.createdAt).getTime();
      if (dateFilter === 'TODAY') {
        if (actTime < startOfToday) return false;
      } else if (dateFilter === 'CUSTOM' && selectedCustomDate) {
        const cd = new Date(selectedCustomDate);
        const startOfCustom = new Date(cd.getFullYear(), cd.getMonth(), cd.getDate()).getTime();
        const endOfCustom = startOfCustom + 24 * 60 * 60 * 1000 - 1;
        if (actTime < startOfCustom || actTime > endOfCustom) return false;
      }
      return true;
    });

    return {
      all: base.length,
      connected: base.filter((a) => a.connected).length,
      interested: base.filter((a) => a.stage.toLowerCase().includes('interested')).length,
      followUp: base.filter((a) => a.stage.toLowerCase().includes('follow')).length,
      notConnected: base.filter((a) => !a.connected).length,
    };
  }, [userActivities, dateFilter, selectedCustomDate, startOfToday]);

  // Computed metrics for currently filtered call activities
  const callStats = useMemo(() => {
    const total = filteredActivities.length;
    const connected = filteredActivities.filter((a) => a.connected).length;
    const rate = total > 0 ? Math.round((connected / total) * 100) : 0;
    const totalDurationSec = filteredActivities
      .filter((a) => a.connected)
      .reduce((sum, a) => sum + (a.durationSeconds || 0), 0);
    const avgDurationSec = connected > 0 ? Math.round(totalDurationSec / connected) : 0;

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
      rate,
      totalDuration: formatSec(totalDurationSec),
      avgDuration: formatSec(avgDurationSec),
    };
  }, [filteredActivities]);

  const getInitials = (name?: string) => {
    if (!name || !name.trim()) return 'CL';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  // Handle Redial
  const handleCallAgain = (act: Activity) => {
    if (!act.phone) {
      Alert.alert('No Number', 'Customer phone number is unavailable.');
      return;
    }

    toast.info(`Dialing ${act.customerName || act.phone}...`, 'Calling');

    Linking.openURL(getDialerTelUrl(act.phone)).catch(() => {
      Alert.alert('Call Error', 'Unable to launch dialer on this device.');
    });
  };

  // Handle WhatsApp
  const handleOpenWhatsApp = (act: Activity) => {
    if (!act.phone) return;
    setWhatsAppData({
      visible: true,
      name: act.customerName || 'Customer',
      phone: act.phone,
    });
  };

  // Open Lead Quick Modal
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

  const formatActivityTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      const now = new Date();
      const isToday = d.toDateString() === now.toDateString();
      const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (isToday) {
        return `Today at ${timeStr}`;
      }
      return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${timeStr}`;
    } catch {
      return isoString;
    }
  };

  const formatDuration = (seconds?: number, connected?: boolean) => {
    if (!connected) return 'Not connected';
    if (!seconds || seconds <= 0) return 'Connected';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m === 0) return `${s}s`;
    return `${m}m ${s}s`;
  };

  return (
    <CrmShell
      title="Call History"
      headerIcon={<PhoneCall size={15} color={colors.textSecondary} />}
      breadcrumb="Workspace"
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Sleek Top Search Bar & Quick Refresh */}
        <View style={styles.topSearchRow}>
          <View style={styles.searchInputWrap}>
            <Search size={16} color="#64748B" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search customer name or phone..."
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

        {/* 4-Card KPI Performance Strip */}
        <View style={styles.kpiRow}>
          <View style={[styles.kpiCard, { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}>
            <View style={[styles.kpiIconWrap, { backgroundColor: '#EFF6FF' }]}>
              <Phone size={13} color="#2563EB" />
            </View>
            <Text style={styles.kpiValue}>{callStats.total}</Text>
            <Text style={styles.kpiLabel}>Total Calls</Text>
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

          <View style={[styles.kpiCard, { backgroundColor: '#FFFBEB', borderColor: '#FEF3C7' }]}>
            <View style={[styles.kpiIconWrap, { backgroundColor: '#FEF3C7' }]}>
              <TrendingUp size={13} color="#D97706" />
            </View>
            <Text style={[styles.kpiValue, { color: '#B45309' }]}>{callStats.avgDuration}</Text>
            <Text style={styles.kpiLabel}>Avg. Call</Text>
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
            style={[
              styles.dateTab,
              dateFilter === 'CUSTOM' && styles.dateTabActive,
              styles.datePickerTab,
            ]}
            onPress={() => setShowDatePicker(true)}
            activeOpacity={0.7}
          >
            <Calendar
              size={13}
              color={dateFilter === 'CUSTOM' ? '#FFFFFF' : '#475569'}
            />
            <Text style={[styles.dateTabText, dateFilter === 'CUSTOM' && styles.dateTabTextActive]} numberOfLines={1}>
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

          <TouchableOpacity
            style={[styles.dateTab, dateFilter === 'ALL' && styles.dateTabActive]}
            onPress={() => {
              setDateFilter('ALL');
              setSelectedCustomDate(null);
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.dateTabText, dateFilter === 'ALL' && styles.dateTabTextActive]}>
              All Calls
            </Text>
            <View style={[styles.tabBadge, dateFilter === 'ALL' && styles.tabBadgeActive]}>
              <Text style={[styles.tabBadgeText, dateFilter === 'ALL' && styles.tabBadgeTextActive]}>
                {userActivities.length}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Stage Filter Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.stageFilterScroll}
        >
          <TouchableOpacity
            style={[styles.stagePill, stageFilter === 'ALL' && styles.stagePillActive]}
            onPress={() => setStageFilter('ALL')}
            activeOpacity={0.7}
          >
            <Text style={[styles.stagePillText, stageFilter === 'ALL' && styles.stagePillTextActive]}>
              All
            </Text>
            <View style={[styles.stageCountPill, stageFilter === 'ALL' && styles.stageCountPillActive]}>
              <Text style={[styles.stageCountText, stageFilter === 'ALL' && styles.stageCountTextActive]}>
                {stageCounts.all}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.stagePill, stageFilter === 'CONNECTED' && styles.stagePillActiveConnected]}
            onPress={() => setStageFilter('CONNECTED')}
            activeOpacity={0.7}
          >
            <CheckCircle2 size={12} color={stageFilter === 'CONNECTED' ? '#FFFFFF' : '#16A34A'} />
            <Text style={[styles.stagePillText, stageFilter === 'CONNECTED' && styles.stagePillTextActive]}>
              Connected
            </Text>
            <View style={[styles.stageCountPill, stageFilter === 'CONNECTED' && styles.stageCountPillActive]}>
              <Text style={[styles.stageCountText, stageFilter === 'CONNECTED' && styles.stageCountTextActive]}>
                {stageCounts.connected}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.stagePill, stageFilter === 'INTERESTED' && styles.stagePillActiveInterested]}
            onPress={() => setStageFilter('INTERESTED')}
            activeOpacity={0.7}
          >
            <Flame size={12} color={stageFilter === 'INTERESTED' ? '#FFFFFF' : '#DC2626'} fill={stageFilter === 'INTERESTED' ? '#FFFFFF' : '#DC2626'} />
            <Text style={[styles.stagePillText, stageFilter === 'INTERESTED' && styles.stagePillTextActive]}>
              Interested
            </Text>
            <View style={[styles.stageCountPill, stageFilter === 'INTERESTED' && styles.stageCountPillActive]}>
              <Text style={[styles.stageCountText, stageFilter === 'INTERESTED' && styles.stageCountTextActive]}>
                {stageCounts.interested}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.stagePill, stageFilter === 'FOLLOW_UP' && styles.stagePillActiveFollowUp]}
            onPress={() => setStageFilter('FOLLOW_UP')}
            activeOpacity={0.7}
          >
            <Clock size={12} color={stageFilter === 'FOLLOW_UP' ? '#FFFFFF' : '#0D9488'} />
            <Text style={[styles.stagePillText, stageFilter === 'FOLLOW_UP' && styles.stagePillTextActive]}>
              Follow-ups
            </Text>
            <View style={[styles.stageCountPill, stageFilter === 'FOLLOW_UP' && styles.stageCountPillActive]}>
              <Text style={[styles.stageCountText, stageFilter === 'FOLLOW_UP' && styles.stageCountTextActive]}>
                {stageCounts.followUp}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.stagePill, stageFilter === 'NOT_CONNECTED' && styles.stagePillActiveNotConnected]}
            onPress={() => setStageFilter('NOT_CONNECTED')}
            activeOpacity={0.7}
          >
            <PhoneOff size={12} color={stageFilter === 'NOT_CONNECTED' ? '#FFFFFF' : '#94A3B8'} />
            <Text style={[styles.stagePillText, stageFilter === 'NOT_CONNECTED' && styles.stagePillTextActive]}>
              Not Connected
            </Text>
            <View style={[styles.stageCountPill, stageFilter === 'NOT_CONNECTED' && styles.stageCountPillActive]}>
              <Text style={[styles.stageCountText, stageFilter === 'NOT_CONNECTED' && styles.stageCountTextActive]}>
                {stageCounts.notConnected}
              </Text>
            </View>
          </TouchableOpacity>
        </ScrollView>

        {/* Call History List */}
        <View style={styles.historyList}>
          {filteredActivities.length === 0 ? (
            <View style={styles.emptyStateCard}>
              <View style={styles.emptyIconCircle}>
                <PhoneCall size={30} color="#0F9D58" />
              </View>
              <Text style={styles.emptyStateTitle}>
                {dateFilter === 'TODAY'
                  ? 'No calls made today yet'
                  : 'No calls found for this period'}
              </Text>
              <Text style={styles.emptyStateSubtitle}>
                {dateFilter === 'TODAY'
                  ? 'When you dial leads or log dispositions today, each call will automatically appear here with duration, timestamps, and customer notes.'
                  : 'No calls match your selected date or search filter. Try clearing filters or selecting another date.'}
              </Text>

              {dateFilter === 'TODAY' ? (
                <TouchableOpacity
                  style={styles.emptyActionBtn}
                  onPress={() => navigation.navigate('MyLeads')}
                  activeOpacity={0.8}
                >
                  <Phone size={14} color="#FFFFFF" strokeWidth={2.5} />
                  <Text style={styles.emptyActionBtnText}>Go to Calling Queue</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.emptyResetBtn}
                  onPress={() => {
                    setDateFilter('TODAY');
                    setStageFilter('ALL');
                    setSearchQuery('');
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.emptyResetBtnText}>View Today's Calls</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            filteredActivities.map((act) => {
              const isHot = act.temperature === 'HOT' || act.tag === 'HOT';
              const isCold = act.temperature === 'COLD' || act.tag === 'COLD';
              const displayName = act.customerName || (act.phone ? `Customer (${formatDisplayPhone(act.phone)})` : 'Lead Contact');
              const initials = getInitials(act.customerName);

              return (
                <View key={act._id} style={styles.callCard}>
                  {/* Card Header: Avatar + Customer Info + Time & Duration */}
                  <View style={styles.callCardHeader}>
                    <View style={styles.avatarCircle}>
                      <Text style={styles.avatarText}>{initials}</Text>
                    </View>

                    <View style={styles.customerInfoCol}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
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
                        onPress={() => handleCallAgain(act)}
                        activeOpacity={0.7}
                      >
                        <Phone size={12} color="#0F9D58" />
                        <Text style={styles.customerPhoneText}>
                          {act.phone ? formatDisplayPhone(act.phone) : 'No phone'}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Time Pill & Duration */}
                    <View style={styles.timeDurationCol}>
                      <View style={styles.callTimePill}>
                        <Clock size={11} color="#64748B" />
                        <Text style={styles.callTimeText}>{formatActivityTime(act.createdAt)}</Text>
                      </View>

                      <View
                        style={[
                          styles.durationBadge,
                          act.connected ? styles.durationConnected : styles.durationMissed,
                        ]}
                      >
                        {act.connected ? (
                          <Phone size={10} color="#0F9D58" />
                        ) : (
                          <PhoneOff size={10} color="#DC2626" />
                        )}
                        <Text
                          style={[
                            styles.durationText,
                            act.connected ? { color: '#0F9D58' } : { color: '#DC2626' },
                          ]}
                        >
                          {formatDuration(act.durationSeconds, act.connected)}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Metadata Row: Stage Pill, Follow-up tag */}
                  <View style={styles.cardMetaRow}>
                    <View style={styles.stageBadge}>
                      <Text style={styles.stageBadgeText}>{act.stage}</Text>
                    </View>

                    {act.followUpAt ? (
                      <>
                        <Text style={styles.metaDot}>•</Text>
                        <View style={styles.followUpScheduledTag}>
                          <Calendar size={11} color="#0D9488" />
                          <Text style={styles.followUpScheduledText}>
                            Callback scheduled
                          </Text>
                        </View>
                      </>
                    ) : null}
                  </View>

                  {/* Remark / Notes (if present) */}
                  {act.remark ? (
                    <View style={styles.remarkBox}>
                      <Text style={styles.remarkText} numberOfLines={2}>
                        "{act.remark}"
                      </Text>
                    </View>
                  ) : null}

                  {/* Action Buttons Row: [ 📞 Call Again ] [ 💬 WhatsApp ] [ 📋 Lead Details ] */}
                  <View style={styles.cardActionsRow}>
                    {/* Call Again */}
                    <TouchableOpacity
                      style={styles.callAgainBtn}
                      onPress={() => handleCallAgain(act)}
                      activeOpacity={0.8}
                    >
                      <Phone size={13} color="#FFFFFF" strokeWidth={2.5} />
                      <Text style={styles.callAgainBtnText}>Call Again</Text>
                    </TouchableOpacity>

                    {/* WhatsApp */}
                    <TouchableOpacity
                      style={styles.whatsAppBtn}
                      onPress={() => handleOpenWhatsApp(act)}
                      activeOpacity={0.8}
                    >
                      <MessageCircle size={13} color="#0F9D58" strokeWidth={2.5} />
                      <Text style={styles.whatsAppBtnText}>WhatsApp</Text>
                    </TouchableOpacity>

                    {/* Open Lead */}
                    <TouchableOpacity
                      style={styles.openLeadBtn}
                      onPress={() => handleOpenLead(act)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.openLeadBtnText}>Lead Details</Text>
                      <ArrowUpRight size={13} color="#0284C7" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* WhatsApp Template Modal */}
      {whatsAppData.visible && (
        <WhatsAppTemplateModal
          visible={whatsAppData.visible}
          onClose={() => setWhatsAppData({ visible: false, name: '', phone: '' })}
          recipientName={whatsAppData.name}
          recipientPhone={whatsAppData.phone}
        />
      )}

      {/* Embedded Lead Quick Modal */}
      {quickLead && (
        <LeadQuickModal
          lead={quickLead}
          visible={Boolean(quickLead)}
          onClose={() => setQuickLead(null)}
          onOpenFullDispose={(leadToDispose) => {
            setQuickLead(null);
            navigation.navigate('Dispose', { lead: leadToDispose });
          }}
        />
      )}

      {/* Date Picker Modal for Call History Date Filtering (Allows selecting past dates like yesterday) */}
      <CrmDateTimePickerModal
        visible={showDatePicker}
        title="Select Call History Date"
        initialDate={selectedCustomDate || new Date().toISOString()}
        onClose={() => setShowDatePicker(false)}
        allowPastDates={true}
        mode="date"
        onConfirm={(dateIso) => {
          setSelectedCustomDate(dateIso);
          setDateFilter('CUSTOM');
          setShowDatePicker(false);
          const d = new Date(dateIso);
          const label = d.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
          toast.info(`Filtered for ${label}`);
        }}
      />
    </CrmShell>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 110,
  },
  topSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 9,
    ...shadows.soft,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    padding: 0,
  },
  iconRefreshBtn: {
    width: 42,
    height: 42,
    borderRadius: borderRadius.md,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.soft,
  },
  kpiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  kpiCard: {
    flex: 1,
    minWidth: '47%',
    padding: 10,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    ...shadows.soft,
  },
  kpiIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  kpiValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  kpiLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  dateTabsRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: borderRadius.md,
    padding: 3,
    marginBottom: 12,
    gap: 4,
  },
  dateTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: borderRadius.sm,
  },
  dateTabActive: {
    backgroundColor: '#0F172A',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  datePickerTab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  dateTabText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#475569',
  },
  dateTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  tabBadge: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 10,
  },
  tabBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  tabBadgeTextActive: {
    color: '#FFFFFF',
  },
  stageFilterScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 12,
  },
  stagePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  stagePillActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  stagePillActiveConnected: {
    backgroundColor: '#16A34A',
    borderColor: '#16A34A',
  },
  stagePillActiveInterested: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
  },
  stagePillActiveFollowUp: {
    backgroundColor: '#0D9488',
    borderColor: '#0D9488',
  },
  stagePillActiveNotConnected: {
    backgroundColor: '#475569',
    borderColor: '#475569',
  },
  stagePillText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#475569',
  },
  stagePillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  stageCountPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
  },
  stageCountPillActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  stageCountText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  stageCountTextActive: {
    color: '#FFFFFF',
  },
  historyList: {
    gap: 12,
  },
  emptyStateCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...shadows.soft,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  emptyStateSubtitle: {
    fontSize: 12.5,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    maxWidth: 320,
  },
  emptyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0F9D58',
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 10,
    marginTop: 18,
    shadowColor: '#0F9D58',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  emptyActionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  emptyResetBtn: {
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  emptyResetBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F9D58',
  },
  callCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    ...shadows.soft,
  },
  callCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  avatarText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  customerInfoCol: {
    flex: 1,
  },
  customerNameText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  tempPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  tempHot: {
    backgroundColor: '#FEE2E2',
  },
  tempWarm: {
    backgroundColor: '#FEF3C7',
  },
  tempCold: {
    backgroundColor: '#DBEAFE',
  },
  tempPillText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  phoneClickableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  customerPhoneText: {
    fontSize: 13.5,
    color: '#0F172A',
    fontWeight: '800',
  },
  timeDurationCol: {
    alignItems: 'flex-end',
    gap: 4,
  },
  callTimePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  callTimeText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#64748B',
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  durationConnected: {
    backgroundColor: '#ECFDF5',
  },
  durationMissed: {
    backgroundColor: '#FEF2F2',
  },
  durationText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    marginBottom: 8,
  },
  stageBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  stageBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#334155',
  },
  metaDot: {
    color: '#CBD5E1',
    fontSize: 12,
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
  remarkBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 10,
  },
  remarkText: {
    fontSize: 11.5,
    color: '#475569',
    fontStyle: 'italic',
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  callAgainBtn: {
    flex: 1.2,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#0F9D58',
    borderRadius: 10,
    shadowColor: '#0F9D58',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  callAgainBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  whatsAppBtn: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 10,
  },
  whatsAppBtnText: {
    color: '#0F9D58',
    fontSize: 12,
    fontWeight: '700',
  },
  openLeadBtn: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 10,
  },
  openLeadBtnText: {
    color: '#0284C7',
    fontSize: 12,
    fontWeight: '700',
  },
});
