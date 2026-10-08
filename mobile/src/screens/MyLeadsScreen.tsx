import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
  Alert,
  TextInput,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { fetchMyLeads, fetchCampaigns } from '../api/leadApi';
import { Lead, LeadFilterType, RootStackParamList } from '../types';
import { Badge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { Loader } from '../components/Loader';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const FILTER_TABS: Array<{ label: string; value: LeadFilterType }> = [
  { label: 'All', value: 'ALL' },
  { label: 'New', value: 'NEW' },
  { label: 'Follow-up', value: 'FOLLOW_UP' },
  { label: 'Not Connected', value: 'NOT_CONNECTED' },
];

export const MyLeadsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();

  const [activeFilter, setActiveFilter] = useState<LeadFilterType>('ALL');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Fetch campaigns for campaign filter
  const { data: campaignData } = useQuery({
    queryKey: ['campaigns'],
    queryFn: fetchCampaigns,
  });

  // Infinite query for leads
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useInfiniteQuery({
    queryKey: ['myLeads', activeFilter, selectedCampaignId],
    queryFn: ({ pageParam = 1 }) =>
      fetchMyLeads({
        type: activeFilter,
        campaignId: selectedCampaignId || undefined,
        page: pageParam,
        limit: 20,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
  });

  const allLeads: Lead[] = data?.pages.flatMap((page) => page.leads) ?? [];

  // Real-time quick search filter by name or phone
  const filteredLeads = useMemo(() => {
    if (!searchQuery.trim()) return allLeads;
    const q = searchQuery.toLowerCase().trim();
    return allLeads.filter(
      (lead) =>
        lead.name.toLowerCase().includes(q) ||
        lead.phone.toLowerCase().includes(q) ||
        (lead.email && lead.email.toLowerCase().includes(q)),
    );
  }, [allLeads, searchQuery]);

  const handleStartCalling = () => {
    if (filteredLeads.length === 0) {
      if (Platform.OS === 'web') {
        window.alert('Queue Empty: There are no leads in the current calling queue.');
      } else {
        Alert.alert('Queue Empty', 'There are no leads in the current calling queue.');
      }
      return;
    }

    // Leads are returned by the server in strict priority order:
    // (Campaign priority HIGH -> MEDIUM -> LOW, then follow-up due soonest)
    navigation.navigate('LeadDetail', {
      lead: filteredLeads[0],
      queue: filteredLeads,
      queueIndex: 0,
    });
  };

  const handleOpenLead = (lead: Lead, index: number) => {
    navigation.navigate('LeadDetail', {
      lead,
      queue: filteredLeads,
      queueIndex: index,
    });
  };

  const formatFollowUpTime = (dateStr?: string | null): string => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday) {
      return `Today, ${timeString}`;
    }
    return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeString}`;
  };

  const isFollowUpOverdue = (dateStr?: string | null): boolean => {
    if (!dateStr) return false;
    return new Date(dateStr).getTime() < Date.now();
  };

  const renderLeadCard = ({ item: lead, index }: { item: Lead; index: number }) => {
    const campaignName = lead.campaign?.name || 'Standard Campaign';
    const campaignPriority = lead.campaign?.priority;
    const isOverdue = lead.followUpDue || isFollowUpOverdue(lead.nextFollowUpAt);

    return (
      <TouchableOpacity
        onPress={() => handleOpenLead(lead, index)}
        activeOpacity={0.7}
        className="bg-white border border-slate-200/90 rounded-2xl p-4 mb-3 shadow-xs"
      >
        {/* Top Header: Name & Priority */}
        <View className="flex-row justify-between items-start mb-1.5">
          <View className="flex-1 mr-2">
            <Text className="text-slate-900 font-bold text-base" numberOfLines={1}>
              {lead.name}
            </Text>
            <Text className="text-slate-500 text-xs mt-0.5 font-medium">{lead.phone}</Text>
          </View>

          {campaignPriority ? (
            <Badge
              label={campaignPriority}
              variant={
                campaignPriority === 'HIGH'
                  ? 'danger'
                  : campaignPriority === 'MEDIUM'
                  ? 'warning'
                  : 'default'
              }
            />
          ) : null}
        </View>

        {/* Campaign Info */}
        <View className="flex-row items-center mb-3">
          <Text className="text-blue-600 text-xs font-semibold mr-2">
            📁 {campaignName}
          </Text>
          <Text className="text-slate-300 text-xs">•</Text>
          <Text className="text-slate-500 text-xs ml-2">
            Attempts: {lead.attemptCount}
          </Text>
        </View>

        {/* Badges and Follow-up Row */}
        <View className="flex-row flex-wrap items-center gap-1.5 pt-2.5 border-t border-slate-100">
          <Badge label={lead.stage} variant="info" />
          {lead.tag ? <Badge label={lead.tag} variant="default" /> : null}

          {lead.nextFollowUpAt ? (
            <View
              className={`flex-row items-center px-2.5 py-0.5 rounded-full border ${
                isOverdue
                  ? 'bg-red-50 border-red-200'
                  : 'bg-amber-50 border-amber-200'
              }`}
            >
              <Text
                className={`text-xs font-medium ${
                  isOverdue ? 'text-red-600 font-bold' : 'text-amber-700'
                }`}
              >
                ⏰ {formatFollowUpTime(lead.nextFollowUpAt)}
              </Text>
            </View>
          ) : null}

          {/* Call action button icon */}
          <View className="ml-auto flex-row items-center bg-blue-50 border border-blue-200 px-3 py-1 rounded-lg">
            <Text className="text-blue-600 text-xs font-bold">Open Lead ›</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      {/* Top Header Bar */}
      <View className="bg-white px-4 py-3.5 border-b border-slate-200 flex-row justify-between items-center shadow-xs">
        <View className="flex-1 mr-2">
          <Text className="text-xl font-black text-slate-900">My Leads</Text>
          <Text className="text-xs text-slate-500 font-medium mt-0.5">
            {filteredLeads.length} {filteredLeads.length === 1 ? 'lead' : 'leads'} in calling queue
          </Text>
        </View>

        <View className="flex-row items-center gap-2">
          {/* Add Walk-in Lead Button */}
          <TouchableOpacity
            onPress={() => navigation.navigate('AddWalkInLead')}
            activeOpacity={0.8}
            className="bg-slate-100 border border-slate-200 px-3 py-2 rounded-xl flex-row items-center"
          >
            <Text className="text-slate-700 text-xs font-bold">+ Walk-in</Text>
          </TouchableOpacity>

          {/* Start Calling Button */}
          <TouchableOpacity
            onPress={handleStartCalling}
            disabled={filteredLeads.length === 0}
            activeOpacity={0.85}
            className={`flex-row items-center bg-blue-600 px-3.5 py-2 rounded-xl shadow-sm ${
              filteredLeads.length === 0 ? 'opacity-50' : 'active:bg-blue-700'
            }`}
          >
            <Text className="text-white text-xs font-bold mr-1">📞 Start Calling</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Quick Search Bar */}
      <View className="px-4 pt-3 pb-1 bg-slate-50">
        <View className="flex-row items-center bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-xs">
          <Text className="text-slate-400 mr-2 text-sm">🔍</Text>
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search leads by name or phone..."
            placeholderTextColor="#94A3B8"
            className="flex-1 text-slate-900 text-xs py-1"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')} className="p-1">
              <Text className="text-slate-400 text-xs font-bold">✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Segmented Filter Bar */}
      <View className="px-4 py-2 bg-slate-50">
        <View className="flex-row bg-slate-200/60 p-1 rounded-xl">
          {FILTER_TABS.map((tab) => {
            const isSelected = activeFilter === tab.value;
            return (
              <TouchableOpacity
                key={tab.value}
                onPress={() => setActiveFilter(tab.value)}
                activeOpacity={0.8}
                className={`flex-1 py-1.5 rounded-lg items-center ${
                  isSelected ? 'bg-white shadow-xs' : ''
                }`}
              >
                <Text
                  className={`text-xs font-bold ${
                    isSelected ? 'text-blue-600' : 'text-slate-600'
                  }`}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Campaign Filter Pill Selector */}
      {campaignData?.campaigns && campaignData.campaigns.length > 0 ? (
        <View className="py-2 bg-slate-50 border-b border-slate-200/80">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
          >
            <TouchableOpacity
              onPress={() => setSelectedCampaignId(null)}
              activeOpacity={0.8}
              className={`px-3 py-1 rounded-full border ${
                selectedCampaignId === null
                  ? 'bg-blue-50 border-blue-500'
                  : 'bg-white border-slate-200'
              }`}
            >
              <Text
                className={`text-xs font-semibold ${
                  selectedCampaignId === null ? 'text-blue-600 font-bold' : 'text-slate-600'
                }`}
              >
                All Campaigns
              </Text>
            </TouchableOpacity>

            {campaignData.campaigns.map((camp) => {
              const isSelected = selectedCampaignId === camp._id;
              return (
                <TouchableOpacity
                  key={camp._id}
                  onPress={() => setSelectedCampaignId(camp._id)}
                  activeOpacity={0.8}
                  className={`px-3 py-1 rounded-full border ${
                    isSelected
                      ? 'bg-blue-50 border-blue-500'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <Text
                    className={`text-xs font-semibold ${
                      isSelected ? 'text-blue-600 font-bold' : 'text-slate-600'
                    }`}
                  >
                    {camp.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {/* Main Leads List */}
      {isLoading ? (
        <Loader message="Loading assigned leads..." />
      ) : isError ? (
        <View className="flex-1 justify-center items-center px-6">
          <Text className="text-red-500 font-bold text-base mb-1">
            Failed to load leads
          </Text>
          <Text className="text-slate-500 text-xs text-center mb-4">
            {error instanceof Error ? error.message : 'An unexpected error occurred'}
          </Text>
          <TouchableOpacity
            onPress={() => refetch()}
            className="bg-blue-600 px-5 py-2.5 rounded-xl"
          >
            <Text className="text-white font-semibold text-sm">Retry</Text>
          </TouchableOpacity>
        </View>
      ) : filteredLeads.length === 0 ? (
        <EmptyState
          title={searchQuery ? 'No Matching Leads' : 'No Leads Found'}
          description={
            searchQuery
              ? `No leads found matching "${searchQuery}".`
              : activeFilter === 'ALL'
              ? 'You do not have any open assigned leads currently.'
              : `No leads matching the "${activeFilter.replace('_', ' ')}" filter.`
          }
        />
      ) : (
        <FlatList
          data={filteredLeads}
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
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) {
              fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            isFetchingNextPage ? (
              <View className="py-4 items-center">
                <ActivityIndicator size="small" color="#2563EB" />
                <Text className="text-slate-500 text-xs mt-1">Loading more leads...</Text>
              </View>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
};
