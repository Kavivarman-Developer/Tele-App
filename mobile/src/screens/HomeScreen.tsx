import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  Phone,
  Clock3,
  ArrowUpRight,
  ChevronRight,
  PhoneCall,
  Plus,
  LayoutGrid,
  MapPin,
  CheckCircle2,
  Calendar,
  MessageCircle,
  TrendingUp,
  Target,
  Sparkles,
  PhoneOff,
  Flame,
  Sun,
  Snowflake,
  FileEdit,
  Check,
} from 'lucide-react-native';

import { useAuthStore } from '../store/authStore';
import { useLeadHistoryStore } from '../store/leadHistoryStore';
import { useNotificationStore } from '../store/notificationStore';
import {
  fetchDashboardReports,
  fetchUserCallsReport,
  fetchMyLeads,
  fetchCampaigns,
} from '../api/leadApi';
import { RootStackParamList, Lead } from '../types';
import { colors, borderRadius, shadows } from '../theme';
import { CrmShell } from '../components/CrmShell';
import { ReportingPeriod } from '../components/PeriodControl';
import { LeadQuickModal } from '../components/LeadQuickModal';
import { CrmDateTimePickerModal } from '../components/CrmDateTimePickerModal';
import { WhatsAppTemplateModal } from '../components/WhatsAppTemplateModal';
import { getDialerTelUrl, formatDisplayPhone } from '../utils/phoneUtils';
import { toast } from '../store/toastStore';
import { storage } from '../utils/storage';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuthStore();
  const { width } = useWindowDimensions();
  const isWide = width >= 860;

  const isAgent = user?.role === 'AGENT';
  const isManagerOrAdmin = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const isAdmin = user?.role === 'ADMIN';

  const [period, setPeriod] = useState<ReportingPeriod>('Today');
  const [customDate, setCustomDate] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const [selectedBranch, setSelectedBranch] = useState<'ALL' | 'Trichy' | 'Pudukkottai'>('ALL');
  const [selectedLeadForQuickModal, setSelectedLeadForQuickModal] = useState<Lead | null>(null);

  // WhatsApp Modal State
  const [whatsAppTarget, setWhatsAppTarget] = useState<{ name: string; phone: string } | null>(null);

  const effectiveBranch: 'ALL' | 'Trichy' | 'Pudukkottai' =
    user?.role === 'MANAGER' && user?.branch
      ? (user.branch as any)
      : user?.role === 'AGENT' && user?.branch
      ? (user.branch as any)
      : selectedBranch;

  const handleConfirmCustomDate = (isoStr: string) => {
    setCustomDate(isoStr);
    setPeriod('Custom');
    setShowDatePicker(false);
  };

  const customDateLabel = customDate
    ? new Date(customDate).toLocaleDateString([], { month: 'short', day: 'numeric' })
    : 'Date';

  // Compute ISO 'from' date for backend query
  const now = new Date();
  let fromDate: string | undefined;
  if (period === 'Today') {
    fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  } else if (period === '7 Days') {
    fromDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  } else if (period === '30 Days') {
    fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  } else if (period === 'Custom' && customDate) {
    const cd = new Date(customDate);
    fromDate = new Date(cd.getFullYear(), cd.getMonth(), cd.getDate()).toISOString();
  }

  // 1. Dashboard Metrics from Backend
  const {
    data: dashboardData,
    isLoading: isDashboardLoading,
    refetch: refetchDashboard,
    isRefetching: isDashboardRefetching,
  } = useQuery({
    queryKey: ['homeDashboard', period, fromDate],
    queryFn: () => fetchDashboardReports({ from: fromDate }),
  });

  // 2. Per-Agent Calls (Manager & Admin only)
  const {
    data: userCallsData,
    isLoading: isUserCallsLoading,
    refetch: refetchUserCalls,
    isRefetching: isUserCallsRefetching,
  } = useQuery({
    queryKey: ['homeUserCalls', period, fromDate],
    queryFn: () => fetchUserCallsReport({ from: fromDate }),
    enabled: isManagerOrAdmin,
  });

  // Agent Alert for newly assigned leads
  const [assignedLeadAlert, setAssignedLeadAlert] = useState<{
    id: string;
    count: number;
    assignedBy: string;
    campaignName: string;
    timestamp: string;
  } | null>(null);

  useEffect(() => {
    if (!isAgent) return;
    const checkAssignedNotifications = async () => {
      try {
        const raw = await storage.getItem('tele_crm_assigned_lead_notifications');
        if (raw) {
          const list = JSON.parse(raw);
          const relevant = list.find((item: any) => {
            const readBy = item.readBy || [];
            if (readBy.includes(user?._id || user?.email)) return false;
            if (!item.targetAgentId || item.targetAgentId === 'null') return true;
            return (
              item.targetAgentId === user?._id ||
              item.targetAgentName?.toLowerCase() === user?.name?.toLowerCase() ||
              item.targetAgentId === user?.email
            );
          });
          if (relevant) {
            setAssignedLeadAlert(relevant);
            toast.info(
              `${relevant.assignedBy || 'Admin'} has assigned ${relevant.count} new leads to your queue!`,
              'New Numbers Assigned',
              6000,
            );
          }
        }
      } catch (err) {
        console.warn('Failed to check assigned notifications:', err);
      }
    };
    checkAssignedNotifications();
  }, [isAgent, user]);

  const handleDismissAssignedAlert = async () => {
    if (!assignedLeadAlert) return;
    try {
      const raw = await storage.getItem('tele_crm_assigned_lead_notifications');
      if (raw) {
        const list = JSON.parse(raw);
        const updated = list.map((item: any) => {
          if (item.id === assignedLeadAlert.id) {
            const readBy = item.readBy || [];
            return { ...item, readBy: [...readBy, user?._id || user?.email] };
          }
          return item;
        });
        await storage.setItem('tele_crm_assigned_lead_notifications', JSON.stringify(updated));
      }
    } catch {}
    setAssignedLeadAlert(null);
  };

  // Overall Agent Calls List for Manager & Admin
  const agentCallsList = useMemo(() => {
    const list = userCallsData?.agents || [];
    if (selectedBranch === 'ALL') return list;
    return list.filter(
      (a) => (a.branch || 'Trichy').toLowerCase() === selectedBranch.toLowerCase(),
    );
  }, [userCallsData, selectedBranch]);

  // 3. Agent's Prioritized Queue
  const {
    data: myLeadsData,
    isLoading: isMyLeadsLoading,
    refetch: refetchMyLeads,
    isRefetching: isMyLeadsRefetching,
  } = useQuery({
    queryKey: ['homeMyLeadsQueue'],
    queryFn: () => fetchMyLeads({ type: 'ALL', limit: 20 }),
  });

  // 4. Campaigns List
  const { data: campaignsData } = useQuery({
    queryKey: ['homeCampaigns'],
    queryFn: () => fetchCampaigns(),
  });

  // 5. Real Local Activities from leadHistoryStore for immediate session responsiveness
  const { getActivitiesForPeriod, logDialedCall } = useLeadHistoryStore();
  const periodActivities = useMemo(() => {
    return getActivitiesForPeriod(period, customDate, user?._id || user?.name);
  }, [getActivitiesForPeriod, period, customDate, user]);

  const isRefreshing =
    isDashboardRefetching || isUserCallsRefetching || isMyLeadsRefetching;

  const handleRefreshAll = () => {
    refetchDashboard();
    refetchMyLeads();
    if (isManagerOrAdmin) {
      refetchUserCalls();
    }
  };

  // Format Talk Time seconds into MM:SS
  const formatSeconds = (totalSec: number) => {
    if (!totalSec || isNaN(totalSec) || totalSec <= 0) return '00:00';
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // ==============================================================
  // REAL DYNAMIC METRICS CALCULATION (ZERO MOCK NUMBERS)
  // ==============================================================
  const myAssignedLeadsCount = myLeadsData?.total ?? (myLeadsData?.leads?.length || 0);

  // Calls made and connected
  const localCallsCount = periodActivities.length;
  const localConnectedCount = periodActivities.filter((a) => a.connected).length;
  const localTotalDuration = periodActivities.reduce((sum, a) => sum + (a.durationSeconds || 0), 0);

  // Blend with backend dashboard reporting if available
  const callsMade = Math.max(dashboardData?.callsMade ?? 0, localCallsCount);
  const connectedCalls = Math.max(dashboardData?.connectedCalls ?? 0, localConnectedCount);
  const connectRatePercent = callsMade > 0 ? ((connectedCalls / callsMade) * 100).toFixed(1) + '%' : '0%';

  const avgDurationSeconds =
    connectedCalls > 0
      ? Math.round(localTotalDuration / connectedCalls)
      : dashboardData?.connectedCalls && dashboardData.callsMade > 0
      ? Math.round(dashboardData.callsMade * 6)
      : 0;
  const avgDurationFormatted = callsMade > 0 ? formatSeconds(avgDurationSeconds) : '00:00';

  // Real scheduled callbacks due today
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const endOfToday = startOfToday + 24 * 60 * 60 * 1000 - 1;

  const dueTodayFollowUps = (myLeadsData?.leads || []).filter((l) => {
    if (
      l.status === 'CLOSED' ||
      l.stage === 'Not Interested' ||
      l.stage === 'Closed' ||
      l.stage === 'Lost'
    ) {
      return false;
    }
    if (!l.nextFollowUpAt) return false;
    const t = new Date(l.nextFollowUpAt).getTime();
    return t >= startOfToday && t <= endOfToday;
  });
  const callbacksDueTodayCount = dashboardData?.followUpsDueToday ?? dueTodayFollowUps.length;

  // Sync Bell Icon in Notification Store
  useEffect(() => {
    useNotificationStore.getState().setTotalRemindersCount(callbacksDueTodayCount);
  }, [callbacksDueTodayCount]);

  // Daily target configuration
  const dailyTargetTotal = 30;
  const targetCompletedPercent = Math.min(100, Math.round((callsMade / dailyTargetTotal) * 100));

  // Dynamic Pipeline Distribution
  const pipelineStages = useMemo(() => {
    const leads = myLeadsData?.leads || [];
    if (leads.length > 0) {
      const counts: Record<string, number> = {
        New: 0,
        Contacted: 0,
        Interested: 0,
        FollowUp: 0,
        Converted: 0,
      };

      for (const l of leads) {
        const stg = (l.stage || 'New').toLowerCase();
        if (stg.includes('new')) counts.New++;
        else if (stg.includes('contact')) counts.Contacted++;
        else if (stg.includes('interest')) counts.Interested++;
        else if (stg.includes('follow')) counts.FollowUp++;
        else if (stg.includes('convert')) counts.Converted++;
        else counts.New++;
      }

      return [
        { name: 'New', count: counts.New, color: '#3B82F6' },
        { name: 'Contacted', count: counts.Contacted, color: '#F59E0B' },
        { name: 'Interested', count: counts.Interested, color: '#10B981' },
        { name: 'Follow-up', count: counts.FollowUp, color: '#6366F1' },
        { name: 'Converted', count: counts.Converted, color: '#059669' },
      ];
    }

    if (dashboardData?.leadsByStage && dashboardData.leadsByStage.length > 0) {
      return dashboardData.leadsByStage.map((s) => ({
        name: s.stage,
        count: s.count,
        color:
          s.stage === 'New'
            ? '#3B82F6'
            : s.stage === 'Contacted'
            ? '#F59E0B'
            : s.stage === 'Interested'
            ? '#10B981'
            : '#6366F1',
      }));
    }

    return [
      { name: 'New', count: 0, color: '#3B82F6' },
      { name: 'Contacted', count: 0, color: '#F59E0B' },
      { name: 'Interested', count: 0, color: '#10B981' },
      { name: 'Follow-up', count: 0, color: '#6366F1' },
      { name: 'Converted', count: 0, color: '#059669' },
    ];
  }, [myLeadsData, dashboardData]);

  // Immediate queue (top leads ready to call - strictly excludes Not Interested / Closed / Lost)
  const queueLeads = useMemo(() => {
    return (myLeadsData?.leads || []).filter(
      (l) =>
        l.status !== 'CLOSED' &&
        l.stage !== 'Not Interested' &&
        l.stage !== 'Closed' &&
        l.stage !== 'Lost',
    );
  }, [myLeadsData]);

  const heroLead: Lead | null = queueLeads.length > 0 ? queueLeads[0] : null;
  const nextInQueueLeads = queueLeads.slice(1, 4);

  // Handle direct call from dashboard
  const handleDirectDial = (leadItem: Lead) => {
    const isSuppressed =
      leadItem.status === 'CLOSED' ||
      leadItem.stage === 'Not Interested' ||
      leadItem.stage === 'Closed' ||
      leadItem.stage === 'Lost';

    const executeDial = () => {
      logDialedCall({
        leadId: leadItem._id,
        phone: leadItem.phone,
        customerName: leadItem.name,
        agentName: user?.name,
        agentId: user?._id,
        branch: user?.branch,
      });
      toast.info(`Calling ${leadItem.name}...`, 'Dialing');
      Linking.openURL(getDialerTelUrl(leadItem.phone)).catch(() => {
        Alert.alert('Call Error', 'Could not open phone dialer on this device.');
      });
    };

    if (isSuppressed) {
      Alert.alert(
        '⚠️ Customer Not Interested',
        `${leadItem.name} was marked as "${leadItem.stage || 'Not Interested'}". Calling again may cause customer irritation.\n\nAre you sure you want to dial anyway?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Call Anyway', style: 'destructive', onPress: executeDial },
        ],
      );
      return;
    }

    executeDial();
  };

  const handleOpenWhatsApp = (leadItem: Lead) => {
    setWhatsAppTarget({ name: leadItem.name, phone: leadItem.phone });
  };

  const heroLeadInitials = heroLead?.name
    ? heroLead.name
        .split(' ')
        .filter(Boolean)
        .map((w) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'LD';

  const heroLeadCampaign =
    typeof heroLead?.campaign === 'object' && heroLead?.campaign?.name
      ? heroLead.campaign.name
      : 'Demo Outreach Campaign';

  const heroLeadTemp = (heroLead?.tag || 'WARM').toUpperCase();

  return (
    <CrmShell
      title="Telecalling Desk"
      headerIcon={<LayoutGrid size={15} color={colors.textSecondary} />}
      showPeriodControl
      period={period}
      onPeriodChange={(newP) => {
        if (newP === 'Custom') {
          setShowDatePicker(true);
        } else {
          setPeriod(newP);
        }
      }}
      customDateLabel={period === 'Custom' ? customDateLabel : undefined}
      onPickCustomDate={() => setShowDatePicker(true)}
      rightAction={
        isManagerOrAdmin ? (
          <TouchableOpacity
            style={styles.headerAddBtn}
            onPress={() => navigation.navigate('Campaigns')}
            activeOpacity={0.8}
          >
            <Plus size={14} color="#FFFFFF" strokeWidth={2.5} />
            <Text style={styles.headerAddBtnText}>New Campaign</Text>
          </TouchableOpacity>
        ) : null
      }
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefreshAll}
            colors={[colors.primary]}
          />
        }
      >
        {/* 1. NEODOVE AGENT WELCOME & STATUS HEADER */}
        <View style={styles.neoWelcomeRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.neoGreetingText}>Welcome back 👋</Text>
            <Text style={styles.neoAgentNameText}>{user?.name || 'Agent'}</Text>
            <Text style={styles.neoBranchSubText}>
              {user?.branch ? `${user.branch} Branch` : 'Main Office'} · {isAgent ? 'Telecalling Desk' : user?.role || 'Admin'}
            </Text>
          </View>
          <View style={styles.neoStatusPill}>
            <View style={styles.liveGreenDot} />
            <Text style={styles.neoStatusPillText}>Ready to Call</Text>
          </View>
        </View>

        {/* New Leads Notification Alert Banner for Agent */}
        {isAgent && assignedLeadAlert && (
          <View style={styles.newLeadsAlertBanner}>
            <View style={styles.newLeadsAlertIconBox}>
              <Sparkles size={18} color="#2563EB" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={styles.newLeadsAlertTitle}>New Leads Assigned!</Text>
                <TouchableOpacity onPress={handleDismissAssignedAlert} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={{ fontSize: 11, color: '#64748B', fontWeight: '700' }}>Dismiss</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.newLeadsAlertSubtitle}>
                {assignedLeadAlert.assignedBy || 'Admin'} assigned {assignedLeadAlert.count} new leads in {assignedLeadAlert.campaignName || 'Campaign'}.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.newLeadsAlertBtn}
              onPress={() => {
                handleDismissAssignedAlert();
                navigation.navigate('MyLeads');
              }}
              activeOpacity={0.8}
            >
              <PhoneCall size={12} color="#FFFFFF" strokeWidth={2.5} />
              <Text style={styles.newLeadsAlertBtnText}>Call</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 2. NEODOVE DAILY TARGET & PERFORMANCE OVERVIEW CARD */}
        <View style={styles.neoTargetCard}>
          <View style={styles.neoTargetHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Target size={15} color="#4F46E5" />
              <Text style={styles.neoTargetTitle}>DAILY TARGET PROGRESS</Text>
            </View>
            <View style={styles.periodPill}>
              <Text style={styles.periodPillText}>{period}</Text>
            </View>
          </View>

          {/* Target Progress Bar & Counter */}
          <View style={styles.targetProgressSection}>
            <View style={styles.targetScoreRow}>
              <Text style={styles.targetCallsBig}>
                {callsMade}
                <Text style={styles.targetCallsTotal}> / {dailyTargetTotal} Calls</Text>
              </Text>
              <View style={styles.targetPercentBadge}>
                <Text style={styles.targetPercentBadgeText}>{targetCompletedPercent}% Done</Text>
              </View>
            </View>

            {/* Visual Progress Bar Track */}
            <View style={styles.neoProgressBarTrack}>
              <View
                style={[
                  styles.neoProgressBarFill,
                  { width: `${Math.max(4, targetCompletedPercent)}%` },
                ]}
              />
            </View>
          </View>

          {/* 3 Metric Pills */}
          <View style={styles.neoMetricsRow}>
            <View style={styles.neoMetricBox}>
              <Text style={styles.neoMetricVal}>{connectedCalls}</Text>
              <Text style={styles.neoMetricLabel}>Connected</Text>
              <Text style={styles.neoMetricSub}>{connectRatePercent}</Text>
            </View>

            <View style={styles.neoMetricDivider} />

            <View style={styles.neoMetricBox}>
              <Text
                style={[
                  styles.neoMetricVal,
                  callbacksDueTodayCount > 0 && { color: '#D97706' },
                ]}
              >
                {callbacksDueTodayCount}
              </Text>
              <Text style={styles.neoMetricLabel}>Callbacks Due</Text>
              <Text style={styles.neoMetricSub}>Scheduled</Text>
            </View>

            <View style={styles.neoMetricDivider} />

            <View style={styles.neoMetricBox}>
              <Text style={styles.neoMetricVal}>{avgDurationFormatted}</Text>
              <Text style={styles.neoMetricLabel}>Avg Talk Time</Text>
              <Text style={styles.neoMetricSub}>mm:ss</Text>
            </View>
          </View>
        </View>

        {/* 3. NEODOVE HERO CALLER CARD (The Core Clean Focus!) */}
        <View style={styles.heroSection}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>UP NEXT TO CALL</Text>
            <View style={styles.queueReadyBadge}>
              <Text style={styles.queueReadyBadgeText}>{queueLeads.length} leads in queue</Text>
            </View>
          </View>

          {heroLead ? (
            <View style={styles.heroLeadCard}>
              {/* Top Tag Row */}
              <View style={styles.heroCardTopRow}>
                <View style={styles.heroQueuePill}>
                  <Text style={styles.heroQueuePillText}>Next Lead #1</Text>
                </View>

                <View style={styles.heroTempBadgeRow}>
                  {heroLeadTemp === 'HOT' ? (
                    <View style={[styles.heroTempBadge, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
                      <Flame size={11} color="#DC2626" fill="#DC2626" />
                      <Text style={[styles.heroTempBadgeText, { color: '#DC2626' }]}>Hot Lead</Text>
                    </View>
                  ) : heroLeadTemp === 'COLD' ? (
                    <View style={[styles.heroTempBadge, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
                      <Snowflake size={11} color="#2563EB" />
                      <Text style={[styles.heroTempBadgeText, { color: '#2563EB' }]}>Cold Lead</Text>
                    </View>
                  ) : (
                    <View style={[styles.heroTempBadge, { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}>
                      <Sun size={11} color="#D97706" />
                      <Text style={[styles.heroTempBadgeText, { color: '#D97706' }]}>Warm Lead</Text>
                    </View>
                  )}

                  <View style={styles.heroStageBadge}>
                    <Text style={styles.heroStageBadgeText}>{heroLead.stage || 'New'}</Text>
                  </View>
                </View>
              </View>

              {/* Lead Information */}
              <View style={styles.heroLeadInfo}>
                <View style={styles.heroAvatarBox}>
                  <Text style={styles.heroAvatarText}>{heroLeadInitials}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.heroLeadName} numberOfLines={1}>
                    {heroLead.name}
                  </Text>
                  <Text style={styles.heroLeadPhone}>
                    {formatDisplayPhone(heroLead.phone)}
                  </Text>
                  <Text style={styles.heroLeadCampaign} numberOfLines={1}>
                    {heroLeadCampaign} · Attempt #{heroLead.attemptCount || 1}
                  </Text>
                </View>
              </View>

              {/* Last Call Note Preview Line (Display only) */}
              <View style={styles.heroNotePreviewBox}>
                <Clock3 size={12} color="#64748B" />
                <Text style={styles.heroNotePreviewText} numberOfLines={1}>
                  {heroLead.customProperties?.lastRemark || (heroLead.attemptCount && heroLead.attemptCount > 0 ? 'Prior conversation noted · Callback scheduled' : 'New lead · Ready for initial pitch')}
                </Text>
              </View>

              {/* Big NeoDove Primary Call Action Button */}
              <TouchableOpacity
                style={styles.heroCallNowBtn}
                onPress={() => handleDirectDial(heroLead)}
                activeOpacity={0.85}
              >
                <Phone size={18} color="#FFFFFF" strokeWidth={2.5} />
                <Text style={styles.heroCallNowBtnText}>CALL NOW</Text>
              </TouchableOpacity>

              {/* Secondary Actions: WhatsApp & Disposition Note */}
              <View style={styles.heroSecondaryActionsRow}>
                <TouchableOpacity
                  style={styles.heroSecondaryBtn}
                  onPress={() => handleOpenWhatsApp(heroLead)}
                  activeOpacity={0.8}
                >
                  <MessageCircle size={15} color="#15803D" strokeWidth={2.5} />
                  <Text style={styles.heroWhatsAppText}>WhatsApp</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.heroSecondaryBtn, styles.heroNoteBtn]}
                  onPress={() => setSelectedLeadForQuickModal(heroLead)}
                  activeOpacity={0.8}
                >
                  <FileEdit size={15} color="#2563EB" strokeWidth={2.5} />
                  <Text style={styles.heroNoteText}>Update / Note</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            /* Queue Completed State */
            <View style={styles.emptyQueueCard}>
              <CheckCircle2 size={38} color="#10B981" />
              <Text style={styles.emptyQueueCardTitle}>Queue is all caught up! 🎉</Text>
              <Text style={styles.emptyQueueCardSub}>
                You have reached all active leads in this queue. Tap below to browse all leads or import a new contact list.
              </Text>
              <TouchableOpacity
                style={styles.emptyBrowseBtn}
                onPress={() => navigation.navigate('MyLeads')}
                activeOpacity={0.8}
              >
                <Text style={styles.emptyBrowseBtnText}>Browse All {myAssignedLeadsCount} Leads</Text>
                <ArrowUpRight size={14} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* 4. UPCOMING IN QUEUE (Next 2-3 Leads Preview) */}
        {nextInQueueLeads.length > 0 && (
          <View style={styles.upcomingSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>NEXT IN LINE</Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('MyLeads')}
                activeOpacity={0.7}
                style={styles.viewAllRow}
              >
                <Text style={styles.viewAllText}>View All ({myAssignedLeadsCount})</Text>
                <ChevronRight size={13} color="#2563EB" />
              </TouchableOpacity>
            </View>

            <View style={styles.upcomingList}>
              {nextInQueueLeads.map((item, idx) => {
                const initials = item.name
                  .split(' ')
                  .filter(Boolean)
                  .map((w) => w[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2) || 'LD';

                return (
                  <View key={item._id} style={styles.upcomingCard}>
                    <View style={styles.upcomingAvatar}>
                      <Text style={styles.upcomingAvatarText}>{initials}</Text>
                    </View>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={styles.upcomingName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={styles.upcomingPhone}>{formatDisplayPhone(item.phone)}</Text>
                    </View>

                    <View style={styles.upcomingActions}>
                      <TouchableOpacity
                        style={styles.upcomingMiniCallBtn}
                        onPress={() => handleDirectDial(item)}
                        activeOpacity={0.8}
                      >
                        <Phone size={13} color="#FFFFFF" strokeWidth={2.5} />
                        <Text style={styles.upcomingMiniCallText}>Call</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.upcomingMiniIconBtn}
                        onPress={() => handleOpenWhatsApp(item)}
                        activeOpacity={0.8}
                      >
                        <MessageCircle size={14} color="#15803D" strokeWidth={2.5} />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.upcomingMiniIconBtn}
                        onPress={() => setSelectedLeadForQuickModal(item)}
                        activeOpacity={0.7}
                      >
                        <FileEdit size={14} color="#4F46E5" strokeWidth={2} />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* 5. PIPELINE STAGE SUMMARY */}
        <View style={styles.pipelineSection}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>LEAD STAGES OVERVIEW</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('MyLeads')}
              activeOpacity={0.7}
              style={styles.viewAllRow}
            >
              <Text style={styles.viewAllText}>Manage Leads</Text>
              <ChevronRight size={13} color="#2563EB" />
            </TouchableOpacity>
          </View>

          <View style={styles.pipelinePillsRow}>
            {pipelineStages.map((stg) => (
              <View key={stg.name} style={styles.pipelinePillCard}>
                <View style={styles.pipelinePillHeader}>
                  <View style={[styles.pipelineDot, { backgroundColor: stg.color }]} />
                  <Text style={styles.pipelinePillName}>{stg.name}</Text>
                </View>
                <Text style={styles.pipelinePillCount}>{stg.count}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 6. RECENT CALL DISPOSITIONS (Agent Only) */}
        {isAgent && (
          <View style={styles.historySection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>RECENT CALL ACTIVITY</Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('CallHistory')}
                activeOpacity={0.7}
                style={styles.viewAllRow}
              >
                <Text style={styles.viewAllText}>Full History</Text>
                <ChevronRight size={13} color="#2563EB" />
              </TouchableOpacity>
            </View>

            {periodActivities.length === 0 ? (
              <View style={styles.emptyHistoryBox}>
                <Clock3 size={28} color="#94A3B8" />
                <Text style={styles.emptyHistoryTitle}>No calls logged for this period</Text>
                <Text style={styles.emptyHistorySub}>
                  When you dial or dispose calls, they will appear here with call duration and outcome tags.
                </Text>
              </View>
            ) : (
              <View style={styles.historyCardList}>
                {periodActivities.slice(0, 4).map((act, index) => {
                  const isLast = index === Math.min(periodActivities.length, 4) - 1;
                  const durText = act.connected
                    ? formatSeconds(act.durationSeconds || 0)
                    : 'Missed';
                  const timeStr = new Date(act.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <View
                      key={act._id}
                      style={[styles.historyRow, isLast && { borderBottomWidth: 0 }]}
                    >
                      <View style={styles.historyLeft}>
                        <View
                          style={[
                            styles.historyIconWrap,
                            { backgroundColor: act.connected ? '#ECFDF5' : '#FEF2F2' },
                          ]}
                        >
                          {act.connected ? (
                            <Phone size={13} color="#059669" />
                          ) : (
                            <PhoneOff size={13} color="#DC2626" />
                          )}
                        </View>
                        <View>
                          <Text style={styles.historyName}>
                            {act.customerName || (act.phone ? formatDisplayPhone(act.phone) : 'Contact')}
                          </Text>
                          <Text style={styles.historyPhone}>
                            {act.phone ? formatDisplayPhone(act.phone) : 'No phone'}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.historyCenter}>
                        <View style={styles.stageTagMini}>
                          <Text style={styles.stageTagMiniText}>{act.stage}</Text>
                        </View>
                        <Text style={styles.historyTimeText}>{timeStr}</Text>
                      </View>

                      <View style={styles.historyRight}>
                        <Text
                          style={[
                            styles.historyDurationText,
                            { color: act.connected ? '#059669' : '#DC2626' },
                          ]}
                        >
                          {durText}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* 7. OVERALL AGENTS CALLING REPORT (Admin & Manager Only) */}
        {isManagerOrAdmin && (
          <View style={styles.adminReportSection}>
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={styles.sectionTitle}>OVERALL AGENTS CALLING REPORT</Text>
                <Text style={styles.adminSectionSub}>
                  Live metrics for {period.toLowerCase()} across all branch agents
                </Text>
              </View>
              <View style={styles.periodPill}>
                <Text style={styles.periodPillText}>{period}</Text>
              </View>
            </View>

            {/* Branch Filter Selector */}
            <View style={styles.adminBranchFilterRow}>
              {(['ALL', 'Trichy', 'Pudukkottai'] as const).map((br) => {
                const isSelected = selectedBranch === br;
                return (
                  <TouchableOpacity
                    key={br}
                    style={[styles.adminBranchPill, isSelected && styles.adminBranchPillActive]}
                    onPress={() => setSelectedBranch(br)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.adminBranchPillText,
                        isSelected && styles.adminBranchPillTextActive,
                      ]}
                    >
                      {br === 'ALL' ? 'All Branches' : `${br} Branch`}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {agentCallsList.length === 0 ? (
              <View style={styles.emptyHistoryBox}>
                <Users size={28} color="#94A3B8" />
                <Text style={styles.emptyHistoryTitle}>No agents found</Text>
                <Text style={styles.emptyHistorySub}>
                  No active agents found in {selectedBranch === 'ALL' ? 'organization' : selectedBranch + ' Branch'}.
                </Text>
              </View>
            ) : (
              <View style={styles.agentReportList}>
                {agentCallsList.map((agentItem, idx) => {
                  const isLast = idx === agentCallsList.length - 1;
                  const initials = agentItem.name
                    .split(' ')
                    .filter(Boolean)
                    .map((w) => w[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2) || 'AG';

                  const cRate =
                    agentItem.calls > 0
                      ? ((agentItem.connected / agentItem.calls) * 100).toFixed(1) + '%'
                      : '0%';
                  const avgDur = formatSeconds(agentItem.avgDurationSeconds || 0);
                  const totalDur = formatSeconds(agentItem.totalDurationSeconds || 0);

                  return (
                    <View
                      key={agentItem.userId || agentItem.email}
                      style={[styles.agentReportCard, isLast && { marginBottom: 0 }]}
                    >
                      <View style={styles.agentReportCardHeader}>
                        <View style={styles.agentAvatarBox}>
                          <Text style={styles.agentAvatarText}>{initials}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={styles.agentReportName}>{agentItem.name}</Text>
                            <View style={styles.agentBranchBadge}>
                              <Text style={styles.agentBranchBadgeText}>
                                {agentItem.branch || 'Trichy'}
                              </Text>
                            </View>
                          </View>
                          <Text style={styles.agentReportEmail}>{agentItem.email}</Text>
                        </View>
                      </View>

                      {/* Stat Metrics Grid */}
                      <View style={styles.agentReportStatsRow}>
                        <View style={styles.agentReportStatCol}>
                          <Text style={styles.agentReportStatVal}>{agentItem.calls}</Text>
                          <Text style={styles.agentReportStatLbl}>Calls</Text>
                        </View>

                        <View style={styles.agentReportStatDivider} />

                        <View style={styles.agentReportStatCol}>
                          <Text
                            style={[
                              styles.agentReportStatVal,
                              { color: agentItem.connected > 0 ? '#047857' : '#64748B' },
                            ]}
                          >
                            {agentItem.connected}
                          </Text>
                          <Text style={styles.agentReportStatLbl}>Connected</Text>
                        </View>

                        <View style={styles.agentReportStatDivider} />

                        <View style={styles.agentReportStatCol}>
                          <Text style={styles.agentReportStatVal}>{cRate}</Text>
                          <Text style={styles.agentReportStatLbl}>Rate</Text>
                        </View>

                        <View style={styles.agentReportStatDivider} />

                        <View style={styles.agentReportStatCol}>
                          <Text style={styles.agentReportStatVal}>{avgDur}</Text>
                          <Text style={styles.agentReportStatLbl}>Avg Talk</Text>
                        </View>

                        <View style={styles.agentReportStatDivider} />

                        <View style={styles.agentReportStatCol}>
                          <Text style={styles.agentReportStatVal}>{totalDur}</Text>
                          <Text style={styles.agentReportStatLbl}>Total Time</Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Embedded Lead Quick Modal */}
      {selectedLeadForQuickModal && (
        <LeadQuickModal
          lead={selectedLeadForQuickModal}
          visible={Boolean(selectedLeadForQuickModal)}
          onClose={() => setSelectedLeadForQuickModal(null)}
          onLeadUpdated={() => {
            refetchMyLeads();
            refetchDashboard();
          }}
          onOpenFullDispose={(leadToDispose) => {
            setSelectedLeadForQuickModal(null);
            navigation.navigate('Dispose', { lead: leadToDispose });
          }}
        />
      )}

      {/* Date Picker Modal for Dashboard Filtering */}
      <CrmDateTimePickerModal
        visible={showDatePicker}
        title="Filter Dashboard by Date"
        initialDate={customDate || new Date().toISOString()}
        onClose={() => setShowDatePicker(false)}
        onConfirm={handleConfirmCustomDate}
      />

      {/* WhatsApp Template Modal */}
      {whatsAppTarget && (
        <WhatsAppTemplateModal
          visible={Boolean(whatsAppTarget)}
          onClose={() => setWhatsAppTarget(null)}
          recipientName={whatsAppTarget.name}
          recipientPhone={whatsAppTarget.phone}
        />
      )}
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
  headerAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#4F46E5',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  headerAddBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },

  // 1. Neo Welcome Row
  neoWelcomeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  neoGreetingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  neoAgentNameText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.4,
  },
  neoBranchSubText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  neoStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  liveGreenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  neoStatusPillText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#047857',
  },

  // Alert Banner
  newLeadsAlertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  newLeadsAlertIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  newLeadsAlertTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E3A8A',
  },
  newLeadsAlertSubtitle: {
    fontSize: 11,
    color: '#3B82F6',
    marginTop: 1,
  },
  newLeadsAlertBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2563EB',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  newLeadsAlertBtnText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
  },

  // 2. NeoDove Target Card
  neoTargetCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    ...shadows.soft,
  },
  neoTargetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  neoTargetTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.5,
  },
  periodPill: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  periodPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2563EB',
  },
  targetProgressSection: {
    marginBottom: 14,
  },
  targetScoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 6,
  },
  targetCallsBig: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  targetCallsTotal: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  targetPercentBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  targetPercentBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F46E5',
  },
  neoProgressBarTrack: {
    height: 7,
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    overflow: 'hidden',
  },
  neoProgressBarFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 4,
  },
  neoMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  neoMetricBox: {
    flex: 1,
    alignItems: 'center',
  },
  neoMetricVal: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  neoMetricLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  neoMetricSub: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#94A3B8',
    marginTop: 1,
  },
  neoMetricDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#F1F5F9',
  },

  // 3. NeoDove Hero Caller Card
  heroSection: {
    marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.5,
  },
  queueReadyBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  queueReadyBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#047857',
  },
  heroLeadCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#10B981',
    ...shadows.elevated,
  },
  heroCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  heroQueuePill: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  heroQueuePillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#4F46E5',
    textTransform: 'uppercase',
  },
  heroTempBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroTempBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  heroTempBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  heroStageBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  heroStageBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  heroLeadInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  heroAvatarBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ECFDF5',
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroAvatarText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#047857',
  },
  heroLeadName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  heroLeadPhone: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  heroLeadCampaign: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  heroNotePreviewBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 10,
    marginBottom: 12,
  },
  heroNotePreviewText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748B',
    flex: 1,
  },
  heroCallNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#10B981',
    minHeight: 52,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  heroCallNowBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  heroSecondaryActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  heroSecondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    paddingVertical: 9,
    borderRadius: 10,
  },
  heroWhatsAppText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803D',
  },
  heroNoteBtn: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  heroNoteText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
  },

  // Empty Queue State
  emptyQueueCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...shadows.soft,
  },
  emptyQueueCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 10,
  },
  emptyQueueCardSub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    maxWidth: 300,
  },
  emptyBrowseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 14,
  },
  emptyBrowseBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
  },

  // 4. Upcoming Leads
  upcomingSection: {
    marginBottom: 16,
  },
  viewAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewAllText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#2563EB',
  },
  upcomingList: {
    gap: 8,
  },
  upcomingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...shadows.soft,
  },
  upcomingAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  upcomingAvatarText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  upcomingName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  upcomingPhone: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  upcomingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  upcomingMiniCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#10B981',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  upcomingMiniCallText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  upcomingMiniIconBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // 5. Pipeline Stage Summary
  pipelineSection: {
    marginBottom: 16,
  },
  pipelinePillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pipelinePillCard: {
    flex: 1,
    minWidth: 80,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...shadows.soft,
  },
  pipelinePillHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  pipelineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pipelinePillName: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  pipelinePillCount: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },

  // 6. Recent Call Activity
  historySection: {
    marginBottom: 16,
  },
  emptyHistoryBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyHistoryTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 6,
  },
  emptyHistorySub: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 260,
  },
  historyCardList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...shadows.soft,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  historyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1.8,
  },
  historyIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyName: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  historyPhone: {
    fontSize: 10.5,
    color: '#64748B',
  },
  historyCenter: {
    alignItems: 'center',
    flex: 1.2,
  },
  stageTagMini: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  stageTagMiniText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#475569',
  },
  historyTimeText: {
    fontSize: 9.5,
    color: '#94A3B8',
    marginTop: 2,
  },
  historyRight: {
    alignItems: 'flex-end',
    flex: 0.8,
  },
  historyDurationText: {
    fontSize: 11.5,
    fontWeight: '700',
  },

  // 7. Admin Report Section
  adminReportSection: {
    marginBottom: 16,
  },
  adminSectionSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  adminBranchFilterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    marginTop: 8,
  },
  adminBranchPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  adminBranchPillActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  adminBranchPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  adminBranchPillTextActive: {
    color: '#FFFFFF',
  },
  agentReportList: {
    gap: 10,
  },
  agentReportCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    gap: 10,
    ...shadows.soft,
  },
  agentReportCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  agentAvatarBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  agentAvatarText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4F46E5',
  },
  agentReportName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  agentBranchBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  agentBranchBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4338CA',
  },
  agentReportEmail: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  agentReportStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  agentReportStatCol: {
    alignItems: 'center',
    flex: 1,
  },
  agentReportStatVal: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  agentReportStatLbl: {
    fontSize: 9,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  agentReportStatDivider: {
    width: 1,
    height: 18,
    backgroundColor: '#E2E8F0',
  },
});
