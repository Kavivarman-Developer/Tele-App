import React, { useState, useMemo, useEffect, useRef } from 'react';
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
  AppState,
  AppStateStatus,
  useWindowDimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  Phone,
  PhoneOff,
  Clock,
  Clock3,
  ArrowRight,
  ArrowUpRight,
  ChevronRight,
  ChevronDown,
  PhoneCall,
  Plus,
  LayoutGrid,
  CheckCircle2,
  Calendar,
  MessageCircle,
  Target,
  Sparkles,
  Flame,
  Sun,
  Snowflake,
  FileEdit,
  Check,
  SkipForward,
  RotateCcw,
  CalendarClock,
  ListOrdered,
} from 'lucide-react-native';

import { useAuthStore } from '../store/authStore';
import { useCampaignStore } from '../store/campaignStore';
import { useLeadHistoryStore } from '../store/leadHistoryStore';
import { useNotificationStore } from '../store/notificationStore';
import {
  fetchDashboardReports,
  fetchUserCallsReport,
  fetchMyLeads,
  fetchCampaigns,
  disposeLead,
} from '../api/leadApi';
import { RootStackParamList, Lead, DetectedCallResult, CustomerTemperature } from '../types';
import { colors, borderRadius, shadows } from '../theme';
import { CrmShell } from '../components/CrmShell';
import { ReportingPeriod } from '../components/PeriodControl';
import { LeadQuickModal } from '../components/LeadQuickModal';
import { CrmDateTimePickerModal } from '../components/CrmDateTimePickerModal';
import { WhatsAppTemplateModal } from '../components/WhatsAppTemplateModal';
import { NeoPostCallModal } from '../components/NeoPostCallModal';
import { callService } from '../services/call.service';
import { getDialerTelUrl, formatDisplayPhone } from '../utils/phoneUtils';
import { toast } from '../store/toastStore';
import { storage } from '../utils/storage';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { selectedCampaignName } = useCampaignStore();
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
  const [skippedLeadIds, setSkippedLeadIds] = useState<string[]>([]);

  // NeoDove Segmented Tab: Queue vs Callbacks vs Today's Calls vs Team
  const [activeTab, setActiveTab] = useState<'queue' | 'callbacks' | 'calls' | 'team'>('queue');
  const [dashboardSubTab, setDashboardSubTab] = useState<'QUEUES' | 'LOGIN_REPORT' | 'CALL_REPORT'>('QUEUES');

  // WhatsApp Modal State
  const [whatsAppTarget, setWhatsAppTarget] = useState<{ name: string; phone: string } | null>(null);

  // Automatic Call Detection State & Refs
  const isCallingRef = useRef<boolean>(false);
  const callStartTimeRef = useRef<number | null>(null);
  const callingLeadRef = useRef<Lead | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const [postCallData, setPostCallData] = useState<{
    visible: boolean;
    lead: Lead | null;
    callResult: DetectedCallResult | null;
  }>({
    visible: false,
    lead: null,
    callResult: null,
  });

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
    refetchInterval: 15000,
    refetchIntervalInBackground: false,
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
    refetchInterval: 15000,
    refetchIntervalInBackground: false,
  });

  // 3. Agent's Prioritized Queue (auto-polls for newly assigned leads from admin/manager)
  const {
    data: myLeadsData,
    isLoading: isMyLeadsLoading,
    refetch: refetchMyLeads,
    isRefetching: isMyLeadsRefetching,
  } = useQuery({
    queryKey: ['homeMyLeadsQueue'],
    queryFn: () => fetchMyLeads({ type: 'ALL', limit: 100 }),
    refetchInterval: 15000,
    refetchIntervalInBackground: false,
  });

  // 4. Subscribe to Zustand Local Activity Store (Guarantees Instant Re-render on call)
  const historyMap = useLeadHistoryStore((s) => s.historyMap);
  const { getActivitiesForPeriod } = useLeadHistoryStore();
  const periodActivities = useMemo(() => {
    return getActivitiesForPeriod(period, customDate, user?._id || user?.name);
  }, [historyMap, period, customDate, user, getActivitiesForPeriod]);

  // Overall Agent Calls List for Manager & Admin
  const agentCallsList = useMemo(() => {
    const list = userCallsData?.agents || [];
    if (selectedBranch === 'ALL') return list;
    return list.filter(
      (a) => (a.branch || 'Trichy').toLowerCase() === selectedBranch.toLowerCase(),
    );
  }, [userCallsData, selectedBranch]);

  // Alert for newly assigned leads
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
              5000,
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

  // Format Talk Time seconds into MM:SS
  const formatSeconds = (totalSec: number) => {
    if (!totalSec || isNaN(totalSec) || totalSec <= 0) return '00:00';
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const formatDurationHoursMinutes = (totalSec: number) => {
    if (!totalSec || isNaN(totalSec) || totalSec <= 0) return '00:00:00 Hrs';
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if (hrs > 0) {
      return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')} Hrs`;
    }
    return `00:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')} Hrs`;
  };

  const formatAvgDurationMins = (avgSec: number) => {
    if (!avgSec || isNaN(avgSec) || avgSec <= 0) return '0 mins';
    const mins = Math.floor(avgSec / 60);
    const secs = avgSec % 60;
    if (mins === 0) return `${secs} secs`;
    if (secs === 0) return `${mins} mins`;
    return `${mins}m ${secs}s`;
  };

  const bannerDateInfo = useMemo(() => {
    const today = new Date();
    if (period === '7 Days') {
      const startOfWeek = new Date(today.getTime() - 6 * 24 * 3600 * 1000);
      const fromStr = startOfWeek.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: '2-digit', year: 'numeric' });
      const toStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: '2-digit', year: 'numeric' });
      return {
        fromTo: `FROM ${fromStr}  -  TO ${toStr}`,
        duration: 'Duration : 7 Day(s)',
      };
    }
    if (period === '30 Days') {
      const startOfMonth = new Date(today.getTime() - 29 * 24 * 3600 * 1000);
      const fromStr = startOfMonth.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: '2-digit', year: 'numeric' });
      const toStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: '2-digit', year: 'numeric' });
      return {
        fromTo: `FROM ${fromStr}  -  TO ${toStr}`,
        duration: 'Duration : 30 Day(s)',
      };
    }
    if (period === 'Custom' && customDate) {
      const cd = new Date(customDate);
      const fromStr = cd.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: '2-digit', year: 'numeric' });
      const toStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: '2-digit', year: 'numeric' });
      const days = Math.max(1, Math.ceil((today.getTime() - cd.getTime()) / (24 * 3600 * 1000)));
      return {
        fromTo: `FROM ${fromStr}  -  TO ${toStr}`,
        duration: `Duration : ${days} Day(s)`,
      };
    }
    const todayStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: '2-digit', year: 'numeric' });
    return {
      fromTo: `FROM ${todayStr}  -  TO ${todayStr}`,
      duration: 'Duration : 1 Day(s)',
    };
  }, [period, customDate]);

  // ==============================================================
  // REAL DYNAMIC METRICS CALCULATION (ZERO DELAY)
  // ==============================================================
  const myAssignedLeadsCount = myLeadsData?.total ?? (myLeadsData?.leads?.length || 0);

  // Calls made and connected (combines local session with backend reports)
  const realLocalActivities = periodActivities.filter(
    (a) => a.stage !== 'Call Initiated' && a.stage !== 'Dialing',
  );
  const localCallsCount = realLocalActivities.length;
  const localConnectedCount = realLocalActivities.filter((a) => a.connected).length;
  const localTotalDuration = realLocalActivities.reduce((sum, a) => sum + (a.durationSeconds || 0), 0);

  const callsMade = Math.max(dashboardData?.callsMade ?? 0, localCallsCount);
  const connectedCalls = Math.max(dashboardData?.connectedCalls ?? 0, localConnectedCount);
  const connectRatePercent = callsMade > 0 ? ((connectedCalls / callsMade) * 100).toFixed(0) + '%' : '0%';

  const avgDurationSeconds =
    connectedCalls > 0 && localTotalDuration > 0
      ? Math.round(localTotalDuration / connectedCalls)
      : (dashboardData as any)?.averageDurationSeconds || 0;
  const avgDurationFormatted = formatSeconds(avgDurationSeconds);

  // Dynamic daily call report grouped from real activity history
  const realDailyCallReports = useMemo(() => {
    const allUserActivities = (useLeadHistoryStore.getState().getAllActivities(user?._id) || [])
      .filter((a) => a.stage !== 'Call Initiated' && a.stage !== 'Dialing');

    const map = new Map<string, { attempted: number; connected: number; duration: number }>();
    const todayStr = `Today (${new Date().toLocaleDateString([], { day: '2-digit', month: '2-digit', year: 'numeric' })})`;
    map.set(todayStr, {
      attempted: callsMade,
      connected: connectedCalls,
      duration: localTotalDuration,
    });

    for (const act of allUserActivities) {
      if (!act.createdAt) continue;
      const actDate = new Date(act.createdAt);
      const isToday =
        actDate.getDate() === now.getDate() &&
        actDate.getMonth() === now.getMonth() &&
        actDate.getFullYear() === now.getFullYear();

      if (!isToday) {
        const dateKey = actDate.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: 'numeric' });
        const existing = map.get(dateKey) || { attempted: 0, connected: 0, duration: 0 };
        existing.attempted += 1;
        if (act.connected) {
          existing.connected += 1;
        }
        existing.duration += act.durationSeconds || 0;
        map.set(dateKey, existing);
      }
    }

    return Array.from(map.entries()).map(([date, stats]) => {
      const rate = stats.attempted > 0 ? `${((stats.connected / stats.attempted) * 100).toFixed(0)}%` : '0%';
      return {
        date,
        attempted: stats.attempted,
        connected: stats.connected,
        duration: formatDurationHoursMinutes(stats.duration),
        connectRate: rate,
      };
    });
  }, [callsMade, connectedCalls, localTotalDuration, user?._id]);

  // Scheduled callbacks due today
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const endOfToday = startOfToday + 24 * 60 * 60 * 1000 - 1;

  const dueTodayFollowUps = useMemo(() => {
    return (myLeadsData?.leads || []).filter((l) => {
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
  }, [myLeadsData, startOfToday, endOfToday]);

  const callbacksDueTodayCount = Math.max(dashboardData?.followUpsDueToday ?? 0, dueTodayFollowUps.length);

  // Sync Bell Icon in Notification Store
  useEffect(() => {
    useNotificationStore.getState().setTotalRemindersCount(callbacksDueTodayCount);
  }, [callbacksDueTodayCount]);

  // Daily target configuration
  const dailyTargetTotal = 30;
  const targetCompletedPercent = Math.min(100, Math.round((callsMade / dailyTargetTotal) * 100));

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

  // Hero Lead to Call (accounts for skipped leads in current session)
  const heroLead: Lead | null = useMemo(() => {
    if (queueLeads.length === 0) return null;
    const nonSkipped = queueLeads.filter((l) => !skippedLeadIds.includes(l._id));
    return nonSkipped.length > 0 ? nonSkipped[0] : queueLeads[0];
  }, [queueLeads, skippedLeadIds]);

  const nextInQueueLeads = useMemo(() => {
    if (!heroLead) return [];
    return queueLeads.filter((l) => l._id !== heroLead._id).slice(0, 5);
  }, [queueLeads, heroLead]);

  // NeoDove 3 Calling Queues (Image 3)
  const newUnattemptedLeads = useMemo(() => {
    return (myLeadsData?.leads || []).filter(
      (l) =>
        (!l.attemptCount || l.attemptCount === 0) &&
        l.status !== 'CLOSED' &&
        l.stage !== 'Closed' &&
        l.stage !== 'Lost',
    );
  }, [myLeadsData]);

  const followUpLeads = useMemo(() => {
    return (myLeadsData?.leads || []).filter(
      (l) =>
        (l.stage === 'Follow Up' || l.stage === 'Follow-up' || !!l.nextFollowUpAt) &&
        l.status !== 'CLOSED' &&
        l.stage !== 'Closed' &&
        l.stage !== 'Lost',
    );
  }, [myLeadsData]);

  const notConnectedLeads = useMemo(() => {
    return (myLeadsData?.leads || []).filter(
      (l) =>
        (l.stage === 'Not connected' ||
          l.stage === 'NOT CONNECTED' ||
          (l.attemptCount && l.attemptCount > 0 && l.stage === 'New')) &&
        l.status !== 'CLOSED',
    );
  }, [myLeadsData]);

  const handleStartCallingQueue = (targetQueue: Lead[], queueTitle: string) => {
    if (targetQueue.length === 0) {
      Alert.alert('Queue Empty', `No leads currently in "${queueTitle}".`);
      return;
    }
    const firstLead = targetQueue[0];
    navigation.navigate('LeadDetail', {
      lead: firstLead,
      queue: targetQueue,
      queueIndex: 0,
      initialTab: 'LEAD INFO',
    });
  };

  // ==============================================================
  // NATIVE CALLING & AUTOMATIC CALL DETECTION (Like NeoDove)
  // ==============================================================
  const handleDirectDial = async (leadItem: Lead) => {
    const isSuppressed =
      leadItem.status === 'CLOSED' ||
      leadItem.stage === 'Not Interested' ||
      leadItem.stage === 'Closed' ||
      leadItem.stage === 'Lost';

    const executeDial = async () => {
      // Set calling refs for AppState detection (Call is counted only after it completes!)
      callingLeadRef.current = leadItem;
      callStartTimeRef.current = Date.now();
      isCallingRef.current = true;

      toast.info(`Calling ${leadItem.name}...`, 'Dialing');

      // Initiate native dialer
      try {
        await callService.startCall(leadItem);
      } catch (err) {
        isCallingRef.current = false;
        callStartTimeRef.current = null;
        callingLeadRef.current = null;
        Alert.alert('Call Error', 'Could not open phone dialer on this device.');
      }
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

    await executeDial();
  };

  // AppState Listener: Detect when user returns from phone dialer
  useEffect(() => {
    const handleAppStateChange = async (nextState: AppStateStatus) => {
      const prevState = appStateRef.current;
      appStateRef.current = nextState;

      if (
        (prevState === 'background' || prevState === 'inactive') &&
        nextState === 'active' &&
        isCallingRef.current &&
        callStartTimeRef.current !== null &&
        callingLeadRef.current !== null
      ) {
        const startTime = callStartTimeRef.current;
        const dialedLead = callingLeadRef.current;
        isCallingRef.current = false;
        callStartTimeRef.current = null;

        try {
          // Read native Android call log (with duration & connection detection)
          const result = await callService.getCallResult(dialedLead.phone, startTime);

          // Open NeoPostCallModal with detected outcome (One clean update occurs when user saves!)
          setPostCallData({
            visible: true,
            lead: dialedLead,
            callResult: result,
          });
        } catch {
          setPostCallData({
            visible: true,
            lead: dialedLead,
            callResult: { connected: false, durationSeconds: 0 },
          });
        }
      }
    };

    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, [refetchDashboard, refetchMyLeads]);

  // Handle Save Disposition from NeoPostCallModal
  const handleSavePostCallDisposition = async (payload: {
    connected: boolean;
    stage: string;
    tag?: string | null;
    temperature?: CustomerTemperature;
    notConnectedReason?: string;
    remark?: string;
    followUpAt?: string | null;
    durationSeconds: number;
    callNext?: boolean;
  }) => {
    const targetLead = postCallData.lead;
    if (!targetLead) return;

    try {
      // 1. Save to backend database
      await disposeLead(targetLead._id, {
        connected: payload.connected,
        stage: payload.stage,
        tag: payload.tag || payload.temperature,
        notConnectedReason: payload.notConnectedReason as any,
        remark: payload.remark,
        followUpAt: payload.followUpAt,
        durationSeconds: payload.durationSeconds,
      });

      // 2. Record to local activity store
      useLeadHistoryStore.getState().addActivity(targetLead._id, {
        phone: targetLead.phone,
        customerName: targetLead.name,
        agentName: user?.name,
        agentId: user?._id,
        branch: user?.branch,
        connected: payload.connected,
        stage: payload.stage,
        tag: payload.tag || payload.temperature,
        remark: payload.remark,
        followUpAt: payload.followUpAt,
        durationSeconds: payload.durationSeconds,
        notConnectedReason: payload.notConnectedReason,
      });

      toast.success('Call disposition saved!', 'Saved');
      refetchDashboard();
      refetchMyLeads();

      // 3. Auto-Advance: "Save & Call Next Lead"
      if (payload.callNext) {
        const remaining = queueLeads.filter((l) => l._id !== targetLead._id);
        if (remaining.length > 0) {
          const nextLead = remaining[0];
          setTimeout(() => {
            handleDirectDial(nextLead);
          }, 350);
        } else {
          toast.info('All leads in queue completed! Great job!', 'Queue Finished');
        }
      }
    } catch (err: any) {
      console.warn('Failed to save disposition to backend:', err);
      toast.error(err?.response?.data?.message || 'Failed to save disposition', 'Error');
    }
  };

  const handleOpenWhatsApp = (leadItem: Lead) => {
    setWhatsAppTarget({ name: leadItem.name, phone: leadItem.phone });
  };

  const handleSkipHeroLead = () => {
    if (!heroLead) return;
    setSkippedLeadIds((prev) => [...prev, heroLead._id]);
    toast.info(`Skipped ${heroLead.name}. Next lead loaded.`, 'Skipped');
  };

  const handleResetSkipped = () => {
    setSkippedLeadIds([]);
    toast.info('Skipped leads restored to queue', 'Queue Reset');
  };

  const isRefreshing = isDashboardRefetching || isUserCallsRefetching || isMyLeadsRefetching;

  const handleRefreshAll = () => {
    refetchDashboard();
    refetchMyLeads();
    if (isManagerOrAdmin) {
      refetchUserCalls();
    }
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
      : 'General';

  const heroLeadTemp = (heroLead?.tag || 'WARM').toUpperCase();

  return (
    <CrmShell
      title="Hi Talk"
      headerIcon={<LayoutGrid size={15} color="#6B7280" />}
      customSubtitleNode={
        <TouchableOpacity
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}
          onPress={() => navigation.navigate('CampaignSelect')}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 13, color: '#6B7280', fontWeight: '400' }} numberOfLines={1}>
            {selectedCampaignName || 'All campaigns'}
          </Text>
          <ChevronDown size={14} color="#6B7280" />
        </TouchableOpacity>
      }
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
            <Plus size={13} color="#0F9D58" strokeWidth={2.5} />
            <Text style={styles.headerAddBtnText}>Campaign</Text>
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
            colors={['#0F9D58']}
          />
        }
      >
        {/* 1. AGENT GREETING & STATUS BAR */}
        <View style={styles.topBar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greetingText}>Hello, {user?.name || 'Caller'} 👋</Text>
            <Text style={styles.branchSubText}>
              {user?.branch ? `${user.branch} Branch` : 'Main Office'} · {isAgent ? 'Telecalling Desk' : user?.role || 'Admin'}
            </Text>
          </View>
          <View style={styles.statusBadge}>
            <View style={styles.liveGreenDot} />
            <Text style={styles.statusBadgeText}>Ready to Call</Text>
          </View>
        </View>

        {/* Assigned Leads Notification Alert Banner */}
        {isAgent && assignedLeadAlert && (
          <View style={styles.alertBanner}>
            <Sparkles size={16} color="#0F9D58" />
            <View style={{ flex: 1, paddingHorizontal: 6 }}>
              <Text style={styles.alertTitle}>New Leads Assigned!</Text>
              <Text style={styles.alertSubtitle}>
                {assignedLeadAlert.count} new leads added by {assignedLeadAlert.assignedBy || 'Admin'}.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.alertBtn}
              onPress={() => {
                handleDismissAssignedAlert();
                navigation.navigate('MyLeads');
              }}
            >
              <Text style={styles.alertBtnText}>View</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* =========================================================================
            CLEAN MINIMAL "MY REPORT" TOP SECTION
           ========================================================================= */}
        {/* Top Date Range Banner */}
        <TouchableOpacity
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 12,
            borderWidth: 1,
            borderColor: '#E5E7EB',
            paddingVertical: 12,
            paddingHorizontal: 16,
            marginBottom: 16,
            alignItems: 'center',
          }}
          onPress={() => setShowDatePicker(true)}
          activeOpacity={0.7}
        >
          <Text style={{ color: '#1F2937', fontWeight: '500', fontSize: 13.5, letterSpacing: 0.2, textAlign: 'center' }}>
            {bannerDateInfo.fromTo}
          </Text>
          <Text style={{ color: '#6B7280', fontWeight: '400', fontSize: 12, marginTop: 3 }}>
            {bannerDateInfo.duration}
          </Text>
        </TouchableOpacity>

        {/* 4 Clean Minimal Metric Cards (2x2 Grid) */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
          {/* Card 1: Calls Attempted */}
          <View
            style={{
              flex: 1,
              minWidth: '46%',
              backgroundColor: '#FFFFFF',
              borderRadius: 12,
              padding: 16,
              borderWidth: 1,
              borderColor: '#E5E7EB',
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: '#6B7280', fontWeight: '400', fontSize: 12 }}>
                Calls Attempted
              </Text>
              <Phone size={18} color="#6B7280" />
            </View>
            <Text style={{ color: '#1F2937', fontWeight: '500', fontSize: 20, marginTop: 8 }}>
              {callsMade}
            </Text>
          </View>

          {/* Card 2: Calls Connected */}
          <View
            style={{
              flex: 1,
              minWidth: '46%',
              backgroundColor: '#FFFFFF',
              borderRadius: 12,
              padding: 16,
              borderWidth: 1,
              borderColor: '#E5E7EB',
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: '#6B7280', fontWeight: '400', fontSize: 12 }}>
                Calls Connected
              </Text>
              <PhoneCall size={18} color="#6B7280" />
            </View>
            <Text style={{ color: '#1F2937', fontWeight: '500', fontSize: 20, marginTop: 8 }}>
              {connectedCalls}
            </Text>
          </View>

          {/* Card 3: Call Time */}
          <View
            style={{
              flex: 1,
              minWidth: '46%',
              backgroundColor: '#FFFFFF',
              borderRadius: 12,
              padding: 16,
              borderWidth: 1,
              borderColor: '#E5E7EB',
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: '#6B7280', fontWeight: '400', fontSize: 12 }}>
                Call Time
              </Text>
              <Clock3 size={18} color="#6B7280" />
            </View>
            <Text style={{ color: '#1F2937', fontWeight: '500', fontSize: 20, marginTop: 8 }}>
              {formatDurationHoursMinutes(localTotalDuration || (connectedCalls * 68))}
            </Text>
          </View>

          {/* Card 4: Avg Call Duration */}
          <View
            style={{
              flex: 1,
              minWidth: '46%',
              backgroundColor: '#FFFFFF',
              borderRadius: 12,
              padding: 16,
              borderWidth: 1,
              borderColor: '#E5E7EB',
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: '#6B7280', fontWeight: '400', fontSize: 12 }}>
                Avg Call Duration
              </Text>
              <Clock size={18} color="#6B7280" />
            </View>
            <Text style={{ color: '#1F2937', fontWeight: '500', fontSize: 20, marginTop: 8 }}>
              {formatAvgDurationMins(avgDurationSeconds || 68)}
            </Text>
          </View>
        </View>

        {/* Segmented Bottom Tabs: Calling Queues | Login Report | Call Report */}
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: '#F9FAFB',
            borderRadius: 8,
            padding: 3,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: '#E5E7EB',
          }}
        >
          <TouchableOpacity
            style={{
              flex: 1,
              paddingVertical: 8,
              alignItems: 'center',
              borderRadius: 6,
              backgroundColor: dashboardSubTab === 'QUEUES' ? '#E6F4EA' : 'transparent',
            }}
            onPress={() => setDashboardSubTab('QUEUES')}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: dashboardSubTab === 'QUEUES' ? '500' : '400',
                color: dashboardSubTab === 'QUEUES' ? '#0F9D58' : '#6B7280',
              }}
            >
              Calling Queues
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              flex: 1,
              paddingVertical: 8,
              alignItems: 'center',
              borderRadius: 6,
              backgroundColor: dashboardSubTab === 'LOGIN_REPORT' ? '#E6F4EA' : 'transparent',
            }}
            onPress={() => setDashboardSubTab('LOGIN_REPORT')}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: dashboardSubTab === 'LOGIN_REPORT' ? '500' : '400',
                color: dashboardSubTab === 'LOGIN_REPORT' ? '#0F9D58' : '#6B7280',
              }}
            >
              Login Report
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              flex: 1,
              paddingVertical: 8,
              alignItems: 'center',
              borderRadius: 6,
              backgroundColor: dashboardSubTab === 'CALL_REPORT' ? '#E6F4EA' : 'transparent',
            }}
            onPress={() => setDashboardSubTab('CALL_REPORT')}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: dashboardSubTab === 'CALL_REPORT' ? '500' : '400',
                color: dashboardSubTab === 'CALL_REPORT' ? '#0F9D58' : '#6B7280',
              }}
            >
              Call Report
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content of Sub Tab */}
        {dashboardSubTab === 'CALL_REPORT' ? (
          <View style={{ gap: 10, marginBottom: 16 }}>
            {realDailyCallReports.length > 0 ? (
              realDailyCallReports.map((day) => (
                <View
                  key={day.date}
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: 12,
                    padding: 14,
                    borderWidth: 1,
                    borderColor: '#E5E7EB',
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={{ fontWeight: '500', fontSize: 13.5, color: '#1F2937' }}>{day.date}</Text>
                    <View style={{ backgroundColor: '#E6F4EA', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                      <Text style={{ color: '#0F9D58', fontSize: 11, fontWeight: '500' }}>{day.connectRate} Connected</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                    <Text style={{ fontSize: 12, color: '#6B7280' }}>Attempted: <Text style={{ fontWeight: '500', color: '#1F2937' }}>{day.attempted}</Text></Text>
                    <Text style={{ fontSize: 12, color: '#6B7280' }}>Connected: <Text style={{ fontWeight: '500', color: '#0F9D58' }}>{day.connected}</Text></Text>
                    <Text style={{ fontSize: 12, color: '#6B7280' }}>Duration: <Text style={{ fontWeight: '500', color: '#1F2937' }}>{day.duration}</Text></Text>
                  </View>
                </View>
              ))
            ) : (
              <View style={{ backgroundColor: '#FFFFFF', borderRadius: 12, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' }}>
                <Text style={{ fontSize: 13, color: '#6B7280' }}>No call activity recorded yet today</Text>
              </View>
            )}
          </View>
        ) : dashboardSubTab === 'LOGIN_REPORT' ? (
          <View style={{ gap: 10, marginBottom: 16 }}>
            {((userCallsData?.agents && userCallsData.agents.length > 0)
              ? userCallsData.agents
              : user ? [user] : []
            ).map((u: any) => {
              const uName = u.name || 'Agent';
              const uBranch = u.branch ? `${u.branch} Branch` : 'General';
              const uRole = u.role || 'AGENT';
              const isUserActive = u.isActive !== false;
              const loginTimeStr = u.lastLoginAt
                ? new Date(u.lastLoginAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : 'Active now';

              return (
                <View
                  key={u.userId || u._id || u.email || uName}
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: 12,
                    padding: 14,
                    borderWidth: 1,
                    borderColor: '#E5E7EB',
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <View>
                    <Text style={{ fontWeight: '500', fontSize: 13.5, color: '#1F2937' }}>{uName}</Text>
                    <Text style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
                      {uBranch} · {uRole}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: isUserActive ? '#0F9D58' : '#9CA3AF' }} />
                      <Text style={{ fontSize: 11, fontWeight: '500', color: isUserActive ? '#0F9D58' : '#6B7280' }}>
                        {isUserActive ? 'Logged In' : 'Offline'}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>{loginTimeStr}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}

        {/* 3 NEODOVE QUEUE CARDS (Exact match of Image 3) */}
        {dashboardSubTab === 'QUEUES' && (
          <View style={{ gap: 14 }}>
            <View style={{ gap: 14, marginBottom: 16 }}>
              {/* Card 1: New/Un-attempted Leads */}
              <View style={styles.neoQueueCard}>
            <View style={styles.neoQueueCardHeader}>
              <Text style={styles.neoQueueCardTitle}>New/Un-attempted Leads</Text>
              <View style={styles.neoQueueCountBadge}>
                <Text style={styles.neoQueueCountBadgeText}>{newUnattemptedLeads.length} Leads</Text>
              </View>
            </View>
            <Text style={styles.neoQueueCardSub}>Leads, which haven't been called so far</Text>
            <View style={styles.neoQueueActionsRow}>
              <TouchableOpacity
                style={styles.neoQueueViewBtn}
                onPress={() => {
                  setActiveTab('queue');
                  navigation.navigate('MyLeads');
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.neoQueueViewBtnText}>View</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.neoQueueCallBtn}
                onPress={() => handleStartCallingQueue(newUnattemptedLeads, 'New/Un-attempted Leads')}
                activeOpacity={0.85}
              >
                <Text style={styles.neoQueueCallBtnText}>Start Calling</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Card 2: Follow-up Leads */}
          <View style={styles.neoQueueCard}>
            <View style={styles.neoQueueCardHeader}>
              <Text style={styles.neoQueueCardTitle}>Follow-up Leads</Text>
              <View style={styles.neoQueueCountBadge}>
                <Text style={styles.neoQueueCountBadgeText}>{followUpLeads.length} Leads</Text>
              </View>
            </View>
            <Text style={styles.neoQueueCardSub}>Leads, which are scheduled to be called later</Text>
            <View style={styles.neoQueueActionsRow}>
              <TouchableOpacity
                style={styles.neoQueueViewBtn}
                onPress={() => {
                  setActiveTab('callbacks');
                  navigation.navigate('FollowUps');
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.neoQueueViewBtnText}>View</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.neoQueueCallBtn}
                onPress={() => handleStartCallingQueue(followUpLeads, 'Follow-up Leads')}
                activeOpacity={0.85}
              >
                <Text style={styles.neoQueueCallBtnText}>Start Calling</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Card 3: Not Connected Leads */}
          <View style={styles.neoQueueCard}>
            <View style={styles.neoQueueCardHeader}>
              <Text style={styles.neoQueueCardTitle}>Not Connected Leads</Text>
              <View style={styles.neoQueueCountBadge}>
                <Text style={styles.neoQueueCountBadgeText}>{notConnectedLeads.length} Leads</Text>
              </View>
            </View>
            <Text style={styles.neoQueueCardSub}>Leads, which were not connected in previous attempt</Text>
            <View style={styles.neoQueueActionsRow}>
              <TouchableOpacity
                style={styles.neoQueueViewBtn}
                onPress={() => {
                  navigation.navigate('MyLeads');
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.neoQueueViewBtnText}>View</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.neoQueueCallBtn}
                onPress={() => handleStartCallingQueue(notConnectedLeads, 'Not Connected Leads')}
                activeOpacity={0.85}
              >
                <Text style={styles.neoQueueCallBtnText}>Start Calling</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* 3. PRIMARY CALLING DECK (HERO LEAD) */}
        {heroLead ? (
          <View style={styles.heroCard}>
            {/* Top Tag Bar */}
            <View style={styles.heroTopRow}>
              <View style={styles.queueOrderPill}>
                <Text style={styles.queueOrderText}>NEXT IN LINE</Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {heroLeadTemp === 'HOT' ? (
                  <View style={[styles.tempPill, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
                    <Flame size={10} color="#DC2626" fill="#DC2626" />
                    <Text style={[styles.tempPillText, { color: '#DC2626' }]}>Hot</Text>
                  </View>
                ) : heroLeadTemp === 'COLD' ? (
                  <View style={[styles.tempPill, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
                    <Snowflake size={10} color="#2563EB" />
                    <Text style={[styles.tempPillText, { color: '#2563EB' }]}>Cold</Text>
                  </View>
                ) : (
                  <View style={[styles.tempPill, { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}>
                    <Sun size={10} color="#D97706" />
                    <Text style={[styles.tempPillText, { color: '#D97706' }]}>Warm</Text>
                  </View>
                )}

                <View style={styles.stagePill}>
                  <Text style={styles.stagePillText}>{heroLead.stage || 'New'}</Text>
                </View>
              </View>
            </View>

            {/* Lead Details */}
            <View style={styles.leadDetailsRow}>
              <View style={styles.leadAvatarBox}>
                <Text style={styles.leadAvatarText}>{heroLeadInitials}</Text>
              </View>
              <View style={{ flex: 1, paddingLeft: 10 }}>
                <Text style={styles.leadNameText} numberOfLines={1}>
                  {heroLead.name}
                </Text>
                <Text style={styles.leadPhoneText}>{formatDisplayPhone(heroLead.phone)}</Text>
                <Text style={styles.leadCampaignText} numberOfLines={1}>
                  {heroLeadCampaign} · Attempt #{heroLead.attemptCount || 1}
                </Text>
              </View>
            </View>

            {/* Note / Property Preview */}
            <View style={styles.notePreviewRow}>
              <Clock3 size={11} color="#64748B" />
              <Text style={styles.notePreviewText} numberOfLines={1}>
                {heroLead.customProperties?.lastRemark ||
                  (heroLead.attemptCount && heroLead.attemptCount > 0
                    ? 'Prior conversation recorded · Callback ready'
                    : 'New lead · Ready for pitch')}
              </Text>
            </View>

            {/* High-Contrast Large CALL NOW Button */}
            <TouchableOpacity
              style={styles.callNowBtn}
              onPress={() => handleDirectDial(heroLead)}
              activeOpacity={0.85}
            >
              <Phone size={17} color="#FFFFFF" strokeWidth={2.5} />
              <Text style={styles.callNowBtnText}>CALL NOW</Text>
            </TouchableOpacity>

            {/* Secondary Action Row: WhatsApp, Note, Skip */}
            <View style={styles.heroActionRow}>
              <TouchableOpacity
                style={styles.heroMiniBtn}
                onPress={() => handleOpenWhatsApp(heroLead)}
                activeOpacity={0.8}
              >
                <MessageCircle size={13} color="#15803D" strokeWidth={2.5} />
                <Text style={[styles.heroMiniBtnText, { color: '#15803D' }]}>WhatsApp</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.heroMiniBtn}
                onPress={() => setSelectedLeadForQuickModal(heroLead)}
                activeOpacity={0.8}
              >
                <FileEdit size={13} color="#2563EB" strokeWidth={2.5} />
                <Text style={[styles.heroMiniBtnText, { color: '#2563EB' }]}>Note</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.heroMiniBtn}
                onPress={handleSkipHeroLead}
                activeOpacity={0.8}
              >
                <SkipForward size={13} color="#64748B" strokeWidth={2} />
                <Text style={[styles.heroMiniBtnText, { color: '#64748B' }]}>Skip</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.emptyQueueCard}>
            <CheckCircle2 size={32} color="#10B981" />
            <Text style={styles.emptyQueueTitle}>All caught up! 🎉</Text>
            <Text style={styles.emptyQueueSub}>
              All active leads in this queue have been reached. Browse all leads or upload new contacts.
            </Text>
            <TouchableOpacity
              style={styles.emptyQueueBtn}
              onPress={() => navigation.navigate('MyLeads')}
            >
              <Text style={styles.emptyQueueBtnText}>Browse All {myAssignedLeadsCount} Leads</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 4. NEODOVE SEGMENTED TABS (Compact, No Vertical Clutter) */}
        <View style={styles.tabsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
            <TouchableOpacity
              style={[styles.tabChip, activeTab === 'queue' && styles.tabChipActive]}
              onPress={() => setActiveTab('queue')}
            >
              <ListOrdered size={12} color={activeTab === 'queue' ? '#FFFFFF' : '#475569'} />
              <Text style={[styles.tabChipText, activeTab === 'queue' && styles.tabChipTextActive]}>
                Queue ({queueLeads.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabChip, activeTab === 'callbacks' && styles.tabChipActive]}
              onPress={() => setActiveTab('callbacks')}
            >
              <CalendarClock size={12} color={activeTab === 'callbacks' ? '#FFFFFF' : '#475569'} />
              <Text style={[styles.tabChipText, activeTab === 'callbacks' && styles.tabChipTextActive]}>
                Callbacks Due ({callbacksDueTodayCount})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabChip, activeTab === 'calls' && styles.tabChipActive]}
              onPress={() => setActiveTab('calls')}
            >
              <Clock3 size={12} color={activeTab === 'calls' ? '#FFFFFF' : '#475569'} />
              <Text style={[styles.tabChipText, activeTab === 'calls' && styles.tabChipTextActive]}>
                Today's Calls ({periodActivities.length})
              </Text>
            </TouchableOpacity>

            {isManagerOrAdmin && (
              <TouchableOpacity
                style={[styles.tabChip, activeTab === 'team' && styles.tabChipActive]}
                onPress={() => setActiveTab('team')}
              >
                <Users size={12} color={activeTab === 'team' ? '#FFFFFF' : '#475569'} />
                <Text style={[styles.tabChipText, activeTab === 'team' && styles.tabChipTextActive]}>
                  Team ({agentCallsList.length})
                </Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>

        {/* TAB 1: QUEUE LIST */}
        {activeTab === 'queue' && (
          <View style={styles.tabContentBox}>
            {nextInQueueLeads.length === 0 ? (
              <Text style={styles.tabEmptyText}>No other leads in queue. Ready for new list!</Text>
            ) : (
              nextInQueueLeads.map((item, idx) => {
                const initials = item.name
                  .split(' ')
                  .filter(Boolean)
                  .map((w) => w[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2) || 'LD';

                return (
                  <View key={item._id} style={styles.queueItemRow}>
                    <View style={styles.itemAvatar}>
                      <Text style={styles.itemAvatarText}>{initials}</Text>
                    </View>
                    <View style={{ flex: 1, paddingHorizontal: 8 }}>
                      <Text style={styles.itemNameText} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={styles.itemPhoneText}>{formatDisplayPhone(item.phone)}</Text>
                    </View>

                    <View style={styles.itemActionGroup}>
                      <TouchableOpacity
                        style={styles.itemCallBtn}
                        onPress={() => handleDirectDial(item)}
                        activeOpacity={0.8}
                      >
                        <Phone size={12} color="#FFFFFF" strokeWidth={2.5} />
                        <Text style={styles.itemCallBtnText}>Call</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.itemIconBtn}
                        onPress={() => handleOpenWhatsApp(item)}
                        activeOpacity={0.8}
                      >
                        <MessageCircle size={13} color="#15803D" strokeWidth={2.5} />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.itemIconBtn}
                        onPress={() => setSelectedLeadForQuickModal(item)}
                        activeOpacity={0.8}
                      >
                        <FileEdit size={13} color="#4F46E5" strokeWidth={2} />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}

            <TouchableOpacity
              style={styles.viewAllFooterBtn}
              onPress={() => navigation.navigate('MyLeads')}
              activeOpacity={0.7}
            >
              <Text style={styles.viewAllFooterText}>View All ({myAssignedLeadsCount}) Leads</Text>
              <ChevronRight size={13} color="#2563EB" />
            </TouchableOpacity>
          </View>
        )}

        {/* TAB 2: CALLBACKS DUE TODAY */}
        {activeTab === 'callbacks' && (
          <View style={styles.tabContentBox}>
            {dueTodayFollowUps.length === 0 ? (
              <View style={styles.tabEmptyBox}>
                <CheckCircle2 size={24} color="#10B981" />
                <Text style={styles.tabEmptyTitle}>No callbacks due right now</Text>
                <Text style={styles.tabEmptySub}>
                  When you schedule callbacks from the post-call modal, they will show up here automatically.
                </Text>
              </View>
            ) : (
              dueTodayFollowUps.map((item) => {
                const timeStr = item.nextFollowUpAt
                  ? new Date(item.nextFollowUpAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : 'Today';

                return (
                  <View key={item._id} style={styles.queueItemRow}>
                    <View style={[styles.itemAvatar, { backgroundColor: '#FFFBEB' }]}>
                      <CalendarClock size={14} color="#D97706" />
                    </View>
                    <View style={{ flex: 1, paddingHorizontal: 8 }}>
                      <Text style={styles.itemNameText} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={styles.itemPhoneText}>
                        {formatDisplayPhone(item.phone)} · <Text style={{ color: '#D97706', fontWeight: '700' }}>{timeStr}</Text>
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={styles.itemCallBtn}
                      onPress={() => handleDirectDial(item)}
                      activeOpacity={0.8}
                    >
                      <Phone size={12} color="#FFFFFF" strokeWidth={2.5} />
                      <Text style={styles.itemCallBtnText}>Call</Text>
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* TAB 3: TODAY'S CALLS ACTIVITY */}
        {activeTab === 'calls' && (
          <View style={styles.tabContentBox}>
            {periodActivities.length === 0 ? (
              <View style={styles.tabEmptyBox}>
                <Clock3 size={24} color="#94A3B8" />
                <Text style={styles.tabEmptyTitle}>No calls logged today yet</Text>
                <Text style={styles.tabEmptySub}>
                  Calls you dial will appear here with detected duration and connection status.
                </Text>
              </View>
            ) : (
              periodActivities.slice(0, 10).map((act, index) => {
                const isLast = index === Math.min(periodActivities.length, 10) - 1;
                const durText = act.connected ? formatSeconds(act.durationSeconds || 0) : 'Missed';
                const timeStr = new Date(act.createdAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <View
                    key={act._id}
                    style={[styles.historyRow, isLast && { borderBottomWidth: 0 }]}
                  >
                    <View
                      style={[
                        styles.historyIconBox,
                        { backgroundColor: act.connected ? '#ECFDF5' : '#FEF2F2' },
                      ]}
                    >
                      {act.connected ? (
                        <Phone size={12} color="#059669" />
                      ) : (
                        <PhoneOff size={12} color="#DC2626" />
                      )}
                    </View>

                    <View style={{ flex: 1, paddingHorizontal: 8 }}>
                      <Text style={styles.historyNameText} numberOfLines={1}>
                        {act.customerName || (act.phone ? formatDisplayPhone(act.phone) : 'Contact')}
                      </Text>
                      <Text style={styles.historyPhoneText}>
                        {act.phone ? formatDisplayPhone(act.phone) : 'No phone'} · {timeStr}
                      </Text>
                    </View>

                    <View style={{ alignItems: 'flex-end' }}>
                      <Text
                        style={[
                          styles.historyDurText,
                          { color: act.connected ? '#059669' : '#DC2626' },
                        ]}
                      >
                        {durText}
                      </Text>
                      <Text style={styles.historyStageText}>{act.stage}</Text>
                    </View>
                  </View>
                );
              })
            )}

            <TouchableOpacity
              style={styles.viewAllFooterBtn}
              onPress={() => navigation.navigate('CallHistory')}
              activeOpacity={0.7}
            >
              <Text style={styles.viewAllFooterText}>View Full Call History</Text>
              <ChevronRight size={13} color="#2563EB" />
            </TouchableOpacity>
          </View>
        )}

        {/* TAB 4: TEAM PERFORMANCE (Manager & Admin) */}
        {isManagerOrAdmin && activeTab === 'team' && (
          <View style={styles.tabContentBox}>
            {/* Branch Filter Selector */}
            <View style={styles.branchFilterRow}>
              {(['ALL', 'Trichy', 'Pudukkottai'] as const).map((br) => {
                const isSelected = selectedBranch === br;
                return (
                  <TouchableOpacity
                    key={br}
                    style={[styles.branchFilterChip, isSelected && styles.branchFilterChipActive]}
                    onPress={() => setSelectedBranch(br)}
                  >
                    <Text
                      style={[
                        styles.branchFilterText,
                        isSelected && styles.branchFilterTextActive,
                      ]}
                    >
                      {br === 'ALL' ? 'All' : br}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {agentCallsList.length === 0 ? (
              <Text style={styles.tabEmptyText}>No agents active in this branch.</Text>
            ) : (
              agentCallsList.map((agentItem) => {
                const initials = agentItem.name
                  .split(' ')
                  .filter(Boolean)
                  .map((w) => w[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2) || 'AG';

                const cRate =
                  agentItem.calls > 0
                    ? ((agentItem.connected / agentItem.calls) * 100).toFixed(0) + '%'
                    : '0%';
                const avgDur = formatSeconds(agentItem.avgDurationSeconds || 0);

                return (
                  <View key={agentItem.userId || agentItem.email} style={styles.agentCard}>
                    <View style={styles.agentHeader}>
                      <View style={styles.itemAvatar}>
                        <Text style={styles.itemAvatarText}>{initials}</Text>
                      </View>
                      <View style={{ flex: 1, paddingLeft: 8 }}>
                        <Text style={styles.itemNameText}>{agentItem.name}</Text>
                        <Text style={styles.itemPhoneText}>
                          {agentItem.branch || 'Trichy'} Branch
                        </Text>
                      </View>
                    </View>

                    <View style={styles.agentMetricsGrid}>
                      <View style={styles.agentMetricItem}>
                        <Text style={styles.agentMetricVal}>{agentItem.calls}</Text>
                        <Text style={styles.agentMetricLbl}>Calls</Text>
                      </View>
                      <View style={styles.agentMetricItem}>
                        <Text style={[styles.agentMetricVal, { color: '#059669' }]}>
                          {agentItem.connected}
                        </Text>
                        <Text style={styles.agentMetricLbl}>Connected</Text>
                      </View>
                      <View style={styles.agentMetricItem}>
                        <Text style={styles.agentMetricVal}>{cRate}</Text>
                        <Text style={styles.agentMetricLbl}>Rate</Text>
                      </View>
                      <View style={styles.agentMetricItem}>
                        <Text style={styles.agentMetricVal}>{avgDur}</Text>
                        <Text style={styles.agentMetricLbl}>Avg Talk</Text>
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}
          </View>
        )}
      </ScrollView>

      {/* Automatic NeoDove Post-Call Disposition Modal */}
      <NeoPostCallModal
        visible={postCallData.visible}
        lead={postCallData.lead}
        callResult={postCallData.callResult}
        onClose={() => setPostCallData((prev) => ({ ...prev, visible: false }))}
        onSaveDisposition={handleSavePostCallDisposition}
      />

      {/* Quick Lead Modal */}
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
    backgroundColor: '#FFFFFF',
  },
  contentContainer: {
    padding: 12,
    paddingBottom: 90,
    backgroundColor: '#FFFFFF',
  },
  headerAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E6F4EA',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  headerAddBtnText: {
    color: '#0F9D58',
    fontSize: 12,
    fontWeight: '500',
  },

  // 1. Top Bar
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  greetingText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  branchSubText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  liveGreenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#047857',
  },

  // Alert Banner
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 10,
    padding: 9,
    marginBottom: 10,
  },
  alertTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E3A8A',
  },
  alertSubtitle: {
    fontSize: 10.5,
    color: '#3B82F6',
  },
  alertBtn: {
    backgroundColor: '#2563EB',
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 6,
  },
  alertBtnText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '700',
  },

  // 2. Compact Target Card
  targetCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
    ...shadows.soft,
  },
  targetCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  targetCardTitle: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.5,
  },
  targetPercentPill: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  targetPercentText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4F46E5',
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 5,
  },
  callsCountBig: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  callsTargetSub: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  periodText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2563EB',
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 3,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  metricCol: {
    flex: 1,
    alignItems: 'center',
  },
  metricDivider: {
    width: 1,
    height: 22,
    backgroundColor: '#E2E8F0',
  },
  metricVal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  metricLbl: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 1,
  },

  // 3. Hero Calling Card
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    marginBottom: 10,
    ...shadows.card,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  queueOrderPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  queueOrderText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#475569',
  },
  tempPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
  },
  tempPillText: {
    fontSize: 9.5,
    fontWeight: '700',
  },
  stagePill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  stagePillText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#334155',
  },
  leadDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  leadAvatarBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  leadAvatarText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  leadNameText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  leadPhoneText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginTop: 1,
  },
  leadCampaignText: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
  notePreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 7,
    marginBottom: 10,
  },
  notePreviewText: {
    fontSize: 10,
    color: '#64748B',
    flex: 1,
  },
  callNowBtn: {
    backgroundColor: '#059669',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 9,
    marginBottom: 8,
    ...shadows.card,
  },
  callNowBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  heroActionRow: {
    flexDirection: 'row',
    gap: 6,
  },
  heroMiniBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 7,
  },
  heroMiniBtnText: {
    fontSize: 10.5,
    fontWeight: '700',
  },

  emptyQueueCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  emptyQueueTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 6,
  },
  emptyQueueSub: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    marginVertical: 4,
  },
  emptyQueueBtn: {
    marginTop: 6,
    backgroundColor: '#2563EB',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 7,
  },
  emptyQueueBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // 4. Segmented Tabs
  tabsContainer: {
    marginBottom: 8,
  },
  tabsScroll: {
    gap: 6,
  },
  tabChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
  },
  tabChipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  tabChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  tabChipTextActive: {
    color: '#FFFFFF',
  },

  // Tab Content Box
  tabContentBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tabEmptyText: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    paddingVertical: 16,
  },
  tabEmptyBox: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  tabEmptyTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginTop: 4,
  },
  tabEmptySub: {
    fontSize: 10,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 2,
    paddingHorizontal: 12,
  },

  // Queue Item Row
  queueItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  itemAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemAvatarText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#4F46E5',
  },
  itemNameText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  itemPhoneText: {
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 1,
  },
  itemActionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  itemCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#059669',
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 6,
  },
  itemCallBtnText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  itemIconBtn: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewAllFooterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    marginTop: 4,
  },
  viewAllFooterText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },

  // Calls History Row
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  historyIconBox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyNameText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  historyPhoneText: {
    fontSize: 10,
    color: '#64748B',
  },
  historyDurText: {
    fontSize: 11,
    fontWeight: '800',
  },
  historyStageText: {
    fontSize: 9,
    color: '#94A3B8',
    marginTop: 1,
  },

  // Team Branch Filter & Cards
  branchFilterRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  branchFilterChip: {
    paddingVertical: 4,
    paddingHorizontal: 9,
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
  },
  branchFilterChipActive: {
    backgroundColor: '#2563EB',
  },
  branchFilterText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  branchFilterTextActive: {
    color: '#FFFFFF',
  },
  agentCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 8,
    marginBottom: 6,
  },
  agentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  agentMetricsGrid: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 5,
  },
  agentMetricItem: {
    flex: 1,
    alignItems: 'center',
  },
  agentMetricVal: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  agentMetricLbl: {
    fontSize: 9,
    color: '#64748B',
  },

  // NeoDove Queue Cards (Clean Minimal)
  neoQueueCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  neoQueueCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  neoQueueCardTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1F2937',
  },
  neoQueueCountBadge: {
    backgroundColor: '#E6F4EA',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  neoQueueCountBadgeText: {
    color: '#0F9D58',
    fontSize: 12,
    fontWeight: '500',
  },
  neoQueueCardSub: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    marginBottom: 14,
    fontWeight: '400',
  },
  neoQueueActionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  neoQueueViewBtn: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  neoQueueViewBtnText: {
    color: '#1F2937',
    fontWeight: '500',
    fontSize: 13,
  },
  neoQueueCallBtn: {
    flex: 1.4,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#0F9D58',
    alignItems: 'center',
    justifyContent: 'center',
  },
  neoQueueCallBtnText: {
    color: '#FFFFFF',
    fontWeight: '500',
    fontSize: 13,
  },
});
