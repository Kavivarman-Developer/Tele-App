import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { BarChart } from 'react-native-gifted-charts';

import { useAuthStore } from '../store/authStore';
import {
  fetchDashboardReports,
  fetchUserCallsReport,
  fetchMyLeads,
} from '../api/leadApi';
import { RootStackParamList, StageLeadCount, UserCallStats } from '../types';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type DateRangeOption = 'TODAY' | '7_DAYS' | '30_DAYS' | 'ALL_TIME';

const STAGE_COLORS: Record<string, string> = {
  New: '#3B82F6', // Blue
  Interested: '#10B981', // Emerald
  'Follow Up': '#F59E0B', // Amber
  'Not Interested': '#64748B', // Slate
  Converted: '#8B5CF6', // Purple
  Lost: '#EF4444', // Red
};

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuthStore();

  const isAgent = user?.role === 'AGENT';
  const isManagerOrAdmin = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  const [dateRange, setDateRange] = useState<DateRangeOption>(
    isAgent ? 'TODAY' : '7_DAYS',
  );

  // Compute ISO 'from' date based on dateRange
  const now = new Date();
  let fromDate: string | undefined;

  if (dateRange === 'TODAY') {
    fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  } else if (dateRange === '7_DAYS') {
    fromDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  } else if (dateRange === '30_DAYS') {
    fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  } else {
    fromDate = undefined;
  }

  // Query: Dashboard Metrics
  const {
    data: dashboardData,
    isLoading: dashboardLoading,
    refetch: refetchDashboard,
    isRefetching: dashboardRefetching,
  } = useQuery({
    queryKey: ['homeDashboard', user?.role, dateRange],
    queryFn: () => fetchDashboardReports({ from: fromDate }),
  });

  // Query: Per-agent Call Stats (Admin / Manager only)
  const {
    data: userCallsData,
    isLoading: userCallsLoading,
    refetch: refetchUserCalls,
    isRefetching: userCallsRefetching,
  } = useQuery({
    queryKey: ['homeUserCalls', dateRange],
    queryFn: () => fetchUserCallsReport({ from: fromDate }),
    enabled: isManagerOrAdmin,
  });

  // Query: Agent's prioritized leads queue (Agent only)
  const {
    data: agentLeadsData,
    isLoading: agentLeadsLoading,
    refetch: refetchAgentLeads,
    isRefetching: agentLeadsRefetching,
  } = useQuery({
    queryKey: ['homeAgentLeads'],
    queryFn: () => fetchMyLeads({ type: 'ALL', limit: 20 }),
    enabled: isAgent,
  });

  // Query: Agent's follow-up leads for overdue count (Agent only)
  const {
    data: agentFollowUpsData,
    isLoading: agentFollowUpsLoading,
    refetch: refetchFollowUps,
    isRefetching: agentFollowUpsRefetching,
  } = useQuery({
    queryKey: ['homeFollowUps'],
    queryFn: () => fetchMyLeads({ type: 'FOLLOW_UP', limit: 50 }),
    enabled: isAgent,
  });

  const isRefetching =
    dashboardRefetching ||
    userCallsRefetching ||
    agentLeadsRefetching ||
    agentFollowUpsRefetching;

  const handleRefreshAll = () => {
    refetchDashboard();
    if (isManagerOrAdmin) refetchUserCalls();
    if (isAgent) {
      refetchAgentLeads();
      refetchFollowUps();
    }
  };

  // Agent specific stats
  const agentLeads = agentLeadsData?.leads ?? [];
  const followUpLeads = agentFollowUpsData?.leads ?? [];
  const overdueFollowUpsCount = followUpLeads.filter(
    (l) => l.nextFollowUpAt && new Date(l.nextFollowUpAt).getTime() < Date.now(),
  ).length;

  const handleStartCallingShortcut = () => {
    if (agentLeads.length > 0) {
      navigation.navigate('LeadDetail', {
        lead: agentLeads[0],
        queue: agentLeads,
        queueIndex: 0,
      });
    } else {
      (navigation as any).navigate('MyLeads');
    }
  };

  // Screen width for chart responsiveness
  const screenWidth = Dimensions.get('window').width;
  const chartWidth = Math.max(280, screenWidth - 72);

  // Transform leadsByStage for gifted-charts BarChart
  const stageStats: StageLeadCount[] = dashboardData?.leadsByStage || [];
  const barChartData = stageStats.map((item) => {
    const stageName = item.stage || item._id || 'Stage';
    const color = STAGE_COLORS[stageName] || '#3B82F6';
    return {
      value: item.count,
      label: stageName.length > 6 ? `${stageName.slice(0, 5)}.` : stageName,
      frontColor: color,
      topLabelComponent: () => (
        <Text className="text-[10px] text-slate-400 font-bold mb-1 text-center">
          {item.count}
        </Text>
      ),
    };
  });

  const agentCallsList: UserCallStats[] = userCallsData?.agents || [];

  const formatSeconds = (sec: number): string => {
    if (!sec || sec <= 0) return '0s';
    const m = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    if (m === 0) return `${s}s`;
    return `${m}m ${s}s`;
  };

  const isLoading =
    dashboardLoading ||
    (isManagerOrAdmin && userCallsLoading) ||
    (isAgent && (agentLeadsLoading || agentFollowUpsLoading));

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      {/* Top Header */}
      <View className="px-5 py-3.5 bg-white border-b border-slate-200 flex-row justify-between items-center shadow-xs">
        <View>
          <Text className="text-slate-500 text-xs font-bold uppercase tracking-wider">
            {isAgent ? 'Agent Workspace' : 'Manager Overview'}
          </Text>
          <Text className="text-2xl font-black text-slate-900 mt-0.5">
            Hello, {user?.name || 'User'} 👋
          </Text>
        </View>

        <Badge
          label={user?.role || 'AGENT'}
          variant={
            user?.role === 'ADMIN'
              ? 'danger'
              : user?.role === 'MANAGER'
              ? 'warning'
              : 'success'
          }
        />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={handleRefreshAll}
            tintColor="#2563EB"
            colors={['#2563EB']}
          />
        }
      >
        {/* =========================================================================
            AGENT VIEW
           ========================================================================= */}
        {isAgent ? (
          <View>
            {/* Start Calling Primary Shortcut Banner */}
            <View className="mb-4 bg-blue-600 rounded-3xl p-5 shadow-lg shadow-blue-500/20">
              <View className="flex-row justify-between items-center mb-3">
                <View className="flex-1 mr-3">
                  <Text className="text-white font-extrabold text-lg">
                    Outbound Calling Queue
                  </Text>
                  <Text className="text-blue-100 text-xs mt-1">
                    {agentLeads.length > 0
                      ? `${agentLeads.length} leads prioritized by campaign and due callbacks`
                      : 'No open assigned leads at this moment'}
                  </Text>
                </View>
                <View className="w-12 h-12 rounded-2xl bg-white/20 border border-white/30 justify-center items-center">
                  <Text className="text-2xl">📞</Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={handleStartCallingShortcut}
                activeOpacity={0.85}
                className="bg-white py-3.5 px-4 rounded-xl flex-row justify-center items-center shadow-sm"
              >
                <Text className="text-blue-700 font-extrabold text-sm mr-2">
                  ▶ Start Calling Now
                </Text>
              </TouchableOpacity>
            </View>

            {/* Today's Key Metrics Section */}
            <Text className="text-slate-900 font-bold text-base mb-3">Today's Activity</Text>

            {isLoading ? (
              <View className="py-8 items-center">
                <ActivityIndicator size="small" color="#2563EB" />
                <Text className="text-slate-500 text-xs mt-2 font-medium">Loading today's stats...</Text>
              </View>
            ) : (
              <View className="gap-3">
                {/* 2x2 Metrics Grid */}
                <View className="flex-row gap-3">
                  {/* Calls Made Today */}
                  <Card className="flex-1 p-4 bg-white border border-slate-200/90 shadow-sm">
                    <Text className="text-slate-500 text-xs font-bold uppercase tracking-wider">
                      Calls Made
                    </Text>
                    <Text className="text-3xl font-black text-slate-900 mt-1">
                      {dashboardData?.callsMade ?? 0}
                    </Text>
                    <Text className="text-slate-400 text-[11px] mt-0.5">Today's total dials</Text>
                  </Card>

                  {/* Connected Calls & Rate */}
                  <Card className="flex-1 p-4 bg-white border border-slate-200/90 shadow-sm">
                    <Text className="text-slate-500 text-xs font-bold uppercase tracking-wider">
                      Connected
                    </Text>
                    <Text className="text-3xl font-black text-emerald-600 mt-1">
                      {dashboardData?.connectedCalls ?? 0}
                    </Text>
                    <Text className="text-emerald-700 font-semibold text-[11px] mt-0.5">
                      {dashboardData?.connectRate ?? 0}% connect rate
                    </Text>
                  </Card>
                </View>

                <View className="flex-row gap-3">
                  {/* Follow-ups Due Today */}
                  <Card className="flex-1 p-4 bg-white border border-slate-200/90 shadow-sm">
                    <Text className="text-slate-500 text-xs font-bold uppercase tracking-wider">
                      Due Today
                    </Text>
                    <Text className="text-3xl font-black text-amber-600 mt-1">
                      {dashboardData?.followUpsDueToday ?? 0}
                    </Text>
                    <Text className="text-slate-400 text-[11px] mt-0.5">Scheduled callbacks</Text>
                  </Card>

                  {/* Overdue Follow-ups */}
                  <Card
                    className={`flex-1 p-4 border ${
                      overdueFollowUpsCount > 0
                        ? 'bg-rose-50/70 border-rose-200'
                        : 'bg-white border-slate-200/90 shadow-sm'
                    }`}
                  >
                    <Text
                      className={`text-xs font-bold uppercase tracking-wider ${
                        overdueFollowUpsCount > 0 ? 'text-rose-700' : 'text-slate-500'
                      }`}
                    >
                      Overdue
                    </Text>
                    <Text
                      className={`text-3xl font-black mt-1 ${
                        overdueFollowUpsCount > 0 ? 'text-rose-600' : 'text-slate-900'
                      }`}
                    >
                      {overdueFollowUpsCount}
                    </Text>
                    <Text
                      className={`text-[11px] mt-0.5 font-medium ${
                        overdueFollowUpsCount > 0 ? 'text-rose-700' : 'text-slate-400'
                      }`}
                    >
                      {overdueFollowUpsCount > 0 ? 'Requires attention!' : 'All caught up'}
                    </Text>
                  </Card>
                </View>

                {/* Quick Navigation Cards */}
                <View className="mt-3">
                  <Text className="text-slate-900 font-bold text-base mb-2.5">Quick Access</Text>

                  <TouchableOpacity
                    onPress={() => (navigation as any).navigate('MyLeads')}
                    activeOpacity={0.8}
                    className="p-4 bg-white border border-slate-200/90 rounded-2xl mb-2.5 flex-row justify-between items-center shadow-sm"
                  >
                    <View className="flex-row items-center">
                      <View className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 items-center justify-center mr-3">
                        <Text className="text-xl">📋</Text>
                      </View>
                      <View>
                        <Text className="text-slate-900 font-bold text-sm">
                          My Assigned Leads
                        </Text>
                        <Text className="text-slate-500 text-xs">
                          Search, filter by stage, and manage leads
                        </Text>
                      </View>
                    </View>
                    <Text className="text-blue-600 text-xl font-bold">›</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => (navigation as any).navigate('FollowUps')}
                    activeOpacity={0.8}
                    className="p-4 bg-white border border-slate-200/90 rounded-2xl flex-row justify-between items-center shadow-sm"
                  >
                    <View className="flex-row items-center">
                      <View className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 items-center justify-center mr-3">
                        <Text className="text-xl">⏰</Text>
                      </View>
                      <View>
                        <Text className="text-slate-900 font-bold text-sm">
                          Follow-up Schedules
                        </Text>
                        <Text className="text-slate-500 text-xs">
                          Overdue, today, and upcoming customer callbacks
                        </Text>
                      </View>
                    </View>
                    <Text className="text-blue-600 text-xl font-bold">›</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        ) : (
          /* =========================================================================
             ADMIN & MANAGER VIEW
             ========================================================================= */
          <View>
            {/* Date Range Selector Bar */}
            <View className="mb-4">
              <View className="flex-row bg-slate-200/70 p-1 rounded-xl border border-slate-200">
                {(
                  [
                    { label: 'Today', value: 'TODAY' },
                    { label: '7 Days', value: '7_DAYS' },
                    { label: '30 Days', value: '30_DAYS' },
                    { label: 'All Time', value: 'ALL_TIME' },
                  ] as Array<{ label: string; value: DateRangeOption }>
                ).map((tab) => {
                  const isSelected = dateRange === tab.value;
                  return (
                    <TouchableOpacity
                      key={tab.value}
                      onPress={() => setDateRange(tab.value)}
                      activeOpacity={0.8}
                      className={`flex-1 py-1.5 rounded-lg items-center ${
                        isSelected ? 'bg-white shadow-xs' : ''
                      }`}
                    >
                      <Text
                        className={`text-xs font-bold ${
                          isSelected ? 'text-blue-700' : 'text-slate-600'
                        }`}
                      >
                        {tab.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {isLoading ? (
              <View className="py-12 items-center">
                <ActivityIndicator size="small" color="#2563EB" />
                <Text className="text-slate-500 text-xs mt-2 font-medium">
                  Calculating analytics metrics...
                </Text>
              </View>
            ) : (
              <View className="gap-4">
                {/* Primary KPI Metrics */}
                <View className="flex-row gap-3">
                  <Card className="flex-1 p-4 bg-white border border-slate-200/90 shadow-sm">
                    <Text className="text-slate-500 text-xs font-bold uppercase tracking-wider">
                      Total Leads
                    </Text>
                    <Text className="text-3xl font-black text-slate-900 mt-1">
                      {dashboardData?.totalLeads ?? 0}
                    </Text>
                    <Text className="text-slate-500 text-[11px] mt-0.5 font-medium">
                      {dashboardData?.openLeads ?? 0} open • {dashboardData?.closedLeads ?? 0} closed
                    </Text>
                  </Card>

                  <Card className="flex-1 p-4 bg-white border border-slate-200/90 shadow-sm">
                    <Text className="text-slate-500 text-xs font-bold uppercase tracking-wider">
                      Connect Rate
                    </Text>
                    <Text className="text-3xl font-black text-emerald-600 mt-1">
                      {dashboardData?.connectRate ?? 0}%
                    </Text>
                    <Text className="text-emerald-700 font-semibold text-[11px] mt-0.5">
                      {dashboardData?.connectedCalls ?? 0} of {dashboardData?.callsMade ?? 0} calls
                    </Text>
                  </Card>
                </View>

                {/* Leads by Stage - Gifted Charts Bar Chart */}
                <Card className="bg-white border border-slate-200/90 shadow-sm p-4">
                  <Text className="text-slate-900 font-black text-base mb-0.5">
                    📊 Leads by Stage
                  </Text>
                  <Text className="text-slate-500 text-xs mb-4">
                    Pipeline distribution across sales stages
                  </Text>

                  {barChartData.length === 0 ? (
                    <Text className="text-slate-400 text-xs py-4 text-center">
                      No stage data recorded for this time range.
                    </Text>
                  ) : (
                    <View className="items-center py-2 overflow-hidden">
                      <BarChart
                        data={barChartData}
                        barWidth={22}
                        spacing={18}
                        roundedTop
                        roundedBottom
                        hideRules
                        xAxisThickness={1}
                        xAxisColor="#E2E8F0"
                        yAxisThickness={1}
                        yAxisColor="#E2E8F0"
                        yAxisTextStyle={{ color: '#64748B', fontSize: 10 }}
                        xAxisLabelTextStyle={{ color: '#64748B', fontSize: 10 }}
                        noOfSections={4}
                        height={160}
                        width={chartWidth}
                      />

                      {/* Stage Legend */}
                      <View className="flex-row flex-wrap justify-center gap-2 mt-4 pt-3 border-t border-slate-100">
                        {stageStats.map((stg) => {
                          const name = stg.stage || stg._id || 'Stage';
                          const color = STAGE_COLORS[name] || '#2563EB';
                          return (
                            <View key={name} className="flex-row items-center mr-2 mb-1">
                              <View
                                style={{ backgroundColor: color }}
                                className="w-2.5 h-2.5 rounded-full mr-1.5"
                              />
                              <Text className="text-slate-600 text-xs">
                                {name}: <Text className="font-bold text-slate-900">{stg.count}</Text>
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  )}
                </Card>

                {/* Per-Agent Call Performance List */}
                <Card className="bg-white border border-slate-200/90 shadow-sm p-4">
                  <Text className="text-slate-900 font-black text-base mb-0.5">
                    👥 Team Call Performance
                  </Text>
                  <Text className="text-slate-500 text-xs mb-3">
                    Outbound dials and durations per agent
                  </Text>

                  {agentCallsList.length === 0 ? (
                    <Text className="text-slate-400 text-xs py-4 text-center">
                      No agent activity found in selected date range.
                    </Text>
                  ) : (
                    <View className="gap-2.5">
                      {agentCallsList.map((agent) => {
                        const rate =
                          agent.calls > 0
                            ? Math.round((agent.connected / agent.calls) * 100)
                            : 0;

                        return (
                          <View
                            key={agent.userId}
                            className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl shadow-xs"
                          >
                            <View className="flex-row justify-between items-start mb-2">
                              <View className="flex-1 mr-2">
                                <Text className="text-slate-900 font-bold text-sm">
                                  {agent.name}
                                </Text>
                                <Text className="text-slate-500 text-xs mt-0.5">
                                  {agent.email}
                                </Text>
                              </View>
                              <Badge
                                label={`${rate}% Connected`}
                                variant={rate >= 50 ? 'success' : 'warning'}
                              />
                            </View>

                            <View className="flex-row justify-between pt-2.5 border-t border-slate-200/60">
                              <View>
                                <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                                  Calls
                                </Text>
                                <Text className="text-slate-800 font-bold text-xs mt-0.5">
                                  {agent.calls} ({agent.connected} conn)
                                </Text>
                              </View>

                              <View>
                                <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                                  Talk Time
                                </Text>
                                <Text className="text-slate-800 font-bold text-xs mt-0.5">
                                  {formatSeconds(agent.totalDurationSeconds)}
                                </Text>
                              </View>

                              <View>
                                <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                                  Avg Call
                                </Text>
                                <Text className="text-slate-800 font-bold text-xs mt-0.5">
                                  {formatSeconds(agent.avgDurationSeconds)}
                                </Text>
                              </View>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </Card>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};
