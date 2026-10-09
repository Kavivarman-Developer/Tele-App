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
  Megaphone,
  ArrowUpRight,
  ChevronRight,
  PhoneCall,
  UserCheck,
  Plus,
  LayoutGrid,
  MapPin,
  Building2,
  Shield,
  CheckCircle2,
  Calendar,
  MessageCircle,
  TrendingUp,
  Target,
  Sparkles,
  PhoneOff,
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
      ? Math.round((dashboardData.callsMade * 6))
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
        { name: 'New', count: counts.New, color: '#2563EB' },
        { name: 'Contacted', count: counts.Contacted, color: '#F59E0B' },
        { name: 'Interested', count: counts.Interested, color: '#10B981' },
        { name: 'Follow-up', count: counts.FollowUp, color: '#64748B' },
        { name: 'Converted', count: counts.Converted, color: '#059669' },
      ];
    }

    if (dashboardData?.leadsByStage && dashboardData.leadsByStage.length > 0) {
      return dashboardData.leadsByStage.map((s) => ({
        name: s.stage,
        count: s.count,
        color:
          s.stage === 'New'
            ? '#2563EB'
            : s.stage === 'Contacted'
            ? '#F59E0B'
            : s.stage === 'Interested'
            ? '#10B981'
            : '#64748B',
      }));
    }

    return [
      { name: 'New', count: 0, color: '#2563EB' },
      { name: 'Contacted', count: 0, color: '#F59E0B' },
      { name: 'Interested', count: 0, color: '#10B981' },
      { name: 'Follow-up', count: 0, color: '#64748B' },
      { name: 'Converted', count: 0, color: '#059669' },
    ];
  }, [myLeadsData, dashboardData]);

  const maxStageCount = Math.max(...pipelineStages.map((s) => s.count), 1);

  // Immediate queue (top 3 leads ready to call - strictly excludes Not Interested / Closed / Lost)
  const queueLeads = (myLeadsData?.leads || [])
    .filter(
      (l) =>
        l.status !== 'CLOSED' &&
        l.stage !== 'Not Interested' &&
        l.stage !== 'Closed' &&
        l.stage !== 'Lost',
    )
    .slice(0, 3);

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

  return (
    <CrmShell
      title="Dashboard"
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
        {/* 1. AGENT BRANCH OFFICE BANNER */}
        <View style={styles.branchOfficeBanner}>
          <View style={styles.branchOfficeLeft}>
            <View style={styles.branchIconBox}>
              <MapPin size={18} color="#0D9488" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <Text style={styles.branchOfficeTitle}>
                  {user?.branch ? `${user.branch} Branch Office` : 'Global Headquarters'}
                </Text>
                <View style={styles.branchStatusPill}>
                  <View style={styles.liveGreenDot} />
                  <Text style={styles.branchStatusPillText}>Active Office</Text>
                </View>
              </View>
              <Text style={styles.branchOfficeSub}>
                Logged in as <Text style={{ fontWeight: '700', color: '#0F172A' }}>{user?.name || 'Agent'}</Text> ({user?.email}) · {user?.role || 'AGENT'} · {isAgent ? 'Assigned strictly to your calling queue' : `Routing calls for ${user?.branch || 'General'} queue`}
              </Text>
            </View>
          </View>
        </View>

        {/* New Leads Notification Alert Banner for Agent */}
        {isAgent && assignedLeadAlert && (
          <View style={styles.newLeadsAlertBanner}>
            <View style={styles.newLeadsAlertIconBox}>
              <Sparkles size={20} color="#2563EB" />
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
              <PhoneCall size={13} color="#FFFFFF" strokeWidth={2.5} />
              <Text style={styles.newLeadsAlertBtnText}>Call Now</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 2. AGENT TELECALLER DESK (Agent Only) */}
        {isAgent && (
          <View style={styles.agentTelecallerPanel}>
            <View style={styles.agentTelecallerHeaderRow}>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.agentTelecallerTitle}>TELECALLER DESK</Text>
                  <View style={styles.periodPill}>
                    <Text style={styles.periodPillText}>{period}</Text>
                  </View>
                </View>
                <Text style={styles.agentTelecallerSub}>
                  Assigned calling queue for {user?.name || 'Agent'} ({user?.branch || 'General'} Branch)
                </Text>
              </View>
              <View style={styles.agentStatusPill}>
                <View style={styles.liveGreenDot} />
                <Text style={styles.agentStatusPillText}>Ready to Call</Text>
              </View>
            </View>

            {/* Dynamic Calling Targets Row */}
            <View style={styles.agentTargetRow}>
              {/* Daily Target */}
              <View style={styles.agentTargetCol}>
                <Text style={styles.agentTargetLabel}>Daily Target</Text>
                <Text style={styles.agentTargetVal}>
                  {callsMade} / {dailyTargetTotal} Calls
                </Text>
                <View style={styles.progressBarTrack}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${targetCompletedPercent}%` },
                    ]}
                  />
                </View>
                <Text style={styles.agentTargetSub}>
                  {callsMade === 0 ? 'No calls dialed yet today' : `${targetCompletedPercent}% completed today`}
                </Text>
              </View>

              {/* Connected */}
              <View style={styles.agentTargetCol}>
                <Text style={styles.agentTargetLabel}>Connected</Text>
                <Text
                  style={[
                    styles.agentTargetVal,
                    { color: connectedCalls > 0 ? '#047857' : '#64748B' },
                  ]}
                >
                  {connectedCalls} Leads
                </Text>
                <Text style={styles.agentTargetSub}>
                  {callsMade > 0 ? `${connectRatePercent} connect rate` : '0% connect rate'}
                </Text>
              </View>

              {/* Callbacks Due */}
              <View style={styles.agentTargetCol}>
                <Text style={styles.agentTargetLabel}>Callbacks Due</Text>
                <Text
                  style={[
                    styles.agentTargetVal,
                    { color: callbacksDueTodayCount > 0 ? '#D97706' : '#64748B' },
                  ]}
                >
                  {callbacksDueTodayCount} Pending
                </Text>
                <Text style={styles.agentTargetSub}>Scheduled today</Text>
              </View>
            </View>
          </View>
        )}

        {/* 3. Top 4 KPI Metrics Grid */}
        <View style={styles.statsGrid}>
          {/* Card 1: MY LEADS TO CALL / TOTAL LEADS */}
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>{isAgent ? 'MY LEADS TO CALL' : 'TOTAL LEADS'}</Text>
            <View style={styles.statValueRow}>
              <Text style={styles.statValue}>{myAssignedLeadsCount}</Text>
              <View style={styles.statTrendPill}>
                <ArrowUpRight size={10} color="#047857" strokeWidth={3} />
                <Text style={styles.statTrendText}>Ready</Text>
              </View>
            </View>
            <Text style={styles.statSub}>
              {isAgent ? 'Assigned exclusively to you' : 'In organization pipeline'}
            </Text>
          </View>

          {/* Card 2: CONNECT RATE */}
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>{isAgent ? 'MY CONNECT RATE' : 'CONNECT RATE'}</Text>
            <View style={styles.statValueRow}>
              <Text style={styles.statValue}>{connectRatePercent}</Text>
              <View style={styles.statStablePill}>
                <Text style={styles.statStableText}>
                  {connectedCalls} Connected
                </Text>
              </View>
            </View>
            <Text style={styles.statSub}>
              {callsMade > 0
                ? `${connectedCalls} connected out of ${callsMade} dialed`
                : 'Start calling to calculate rate'}
            </Text>
          </View>
        </View>

        <View style={[styles.statsGrid, { marginTop: 12 }]}>
          {/* Card 3: AVG TALK TIME */}
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>{isAgent ? 'MY AVG TALK TIME' : 'AVG TALK TIME'}</Text>
            <View style={styles.statValueRow}>
              <Text style={styles.statValue}>{avgDurationFormatted}</Text>
              <Text style={styles.statUnit}>min/sec</Text>
            </View>
            <Text style={styles.statSub}>
              {callsMade > 0
                ? 'Personal average talk duration'
                : 'No calls completed today'}
            </Text>
          </View>

          {/* Card 4: PENDING FOLLOW-UPS */}
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>
              {isAgent ? 'PENDING FOLLOW-UPS' : 'CALLBACKS DUE'}
            </Text>
            <View style={styles.statValueRow}>
              <Text
                style={[
                  styles.statValue,
                  { color: callbacksDueTodayCount > 0 ? '#D97706' : '#64748B' },
                ]}
              >
                {String(callbacksDueTodayCount).padStart(2, '0')}
              </Text>
              {callbacksDueTodayCount > 0 && (
                <View style={[styles.statTrendPill, { backgroundColor: '#FEF3C7' }]}>
                  <Text style={[styles.statTrendText, { color: '#B45309' }]}>Due</Text>
                </View>
              )}
            </View>
            <Text style={styles.statSub}>Scheduled callbacks due today</Text>
          </View>
        </View>

        {/* 4. PIPELINE DISTRIBUTION (Vertical Bar Chart with Real Values) */}
        <View style={styles.panel}>
          <View style={styles.panelHeaderRow}>
            <View>
              <Text style={styles.panelTitle}>PIPELINE DISTRIBUTION</Text>
              <Text style={styles.panelSubtitle}>
                {isAgent
                  ? 'Your assigned leads across each outreach stage'
                  : 'Leads across each outreach stage'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => navigation.navigate('MyLeads')}
              activeOpacity={0.7}
              style={styles.viewDetailsBtn}
            >
              <Text style={styles.viewDetailsText}>View all leads</Text>
              <ArrowUpRight size={12} color="#2563EB" />
            </TouchableOpacity>
          </View>

          {/* Vertical Column Chart */}
          <View style={styles.barChartContainer}>
            {/* Y Axis Labels */}
            <View style={styles.yAxisCol}>
              <Text style={styles.yAxisText}>{maxStageCount}</Text>
              <Text style={styles.yAxisText}>{Math.round(maxStageCount * 0.75)}</Text>
              <Text style={styles.yAxisText}>{Math.round(maxStageCount * 0.5)}</Text>
              <Text style={styles.yAxisText}>{Math.round(maxStageCount * 0.25)}</Text>
              <Text style={styles.yAxisText}>0</Text>
            </View>

            {/* Bars Area */}
            <View style={styles.barsArea}>
              <View style={[styles.gridLine, { top: '0%' }]} />
              <View style={[styles.gridLine, { top: '25%' }]} />
              <View style={[styles.gridLine, { top: '50%' }]} />
              <View style={[styles.gridLine, { top: '75%' }]} />
              <View style={[styles.gridLine, { top: '100%' }]} />

              {/* Dynamic Columns */}
              <View style={styles.barsColumnsRow}>
                {pipelineStages.map((stage) => {
                  const barHeightPct =
                    stage.count === 0
                      ? '6%'
                      : `${Math.max(12, Math.round((stage.count / maxStageCount) * 85))}%`;

                  return (
                    <View key={stage.name} style={styles.barCol}>
                      <View
                        style={[
                          styles.barFill,
                          {
                            height: barHeightPct as any,
                            backgroundColor: stage.count === 0 ? '#E2E8F0' : stage.color,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.barValueText,
                            stage.count === 0 && { color: '#64748B' },
                          ]}
                        >
                          {stage.count}
                        </Text>
                      </View>
                      <View style={styles.barLegendRow}>
                        <View style={[styles.legendDot, { backgroundColor: stage.color }]} />
                        <Text style={styles.barLegendText} numberOfLines={1}>
                          {stage.name}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>

          {/* Chart Footer */}
          <View style={styles.pipelineFooter}>
            <View style={styles.pipelineFooterLeft}>
              <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
              <Text style={styles.pipelineFooterText}>
                {myAssignedLeadsCount} assigned leads in your pipeline
              </Text>
            </View>
            <Text style={styles.pipelineFooterRight}>Live Status</Text>
          </View>
        </View>

        {/* OVERALL AGENTS CALLING REPORT (Admin & Manager Only) */}
        {isManagerOrAdmin && (
          <View style={styles.panel}>
            <View style={styles.panelHeaderRow}>
              <View>
                <Text style={styles.panelTitle}>OVERALL AGENTS CALLING REPORT</Text>
                <Text style={styles.panelSubtitle}>
                  Real call metrics for {period.toLowerCase()} across all branch agents
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
              <View style={styles.emptyQueueBox}>
                <Users size={32} color="#94A3B8" />
                <Text style={styles.emptyQueueTitle}>No agents found</Text>
                <Text style={styles.emptyQueueSub}>
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
                        <View style={[styles.queueAvatar, { backgroundColor: '#EEF2FF' }]}>
                          <Text style={[styles.queueAvatarText, { color: '#4F46E5' }]}>
                            {initials}
                          </Text>
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

        {/* 5. IMMEDIATE QUEUE (Real Leads from Queue) */}
        <View style={styles.panel}>
          <View style={styles.panelHeaderRow}>
            <View>
              <Text style={styles.panelTitle}>IMMEDIATE CALLING QUEUE</Text>
              <Text style={styles.panelSubtitle}>
                {isAgent ? 'Your prioritized leads ready to call next' : 'Upcoming conversations'}
              </Text>
            </View>
            <View style={styles.queueCountBadge}>
              <Text style={styles.queueCountText}>{queueLeads.length} ready</Text>
            </View>
          </View>

          {queueLeads.length === 0 ? (
            <View style={styles.emptyQueueBox}>
              <CheckCircle2 size={32} color="#10B981" />
              <Text style={styles.emptyQueueTitle}>Calling Queue is Clear</Text>
              <Text style={styles.emptyQueueSub}>
                No immediate leads waiting. Tap below to browse all leads or import new leads.
              </Text>
            </View>
          ) : (
            <View style={styles.queueList}>
              {queueLeads.map((item, idx) => {
                const isLast = idx === queueLeads.length - 1;
                const initials = item.name
                  .split(' ')
                  .filter(Boolean)
                  .map((w) => w[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2) || 'LD';

                return (
                  <View
                    key={item._id}
                    style={[styles.queueRow, isLast && { borderBottomWidth: 0 }]}
                  >
                    <View style={[styles.queueAvatar, { backgroundColor: '#EEF2FF' }]}>
                      <Text style={[styles.queueAvatarText, { color: '#4F46E5' }]}>{initials}</Text>
                    </View>
                    <View style={styles.queueInfo}>
                      <Text style={styles.queueName}>{item.name}</Text>
                      <Text style={styles.queuePhone}>{formatDisplayPhone(item.phone)}</Text>
                    </View>

                    <View style={styles.queueActionsGroup}>
                      <TouchableOpacity
                        style={styles.queueCallBtn}
                        onPress={() => handleDirectDial(item)}
                        activeOpacity={0.8}
                        accessibilityLabel="Dial Lead"
                      >
                        <Phone size={13} color="#FFFFFF" strokeWidth={2.5} />
                        <Text style={styles.queueCallBtnText}>Call</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.queueWhatsAppBtn}
                        onPress={() => handleOpenWhatsApp(item)}
                        activeOpacity={0.8}
                        accessibilityLabel="WhatsApp Lead"
                      >
                        <MessageCircle size={14} color="#15803D" strokeWidth={2.5} />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.queueOpenBtn}
                        onPress={() => setSelectedLeadForQuickModal(item)}
                        activeOpacity={0.7}
                      >
                        <ArrowUpRight size={14} color="#64748B" />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Full-width View all link */}
          <TouchableOpacity
            style={styles.queueFooterBtn}
            onPress={() => navigation.navigate('MyLeads')}
            activeOpacity={0.7}
          >
            <Text style={styles.queueFooterBtnText}>View all {myAssignedLeadsCount} leads ›</Text>
          </TouchableOpacity>
        </View>

        {/* 6. MY RECENT CALL DISPOSITIONS (Real Period Activities) */}
        {isAgent && (
          <View style={styles.panel}>
            <View style={styles.panelHeaderRow}>
              <View>
                <Text style={styles.panelTitle}>MY RECENT CALL DISPOSITIONS</Text>
                <Text style={styles.panelSubtitle}>
                  Calls logged for {period.toLowerCase()} by {user?.name || 'You'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => navigation.navigate('CallHistory')}
                activeOpacity={0.7}
                style={styles.viewDetailsBtn}
              >
                <Text style={styles.viewDetailsText}>Full history</Text>
                <ArrowUpRight size={12} color="#2563EB" />
              </TouchableOpacity>
            </View>

            {periodActivities.length === 0 ? (
              <View style={styles.emptyQueueBox}>
                <Clock3 size={32} color="#94A3B8" />
                <Text style={styles.emptyQueueTitle}>No calls logged for this period</Text>
                <Text style={styles.emptyQueueSub}>
                  When you dial or dispose calls, they will appear here with talk duration and outcome notes.
                </Text>
                <TouchableOpacity
                  style={styles.startDialingBtn}
                  onPress={() => navigation.navigate('MyLeads')}
                  activeOpacity={0.8}
                >
                  <Phone size={13} color="#FFFFFF" strokeWidth={2.5} />
                  <Text style={styles.startDialingBtnText}>Start Dialing from Queue</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.recentCallsList}>
                {periodActivities.slice(0, 5).map((act, index) => {
                  const isLast = index === Math.min(periodActivities.length, 5) - 1;
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
                      style={[styles.callHistoryRow, isLast && { borderBottomWidth: 0 }]}
                    >
                      <View style={styles.callHistoryLeft}>
                        <View
                          style={[
                            styles.callHistoryIconWrap,
                            { backgroundColor: act.connected ? '#ECFDF5' : '#FEF2F2' },
                          ]}
                        >
                          {act.connected ? (
                            <Phone size={12} color="#059669" />
                          ) : (
                            <PhoneOff size={12} color="#DC2626" />
                          )}
                        </View>
                        <View>
                          <Text style={styles.callHistoryName}>
                            {act.customerName || (act.phone ? formatDisplayPhone(act.phone) : 'Contact')}
                          </Text>
                          <Text style={styles.callHistoryPhone}>
                            {act.phone ? formatDisplayPhone(act.phone) : 'No phone'}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.callHistoryCenter}>
                        <View style={styles.stagePillMini}>
                          <Text style={styles.stagePillMiniText}>{act.stage}</Text>
                        </View>
                        <Text style={styles.callHistoryTime}>{timeStr}</Text>
                      </View>

                      <View style={styles.callHistoryRight}>
                        <Text
                          style={[
                            styles.callHistoryDuration,
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
    paddingBottom: 40,
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
  branchOfficeBanner: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
    ...shadows.soft,
  },
  branchOfficeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  branchIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#F0FDFA',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CCFBF1',
  },
  branchOfficeTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  branchStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  liveGreenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  branchStatusPillText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#047857',
  },
  branchOfficeSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 16,
  },
  agentTelecallerPanel: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
    ...shadows.soft,
  },
  agentTelecallerHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    flexWrap: 'wrap',
    gap: 8,
  },
  agentTelecallerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.5,
  },
  periodPill: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  periodPillText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#2563EB',
  },
  agentTelecallerSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  agentStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  agentStatusPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#047857',
  },
  agentTargetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  agentTargetCol: {
    flex: 1,
    minWidth: 95,
  },
  agentTargetLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  agentTargetVal: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  progressBarTrack: {
    height: 5,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    marginTop: 6,
    marginBottom: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#4F46E5',
    borderRadius: 3,
  },
  agentTargetSub: {
    fontSize: 9.5,
    color: '#94A3B8',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...shadows.soft,
  },
  statLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.3,
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: 6,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  statUnit: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  statTrendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  statTrendText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#047857',
  },
  statStablePill: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  statStableText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#2563EB',
  },
  statSub: {
    fontSize: 10,
    color: '#94A3B8',
  },
  panel: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 14,
    ...shadows.soft,
  },
  panelHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 8,
  },
  panelTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.4,
  },
  panelSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  viewDetailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  viewDetailsText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#2563EB',
  },
  barChartContainer: {
    flexDirection: 'row',
    height: 160,
    marginTop: 8,
    marginBottom: 12,
  },
  yAxisCol: {
    width: 32,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 22,
  },
  yAxisText: {
    fontSize: 9,
    color: '#94A3B8',
    fontWeight: '600',
  },
  barsArea: {
    flex: 1,
    position: 'relative',
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#F1F5F9',
  },
  barsColumnsRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    paddingBottom: 22,
  },
  barCol: {
    alignItems: 'center',
    width: 48,
    height: '100%',
    justifyContent: 'flex-end',
  },
  barFill: {
    width: 24,
    borderRadius: 4,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 4,
  },
  barValueText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  barLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 6,
    position: 'absolute',
    bottom: 2,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  barLegendText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#64748B',
  },
  pipelineFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  pipelineFooterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pipelineFooterText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  pipelineFooterRight: {
    fontSize: 10,
    color: '#94A3B8',
  },
  queueCountBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  queueCountText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#4F46E5',
  },
  emptyQueueBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  emptyQueueTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 8,
  },
  emptyQueueSub: {
    fontSize: 11.5,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 280,
  },
  startDialingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#4F46E5',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 12,
  },
  startDialingBtnText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
  },
  queueList: {
    gap: 4,
  },
  queueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 10,
  },
  queueAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  queueAvatarText: {
    fontSize: 12,
    fontWeight: '700',
  },
  queueInfo: {
    flex: 1,
  },
  queueName: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  queuePhone: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 1,
  },
  queueActionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  queueCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#10B981',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  queueCallBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  queueWhatsAppBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  queueOpenBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  queueFooterBtn: {
    paddingTop: 12,
    alignItems: 'center',
  },
  queueFooterBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
  },
  recentCallsList: {
    gap: 4,
  },
  callHistoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  callHistoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1.8,
  },
  callHistoryIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  callHistoryName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  callHistoryPhone: {
    fontSize: 10.5,
    color: '#64748B',
  },
  callHistoryCenter: {
    alignItems: 'center',
    flex: 1.2,
  },
  stagePillMini: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  stagePillMiniText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#475569',
  },
  callHistoryTime: {
    fontSize: 9.5,
    color: '#94A3B8',
    marginTop: 2,
  },
  callHistoryRight: {
    alignItems: 'flex-end',
    flex: 0.8,
  },
  callHistoryDuration: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  newLeadsAlertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: borderRadius.lg,
    padding: 14,
    marginBottom: 14,
    ...shadows.soft,
  },
  newLeadsAlertIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  newLeadsAlertTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E3A8A',
  },
  newLeadsAlertSubtitle: {
    fontSize: 11.5,
    color: '#3B82F6',
    marginTop: 1,
  },
  newLeadsAlertBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2563EB',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  newLeadsAlertBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  adminBranchFilterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
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
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  agentReportCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
    backgroundColor: '#FFFFFF',
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
