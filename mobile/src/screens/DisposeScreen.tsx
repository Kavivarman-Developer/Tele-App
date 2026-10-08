import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import {
  fetchPipeline,
  fetchPublicSettings,
  fetchRetryRules,
  fetchAssignableUsers,
  fetchCampaigns,
  fetchCampaignById,
  disposeLead,
} from '../api/leadApi';
import {
  RootStackParamList,
  NotConnectedReasons,
  NotConnectedReason,
  PipelineStage,
  DisposeLeadPayload,
  EngagementQuestion,
  User,
  Campaign,
} from '../types';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { notificationService } from '../services/notification.service';

type ScreenRouteProp = RouteProp<RootStackParamList, 'Dispose'>;
type ScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const REASON_LABELS: Record<NotConnectedReason, string> = {
  DID_NOT_PICK: 'Did Not Pick',
  BUSY: 'Busy',
  USER_DISCONNECTED: 'User Disconnected',
  SWITCHED_OFF: 'Switched Off',
  OUT_OF_COVERAGE: 'Out of Coverage',
  CALL_NOT_COMPLETED: 'Call Not Completed',
  OTHER: 'Other',
  INVALID_NUMBER: 'Invalid Number',
  INCOMING_NOT_AVAILABLE: 'Incoming Not Available',
  NUMBER_NOT_IN_USE: 'Number Not In Use',
};

export const DisposeScreen: React.FC = () => {
  const route = useRoute<ScreenRouteProp>();
  const navigation = useNavigation<ScreenNavigationProp>();
  const queryClient = useQueryClient();

  const {
    lead,
    callDurationSeconds = 0,
    isCallConnected = true,
    detectionMethod = 'MANUAL',
    queue,
    queueIndex,
  } = route.params;

  // Step 1: Was the call connected? (Prefilled from auto-detection or defaulted)
  const [isConnected, setIsConnected] = useState<boolean>(isCallConnected);

  // Connected State
  const [selectedStageName, setSelectedStageName] = useState<string>(lead.stage || 'Interested');
  const [selectedTag, setSelectedTag] = useState<string | null>(lead.tag || null);
  const [engagementAnswers, setEngagementAnswers] = useState<Record<string, unknown>>({});

  // Not Connected State
  const [selectedReason, setSelectedReason] = useState<NotConnectedReason>('DID_NOT_PICK');

  // Shared State
  const [followUpAt, setFollowUpAt] = useState<string | null>(null);
  const [remark, setRemark] = useState<string>('');
  const [duration, setDuration] = useState<number>(callDurationSeconds);

  // Optional Reassignment and Copy State
  const [showReassign, setShowReassign] = useState<boolean>(false);
  const [reassignUserId, setReassignUserId] = useState<string | null>(null);
  const [showCopyCampaign, setShowCopyCampaign] = useState<boolean>(false);
  const [copyCampaignId, setCopyCampaignId] = useState<string | null>(null);

  // Query: Org Public Settings (/api/settings/public)
  const { data: settingsData } = useQuery({
    queryKey: ['publicSettings'],
    queryFn: fetchPublicSettings,
  });
  const orgSettings = settingsData?.settings;

  // Query: Full Campaign (for dynamic engagementForm questions)
  const campaignId = lead.campaign?._id || lead.campaignId;
  const { data: campaignData } = useQuery({
    queryKey: ['campaign', campaignId],
    queryFn: () => fetchCampaignById(campaignId),
    enabled: !!campaignId,
  });
  const engagementQuestions: EngagementQuestion[] =
    campaignData?.campaign?.engagementForm ||
    ('engagementForm' in (lead.campaign || {}) ? (lead.campaign as any).engagementForm : []) ||
    [];

  // Query: Pipeline Stages and Tags (/api/pipelines/:id)
  const pipelineId = lead.campaign?.pipelineId || campaignData?.campaign?.pipelineId;
  const { data: pipelineData, isLoading: pipelineLoading } = useQuery({
    queryKey: ['pipeline', pipelineId],
    queryFn: () => (pipelineId ? fetchPipeline(pipelineId) : Promise.reject('No pipelineId')),
    enabled: !!pipelineId,
  });

  const stages: PipelineStage[] = pipelineData?.pipeline?.stages || [
    { name: 'New', isClosed: false, tags: [], order: 0 },
    { name: 'Interested', isClosed: false, tags: ['hot', 'warm', 'cold'], order: 1 },
    { name: 'Follow Up', isClosed: false, tags: [], order: 2 },
    { name: 'Not Interested', isClosed: false, tags: [], order: 3 },
    { name: 'Converted', isClosed: true, tags: [], order: 4 },
    { name: 'Lost', isClosed: true, tags: [], order: 5 },
  ];

  const currentStage = stages.find((s) => s.name === selectedStageName);
  const isStageClosed = currentStage?.isClosed ?? false;
  const availableTags = currentStage?.tags ?? [];

  // Query: Retry Rules (/api/retry-rules)
  const { data: retryRulesData } = useQuery({
    queryKey: ['retryRules'],
    queryFn: fetchRetryRules,
  });

  // Query: Assignable Users (/api/users?role=AGENT&isActive=true)
  const { data: usersData } = useQuery({
    queryKey: ['assignableUsers'],
    queryFn: fetchAssignableUsers,
    enabled: showReassign,
  });
  const assignableAgents: User[] = usersData?.users || [];

  // Query: Campaigns for Copying (/api/campaigns)
  const { data: allCampaignsData } = useQuery({
    queryKey: ['allCampaigns'],
    queryFn: fetchCampaigns,
    enabled: showCopyCampaign,
  });
  const otherCampaigns: Campaign[] = (allCampaignsData?.campaigns || []).filter(
    (c) => c._id !== campaignId,
  );

  // Automatically calculate suggested retry follow-up delay when switching reasons
  useEffect(() => {
    if (!isConnected && retryRulesData?.retryRules) {
      const rule = retryRulesData.retryRules.find((r) => r.reason === selectedReason);
      if (rule && rule.enabled && rule.steps.length > 0) {
        const stepIdx = Math.min(lead.attemptCount || 0, rule.steps.length - 1);
        const delayMinutes = rule.steps[stepIdx].delayMinutes;
        const suggestedDate = new Date(Date.now() + delayMinutes * 60 * 1000);
        setFollowUpAt(suggestedDate.toISOString());
      }
    }
  }, [isConnected, selectedReason, retryRulesData, lead.attemptCount]);

  // Quick Follow-Up Presets
  const setQuickFollowUp = (hoursAhead: number, specificHour?: number) => {
    const d = new Date();
    if (specificHour !== undefined) {
      d.setDate(d.getDate() + (hoursAhead >= 24 ? Math.floor(hoursAhead / 24) : 1));
      d.setHours(specificHour, 0, 0, 0);
    } else {
      d.setTime(d.getTime() + hoursAhead * 60 * 60 * 1000);
    }
    setFollowUpAt(d.toISOString());
  };

  // Engagement Question Value Handler
  const handleAnswerChange = (questionId: string, value: unknown) => {
    setEngagementAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }));
  };

  // Mutation to Submit Disposition
  const disposeMutation = useMutation({
    mutationFn: async (payload: DisposeLeadPayload) => {
      return disposeLead(lead._id, payload);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['myLeads'] });
      queryClient.invalidateQueries({ queryKey: ['followUps'] });
      queryClient.invalidateQueries({ queryKey: ['leadHistory', lead._id] });

      // Manage local notification reminders
      const updatedLead = data.lead;
      if (updatedLead.status === 'CLOSED' || !updatedLead.nextFollowUpAt) {
        notificationService.cancelFollowUpReminder(lead._id);
      } else if (updatedLead.nextFollowUpAt) {
        notificationService.scheduleFollowUpReminder(updatedLead, updatedLead.nextFollowUpAt);
      }

      // Move to next lead in calling queue if active
      if (queue && queueIndex !== undefined && queueIndex + 1 < queue.length) {
        const nextLead = queue[queueIndex + 1];

        if (Platform.OS === 'web') {
          const callNext = window.confirm(
            `Lead Disposed. Ready for next lead: ${nextLead.name}? Click OK to Call Next Lead, or Cancel to Finish.`,
          );
          if (callNext) {
            navigation.replace('LeadDetail', {
              lead: nextLead,
              queue,
              queueIndex: queueIndex + 1,
            });
          } else {
            navigation.navigate('Main');
          }
          return;
        }

        Alert.alert(
          'Lead Disposed',
          `Outcome recorded. Ready for next lead: ${nextLead.name}?`,
          [
            {
              text: 'Finish Calling',
              style: 'cancel',
              onPress: () => navigation.navigate('Main'),
            },
            {
              text: 'Call Next Lead ›',
              onPress: () => {
                navigation.replace('LeadDetail', {
                  lead: nextLead,
                  queue,
                  queueIndex: queueIndex + 1,
                });
              },
            },
          ],
        );
      } else {
        if (Platform.OS === 'web') {
          window.alert('Lead Disposed: Outcome recorded successfully.');
          navigation.navigate('Main');
          return;
        }

        Alert.alert('Lead Disposed', 'Outcome recorded successfully.', [
          { text: 'OK', onPress: () => navigation.navigate('Main') },
        ]);
      }
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to record disposition';
      if (Platform.OS === 'web') {
        window.alert(`Disposition Failed: ${msg}`);
      } else {
        Alert.alert('Disposition Failed', msg);
      }
    },
  });

  // Comprehensive Pre-Submit Validation
  const handleSubmit = () => {
    if (disposeMutation.isPending) return;

    if (isConnected) {
      if (!selectedStageName) {
        Alert.alert('Validation Error', 'Please select a pipeline stage.');
        return;
      }

      // Check required engagement form questions
      for (const question of engagementQuestions) {
        if (question.required) {
          const answer = engagementAnswers[question.id];
          if (
            answer === undefined ||
            answer === null ||
            answer === '' ||
            (Array.isArray(answer) && answer.length === 0)
          ) {
            Alert.alert(
              'Required Question Missing',
              `Please provide an answer for: "${question.label}"`,
            );
            return;
          }
        }
      }

      // Check followUpAt rule for open stage
      const allowWithoutFollowUp = orgSettings?.allowDisposeWithoutFollowUp ?? false;
      if (!isStageClosed && !allowWithoutFollowUp && !followUpAt) {
        Alert.alert(
          'Follow-up Required',
          'Organization policy requires scheduling a follow-up date and time for non-closed stages.',
        );
        return;
      }
    } else {
      // Not connected
      if (!selectedReason) {
        Alert.alert('Validation Error', 'Please select a not-connected reason.');
        return;
      }

      const followUpMandatory = orgSettings?.followUpMandatoryForNotConnected ?? false;
      if (followUpMandatory && !followUpAt) {
        Alert.alert(
          'Follow-up Required',
          'Organization policy requires scheduling a follow-up date and time for not-connected calls.',
        );
        return;
      }
    }

    const formattedAnswers = Object.entries(engagementAnswers).map(([qId, val]) => ({
      questionId: qId,
      value: val,
    }));

    const payload: DisposeLeadPayload = {
      connected: isConnected,
      notConnectedReason: isConnected ? undefined : selectedReason,
      stage: isConnected ? selectedStageName : undefined,
      tag: isConnected && selectedTag ? selectedTag : undefined,
      followUpAt: isConnected ? (isStageClosed ? null : followUpAt) : followUpAt,
      remark: remark.trim() || undefined,
      durationSeconds: Math.max(0, duration),
      answers: formattedAnswers,
      reassignToUserId: reassignUserId || undefined,
      copyToCampaignId: copyCampaignId || undefined,
    };

    disposeMutation.mutate(payload);
  };

  const formatDisplayTime = (isoString?: string | null): string => {
    if (!isoString) return 'None selected';
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return `${d.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
    })} at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  // Render Dynamic Engagement Question
  const renderEngagementQuestion = (question: EngagementQuestion) => {
    const value = engagementAnswers[question.id];

    switch (question.type) {
      case 'NUMBER':
        return (
          <View key={question.id} className="mb-3">
            <Text className="text-slate-800 text-xs font-semibold mb-1">
              {question.label} {question.required ? <Text className="text-red-500">*</Text> : null}
            </Text>
            <TextInput
              value={value !== undefined ? String(value) : ''}
              onChangeText={(text) => handleAnswerChange(question.id, text ? Number(text) : '')}
              keyboardType="numeric"
              placeholder="Enter number..."
              placeholderTextColor="#94A3B8"
              className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 text-sm"
            />
          </View>
        );

      case 'LONG_ANSWER':
        return (
          <View key={question.id} className="mb-3">
            <Text className="text-slate-800 text-xs font-semibold mb-1">
              {question.label} {question.required ? <Text className="text-red-500">*</Text> : null}
            </Text>
            <TextInput
              value={value !== undefined ? String(value) : ''}
              onChangeText={(text) => handleAnswerChange(question.id, text)}
              multiline
              numberOfLines={3}
              placeholder="Enter detailed response..."
              placeholderTextColor="#94A3B8"
              textAlignVertical="top"
              className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 text-sm min-h-[70px]"
            />
          </View>
        );

      case 'DATE':
        return (
          <View key={question.id} className="mb-3">
            <Text className="text-slate-800 text-xs font-semibold mb-1">
              {question.label} {question.required ? <Text className="text-red-500">*</Text> : null}
            </Text>
            <View className="flex-row items-center gap-2">
              <TextInput
                value={value !== undefined ? String(value) : ''}
                onChangeText={(text) => handleAnswerChange(question.id, text)}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#94A3B8"
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 text-sm"
              />
              <TouchableOpacity
                onPress={() =>
                  handleAnswerChange(question.id, new Date().toISOString().split('T')[0])
                }
                className="bg-slate-100 border border-slate-200 px-3 py-3 rounded-xl"
              >
                <Text className="text-blue-600 text-xs font-semibold">Today</Text>
              </TouchableOpacity>
            </View>
          </View>
        );

      case 'TIME':
        return (
          <View key={question.id} className="mb-3">
            <Text className="text-slate-800 text-xs font-semibold mb-1">
              {question.label} {question.required ? <Text className="text-red-500">*</Text> : null}
            </Text>
            <View className="flex-row items-center gap-2">
              <TextInput
                value={value !== undefined ? String(value) : ''}
                onChangeText={(text) => handleAnswerChange(question.id, text)}
                placeholder="HH:mm (e.g. 14:30)"
                placeholderTextColor="#94A3B8"
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 text-sm"
              />
              <TouchableOpacity
                onPress={() =>
                  handleAnswerChange(
                    question.id,
                    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  )
                }
                className="bg-slate-100 border border-slate-200 px-3 py-3 rounded-xl"
              >
                <Text className="text-blue-600 text-xs font-semibold">Now</Text>
              </TouchableOpacity>
            </View>
          </View>
        );

      case 'MULTIPLE_CHOICE':
      case 'DROPDOWN':
        return (
          <View key={question.id} className="mb-3">
            <Text className="text-slate-800 text-xs font-semibold mb-1.5">
              {question.label} {question.required ? <Text className="text-red-500">*</Text> : null}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {question.options.map((opt) => {
                const isSelected = value === opt;
                return (
                  <TouchableOpacity
                    key={opt}
                    onPress={() => handleAnswerChange(question.id, opt)}
                    activeOpacity={0.8}
                    className={`px-3 py-2 rounded-xl border ${
                      isSelected
                        ? 'bg-blue-600 border-blue-600 shadow-xs'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <Text
                      className={`text-xs font-medium ${
                        isSelected ? 'text-white font-bold' : 'text-slate-700'
                      }`}
                    >
                      {opt}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        );

      case 'CHECKBOX':
        const selectedArr = Array.isArray(value) ? (value as string[]) : [];
        return (
          <View key={question.id} className="mb-3">
            <Text className="text-slate-800 text-xs font-semibold mb-1.5">
              {question.label} {question.required ? <Text className="text-red-500">*</Text> : null}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {question.options.map((opt) => {
                const isChecked = selectedArr.includes(opt);
                return (
                  <TouchableOpacity
                    key={opt}
                    onPress={() => {
                      const updated = isChecked
                        ? selectedArr.filter((item) => item !== opt)
                        : [...selectedArr, opt];
                      handleAnswerChange(question.id, updated);
                    }}
                    activeOpacity={0.8}
                    className={`px-3 py-2 rounded-xl border flex-row items-center gap-1.5 ${
                      isChecked
                        ? 'bg-emerald-50 border-emerald-400'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <Text className="text-xs">{isChecked ? '☑️' : '◻️'}</Text>
                    <Text
                      className={`text-xs font-medium ${
                        isChecked ? 'text-emerald-800 font-bold' : 'text-slate-700'
                      }`}
                    >
                      {opt}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        );

      case 'TEXT':
      case 'SHORT_ANSWER':
      default:
        return (
          <View key={question.id} className="mb-3">
            <Text className="text-slate-800 text-xs font-semibold mb-1">
              {question.label} {question.required ? <Text className="text-red-500">*</Text> : null}
            </Text>
            <TextInput
              value={value !== undefined ? String(value) : ''}
              onChangeText={(text) => handleAnswerChange(question.id, text)}
              placeholder="Enter answer..."
              placeholderTextColor="#94A3B8"
              className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 text-sm"
            />
          </View>
        );
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      {/* Top Header */}
      <View className="bg-white px-4 py-3.5 border-b border-slate-200 flex-row justify-between items-center shadow-xs">
        <TouchableOpacity onPress={() => navigation.goBack()} className="p-1 -ml-1">
          <Text className="text-slate-500 text-sm font-semibold">✕ Cancel</Text>
        </TouchableOpacity>
        <Text className="text-slate-900 font-bold text-base">Record Disposition</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Lead Summary Banner */}
        <Card className="mb-4">
          <View className="flex-row justify-between items-center">
            <View className="flex-1 mr-2">
              <Text className="text-slate-900 font-bold text-base">{lead.name}</Text>
              <Text className="text-blue-600 text-xs font-semibold">{lead.phone}</Text>
            </View>
            <View className="bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
              <Text className="text-slate-700 text-xs font-semibold">
                ⏱️ Call: {duration}s
              </Text>
            </View>
          </View>
        </Card>

        {/* Auto-Detection Indicator Banner */}
        {detectionMethod === 'AUTOMATIC' && (
          <View className="mb-4 bg-blue-50 border border-blue-200 rounded-2xl p-3.5 flex-row items-center">
            <View className="w-9 h-9 rounded-full bg-blue-100 items-center justify-center mr-3 border border-blue-200">
              <Text className="text-blue-600 text-base">⚡</Text>
            </View>
            <View className="flex-1">
              <View className="flex-row items-center justify-between">
                <Text className="text-xs font-bold text-blue-900">
                  Android Call Log Auto-Detected
                </Text>
                <Badge
                  label={isConnected ? 'Connected' : 'Not Connected'}
                  variant={isConnected ? 'success' : 'warning'}
                />
              </View>
              <Text className="text-[11px] text-blue-700 mt-1 leading-4">
                Duration ({duration}s) and status synced from device call log. You can tap below to override.
              </Text>
            </View>
          </View>
        )}

        {/* STEP 1: Was the call connected? */}
        <View className="mb-5">
          <Text className="text-slate-900 font-bold text-base mb-2">
            Was the call connected?
          </Text>
          <View className="flex-row bg-slate-100 p-1.5 rounded-2xl border border-slate-200 gap-2">
            <TouchableOpacity
              onPress={() => setIsConnected(true)}
              activeOpacity={0.85}
              className={`flex-1 py-4 rounded-xl items-center flex-row justify-center ${
                isConnected
                  ? 'bg-emerald-600 shadow-sm'
                  : 'bg-transparent active:bg-slate-200/50'
              }`}
            >
              <Text className="text-xl mr-2">✅</Text>
              <Text
                className={`font-bold text-base ${
                  isConnected ? 'text-white' : 'text-slate-600'
                }`}
              >
                Yes, Connected
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setIsConnected(false)}
              activeOpacity={0.85}
              className={`flex-1 py-4 rounded-xl items-center flex-row justify-center ${
                !isConnected
                  ? 'bg-amber-600 shadow-sm'
                  : 'bg-transparent active:bg-slate-200/50'
              }`}
            >
              <Text className="text-xl mr-2">❌</Text>
              <Text
                className={`font-bold text-base ${
                  !isConnected ? 'text-white' : 'text-slate-600'
                }`}
              >
                Not Connected
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* CONNECTED OUTCOME SECTION */}
        {isConnected ? (
          <View className="gap-4">
            {/* Dynamic Engagement Form Questions */}
            {engagementQuestions.length > 0 ? (
              <Card>
                <Text className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-3">
                  📋 Campaign Questionnaire
                </Text>
                {engagementQuestions.map(renderEngagementQuestion)}
              </Card>
            ) : null}

            {/* Pipeline Stage Picker */}
            <Card>
              <Text className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">
                Pipeline Stage *
              </Text>
              {pipelineLoading ? (
                <ActivityIndicator size="small" color="#2563EB" />
              ) : (
                <View className="flex-row flex-wrap gap-2">
                  {stages.map((stg) => {
                    const isSelected = selectedStageName === stg.name;
                    return (
                      <TouchableOpacity
                        key={stg.name}
                        onPress={() => {
                          setSelectedStageName(stg.name);
                          setSelectedTag(null);
                          if (stg.isClosed) {
                            setFollowUpAt(null);
                          }
                        }}
                        activeOpacity={0.8}
                        className={`px-3.5 py-2 rounded-xl border ${
                          isSelected
                            ? stg.isClosed
                              ? 'bg-purple-600 border-purple-600 shadow-xs'
                              : 'bg-blue-600 border-blue-600 shadow-xs'
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <Text
                          className={`text-xs font-semibold ${
                            isSelected ? 'text-white font-bold' : 'text-slate-700'
                          }`}
                        >
                          {stg.name} {stg.isClosed ? '🔒' : ''}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {isStageClosed ? (
                <View className="mt-3 bg-purple-50 border border-purple-200 p-2.5 rounded-xl">
                  <Text className="text-purple-700 text-xs font-medium">
                    🔒 This stage closes the lead (Converted / Lost). Follow-up will not be scheduled.
                  </Text>
                </View>
              ) : null}
            </Card>

            {/* Tag Picker (filtered by selected stage) */}
            {availableTags.length > 0 ? (
              <Card>
                <Text className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">
                  Stage Tag
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {availableTags.map((tag) => {
                    const isSelected = selectedTag === tag;
                    return (
                      <TouchableOpacity
                        key={tag}
                        onPress={() => setSelectedTag(isSelected ? null : tag)}
                        activeOpacity={0.8}
                        className={`px-3.5 py-1.5 rounded-full border ${
                          isSelected
                            ? 'bg-blue-50 border-blue-500'
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <Text
                          className={`text-xs capitalize font-medium ${
                            isSelected ? 'text-blue-700 font-bold' : 'text-slate-600'
                          }`}
                        >
                          🏷️ {tag}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </Card>
            ) : null}

            {/* Follow-up Picker */}
            {!isStageClosed ? (
              <Card>
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="text-slate-500 text-xs font-bold uppercase tracking-wider">
                    Next Follow-up{' '}
                    {!orgSettings?.allowDisposeWithoutFollowUp ? (
                      <Text className="text-red-500">* (Mandatory)</Text>
                    ) : (
                      '(Optional)'
                    )}
                  </Text>
                  {followUpAt ? (
                    <TouchableOpacity onPress={() => setFollowUpAt(null)}>
                      <Text className="text-xs text-red-500 font-bold">Clear</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                <View className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 mb-3">
                  <Text className="text-slate-500 text-xs">Selected Follow-up:</Text>
                  <Text className="text-amber-700 font-bold text-sm mt-0.5">
                    {formatDisplayTime(followUpAt)}
                  </Text>
                </View>

                <View className="flex-row flex-wrap gap-2">
                  <TouchableOpacity
                    onPress={() => setQuickFollowUp(1)}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200"
                  >
                    <Text className="text-slate-700 text-xs font-semibold">+1 Hour</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setQuickFollowUp(3)}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200"
                  >
                    <Text className="text-slate-700 text-xs font-semibold">+3 Hours</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setQuickFollowUp(24, 10)}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200"
                  >
                    <Text className="text-slate-700 text-xs font-semibold">
                      Tomorrow 10 AM
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setQuickFollowUp(24, 15)}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200"
                  >
                    <Text className="text-slate-700 text-xs font-semibold">
                      Tomorrow 3 PM
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setQuickFollowUp(48, 10)}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200"
                  >
                    <Text className="text-slate-700 text-xs font-semibold">In 2 Days</Text>
                  </TouchableOpacity>
                </View>
              </Card>
            ) : null}
          </View>
        ) : (
          /* NOT CONNECTED OUTCOME SECTION */
          <View className="gap-4">
            {/* 10 Not-Connected Reasons Picker */}
            <Card>
              <Text className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-3">
                Reason *
              </Text>
              <View className="gap-2">
                {NotConnectedReasons.map((reason) => {
                  const isSelected = selectedReason === reason;
                  return (
                    <TouchableOpacity
                      key={reason}
                      onPress={() => setSelectedReason(reason)}
                      activeOpacity={0.8}
                      className={`p-3 rounded-xl border flex-row justify-between items-center ${
                        isSelected
                          ? 'bg-amber-50 border-amber-400'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <Text
                        className={`text-sm ${
                          isSelected ? 'text-amber-900 font-bold' : 'text-slate-700 font-medium'
                        }`}
                      >
                        {REASON_LABELS[reason]}
                      </Text>
                      {isSelected ? (
                        <Text className="text-amber-600 font-bold text-sm">✓</Text>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Card>

            {/* Follow-up for Not Connected */}
            <Card>
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-slate-500 text-xs font-bold uppercase tracking-wider">
                  Retry Follow-up{' '}
                  {orgSettings?.followUpMandatoryForNotConnected ? (
                    <Text className="text-red-500">* (Mandatory)</Text>
                  ) : (
                    '(Auto-calculated)'
                  )}
                </Text>
                {followUpAt ? (
                  <TouchableOpacity onPress={() => setFollowUpAt(null)}>
                    <Text className="text-xs text-red-500 font-bold">Clear</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              <View className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 mb-3">
                <Text className="text-slate-500 text-xs">Suggested Next Attempt:</Text>
                <Text className="text-amber-700 font-bold text-sm mt-0.5">
                  {formatDisplayTime(followUpAt)}
                </Text>
              </View>

              <View className="flex-row flex-wrap gap-2">
                <TouchableOpacity
                  onPress={() => setQuickFollowUp(1)}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200"
                >
                  <Text className="text-slate-700 text-xs font-semibold">+1 Hour</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setQuickFollowUp(24, 10)}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200"
                >
                  <Text className="text-slate-700 text-xs font-semibold">
                    Tomorrow 10 AM
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setQuickFollowUp(24, 15)}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200"
                >
                  <Text className="text-slate-700 text-xs font-semibold">
                    Tomorrow 3 PM
                  </Text>
                </TouchableOpacity>
              </View>
            </Card>
          </View>
        )}

        {/* Remark Text Box */}
        <Card className="mt-4">
          <Text className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">
            Call Remark / Notes
          </Text>
          <TextInput
            value={remark}
            onChangeText={setRemark}
            placeholder="Add notes about the conversation, feedback, or follow-up reason..."
            placeholderTextColor="#94A3B8"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 text-sm min-h-[80px]"
          />
        </Card>

        {/* Call Duration (Editable Override) */}
        <Card className="mt-4">
          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-slate-500 text-xs font-bold uppercase tracking-wider">
              Call Duration (Seconds)
            </Text>
            {detectionMethod === 'AUTOMATIC' ? (
              <Badge label="Auto-Detected" variant="info" />
            ) : (
              <Badge label="Manual" variant="default" />
            )}
          </View>
          <View className="flex-row items-center gap-3">
            <TextInput
              value={String(duration)}
              onChangeText={(val) => {
                const cleaned = val.replace(/\D/g, '');
                const num = parseInt(cleaned, 10);
                setDuration(isNaN(num) ? 0 : num);
              }}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor="#94A3B8"
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 text-sm"
            />
            <View className="bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 items-center justify-center">
              <Text className="text-slate-700 font-bold text-xs">
                {Math.floor(duration / 60)}m {duration % 60}s
              </Text>
            </View>
          </View>
        </Card>

        {/* OPTIONAL: Reassign to Another User */}
        <Card className="mt-4">
          <TouchableOpacity
            onPress={() => setShowReassign(!showReassign)}
            className="flex-row justify-between items-center"
          >
            <View>
              <Text className="text-slate-900 font-bold text-sm">
                👤 Reassign Lead (Optional)
              </Text>
              <Text className="text-slate-500 text-xs mt-0.5">
                {reassignUserId
                  ? `Selected: ${
                      assignableAgents.find((u) => u._id === reassignUserId)?.name ||
                      reassignUserId
                    }`
                  : 'Assign lead to another active agent'}
              </Text>
            </View>
            <Text className="text-blue-600 text-sm font-bold">
              {showReassign ? '▲ Hide' : '▼ Show'}
            </Text>
          </TouchableOpacity>

          {showReassign ? (
            <View className="mt-3 pt-3 border-t border-slate-100">
              {assignableAgents.length === 0 ? (
                <Text className="text-slate-400 text-xs">No active agents available.</Text>
              ) : (
                <View className="flex-row flex-wrap gap-2">
                  <TouchableOpacity
                    onPress={() => setReassignUserId(null)}
                    className={`px-3 py-1.5 rounded-xl border ${
                      reassignUserId === null
                        ? 'bg-blue-600 border-blue-600'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <Text
                      className={`text-xs font-semibold ${
                        reassignUserId === null ? 'text-white font-bold' : 'text-slate-700'
                      }`}
                    >
                      Keep Current Agent
                    </Text>
                  </TouchableOpacity>

                  {assignableAgents.map((agent) => {
                    const isSelected = reassignUserId === agent._id;
                    return (
                      <TouchableOpacity
                        key={agent._id}
                        onPress={() => setReassignUserId(agent._id)}
                        className={`px-3 py-1.5 rounded-xl border ${
                          isSelected
                            ? 'bg-blue-600 border-blue-600'
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <Text
                          className={`text-xs font-semibold ${
                            isSelected ? 'text-white font-bold' : 'text-slate-700'
                          }`}
                        >
                          {agent.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          ) : null}
        </Card>

        {/* OPTIONAL: Copy to Another Campaign */}
        <Card className="mt-4">
          <TouchableOpacity
            onPress={() => setShowCopyCampaign(!showCopyCampaign)}
            className="flex-row justify-between items-center"
          >
            <View>
              <Text className="text-slate-900 font-bold text-sm">
                📋 Copy to Campaign (Optional)
              </Text>
              <Text className="text-slate-500 text-xs mt-0.5">
                {copyCampaignId
                  ? `Selected: ${
                      otherCampaigns.find((c) => c._id === copyCampaignId)?.name ||
                      copyCampaignId
                    }`
                  : 'Duplicate lead into a parallel campaign'}
              </Text>
            </View>
            <Text className="text-blue-600 text-sm font-bold">
              {showCopyCampaign ? '▲ Hide' : '▼ Show'}
            </Text>
          </TouchableOpacity>

          {showCopyCampaign ? (
            <View className="mt-3 pt-3 border-t border-slate-100">
              {otherCampaigns.length === 0 ? (
                <Text className="text-slate-400 text-xs">No other campaigns available.</Text>
              ) : (
                <View className="flex-row flex-wrap gap-2">
                  <TouchableOpacity
                    onPress={() => setCopyCampaignId(null)}
                    className={`px-3 py-1.5 rounded-xl border ${
                      copyCampaignId === null
                        ? 'bg-blue-600 border-blue-600'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <Text
                      className={`text-xs font-semibold ${
                        copyCampaignId === null ? 'text-white font-bold' : 'text-slate-700'
                      }`}
                    >
                      None
                    </Text>
                  </TouchableOpacity>

                  {otherCampaigns.map((camp) => {
                    const isSelected = copyCampaignId === camp._id;
                    return (
                      <TouchableOpacity
                        key={camp._id}
                        onPress={() => setCopyCampaignId(camp._id)}
                        className={`px-3 py-1.5 rounded-xl border ${
                          isSelected
                            ? 'bg-blue-600 border-blue-600'
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <Text
                          className={`text-xs font-semibold ${
                            isSelected ? 'text-white font-bold' : 'text-slate-700'
                          }`}
                        >
                          {camp.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          ) : null}
        </Card>

        {/* Submit Disposition Button */}
        <View className="mt-6">
          <Button
            title={disposeMutation.isPending ? 'Saving Disposition...' : 'Submit Disposition'}
            onPress={handleSubmit}
            loading={disposeMutation.isPending}
            disabled={disposeMutation.isPending}
            variant="primary"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};
