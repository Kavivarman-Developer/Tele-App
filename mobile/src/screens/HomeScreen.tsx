import React, { useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
} from 'lucide-react-native';

import { useAuthStore } from '../store/authStore';
import {
  fetchDashboardReports,
  fetchUserCallsReport,
  fetchMyLeads,
  fetchCampaigns,
} from '../api/leadApi';
import { RootStackParamList, Lead, UserCallStats } from '../types';
import { colors, borderRadius, shadows } from '../theme';
import { CrmShell } from '../components/CrmShell';
import { PeriodControl, ReportingPeriod } from '../components/PeriodControl';
import { StatCard } from '../components/StatCard';
import { CrmAvatar } from '../components/CrmAvatar';
import { CrmBadge } from '../components/CrmBadge';
import { LeadQuickModal } from '../components/LeadQuickModal';
import { CrmDateTimePickerModal } from '../components/CrmDateTimePickerModal';
import { getDialerTelUrl, formatDisplayPhone } from '../utils/phoneUtils';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuthStore();

  const isAgent = user?.role === 'AGENT';
  const isManagerOrAdmin = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const isAdmin = user?.role === 'ADMIN';

  const [period, setPeriod] = useState<ReportingPeriod>('Today');
  const [customDate, setCustomDate] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const [selectedBranch, setSelectedBranch] = useState<'ALL' | 'Trichy' | 'Pudukkottai'>('ALL');
  const [selectedLeadForQuickModal, setSelectedLeadForQuickModal] = useState<Lead | null>(null);

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

  // Compute ISO 'from' date
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

  // 1. Dashboard Metrics
  const {
    data: dashboardData,
    isLoading: isDashboardLoading,
    refetch: refetchDashboard,
    isRefetching: isDashboardRefetching,
  } = useQuery({
    queryKey: ['homeDashboard', period, fromDate],
    queryFn: () => fetchDashboardReports({ from: fromDate }),
  });

  // 2. Per-Agent Calls
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

  // 3. Agent's Prioritized Queue
  const {
    data: myLeadsData,
    isLoading: isMyLeadsLoading,
    refetch: refetchMyLeads,
    isRefetching: isMyLeadsRefetching,
  } = useQuery({
    queryKey: ['homeMyLeadsQueue'],
    queryFn: () => fetchMyLeads({ type: 'ALL', limit: 10 }),
  });

  // 4. Campaigns List
  const { data: campaignsData } = useQuery({
    queryKey: ['homeCampaigns'],
    queryFn: () => fetchCampaigns(),
  });

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
    if (!totalSec || isNaN(totalSec)) return '00:00';
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Metrics computation
  const totalLeadsCount = dashboardData?.totalLeads ?? 2482;
  const connectRatePercent = dashboardData?.connectRate
    ? `${dashboardData.connectRate.toFixed(1)}%`
    : '50.2%';
  const callsMadeCount = dashboardData?.callsMade ?? 42;
  const connectedCallsCount = dashboardData?.connectedCalls ?? 21;
  const avgDuration = formatSeconds(
    dashboardData?.connectedCalls
      ? Math.round(dashboardData.callsMade * 6)
      : 252,
  );
  const activeCampaignsCount = campaignsData?.campaigns?.length ?? 1;

  // Immediate queue leads (top 3)
  const queueLeads = (myLeadsData?.leads || []).slice(0, 3);

  // Pipeline distribution stages
  const stageCounts = dashboardData?.leadsByStage || [];
  const defaultStages = [
    { name: 'New', count: 12, color: colors.stages.New.color, bg: colors.stages.New.bg },
    { name: 'Contacted', count: 5, color: colors.stages.Contacted.color, bg: colors.stages.Contacted.bg },
    { name: 'Interested', count: 8, color: colors.stages.Interested.color, bg: colors.stages.Interested.bg },
    { name: 'Follow Up', count: 4, color: colors.stages['Follow Up'].color, bg: colors.stages['Follow Up'].bg },
    { name: 'Converted', count: 3, color: colors.stages.Converted.color, bg: colors.stages.Converted.bg },
  ];

  const mappedStages = stageCounts.length > 0
    ? stageCounts.map((sc) => {
        const sName = sc.stage || sc._id || 'New';
        const stgStyle = colors.stages[sName as keyof typeof colors.stages] || colors.stages.New;
        return {
          name: sName,
          count: sc.count,
          color: stgStyle.color,
          bg: stgStyle.bg,
        };
      })
    : defaultStages;

  const totalStageLeads = mappedStages.reduce((sum, s) => sum + s.count, 0) || 1;

  const ALL_AGENTS_DATA = [
    {
      id: 'kavin',
      name: 'Kavin',
      initials: 'KV',
      avatarBg: '#F0FDFA',
      avatarColor: '#0F766E',
      branch: 'Trichy',
      calls: 16,
      connected: 13,
      talkTime: '03:15',
      rate: '81%',
      status: 'Active',
      recentCall: '#9810000129 Priya Verma',
    },
    {
      id: 'sarah',
      name: 'Sarah Telecaller',
      initials: 'ST',
      avatarBg: '#EEF2FF',
      avatarColor: '#4338CA',
      branch: 'Trichy',
      calls: 12,
      connected: 9,
      talkTime: '02:40',
      rate: '75%',
      status: 'Active',
      recentCall: '#9810000081 Rohan Mehta',
    },
    {
      id: 'john',
      name: 'John Agent',
      initials: 'JA',
      avatarBg: '#EFF6FF',
      avatarColor: '#1D4ED8',
      branch: 'Pudukkottai',
      calls: 11,
      connected: 9,
      talkTime: '03:02',
      rate: '82%',
      status: 'Active',
      recentCall: '#9810000129 Priya Verma',
    },
    {
      id: 'alex',
      name: 'Alex Outreach',
      initials: 'AO',
      avatarBg: '#FEF3C7',
      avatarColor: '#B45309',
      branch: 'Pudukkottai',
      calls: 7,
      connected: 5,
      talkTime: '02:18',
      rate: '71%',
      status: 'Break',
      recentCall: '#9810000062 Ayaan Patel',
    },
  ];

  const displayedAgents = ALL_AGENTS_DATA.filter((ag) => {
    if (effectiveBranch === 'ALL') return true;
    return ag.branch === effectiveBranch;
  });

  const currentAgentData = ALL_AGENTS_DATA.find(
    (ag) =>
      ag.name.toLowerCase() === (user?.name || '').toLowerCase() ||
      ag.id.toLowerCase() === (user?.name || '').toLowerCase()
  ) || {
    id: user?._id || 'my-agent',
    name: user?.name || 'Agent',
    initials: (user?.name || 'AG').slice(0, 2).toUpperCase(),
    avatarBg: '#F0FDFA',
    avatarColor: '#0F766E',
    branch: user?.branch || 'Trichy',
    calls: 16,
    connected: 13,
    talkTime: '03:15',
    rate: '81.3%',
    status: 'Active',
    recentCall: '#9810000129 Priya Verma',
  };

  const AGENT_CALL_LOGS = [
    {
      id: 'log-1',
      name: 'Priya Verma',
      phone: '+91 9810000129',
      stage: 'Interested',
      stageColor: '#047857',
      stageBg: '#ECFDF5',
      duration: '03:15',
      time: '02:11 PM',
    },
    {
      id: 'log-2',
      name: 'Rohan Mehta',
      phone: '+91 9810000081',
      stage: 'Follow Up',
      stageColor: '#B45309',
      stageBg: '#FFFBEB',
      duration: '02:40',
      time: '01:45 PM',
    },
    {
      id: 'log-3',
      name: 'Kavya Menon',
      phone: '+91 9810000073',
      stage: 'Interested',
      stageColor: '#047857',
      stageBg: '#ECFDF5',
      duration: '04:12',
      time: '12:30 PM',
    },
    {
      id: 'log-4',
      name: 'Deepa Kumar',
      phone: '+91 9810000120',
      stage: 'Not Connected',
      stageColor: '#64748B',
      stageBg: '#F1F5F9',
      duration: '00:45',
      time: '11:56 AM',
    },
  ];

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
            onPress={() => navigation.navigate('Campaigns' as any)}
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
                Logged in as <Text style={{ fontWeight: '700', color: '#0F172A' }}>{user?.name || 'Agent'}</Text> ({user?.email}) · {user?.role || 'AGENT'} · {isAgent ? 'Assigned strictly to your calling queue' : `Routing telecalls for ${user?.branch || 'General'} queue`}
              </Text>
            </View>
          </View>
        </View>

        {/* 2. BRANCH-WISE CALL SEPARATION & MONITORING (Admin & Manager Only) */}
        {isManagerOrAdmin && (
          <View style={styles.branchMonitorPanel}>
            <View style={styles.branchMonitorHeaderRow}>
              <View>
                <Text style={styles.branchMonitorTitle}>
                  {user?.role === 'MANAGER'
                    ? `${user.branch?.toUpperCase() || ''} CALL MONITORING`
                    : 'BRANCH CALL MONITORING'}
                </Text>
                <Text style={styles.branchMonitorSub}>
                  {user?.role === 'MANAGER'
                    ? `Live calls & agent records for ${user.branch || 'your'} branch`
                    : 'Separate, monitor & verify agent call records branch-wise'}
                </Text>
              </View>

              {isAdmin && (
                <View style={styles.branchFilterPills}>
                  {(['ALL', 'Trichy', 'Pudukkottai'] as const).map((b) => {
                    const isSelected = selectedBranch === b;
                    return (
                      <TouchableOpacity
                        key={b}
                        style={[styles.branchPillBtn, isSelected && styles.branchPillBtnActive]}
                        onPress={() => setSelectedBranch(b)}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.branchPillBtnText,
                            isSelected && styles.branchPillBtnTextActive,
                          ]}
                        >
                          {b === 'ALL' ? '🌐 All Branches' : `📍 ${b}`}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            {/* Branch-Specific Metric Chips */}
            <View style={styles.branchMetricsGrid}>
              <View style={styles.branchMetricBox}>
                <Text style={styles.branchMetricBoxLabel}>Branch Calls</Text>
                <Text style={styles.branchMetricBoxValue}>
                  {effectiveBranch === 'Trichy' ? '28' : effectiveBranch === 'Pudukkottai' ? '18' : '46'}
                </Text>
                <Text style={styles.branchMetricBoxSub}>
                  {effectiveBranch === 'Trichy'
                    ? '22 Connected (78.6%)'
                    : effectiveBranch === 'Pudukkottai'
                    ? '14 Connected (77.8%)'
                    : '36 Total Connected'}
                </Text>
              </View>

              <View style={styles.branchMetricBox}>
                <Text style={styles.branchMetricBoxLabel}>Active Agents</Text>
                <Text style={styles.branchMetricBoxValue}>
                  {effectiveBranch === 'Trichy' ? '2' : effectiveBranch === 'Pudukkottai' ? '2' : '4'}
                </Text>
                <Text style={styles.branchMetricBoxSub}>
                  {effectiveBranch === 'Trichy'
                    ? 'Kavin, Sarah'
                    : effectiveBranch === 'Pudukkottai'
                    ? 'John, Alex'
                    : 'Calling active'}
                </Text>
              </View>

              <View style={styles.branchMetricBox}>
                <Text style={styles.branchMetricBoxLabel}>Multi-Agent Number</Text>
                <Text style={[styles.branchMetricBoxValue, { color: '#0D9488' }]}>
                  #9810000129
                </Text>
                <Text style={styles.branchMetricBoxSub}>Kavin & John shared history</Text>
              </View>
            </View>
          </View>
        )}

        {/* 2B. AGENT TELECALLER DESK (Agent Only - NeoDove Style) */}
        {isAgent && (
          <View style={styles.agentTelecallerPanel}>
            <View style={styles.agentTelecallerHeaderRow}>
              <View>
                <Text style={styles.agentTelecallerTitle}>TELECALLER DESK</Text>
                <Text style={styles.agentTelecallerSub}>
                  Assigned calling queue for {user?.name || 'Agent'} ({user?.branch || 'General'} Branch)
                </Text>
              </View>
              <View style={styles.agentStatusPill}>
                <View style={styles.liveGreenDot} />
                <Text style={styles.agentStatusPillText}>Ready to Call</Text>
              </View>
            </View>

            {/* Agent Calling Targets Row */}
            <View style={styles.agentTargetRow}>
              <View style={styles.agentTargetCol}>
                <Text style={styles.agentTargetLabel}>Daily Target</Text>
                <Text style={styles.agentTargetVal}>16 / 30 Calls</Text>
                <View style={styles.progressBarTrack}>
                  <View style={[styles.progressBarFill, { width: '53%' }]} />
                </View>
                <Text style={styles.agentTargetSub}>53% completed today</Text>
              </View>
              <View style={styles.agentTargetCol}>
                <Text style={styles.agentTargetLabel}>Connected</Text>
                <Text style={[styles.agentTargetVal, { color: '#047857' }]}>13 Leads</Text>
                <Text style={styles.agentTargetSub}>81.3% connect rate</Text>
              </View>
              <View style={styles.agentTargetCol}>
                <Text style={styles.agentTargetLabel}>Callbacks Due</Text>
                <Text style={[styles.agentTargetVal, { color: '#D97706' }]}>6 Pending</Text>
                <Text style={styles.agentTargetSub}>Scheduled today</Text>
              </View>
            </View>
          </View>
        )}

        {/* Top 4 KPI Metrics Grid (2x2 on mobile, 4-col on tablet/wide) */}
        <View style={styles.statsGrid}>
          {/* Card 1: TOTAL LEADS / MY LEADS TO CALL */}
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>{isAgent ? 'MY LEADS TO CALL' : 'TOTAL LEADS'}</Text>
            <View style={styles.statValueRow}>
              <Text style={styles.statValue}>
                {isAgent
                  ? '50'
                  : dashboardData?.totalLeads
                  ? Number(dashboardData.totalLeads).toLocaleString()
                  : '2,482'}
              </Text>
              <View style={styles.statTrendPill}>
                <ArrowUpRight size={10} color="#047857" strokeWidth={3} />
                <Text style={styles.statTrendText}>{isAgent ? 'Ready' : '+12%'}</Text>
              </View>
            </View>
            <Text style={styles.statSub}>
              {isAgent ? 'Assigned exclusively to you' : 'Compared to previous period'}
            </Text>
          </View>

          {/* Card 2: CONNECT RATE */}
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>{isAgent ? 'MY CONNECT RATE' : 'CONNECT RATE'}</Text>
            <View style={styles.statValueRow}>
              <Text style={styles.statValue}>
                {isAgent ? '81.3%' : (dashboardData?.connectRate ? `${dashboardData.connectRate.toFixed(1)}%` : '50.2%')}
              </Text>
              <View style={styles.statStablePill}>
                <Text style={styles.statStableText}>{isAgent ? '13 Connected' : 'Stable'}</Text>
              </View>
            </View>
            <Text style={styles.statSub}>
              {isAgent ? '13 connected out of 16 dialed' : '2,104 successful connections'}
            </Text>
          </View>
        </View>

        <View style={[styles.statsGrid, { marginTop: 12 }]}>
          {/* Card 3: AVG TALK TIME */}
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>{isAgent ? 'MY AVG TALK TIME' : 'AVG TALK TIME'}</Text>
            <View style={styles.statValueRow}>
              <Text style={styles.statValue}>{isAgent ? '03:15' : (avgDuration || '04:12')}</Text>
              <Text style={styles.statUnit}>min/sec</Text>
            </View>
            <Text style={styles.statSub}>
              {isAgent ? 'Personal average talk duration' : 'Across 12 agents today'}
            </Text>
          </View>

          {/* Card 4: ACTIVE CAMPAIGNS / PENDING FOLLOW-UPS */}
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>{isAgent ? 'PENDING FOLLOW-UPS' : 'ACTIVE CAMPAIGNS'}</Text>
            <View style={styles.statValueRow}>
              <Text style={[styles.statValue, { color: isAgent ? '#D97706' : '#2563EB' }]}>
                {isAgent ? '06' : String(activeCampaignsCount || 8).padStart(2, '0')}
              </Text>
            </View>
            {isAgent ? (
              <Text style={styles.statSub}>Scheduled callbacks due today</Text>
            ) : (
              <View style={styles.agentStackRow}>
                <View style={[styles.miniAvatar, { backgroundColor: '#E0E7FF' }]}>
                  <Text style={[styles.miniAvatarText, { color: '#3730A3' }]}>AT</Text>
                </View>
                <View style={[styles.miniAvatar, { backgroundColor: '#ECFDF5', marginLeft: -6 }]}>
                  <Text style={[styles.miniAvatarText, { color: '#065F46' }]}>AT</Text>
                </View>
                <View style={[styles.miniAvatar, { backgroundColor: '#FEF3C7', marginLeft: -6 }]}>
                  <Text style={[styles.miniAvatarText, { color: '#92400E' }]}>JA</Text>
                </View>
                <Text style={styles.agentStackText}>+9 agents</Text>
              </View>
            )}
          </View>
        </View>

        {/* Middle Section 1: PIPELINE DISTRIBUTION (Vertical Bar Chart) */}
        <View style={styles.panel}>
          <View style={styles.panelHeaderRow}>
            <View>
              <Text style={styles.panelTitle}>PIPELINE DISTRIBUTION</Text>
              <Text style={styles.panelSubtitle}>
                {isAgent ? 'Your assigned leads across each outreach stage' : 'Leads across every stage of your outreach'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => navigation.navigate('MyLeads' as any)}
              activeOpacity={0.7}
              style={styles.viewDetailsBtn}
            >
              <Text style={styles.viewDetailsText}>View details</Text>
              <ArrowUpRight size={12} color="#2563EB" />
            </TouchableOpacity>
          </View>

          {/* Vertical Column Chart */}
          <View style={styles.barChartContainer}>
            {/* Y Axis Labels & Grid lines */}
            <View style={styles.yAxisCol}>
              <Text style={styles.yAxisText}>1,200</Text>
              <Text style={styles.yAxisText}>960</Text>
              <Text style={styles.yAxisText}>640</Text>
              <Text style={styles.yAxisText}>320</Text>
              <Text style={styles.yAxisText}>0</Text>
            </View>

            {/* Bars Area */}
            <View style={styles.barsArea}>
              {/* Horizontal Grid lines */}
              <View style={[styles.gridLine, { top: '0%' }]} />
              <View style={[styles.gridLine, { top: '25%' }]} />
              <View style={[styles.gridLine, { top: '50%' }]} />
              <View style={[styles.gridLine, { top: '75%' }]} />
              <View style={[styles.gridLine, { top: '100%' }]} />

              {/* 5 Vertical Bars */}
              <View style={styles.barsColumnsRow}>
                {/* Bar 1: New (1,042) */}
                <View style={styles.barCol}>
                  <View style={[styles.barFill, { height: '86%', backgroundColor: '#2563EB' }]}>
                    <Text style={styles.barValueText}>1,042</Text>
                  </View>
                  <View style={styles.barLegendRow}>
                    <View style={[styles.legendDot, { backgroundColor: '#2563EB' }]} />
                    <Text style={styles.barLegendText}>New</Text>
                  </View>
                </View>

                {/* Bar 2: Contacted (552) */}
                <View style={styles.barCol}>
                  <View style={[styles.barFill, { height: '46%', backgroundColor: '#F59E0B' }]}>
                    <Text style={styles.barValueText}>552</Text>
                  </View>
                  <View style={styles.barLegendRow}>
                    <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
                    <Text style={styles.barLegendText}>Contacted</Text>
                  </View>
                </View>

                {/* Bar 3: Interested (728) */}
                <View style={styles.barCol}>
                  <View style={[styles.barFill, { height: '61%', backgroundColor: '#10B981' }]}>
                    <Text style={styles.barValueText}>728</Text>
                  </View>
                  <View style={styles.barLegendRow}>
                    <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
                    <Text style={styles.barLegendText}>Interested</Text>
                  </View>
                </View>

                {/* Bar 4: Nurture (124) */}
                <View style={styles.barCol}>
                  <View style={[styles.barFill, { height: '18%', backgroundColor: '#64748B' }]}>
                    <Text style={styles.barValueText}>124</Text>
                  </View>
                  <View style={styles.barLegendRow}>
                    <View style={[styles.legendDot, { backgroundColor: '#64748B' }]} />
                    <Text style={styles.barLegendText}>Nurture</Text>
                  </View>
                </View>

                {/* Bar 5: Invalid (36) */}
                <View style={styles.barCol}>
                  <View style={[styles.barFill, { height: '10%', backgroundColor: '#EF4444' }]}>
                    <Text style={styles.barValueText}>36</Text>
                  </View>
                  <View style={styles.barLegendRow}>
                    <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
                    <Text style={styles.barLegendText}>Invalid</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* Chart Footer */}
          <View style={styles.pipelineFooter}>
            <View style={styles.pipelineFooterLeft}>
              <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
              <Text style={styles.pipelineFooterText}>
                {isAgent ? '50 assigned leads in your pipeline' : '2,482 leads in your pipeline'}
              </Text>
            </View>
            <Text style={styles.pipelineFooterRight}>Updated just now</Text>
          </View>
        </View>

        {/* Middle Section 2: IMMEDIATE QUEUE */}
        <View style={styles.panel}>
          <View style={styles.panelHeaderRow}>
            <View>
              <Text style={styles.panelTitle}>IMMEDIATE QUEUE</Text>
              <Text style={styles.panelSubtitle}>
                {isAgent ? 'Your prioritized leads ready to call next' : 'Your next conversations'}
              </Text>
            </View>
            <View style={styles.queueCountBadge}>
              <Text style={styles.queueCountText}>3 leads</Text>
            </View>
          </View>

          <View style={styles.queueList}>
            {/* Item 1: Kavya Menon */}
            <TouchableOpacity
              style={styles.queueRow}
              onPress={() => navigation.navigate('MyLeads' as any)}
              activeOpacity={0.7}
            >
              <View style={[styles.queueAvatar, { backgroundColor: '#EEF2FF' }]}>
                <Text style={[styles.queueAvatarText, { color: '#4F46E5' }]}>KM</Text>
              </View>
              <View style={styles.queueInfo}>
                <Text style={styles.queueName}>Kavya Menon</Text>
                <Text style={styles.queuePhone}>9810000073</Text>
              </View>
              <View style={styles.queueMeta}>
                <Text style={styles.queueTime}>04:13 AM</Text>
                <View style={[styles.tagPill, { backgroundColor: '#FEF2F2' }]}>
                  <Text style={[styles.tagText, { color: '#DC2626' }]}>Hot lead</Text>
                </View>
              </View>
            </TouchableOpacity>

            {/* Item 2: Priya Bhat */}
            <TouchableOpacity
              style={styles.queueRow}
              onPress={() => navigation.navigate('MyLeads' as any)}
              activeOpacity={0.7}
            >
              <View style={[styles.queueAvatar, { backgroundColor: '#F1F5F9' }]}>
                <Text style={[styles.queueAvatarText, { color: '#475569' }]}>PB</Text>
              </View>
              <View style={styles.queueInfo}>
                <Text style={styles.queueName}>Priya Bhat</Text>
                <Text style={styles.queuePhone}>9810000049</Text>
              </View>
              <View style={styles.queueMeta}>
                <Text style={styles.queueTime}>04:15 AM</Text>
                <View style={[styles.tagPill, { backgroundColor: '#FFFBEB' }]}>
                  <Text style={[styles.tagText, { color: '#D97706' }]}>Warm lead</Text>
                </View>
              </View>
            </TouchableOpacity>

            {/* Item 3: Anika Mehta */}
            <TouchableOpacity
              style={[styles.queueRow, { borderBottomWidth: 0 }]}
              onPress={() => navigation.navigate('MyLeads' as any)}
              activeOpacity={0.7}
            >
              <View style={[styles.queueAvatar, { backgroundColor: '#ECFDF5' }]}>
                <Text style={[styles.queueAvatarText, { color: '#059669' }]}>AM</Text>
              </View>
              <View style={styles.queueInfo}>
                <Text style={styles.queueName}>Anika Mehta</Text>
                <Text style={styles.queuePhone}>9810000089</Text>
              </View>
              <View style={styles.queueMeta}>
                <Text style={styles.queueTime}>05:25 AM</Text>
                <View style={[styles.tagPill, { backgroundColor: '#EFF6FF' }]}>
                  <Text style={[styles.tagText, { color: '#2563EB' }]}>Follow-up</Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>

          {/* Full-width View all link */}
          <TouchableOpacity
            style={styles.queueFooterBtn}
            onPress={() => navigation.navigate('FollowUps' as any)}
            activeOpacity={0.7}
          >
            <Text style={styles.queueFooterBtnText}>View all 36 scheduled &gt;</Text>
          </TouchableOpacity>
        </View>

        {/* Bottom Section: TEAM PERFORMANCE (Manager & Admin Only) OR MY CALL DISPOSITIONS (Agent Only) */}
        {isManagerOrAdmin ? (
          <View style={styles.panel}>
            <View style={styles.panelHeaderRow}>
              <View>
                <Text style={styles.panelTitle}>
                  {user?.role === 'MANAGER'
                    ? `${user.branch?.toUpperCase() || ''} TEAM PERFORMANCE`
                    : 'TEAM PERFORMANCE'}
                </Text>
                <Text style={styles.panelSubtitle}>
                  {user?.role === 'MANAGER'
                    ? `Active agents assigned to ${user.branch || 'your'} branch`
                    : "A closer look at your team's calling activity"}
                </Text>
              </View>
              <View style={styles.activeAgentsBadge}>
                <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
                <Text style={styles.activeAgentsText}>{displayedAgents.length} active agents</Text>
              </View>
            </View>

            {/* Table Headers */}
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.thCell, { flex: 2.2 }]}>AGENT NAME</Text>
              <Text style={[styles.thCell, { flex: 1.8 }]}>CALLS</Text>
              <Text style={[styles.thCell, { flex: 1.4 }]}>TALK TIME</Text>
              <Text style={[styles.thCell, { flex: 2 }]}>CONNECT RATE</Text>
              <Text style={[styles.thCell, { flex: 1.3, textAlign: 'right' }]}>STATUS</Text>
            </View>

            {/* Dynamic Branch-Filtered Agent Performance Rows */}
            {displayedAgents.map((agent, index) => {
              const isLast = index === displayedAgents.length - 1;
              return (
                <View
                  key={agent.id}
                  style={[styles.tableDataRow, isLast && { borderBottomWidth: 0 }]}
                >
                  <View
                    style={[
                      styles.tdCell,
                      { flex: 2.3, flexDirection: 'row', alignItems: 'center', gap: 8 },
                    ]}
                  >
                    <View style={[styles.miniAvatar, { backgroundColor: agent.avatarBg }]}>
                      <Text style={[styles.miniAvatarText, { color: agent.avatarColor }]}>
                        {agent.initials}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                        <Text style={styles.agentNameText}>{agent.name}</Text>
                        <View style={styles.tableBranchBadge}>
                          <Text style={styles.tableBranchBadgeText}>{agent.branch}</Text>
                        </View>
                      </View>
                      <Text style={styles.agentRecentCallText} numberOfLines={1}>
                        {agent.recentCall}
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.tdCell, { flex: 1.8 }]}>
                    <Text style={styles.tdBoldText}>
                      {agent.calls}{' '}
                      <Text style={styles.tdMutedSub}>{agent.connected} connected</Text>
                    </Text>
                  </View>

                  <View style={[styles.tdCell, { flex: 1.3 }]}>
                    <Text style={styles.tdText}>{agent.talkTime}</Text>
                  </View>

                  <View
                    style={[
                      styles.tdCell,
                      { flex: 1.9, flexDirection: 'row', alignItems: 'center', gap: 6 },
                    ]}
                  >
                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressFill,
                          { width: agent.rate as any },
                        ]}
                      />
                    </View>
                    <Text style={styles.ratePercentText}>{agent.rate}</Text>
                  </View>

                  <View style={[styles.tdCell, { flex: 1.2, alignItems: 'flex-end' }]}>
                    <View
                      style={
                        agent.status === 'Active' ? styles.statusActiveRow : styles.statusBreakRow
                      }
                    >
                      <View
                        style={[
                          styles.legendDot,
                          {
                            backgroundColor: agent.status === 'Active' ? '#10B981' : '#F59E0B',
                          },
                        ]}
                      />
                      <Text
                        style={
                          agent.status === 'Active'
                            ? styles.statusActiveText
                            : styles.statusBreakText
                        }
                      >
                        {agent.status}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}

            {/* Table Footer */}
            <View style={styles.tableFooter}>
              <Text style={styles.tableFooterLeft}>
                Showing {displayedAgents.length} agents in {effectiveBranch}
              </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('Team' as any)}
                activeOpacity={0.7}
                style={styles.manageTeamBtn}
              >
                <Text style={styles.manageTeamText}>Manage team</Text>
                <ArrowUpRight size={12} color="#2563EB" />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* NeoDove-style Agent Personal Call Logs & Dispositions */
          <View style={styles.panel}>
            <View style={styles.panelHeaderRow}>
              <View>
                <Text style={styles.panelTitle}>MY RECENT CALL DISPOSITIONS</Text>
                <Text style={styles.panelSubtitle}>Your personal calls and outcomes logged today</Text>
              </View>
              <View style={styles.activeAgentsBadge}>
                <View style={[styles.legendDot, { backgroundColor: '#0D9488' }]} />
                <Text style={[styles.activeAgentsText, { color: '#0D9488' }]}>
                  {user?.name || 'Agent'} (You)
                </Text>
              </View>
            </View>

            {/* Table Headers */}
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.thCell, { flex: 2.3 }]}>CUSTOMER</Text>
              <Text style={[styles.thCell, { flex: 1.5 }]}>OUTCOME</Text>
              <Text style={[styles.thCell, { flex: 1.2 }]}>DURATION</Text>
              <Text style={[styles.thCell, { flex: 1.3 }]}>TIME</Text>
              <Text style={[styles.thCell, { flex: 1.2, textAlign: 'right' }]}>ACTION</Text>
            </View>

            {AGENT_CALL_LOGS.map((item, index) => {
              const isLast = index === AGENT_CALL_LOGS.length - 1;
              return (
                <View
                  key={item.id}
                  style={[styles.tableDataRow, isLast && { borderBottomWidth: 0 }]}
                >
                  <View style={[styles.tdCell, { flex: 2.3 }]}>
                    <Text style={styles.agentNameText} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.agentRecentCallText}>{item.phone}</Text>
                  </View>

                  <View style={[styles.tdCell, { flex: 1.5 }]}>
                    <View
                      style={{
                        backgroundColor: item.stageBg,
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        borderRadius: 4,
                        alignSelf: 'flex-start',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: '700',
                          color: item.stageColor,
                        }}
                      >
                        {item.stage}
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.tdCell, { flex: 1.2 }]}>
                    <Text style={styles.tdText}>{item.duration}</Text>
                  </View>

                  <View style={[styles.tdCell, { flex: 1.3 }]}>
                    <Text style={styles.tdText}>{item.time}</Text>
                  </View>

                  <View style={[styles.tdCell, { flex: 1.2, alignItems: 'flex-end' }]}>
                    <TouchableOpacity
                      onPress={() => {
                        Linking.openURL(getDialerTelUrl(item.phone));
                      }}
                      style={{
                        backgroundColor: '#ECFDF5',
                        padding: 6,
                        borderRadius: 6,
                        borderWidth: 1,
                        borderColor: '#A7F3D0',
                      }}
                      accessibilityLabel="Call Lead"
                    >
                      <Phone size={12} color="#047857" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}

            <TouchableOpacity
              style={styles.queueFooterBtn}
              onPress={() => navigation.navigate('MyLeads' as any)}
              activeOpacity={0.7}
            >
              <Text style={styles.queueFooterBtnText}>View all my assigned leads &gt;</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Lovable Interactive Lead Quick Modal */}
      <LeadQuickModal
        lead={selectedLeadForQuickModal}
        visible={Boolean(selectedLeadForQuickModal)}
        onClose={() => setSelectedLeadForQuickModal(null)}
        onLeadUpdated={() => {
          refetchMyLeads();
          refetchDashboard();
        }}
        onOpenFullDispose={(leadToDispose) => {
          navigation.navigate('Dispose', { lead: leadToDispose });
        }}
      />
      {/* Date Picker Modal for Dashboard Filtering */}
      <CrmDateTimePickerModal
        visible={showDatePicker}
        title="Filter Dashboard by Date"
        initialDate={customDate || new Date().toISOString()}
        onClose={() => setShowDatePicker(false)}
        onConfirm={handleConfirmCustomDate}
      />
    </CrmShell>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
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
    backgroundColor: '#2563EB',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
  },
  headerAddBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginTop: 8,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  statTrendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
    gap: 2,
  },
  statTrendText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#047857',
  },
  statStablePill: {
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
  },
  statStableText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B45309',
  },
  statUnit: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  statSub: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  agentStackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  miniAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  miniAvatarText: {
    fontSize: 8,
    fontWeight: '700',
  },
  agentStackText: {
    fontSize: 10,
    color: '#64748B',
    marginLeft: 6,
    fontWeight: '600',
  },
  panel: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 16,
    marginTop: 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  panelHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  panelTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
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
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },
  barChartContainer: {
    flexDirection: 'row',
    height: 180,
    marginTop: 8,
  },
  yAxisCol: {
    width: 36,
    justifyContent: 'space-between',
    paddingBottom: 24,
    alignItems: 'flex-start',
  },
  yAxisText: {
    fontSize: 9,
    color: '#94A3B8',
    fontWeight: '600',
  },
  barsArea: {
    flex: 1,
    position: 'relative',
    justifyContent: 'flex-end',
    paddingBottom: 24,
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#F1F5F9',
  },
  barsColumnsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: '100%',
    zIndex: 1,
  },
  barCol: {
    alignItems: 'center',
    width: 44,
    height: '100%',
    justifyContent: 'flex-end',
  },
  barFill: {
    width: 34,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 4,
  },
  barValueText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  barLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 6,
    position: 'absolute',
    bottom: -20,
  },
  legendDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  barLegendText: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  pipelineFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    marginTop: 18,
  },
  pipelineFooterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pipelineFooterText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  pipelineFooterRight: {
    fontSize: 10,
    color: '#94A3B8',
  },
  queueCountBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  queueCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },
  queueList: {
    gap: 0,
  },
  queueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  queueAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  queueAvatarText: {
    fontSize: 11,
    fontWeight: '700',
  },
  queueInfo: {
    flex: 1,
    marginLeft: 12,
  },
  queueName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  queuePhone: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  queueMeta: {
    alignItems: 'flex-end',
    gap: 4,
  },
  queueTime: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  tagPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  tagText: {
    fontSize: 9,
    fontWeight: '700',
  },
  queueFooterBtn: {
    backgroundColor: '#EFF6FF',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 14,
  },
  queueFooterBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
  },
  activeAgentsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 5,
  },
  activeAgentsText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#047857',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  thCell: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.4,
  },
  tableDataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  tdCell: {
    justifyContent: 'center',
  },
  agentNameText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  tdBoldText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  tdMutedSub: {
    fontSize: 10,
    fontWeight: '500',
    color: '#94A3B8',
  },
  tdText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  progressTrack: {
    width: 44,
    height: 4,
    backgroundColor: '#F1F5F9',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 2,
  },
  ratePercentText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#475569',
  },
  statusActiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusActiveText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#047857',
  },
  statusBreakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusBreakText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#B45309',
  },
  tableFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    marginTop: 4,
  },
  tableFooterLeft: {
    fontSize: 11,
    color: '#94A3B8',
  },
  manageTeamBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  manageTeamText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },
  // Branch Office Banner
  branchOfficeBanner: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CCFBF1',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
    gap: 12,
  },
  branchOfficeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  branchIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F0FDFA',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#99F6E4',
  },
  branchOfficeTitle: {
    fontSize: 14,
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
    borderRadius: 6,
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
    fontSize: 9,
    fontWeight: '700',
    color: '#047857',
  },
  branchOfficeSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  branchQuickSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  branchQuickSwitchLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    marginRight: 2,
  },
  branchQuickSwitchBtn: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  branchQuickSwitchBtnActive: {
    backgroundColor: '#F0FDFA',
    borderColor: '#0D9488',
  },
  branchQuickSwitchText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  branchQuickSwitchTextActive: {
    color: '#0F766E',
    fontWeight: '800',
  },
  // Branch Monitor Panel
  branchMonitorPanel: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
    gap: 12,
  },
  branchMonitorHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    flexWrap: 'wrap',
  },
  branchMonitorTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.4,
  },
  branchMonitorSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  branchFilterPills: {
    flexDirection: 'row',
    gap: 5,
    backgroundColor: '#F1F5F9',
    padding: 3,
    borderRadius: 10,
  },
  branchPillBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
  },
  branchPillBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 1,
    elevation: 1,
  },
  branchPillBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  branchPillBtnTextActive: {
    color: '#0D9488',
    fontWeight: '800',
  },
  branchMetricsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  branchMetricBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 10,
  },
  branchMetricBoxLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  branchMetricBoxValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  branchMetricBoxSub: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
  },
  // Table branch badge & recent call
  tableBranchBadge: {
    backgroundColor: '#F0FDFA',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#CCFBF1',
  },
  tableBranchBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#0F766E',
  },
  agentRecentCallText: {
    fontSize: 9,
    color: '#64748B',
    marginTop: 2,
  },
  // NeoDove Agent Telecaller Desk Panel
  agentTelecallerPanel: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CCFBF1',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
    gap: 12,
  },
  agentTelecallerHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  agentTelecallerTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.4,
  },
  agentTelecallerSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
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
    fontSize: 11,
    fontWeight: '700',
    color: '#047857',
  },
  agentTargetRow: {
    flexDirection: 'row',
    gap: 8,
  },
  agentTargetCol: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 10,
  },
  agentTargetLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  agentTargetVal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  agentTargetSub: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
  },
  progressBarTrack: {
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    marginTop: 6,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#0D9488',
    borderRadius: 2,
  },
});
