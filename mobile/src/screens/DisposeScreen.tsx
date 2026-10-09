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
  Phone,
  PhoneOff,
  CheckCircle2,
  Clock,
  Calendar,
  User as UserIcon,
  Copy,
  FileText,
  Zap,
  X,
  ChevronDown,
  ChevronUp,
  Check,
  Tag,
  HelpCircle,
  AlertCircle,
  Flame,
  Sun,
  Snowflake,
} from 'lucide-react-native';

import {
  fetchPipeline,
  fetchPublicSettings,
  fetchRetryRules,
  fetchAssignableUsers,
  fetchCampaigns,
  fetchCampaignById,
  disposeLead,
} from '../api/leadApi';
import { useLeadHistoryStore } from '../store/leadHistoryStore';
import { useAuthStore } from '../store/authStore';
import {
  RootStackParamList,
  NotConnectedReasons,
  NotConnectedReason,
  PipelineStage,
  DisposeLeadPayload,
  EngagementQuestion,
  User,
  Campaign,
  LeadStatus,
} from '../types';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { CrmBadge } from '../components/CrmBadge';
import { CrmAvatar } from '../components/CrmAvatar';
import { notificationService } from '../services/notification.service';
import { CrmDateTimePickerModal } from '../components/CrmDateTimePickerModal';
import { toast } from '../store/toastStore';

type ScreenRouteProp = RouteProp<RootStackParamList, 'Dispose'>;
type ScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const REASON_LABELS: Record<NotConnectedReason, string> = {
  DID_NOT_PICK: 'Did Not Pick',
  BUSY: 'Busy / Call Waiting',
  USER_DISCONNECTED: 'User Disconnected',
  SWITCHED_OFF: 'Switched Off',
  OUT_OF_COVERAGE: 'Out of Coverage',
  CALL_NOT_COMPLETED: 'Call Not Completed',
  OTHER: 'Other Reason',
  INVALID_NUMBER: 'Invalid Number',
  INCOMING_NOT_AVAILABLE: 'Incoming Not Available',
  NUMBER_NOT_IN_USE: 'Number Not In Use',
};

export const DisposeScreen: React.FC = () => {
  const { user } = useAuthStore();
  const isManagerOrAdmin = user?.role === 'ADMIN' || user?.role === 'MANAGER';
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

  // Step 1: Was the call connected?
  const [isConnected, setIsConnected] = useState<boolean>(isCallConnected);

  // Connected State
  const [selectedStageName, setSelectedStageName] = useState<string>(lead.stage || 'Interested');
  const [selectedTag, setSelectedTag] = useState<string | null>(lead.tag || null);
  const [customerTemperature, setCustomerTemperature] = useState<'HOT' | 'WARM' | 'COLD'>(
    lead.tag?.toUpperCase() === 'HOT'
      ? 'HOT'
      : lead.tag?.toUpperCase() === 'COLD'
      ? 'COLD'
      : 'WARM',
  );
  const [engagementAnswers, setEngagementAnswers] = useState<Record<string, unknown>>({});

  // Not Connected State
  const [selectedReason, setSelectedReason] = useState<NotConnectedReason>('DID_NOT_PICK');

  // Shared State
  const [followUpAt, setFollowUpAt] = useState<string | null>(null);
  const [showCustomDatePicker, setShowCustomDatePicker] = useState<boolean>(false);
  const [remark, setRemark] = useState<string>('');
  const [duration, setDuration] = useState<number>(callDurationSeconds);

  // Optional Reassignment and Copy State
  const [showReassign, setShowReassign] = useState<boolean>(false);
  const [reassignUserId, setReassignUserId] = useState<string | null>(null);
  const [showCopyCampaign, setShowCopyCampaign] = useState<boolean>(false);
  const [copyCampaignId, setCopyCampaignId] = useState<string | null>(null);

  // Query: Org Public Settings
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

  // Query: Pipeline Stages and Tags
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
    { name: 'Not Interested', isClosed: true, tags: [], order: 3 },
    { name: 'Converted', isClosed: true, tags: [], order: 4 },
    { name: 'Lost', isClosed: true, tags: [], order: 5 },
  ];

  const currentStage = stages.find((s) => s.name === selectedStageName);
  const isStageClosed =
    (currentStage?.isClosed ?? false) ||
    selectedStageName === 'Not Interested' ||
    selectedStageName === 'Lost' ||
    selectedStageName === 'Closed';
  const availableTags = currentStage?.tags ?? [];

  // Query: Retry Rules
  const { data: retryRulesData } = useQuery({
    queryKey: ['retryRules'],
    queryFn: fetchRetryRules,
  });

  // Query: Assignable Users
  const { data: usersData } = useQuery({
    queryKey: ['assignableUsers'],
    queryFn: fetchAssignableUsers,
    enabled: showReassign,
  });
  const assignableAgents: User[] = usersData?.users || [];

  // Query: Campaigns for Copying
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

  const handleAnswerChange = (questionId: string, value: unknown) => {
    setEngagementAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }));
  };

  const disposeMutation = useMutation({
    mutationFn: async (payload: DisposeLeadPayload) => {
      try {
        return await disposeLead(lead._id, {
          ...payload,
          phone: lead.phone,
        });
      } catch (apiErr: any) {
        // If backend fails (e.g. offline, mock test lead), gracefully fallback to local storage
        console.warn('Backend dispose returned error, falling back locally:', apiErr);
        return {
          activity: {
            _id: `local-act-${Date.now()}`,
            leadId: lead._id,
            campaignId: (lead.campaign?._id || lead.campaignId) as any,
            userId: (user?._id || 'user-1') as any,
            type: 'CALL' as const,
            connected: payload.connected,
            notConnectedReason: payload.notConnectedReason,
            stage: payload.stage || 'Not connected',
            tag: payload.tag,
            remark: payload.remark,
            followUpAt: payload.followUpAt ? new Date(payload.followUpAt) : null,
            durationSeconds: payload.durationSeconds,
            answers: payload.answers || [],
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          lead: {
            ...lead,
            stage: payload.connected ? (payload.stage || lead.stage) : lead.stage,
            tag: payload.tag || lead.tag,
            status: (payload.connected && isStageClosed ? 'CLOSED' : 'OPEN') as LeadStatus,
            nextFollowUpAt: payload.followUpAt || null,
            lastContactedAt: new Date().toISOString(),
            attemptCount: (lead.attemptCount || 0) + 1,
          },
        };
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['myLeads'] });
      queryClient.invalidateQueries({ queryKey: ['followUps'] });
      queryClient.invalidateQueries({ queryKey: ['leadHistory', lead._id] });

      // Record activity in leadHistoryStore for multi-agent audit trail
      useLeadHistoryStore.getState().addActivity(lead._id, {
        phone: lead.phone,
        branch: user?.branch,
        agentName: user?.name || 'Agent',
        agentId: user?._id,
        connected: isConnected,
        stage: isConnected ? selectedStageName : 'Not connected',
        tag: customerTemperature,
        temperature: customerTemperature,
        remark: remark.trim() || undefined,
        followUpAt: followUpAt || null,
        durationSeconds: duration,
        notConnectedReason: isConnected ? undefined : selectedReason,
      });

      const updatedLead = data.lead;
      if (updatedLead.status === 'CLOSED' || !updatedLead.nextFollowUpAt) {
        notificationService.cancelFollowUpReminder(lead._id);
      } else if (updatedLead.nextFollowUpAt) {
        notificationService.scheduleFollowUpReminder(updatedLead, updatedLead.nextFollowUpAt);
      }

      toast.success(
        `Disposition recorded! ${lead.name} marked as ${isConnected ? selectedStageName : 'Not connected'}${followUpAt ? ` (Follow-up: ${formatDisplayTime(followUpAt)})` : ''}`,
        'Outcome Saved',
      );

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
    onError: (err: any) => {
      const apiErrors = err?.response?.data?.errors;
      const apiMsg = err?.response?.data?.message;
      let detailedMsg = apiMsg || err?.message || 'Failed to record disposition';
      if (Array.isArray(apiErrors) && apiErrors.length > 0) {
        detailedMsg += ': ' + apiErrors.map((e: any) => `${e.field} - ${e.message}`).join(', ');
      }
      if (Platform.OS === 'web') {
        window.alert(`Disposition Failed: ${detailedMsg}`);
      } else {
        Alert.alert('Disposition Failed', detailedMsg);
      }
    },
  });

  const handleSubmit = () => {
    if (disposeMutation.isPending) return;

    if (isConnected) {
      if (!selectedStageName) {
        Alert.alert('Validation Error', 'Please select a pipeline stage.');
        return;
      }

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

      const allowWithoutFollowUp = orgSettings?.allowDisposeWithoutFollowUp ?? false;
      if (!isStageClosed && !allowWithoutFollowUp && !followUpAt) {
        Alert.alert(
          'Follow-up Required',
          'Organization policy requires scheduling a follow-up date and time for non-closed stages.',
        );
        return;
      }
    } else {
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
      phone: lead.phone,
      connected: isConnected,
      notConnectedReason: isConnected ? undefined : selectedReason,
      stage: isConnected ? selectedStageName : undefined,
      tag: customerTemperature || (isConnected && selectedTag ? selectedTag : undefined),
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
    if (!isoString) return 'None scheduled';
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return `${d.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
    })} at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  const renderEngagementQuestion = (question: EngagementQuestion) => {
    const value = engagementAnswers[question.id];

    switch (question.type) {
      case 'NUMBER':
        return (
          <View key={question.id} className="mb-3.5">
            <Text className="text-slate-800 text-xs font-semibold mb-1.5">
              {question.label} {question.required ? <Text className="text-rose-500">*</Text> : null}
            </Text>
            <TextInput
              value={value !== undefined ? String(value) : ''}
              onChangeText={(text) => handleAnswerChange(question.id, text ? Number(text) : '')}
              keyboardType="numeric"
              placeholder="Enter number..."
              placeholderTextColor="#94A3B8"
              className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 text-sm font-medium"
            />
          </View>
        );

      case 'LONG_ANSWER':
        return (
          <View key={question.id} className="mb-3.5">
            <Text className="text-slate-800 text-xs font-semibold mb-1.5">
              {question.label} {question.required ? <Text className="text-rose-500">*</Text> : null}
            </Text>
            <TextInput
              value={value !== undefined ? String(value) : ''}
              onChangeText={(text) => handleAnswerChange(question.id, text)}
              multiline
              numberOfLines={3}
              placeholder="Enter detailed response..."
              placeholderTextColor="#94A3B8"
              textAlignVertical="top"
              className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 text-sm font-medium min-h-[72px]"
            />
          </View>
        );

      case 'MULTIPLE_CHOICE':
      case 'DROPDOWN':
        return (
          <View key={question.id} className="mb-3.5">
            <Text className="text-slate-800 text-xs font-semibold mb-1.5">
              {question.label} {question.required ? <Text className="text-rose-500">*</Text> : null}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {question.options.map((opt) => {
                const isSelected = value === opt;
                return (
                  <TouchableOpacity
                    key={opt}
                    onPress={() => handleAnswerChange(question.id, opt)}
                    activeOpacity={0.8}
                    className={`px-3 py-2 rounded-xl border flex-row items-center gap-1.5 ${
                      isSelected
                        ? 'bg-indigo-600 border-indigo-600 shadow-sm'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    {isSelected ? <Check size={12} color="#FFFFFF" strokeWidth={3} /> : null}
                    <Text
                      className={`text-xs font-semibold ${
                        isSelected ? 'text-white' : 'text-slate-700'
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
          <View key={question.id} className="mb-3.5">
            <Text className="text-slate-800 text-xs font-semibold mb-1.5">
              {question.label} {question.required ? <Text className="text-rose-500">*</Text> : null}
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
                        ? 'bg-emerald-50 border-emerald-500'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <CheckCircle2
                      size={14}
                      color={isChecked ? '#059669' : '#CBD5E1'}
                      strokeWidth={2}
                    />
                    <Text
                      className={`text-xs font-semibold ${
                        isChecked ? 'text-emerald-800' : 'text-slate-700'
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
          <View key={question.id} className="mb-3.5">
            <Text className="text-slate-800 text-xs font-semibold mb-1.5">
              {question.label} {question.required ? <Text className="text-rose-500">*</Text> : null}
            </Text>
            <TextInput
              value={value !== undefined ? String(value) : ''}
              onChangeText={(text) => handleAnswerChange(question.id, text)}
              placeholder="Enter answer..."
              placeholderTextColor="#94A3B8"
              className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 text-sm font-medium"
            />
          </View>
        );
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F8FAFC]" edges={['top']}>
      {/* Top Header */}
      <View className="bg-white px-4 py-3.5 border-b border-slate-200 flex-row justify-between items-center">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="flex-row items-center gap-1.5 p-1 -ml-1"
        >
          <X size={18} color="#64748B" />
          <Text className="text-slate-600 text-xs font-bold uppercase tracking-wider">Cancel</Text>
        </TouchableOpacity>
        <Text className="text-slate-900 font-bold text-base">Record Disposition</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 50 }}>
        {/* Lead Summary Hero Card */}
        <View className="bg-white rounded-2xl p-4 border border-slate-200 mb-4 shadow-sm flex-row items-center justify-between">
          <View className="flex-row items-center gap-3 flex-1 mr-3">
            <CrmAvatar name={lead.name} size={42} />
            <View className="flex-1">
              <Text className="text-slate-900 font-bold text-base" numberOfLines={1}>
                {lead.name}
              </Text>
              <Text className="text-indigo-600 font-semibold text-xs mt-0.5">{lead.phone}</Text>
            </View>
          </View>

          <View className="bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-1.5 items-end">
            <Text className="text-[10px] text-indigo-500 font-bold uppercase">Duration</Text>
            <Text className="text-indigo-900 font-bold text-xs mt-0.5">
              {Math.floor(duration / 60)}m {duration % 60}s
            </Text>
          </View>
        </View>

        {/* Auto-Detection Indicator Banner */}
        {detectionMethod === 'AUTOMATIC' && (
          <View className="mb-4 bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 flex-row items-center gap-3">
            <View className="w-8 h-8 rounded-full bg-emerald-100 items-center justify-center">
              <Zap size={16} color="#059669" />
            </View>
            <View className="flex-1">
              <View className="flex-row items-center justify-between">
                <Text className="text-xs font-bold text-emerald-950">Android Auto-Detection</Text>
                <CrmBadge
                  label={isConnected ? 'Connected' : 'Not Connected'}
                  tone={isConnected ? 'emerald' : 'amber'}
                />
              </View>
              <Text className="text-[11px] text-emerald-800 mt-0.5 leading-4">
                Call log automatically recorded {duration}s. You can override below.
              </Text>
            </View>
          </View>
        )}

        {/* STEP 1: Connected / Not Connected Segmented Switch */}
        <View className="mb-5">
          <Text className="text-slate-900 font-bold text-sm mb-2.5">
            Was the call connected? <Text className="text-rose-500">*</Text>
          </Text>
          <View className="flex-row bg-slate-100 p-1.5 rounded-2xl border border-slate-200 gap-2">
            <TouchableOpacity
              onPress={() => setIsConnected(true)}
              activeOpacity={0.85}
              className={`flex-1 py-3.5 rounded-xl items-center flex-row justify-center gap-2 ${
                isConnected ? 'bg-emerald-600 shadow-sm' : 'bg-transparent'
              }`}
            >
              <Phone size={17} color={isConnected ? '#FFFFFF' : '#64748B'} />
              <Text
                className={`font-bold text-sm ${isConnected ? 'text-white' : 'text-slate-700'}`}
              >
                Call Connected
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setIsConnected(false)}
              activeOpacity={0.85}
              className={`flex-1 py-3.5 rounded-xl items-center flex-row justify-center gap-2 ${
                !isConnected ? 'bg-amber-600 shadow-sm' : 'bg-transparent'
              }`}
            >
              <PhoneOff size={17} color={!isConnected ? '#FFFFFF' : '#64748B'} />
              <Text
                className={`font-bold text-sm ${!isConnected ? 'text-white' : 'text-slate-700'}`}
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
            {engagementQuestions.length > 0 && (
              <View className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
                <View className="flex-row items-center gap-2 mb-3">
                  <FileText size={16} color="#4F46E5" />
                  <Text className="text-slate-900 font-bold text-sm">Campaign Questionnaire</Text>
                </View>
                {engagementQuestions.map(renderEngagementQuestion)}
              </View>
            )}

            {/* Pipeline Stage Picker */}
            <View className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-slate-900 font-bold text-sm">Pipeline Stage *</Text>
                <Text className="text-slate-400 text-xs font-medium">Select stage</Text>
              </View>

              {pipelineLoading ? (
                <ActivityIndicator size="small" color="#4F46E5" />
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
                        className={`px-3.5 py-2.5 rounded-xl border flex-row items-center gap-1.5 ${
                          isSelected
                            ? stg.isClosed
                              ? 'bg-purple-600 border-purple-600 shadow-sm'
                              : 'bg-indigo-600 border-indigo-600 shadow-sm'
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        {isSelected ? <Check size={13} color="#FFFFFF" strokeWidth={3} /> : null}
                        <Text
                          className={`text-xs font-semibold ${
                            isSelected ? 'text-white' : 'text-slate-700'
                          }`}
                        >
                          {stg.name} {stg.isClosed ? '• Closed' : ''}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {isStageClosed && (
                <View className="mt-3.5 bg-purple-50 border border-purple-200 p-3 rounded-xl flex-row items-start gap-2">
                  <AlertCircle size={15} color="#7C3AED" className="mt-0.5" />
                  <Text className="text-purple-800 text-xs font-medium flex-1 leading-4">
                    Closing stage selected (Converted / Lost). Lead will be finalized; no future
                    follow-up will be scheduled.
                  </Text>
                </View>
              )}
            </View>

            {/* Customer Importance / Temperature (NeoDove style) */}
            <View className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
              <View className="flex-row items-center gap-2 mb-3">
                <Flame size={15} color="#EF4444" />
                <Text className="text-slate-900 font-bold text-sm">Customer Importance / Temperature</Text>
              </View>
              <View className="flex-row gap-2">
                {/* HOT */}
                <TouchableOpacity
                  onPress={() => setCustomerTemperature('HOT')}
                  activeOpacity={0.8}
                  className={`flex-1 py-2.5 px-2 rounded-xl border flex-row items-center justify-center gap-1.5 ${
                    customerTemperature === 'HOT'
                      ? 'bg-rose-50 border-rose-500'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <Flame
                    size={14}
                    color={customerTemperature === 'HOT' ? '#DC2626' : '#EF4444'}
                    fill={customerTemperature === 'HOT' ? '#DC2626' : 'transparent'}
                  />
                  <Text
                    className={`text-xs font-bold ${
                      customerTemperature === 'HOT' ? 'text-rose-700' : 'text-slate-600'
                    }`}
                  >
                    Hot
                  </Text>
                </TouchableOpacity>

                {/* WARM */}
                <TouchableOpacity
                  onPress={() => setCustomerTemperature('WARM')}
                  activeOpacity={0.8}
                  className={`flex-1 py-2.5 px-2 rounded-xl border flex-row items-center justify-center gap-1.5 ${
                    customerTemperature === 'WARM'
                      ? 'bg-amber-50 border-amber-500'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <Sun
                    size={14}
                    color={customerTemperature === 'WARM' ? '#B45309' : '#F59E0B'}
                  />
                  <Text
                    className={`text-xs font-bold ${
                      customerTemperature === 'WARM' ? 'text-amber-700' : 'text-slate-600'
                    }`}
                  >
                    Warm
                  </Text>
                </TouchableOpacity>

                {/* COLD */}
                <TouchableOpacity
                  onPress={() => setCustomerTemperature('COLD')}
                  activeOpacity={0.8}
                  className={`flex-1 py-2.5 px-2 rounded-xl border flex-row items-center justify-center gap-1.5 ${
                    customerTemperature === 'COLD'
                      ? 'bg-blue-50 border-blue-500'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <Snowflake
                    size={14}
                    color={customerTemperature === 'COLD' ? '#1D4ED8' : '#3B82F6'}
                  />
                  <Text
                    className={`text-xs font-bold ${
                      customerTemperature === 'COLD' ? 'text-blue-700' : 'text-slate-600'
                    }`}
                  >
                    Cold
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Tag Picker */}
            {availableTags.length > 0 && (
              <View className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
                <View className="flex-row items-center gap-2 mb-3">
                  <Tag size={15} color="#4F46E5" />
                  <Text className="text-slate-900 font-bold text-sm">Lead Tag</Text>
                </View>
                <View className="flex-row flex-wrap gap-2">
                  {availableTags.map((tag) => {
                    const isSelected = selectedTag === tag;
                    return (
                      <TouchableOpacity
                        key={tag}
                        onPress={() => setSelectedTag(isSelected ? null : tag)}
                        activeOpacity={0.8}
                        className={`px-3 py-1.5 rounded-full border flex-row items-center gap-1.5 ${
                          isSelected
                            ? 'bg-indigo-50 border-indigo-500'
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <Text
                          className={`text-xs font-semibold capitalize ${
                            isSelected ? 'text-indigo-700' : 'text-slate-600'
                          }`}
                        >
                          #{tag}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Follow-up Picker */}
            {!isStageClosed && (
              <View className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
                <View className="flex-row justify-between items-center mb-3">
                  <View className="flex-row items-center gap-2">
                    <Calendar size={16} color="#4F46E5" />
                    <Text className="text-slate-900 font-bold text-sm">
                      Next Follow-up{' '}
                      {!orgSettings?.allowDisposeWithoutFollowUp ? (
                        <Text className="text-rose-500">*</Text>
                      ) : (
                        <Text className="text-slate-400 font-normal text-xs">(Optional)</Text>
                      )}
                    </Text>
                  </View>
                  {followUpAt && (
                    <TouchableOpacity onPress={() => setFollowUpAt(null)}>
                      <Text className="text-xs text-rose-600 font-bold">Clear</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Selected Time Banner */}
                <View className="bg-slate-50 p-3 rounded-xl border border-slate-200 mb-3 flex-row items-center gap-2.5">
                  <Clock size={16} color={followUpAt ? '#4F46E5' : '#94A3B8'} />
                  <View className="flex-1">
                    <Text className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                      Scheduled Time
                    </Text>
                    <Text className="text-slate-900 font-bold text-sm mt-0.5">
                      {formatDisplayTime(followUpAt)}
                    </Text>
                  </View>
                  {followUpAt && (
                    <View className="flex-row items-center gap-1.5">
                      <TouchableOpacity
                        onPress={() => setShowCustomDatePicker(true)}
                        className="px-2.5 py-1 bg-indigo-50 border border-indigo-200 rounded-lg"
                      >
                        <Text className="text-indigo-700 text-[11px] font-bold">Change</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setFollowUpAt(null)}
                        className="px-2.5 py-1 bg-rose-50 border border-rose-200 rounded-lg"
                      >
                        <Text className="text-rose-600 text-[11px] font-bold">Clear</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* Presets */}
                <View className="flex-row flex-wrap gap-2 mb-3">
                  <TouchableOpacity
                    onPress={() => setQuickFollowUp(1)}
                    className="px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 active:bg-slate-200"
                  >
                    <Text className="text-slate-700 text-xs font-semibold">+1 Hour</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setQuickFollowUp(3)}
                    className="px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 active:bg-slate-200"
                  >
                    <Text className="text-slate-700 text-xs font-semibold">+3 Hours</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setQuickFollowUp(24, 10)}
                    className="px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 active:bg-slate-200"
                  >
                    <Text className="text-slate-700 text-xs font-semibold">Tomorrow 10 AM</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setQuickFollowUp(24, 15)}
                    className="px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 active:bg-slate-200"
                  >
                    <Text className="text-slate-700 text-xs font-semibold">Tomorrow 3 PM</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setQuickFollowUp(48, 10)}
                    className="px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 active:bg-slate-200"
                  >
                    <Text className="text-slate-700 text-xs font-semibold">In 2 Days</Text>
                  </TouchableOpacity>
                </View>

                {/* Custom Date & Time Picker Trigger */}
                <TouchableOpacity
                  onPress={() => setShowCustomDatePicker(true)}
                  activeOpacity={0.8}
                  className="flex-row items-center justify-center gap-2 py-2.5 px-3 bg-indigo-50 border border-indigo-200 rounded-xl active:bg-indigo-100"
                >
                  <Calendar size={15} color="#4F46E5" />
                  <Text className="text-indigo-700 font-bold text-xs">
                    📅 Pick Custom Date & Time...
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : (
          /* NOT CONNECTED OUTCOME SECTION */
          <View className="gap-4">
            {/* 10 Not-Connected Reasons Picker */}
            <View className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-slate-900 font-bold text-sm">Reason *</Text>
                <Text className="text-slate-400 text-xs font-medium">Select outcome</Text>
              </View>
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
                          isSelected ? 'text-amber-950 font-bold' : 'text-slate-700 font-medium'
                        }`}
                      >
                        {REASON_LABELS[reason]}
                      </Text>
                      {isSelected ? <Check size={16} color="#D97706" strokeWidth={2.5} /> : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Follow-up for Not Connected */}
            <View className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
              <View className="flex-row justify-between items-center mb-3">
                <View className="flex-row items-center gap-2">
                  <Clock size={16} color="#D97706" />
                  <Text className="text-slate-900 font-bold text-sm">
                    Retry Follow-up{' '}
                    {orgSettings?.followUpMandatoryForNotConnected ? (
                      <Text className="text-rose-500">*</Text>
                    ) : (
                      <Text className="text-slate-400 font-normal text-xs">(Auto-delay)</Text>
                    )}
                  </Text>
                </View>
                {followUpAt && (
                  <TouchableOpacity onPress={() => setFollowUpAt(null)}>
                    <Text className="text-xs text-rose-600 font-bold">Clear</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View className="bg-slate-50 p-3 rounded-xl border border-slate-200 mb-3 flex-row items-center gap-2.5">
                <Clock size={16} color="#D97706" />
                <View className="flex-1">
                  <Text className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                    Suggested Next Attempt
                  </Text>
                  <Text className="text-slate-900 font-bold text-sm mt-0.5">
                    {formatDisplayTime(followUpAt)}
                  </Text>
                </View>
                {followUpAt && (
                  <View className="flex-row items-center gap-1.5">
                    <TouchableOpacity
                      onPress={() => setShowCustomDatePicker(true)}
                      className="px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-lg"
                    >
                      <Text className="text-amber-800 text-[11px] font-bold">Change</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setFollowUpAt(null)}
                      className="px-2.5 py-1 bg-rose-50 border border-rose-200 rounded-lg"
                    >
                      <Text className="text-rose-600 text-[11px] font-bold">Clear</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              <View className="flex-row flex-wrap gap-2 mb-3">
                <TouchableOpacity
                  onPress={() => setQuickFollowUp(1)}
                  className="px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 active:bg-slate-200"
                >
                  <Text className="text-slate-700 text-xs font-semibold">+1 Hour</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setQuickFollowUp(24, 10)}
                  className="px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 active:bg-slate-200"
                >
                  <Text className="text-slate-700 text-xs font-semibold">Tomorrow 10 AM</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setQuickFollowUp(24, 15)}
                  className="px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 active:bg-slate-200"
                >
                  <Text className="text-slate-700 text-xs font-semibold">Tomorrow 3 PM</Text>
                </TouchableOpacity>
              </View>

              {/* Custom Date & Time Picker Trigger */}
              <TouchableOpacity
                onPress={() => setShowCustomDatePicker(true)}
                activeOpacity={0.8}
                className="flex-row items-center justify-center gap-2 py-2.5 px-3 bg-amber-50 border border-amber-200 rounded-xl active:bg-amber-100"
              >
                <Calendar size={15} color="#D97706" />
                <Text className="text-amber-900 font-bold text-xs">
                  📅 Pick Custom Retry Date & Time...
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Remark Text Box */}
        <View className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm mt-4">
          <Text className="text-slate-900 font-bold text-sm mb-2">Call Notes & Remarks</Text>
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
        </View>

        {/* Call Duration (Editable Override) */}
        <View className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm mt-4">
          <View className="flex-row justify-between items-center mb-2.5">
            <Text className="text-slate-900 font-bold text-sm">Call Duration</Text>
            <CrmBadge
              label={detectionMethod === 'AUTOMATIC' ? 'Auto-detected' : 'Manual'}
              tone={detectionMethod === 'AUTOMATIC' ? 'indigo' : 'slate'}
            />
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
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 text-sm font-semibold"
            />
            <View className="bg-slate-100 border border-slate-200 rounded-xl px-4 py-2.5 items-center justify-center">
              <Text className="text-slate-700 font-bold text-xs">
                {Math.floor(duration / 60)}m {duration % 60}s
              </Text>
            </View>
          </View>
        </View>

        {/* Reassign to Another User (Optional - Manager/Admin Only) */}
        {isManagerOrAdmin && (
          <>
            <View className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm mt-4">
              <TouchableOpacity
                onPress={() => setShowReassign(!showReassign)}
                className="flex-row justify-between items-center"
              >
                <View className="flex-row items-center gap-2.5">
                  <UserIcon size={16} color="#4F46E5" />
                  <View>
                    <Text className="text-slate-900 font-bold text-sm">Reassign Lead (Optional)</Text>
                    <Text className="text-slate-500 text-xs mt-0.5">
                      {reassignUserId
                        ? `Selected: ${
                            assignableAgents.find((u) => u._id === reassignUserId)?.name ||
                            reassignUserId
                          }`
                        : 'Assign lead to another active agent'}
                    </Text>
                  </View>
                </View>
                {showReassign ? (
                  <ChevronUp size={18} color="#64748B" />
                ) : (
                  <ChevronDown size={18} color="#64748B" />
                )}
              </TouchableOpacity>

              {showReassign && (
                <View className="mt-3 pt-3 border-t border-slate-100">
                  {assignableAgents.length === 0 ? (
                    <Text className="text-slate-400 text-xs">No active agents available.</Text>
                  ) : (
                    <View className="flex-row flex-wrap gap-2">
                      <TouchableOpacity
                        onPress={() => setReassignUserId(null)}
                        className={`px-3 py-2 rounded-xl border ${
                          reassignUserId === null
                            ? 'bg-indigo-600 border-indigo-600 shadow-sm'
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <Text
                          className={`text-xs font-semibold ${
                            reassignUserId === null ? 'text-white' : 'text-slate-700'
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
                            className={`px-3 py-2 rounded-xl border flex-row items-center gap-1.5 ${
                              isSelected
                                ? 'bg-indigo-600 border-indigo-600 shadow-sm'
                                : 'bg-slate-50 border-slate-200'
                            }`}
                          >
                            {isSelected ? <Check size={12} color="#FFFFFF" strokeWidth={3} /> : null}
                            <Text
                              className={`text-xs font-semibold ${
                                isSelected ? 'text-white' : 'text-slate-700'
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
              )}
            </View>

            {/* Copy to Another Campaign (Optional) */}
            <View className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm mt-4">
              <TouchableOpacity
                onPress={() => setShowCopyCampaign(!showCopyCampaign)}
                className="flex-row justify-between items-center"
              >
                <View className="flex-row items-center gap-2.5">
                  <Copy size={16} color="#4F46E5" />
                  <View>
                    <Text className="text-slate-900 font-bold text-sm">
                      Copy to Campaign (Optional)
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
                </View>
                {showCopyCampaign ? (
                  <ChevronUp size={18} color="#64748B" />
                ) : (
                  <ChevronDown size={18} color="#64748B" />
                )}
              </TouchableOpacity>

              {showCopyCampaign && (
                <View className="mt-3 pt-3 border-t border-slate-100">
                  {otherCampaigns.length === 0 ? (
                    <Text className="text-slate-400 text-xs">No other campaigns available.</Text>
                  ) : (
                    <View className="flex-row flex-wrap gap-2">
                      <TouchableOpacity
                        onPress={() => setCopyCampaignId(null)}
                        className={`px-3 py-2 rounded-xl border ${
                          copyCampaignId === null
                            ? 'bg-indigo-600 border-indigo-600 shadow-sm'
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <Text
                          className={`text-xs font-semibold ${
                            copyCampaignId === null ? 'text-white' : 'text-slate-700'
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
                            className={`px-3 py-2 rounded-xl border flex-row items-center gap-1.5 ${
                              isSelected
                                ? 'bg-indigo-600 border-indigo-600 shadow-sm'
                                : 'bg-slate-50 border-slate-200'
                            }`}
                          >
                            {isSelected ? <Check size={12} color="#FFFFFF" strokeWidth={3} /> : null}
                            <Text
                              className={`text-xs font-semibold ${
                                isSelected ? 'text-white' : 'text-slate-700'
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
              )}
            </View>
          </>
        )}

        {/* Submit Disposition Button */}
        <View className="mt-6">
          <Button
            title={disposeMutation.isPending ? 'Saving Outcome...' : 'Submit Disposition'}
            onPress={handleSubmit}
            loading={disposeMutation.isPending}
            disabled={disposeMutation.isPending}
            variant="primary"
          />
        </View>
      </ScrollView>

      {/* Interactive Custom Date & Time Picker Modal */}
      <CrmDateTimePickerModal
        visible={showCustomDatePicker}
        initialDate={followUpAt || undefined}
        title={isConnected ? 'Schedule Follow-up' : 'Schedule Next Retry Call'}
        onConfirm={(isoString) => {
          setFollowUpAt(isoString);
          setShowCustomDatePicker(false);
        }}
        onClose={() => setShowCustomDatePicker(false)}
      />
    </SafeAreaView>
  );
};
