import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';

import { fetchMyLeads } from '../api/leadApi';
import { Lead, RootStackParamList } from '../types';
import { Badge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { Loader } from '../components/Loader';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type FollowUpTab = 'OVERDUE' | 'TODAY' | 'UPCOMING';

export const FollowUpsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const [activeTab, setActiveTab] = useState<FollowUpTab>('TODAY');

  // Fetch follow-up leads
  const {
    data,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['followUps'],
    queryFn: () => fetchMyLeads({ type: 'FOLLOW_UP', limit: 100 }),
  });

  const leads = data?.leads ?? [];

  // Categorize leads into Overdue, Today, and Upcoming
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const endOfToday = startOfToday + 24 * 60 * 60 * 1000 - 1;

  const overdueLeads: Lead[] = [];
  const todayLeads: Lead[] = [];
  const upcomingLeads: Lead[] = [];

  for (const lead of leads) {
    if (!lead.nextFollowUpAt) continue;
    const followUpTime = new Date(lead.nextFollowUpAt).getTime();

    if (followUpTime < now.getTime()) {
      overdueLeads.push(lead);
    } else if (followUpTime >= startOfToday && followUpTime <= endOfToday) {
      todayLeads.push(lead);
    } else if (followUpTime > endOfToday) {
      upcomingLeads.push(lead);
    }
  }

  // Active list based on selected tab
  let displayedLeads = todayLeads;
  if (activeTab === 'OVERDUE') displayedLeads = overdueLeads;
  if (activeTab === 'UPCOMING') displayedLeads = upcomingLeads;

  const handleOpenLead = (lead: Lead) => {
    navigation.navigate('LeadDetail', { lead });
  };

  const formatFollowUpTime = (dateStr: string): string => {
    const d = new Date(dateStr);
    return `${d.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
    })} at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  const renderLeadCard = ({ item: lead }: { item: Lead }) => {
    const isOverdue = new Date(lead.nextFollowUpAt || '').getTime() < now.getTime();

    return (
      <TouchableOpacity
        onPress={() => handleOpenLead(lead)}
        activeOpacity={0.7}
        className="bg-white border border-slate-200/90 rounded-2xl p-4 mb-3 shadow-xs"
      >
        <View className="flex-row justify-between items-start mb-2">
          <View className="flex-1 mr-2">
            <Text className="text-slate-900 font-bold text-base">{lead.name}</Text>
            <Text className="text-blue-600 text-xs font-semibold mt-0.5">{lead.phone}</Text>
          </View>
          <Badge
            label={isOverdue ? 'OVERDUE' : 'SCHEDULED'}
            variant={isOverdue ? 'danger' : 'warning'}
          />
        </View>

        <View className="flex-row items-center mb-2.5">
          <Text className="text-slate-500 text-xs mr-2">
            📁 {lead.campaign?.name || 'Campaign'}
          </Text>
          <Text className="text-slate-300 text-xs">•</Text>
          <Text className="text-slate-500 text-xs ml-2">Attempts: {lead.attemptCount}</Text>
        </View>

        <View className="flex-row items-center justify-between pt-2.5 border-t border-slate-100">
          <View className="flex-row items-center gap-1.5">
            <Badge label={lead.stage} variant="info" />
            {lead.tag ? <Badge label={lead.tag} variant="default" /> : null}
          </View>

          <View className="flex-row items-center">
            <Text
              className={`text-xs font-semibold ${
                isOverdue ? 'text-red-600 font-bold' : 'text-amber-700'
              }`}
            >
              ⏰ {lead.nextFollowUpAt ? formatFollowUpTime(lead.nextFollowUpAt) : 'No date'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      {/* Top Header */}
      <View className="bg-white px-5 py-3.5 border-b border-slate-200 shadow-xs">
        <Text className="text-xl font-black text-slate-900">Scheduled Follow-ups</Text>
        <Text className="text-xs text-slate-500 font-medium mt-0.5">
          {leads.length} total scheduled callback {leads.length === 1 ? 'task' : 'tasks'}
        </Text>
      </View>

      {/* Segmented Tabs: Overdue, Today, Upcoming */}
      <View className="px-4 py-2.5 bg-slate-50">
        <View className="flex-row bg-slate-200/60 p-1 rounded-xl">
          {/* Overdue Tab */}
          <TouchableOpacity
            onPress={() => setActiveTab('OVERDUE')}
            activeOpacity={0.8}
            className={`flex-1 py-2 rounded-lg items-center flex-row justify-center ${
              activeTab === 'OVERDUE' ? 'bg-red-500 shadow-xs' : ''
            }`}
          >
            <Text
              className={`text-xs font-bold ${
                activeTab === 'OVERDUE' ? 'text-white' : 'text-slate-600'
              }`}
            >
              Overdue ({overdueLeads.length})
            </Text>
          </TouchableOpacity>

          {/* Today Tab */}
          <TouchableOpacity
            onPress={() => setActiveTab('TODAY')}
            activeOpacity={0.8}
            className={`flex-1 py-2 rounded-lg items-center flex-row justify-center ${
              activeTab === 'TODAY' ? 'bg-white shadow-xs' : ''
            }`}
          >
            <Text
              className={`text-xs font-bold ${
                activeTab === 'TODAY' ? 'text-blue-600' : 'text-slate-600'
              }`}
            >
              Today ({todayLeads.length})
            </Text>
          </TouchableOpacity>

          {/* Upcoming Tab */}
          <TouchableOpacity
            onPress={() => setActiveTab('UPCOMING')}
            activeOpacity={0.8}
            className={`flex-1 py-2 rounded-lg items-center flex-row justify-center ${
              activeTab === 'UPCOMING' ? 'bg-white shadow-xs' : ''
            }`}
          >
            <Text
              className={`text-xs font-bold ${
                activeTab === 'UPCOMING' ? 'text-blue-600' : 'text-slate-600'
              }`}
            >
              Upcoming ({upcomingLeads.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main List */}
      {isLoading ? (
        <Loader message="Loading follow-up tasks..." />
      ) : isError ? (
        <View className="flex-1 justify-center items-center px-6">
          <Text className="text-red-500 font-bold text-base mb-1">
            Failed to load follow-ups
          </Text>
          <TouchableOpacity
            onPress={() => refetch()}
            className="bg-blue-600 px-5 py-2.5 rounded-xl mt-3"
          >
            <Text className="text-white font-semibold text-sm">Retry</Text>
          </TouchableOpacity>
        </View>
      ) : displayedLeads.length === 0 ? (
        <EmptyState
          title={
            activeTab === 'OVERDUE'
              ? 'No Overdue Follow-ups'
              : activeTab === 'TODAY'
              ? 'No Follow-ups Due Today'
              : 'No Upcoming Follow-ups'
          }
          description={
            activeTab === 'OVERDUE'
              ? 'Great job! You have zero overdue follow-up calls.'
              : activeTab === 'TODAY'
              ? 'No more callbacks scheduled for today.'
              : 'Future callbacks will appear here when scheduled.'
          }
        />
      ) : (
        <FlatList
          data={displayedLeads}
          keyExtractor={(item) => item._id}
          renderItem={renderLeadCard}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor="#2563EB"
              colors={['#2563EB']}
            />
          }
        />
      )}
    </SafeAreaView>
  );
};
