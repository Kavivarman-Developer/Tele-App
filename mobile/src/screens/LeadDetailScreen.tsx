import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  AppState,
  AppStateStatus,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { callService } from '../services/call.service';
import { fetchLeadHistory, reassignLead, fetchAssignableUsers } from '../api/leadApi';
import { RootStackParamList, Activity, Lead } from '../types';
import { Badge } from '../components/Badge';
import { Card } from '../components/Card';
import { CallPermissionModal } from '../components/CallPermissionModal';

type ScreenRouteProp = RouteProp<RootStackParamList, 'LeadDetail'>;
type ScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const LeadDetailScreen: React.FC = () => {
  const route = useRoute<ScreenRouteProp>();
  const navigation = useNavigation<ScreenNavigationProp>();
  const { lead, queue, queueIndex } = route.params;
  const queryClient = useQueryClient();

  const [currentLead, setCurrentLead] = useState<Lead>(lead);
  const [showReassignModal, setShowReassignModal] = useState<boolean>(false);
  const [callActive, setCallActive] = useState<boolean>(false);
  const [showPermissionModal, setShowPermissionModal] = useState<boolean>(false);
  const callStartTimeRef = useRef<number | null>(null);
  const isCallingRef = useRef<boolean>(false);
  const skipPermissionCheckRef = useRef<boolean>(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // Fetch active assignable agents for reassignment
  const { data: usersData } = useQuery({
    queryKey: ['assignableUsers'],
    queryFn: fetchAssignableUsers,
    enabled: showReassignModal,
  });
  const assignableAgents = usersData?.users || [];

  // Mutation to reassign lead directly to a specific agent
  const reassignMutation = useMutation({
    mutationFn: (targetUserId: string) => reassignLead(currentLead._id, targetUserId),
    onSuccess: (data, targetUserId) => {
      queryClient.invalidateQueries({ queryKey: ['myLeads'] });
      queryClient.invalidateQueries({ queryKey: ['leadHistory', currentLead._id] });
      const targetAgentName = assignableAgents.find((a) => a._id === targetUserId)?.name || 'Agent';
      setCurrentLead(data.lead);
      setShowReassignModal(false);
      const msg = `Lead "${currentLead.name}" has been transferred to ${targetAgentName}.`;
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Lead Reassigned', msg);
      }
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to reassign lead';
      if (Platform.OS === 'web') {
        window.alert(`Reassign Failed: ${msg}`);
      } else {
        Alert.alert('Reassign Failed', msg);
      }
    },
  });

  // AppState Listener: Detect returning to foreground after call
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      const prevAppState = appStateRef.current;
      appStateRef.current = nextAppState;

      // When transitioning back to 'active' from 'background' or 'inactive' after a call started
      if (
        (prevAppState === 'background' || prevAppState === 'inactive') &&
        nextAppState === 'active' &&
        isCallingRef.current &&
        callStartTimeRef.current !== null
      ) {
        const startTime = callStartTimeRef.current;
        isCallingRef.current = false;
        callStartTimeRef.current = null;
        setCallActive(false);

        // Fetch call log result (duration and connected status) via CallService
        callService
          .getCallResult(lead.phone, startTime)
          .then((callResult) => {
            navigation.navigate('Dispose', {
              lead,
              callDurationSeconds: callResult.durationSeconds,
              isCallConnected: callResult.connected,
              detectionMethod: callResult.matchedLog ? 'AUTOMATIC' : 'MANUAL',
              queue,
              queueIndex,
            });
          })
          .catch((err) => {
            console.warn('[LeadDetailScreen] Failed to retrieve call result:', err);
            const durationSeconds = Math.max(1, Math.round((Date.now() - startTime) / 1000));
            navigation.navigate('Dispose', {
              lead,
              callDurationSeconds: durationSeconds,
              isCallConnected: true,
              detectionMethod: 'MANUAL',
              queue,
              queueIndex,
            });
          });
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [navigation, lead, queue, queueIndex]);

  // Fetch full contact history from /api/leads/:id/history
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['leadHistory', lead._id],
    queryFn: () => fetchLeadHistory(lead._id),
  });

  const activities: Activity[] = historyData?.activities ?? [];

  // Low-level dialing execution
  const executeDialing = async () => {
    callStartTimeRef.current = Date.now();
    isCallingRef.current = true;
    setCallActive(true);

    const success = await callService.startCall(lead);
    if (!success) {
      isCallingRef.current = false;
      callStartTimeRef.current = null;
      setCallActive(false);
      if (Platform.OS === 'web') {
        window.alert(`Unable to dial ${lead.phone}. Please check phone capabilities.`);
      } else {
        Alert.alert(
          'Call Error',
          `Unable to dial ${lead.phone}. Please check device phone capabilities.`,
        );
      }
    }
  };

  // User taps Start Call
  const handleStartCall = async () => {
    if (Platform.OS === 'android' && !skipPermissionCheckRef.current) {
      const hasPermission = await (callService.checkPermissions?.() ?? Promise.resolve(false));
      if (!hasPermission) {
        setShowPermissionModal(true);
        return;
      }
    }

    await executeDialing();
  };

  // Agent accepts rationale and grants permissions
  const handleGrantPermissions = async () => {
    setShowPermissionModal(false);
    if (callService.requestPermissions) {
      await callService.requestPermissions();
    }
    await executeDialing();
  };

  // Agent skips rationale to use manual timing
  const handleSkipPermissions = async () => {
    setShowPermissionModal(false);
    skipPermissionCheckRef.current = true;
    await executeDialing();
  };

  const handleOpenWhatsApp = async () => {
    const defaultGreeting = `Hi ${lead.name}, contacting you from ${
      lead.campaign?.name || 'our sales team'
    }.`;
    await callService.openWhatsApp(lead.phone, defaultGreeting);
  };

  const handleManualDispose = async () => {
    let duration = 0;
    let connected = true;
    let detectionMethod: 'AUTOMATIC' | 'MANUAL' = 'MANUAL';

    if (callStartTimeRef.current) {
      const startTime = callStartTimeRef.current;
      callStartTimeRef.current = null;
      isCallingRef.current = false;
      setCallActive(false);

      try {
        const result = await callService.getCallResult(lead.phone, startTime);
        duration = result.durationSeconds;
        connected = result.connected;
        if (result.matchedLog) {
          detectionMethod = 'AUTOMATIC';
        }
      } catch {
        duration = Math.max(0, Math.round((Date.now() - startTime) / 1000));
      }
    }

    navigation.navigate('Dispose', {
      lead,
      callDurationSeconds: duration,
      isCallConnected: connected,
      detectionMethod,
      queue,
      queueIndex,
    });
  };

  const handleNavigateQueue = (direction: 'next' | 'prev') => {
    if (!queue || queueIndex === undefined) return;
    const targetIndex = direction === 'next' ? queueIndex + 1 : queueIndex - 1;
    if (targetIndex >= 0 && targetIndex < queue.length) {
      navigation.replace('LeadDetail', {
        lead: queue[targetIndex],
        queue,
        queueIndex: targetIndex,
      });
    }
  };

  const formatActivityDate = (dateStr: string): string => {
    const d = new Date(dateStr);
    return `${d.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
    })} at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  const formatSeconds = (sec: number): string => {
    if (!sec || sec <= 0) return '0s';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    if (m === 0) return `${s}s`;
    return `${m}m ${s}s`;
  };

  const customPropEntries = lead.customProperties
    ? Object.entries(lead.customProperties)
    : [];

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      {/* Top Navigation Bar */}
      <View className="bg-white px-4 py-3.5 border-b border-slate-200 flex-row justify-between items-center shadow-xs">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="p-1 -ml-1 flex-row items-center"
        >
          <Text className="text-blue-600 text-base font-bold">‹ Back</Text>
        </TouchableOpacity>

        {queue && queueIndex !== undefined ? (
          <View className="flex-row items-center bg-slate-100 border border-slate-200 px-3 py-1 rounded-full">
            <Text className="text-slate-700 text-xs font-semibold mr-2">
              Queue {queueIndex + 1} of {queue.length}
            </Text>
            <TouchableOpacity
              onPress={() => handleNavigateQueue('prev')}
              disabled={queueIndex === 0}
              className={`mr-1 px-1.5 ${queueIndex === 0 ? 'opacity-30' : ''}`}
            >
              <Text className="text-slate-900 text-xs font-bold">‹</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleNavigateQueue('next')}
              disabled={queueIndex === queue.length - 1}
              className={`px-1.5 ${
                queueIndex === queue.length - 1 ? 'opacity-30' : ''
              }`}
            >
              <Text className="text-slate-900 text-xs font-bold">›</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text className="text-slate-500 text-xs font-semibold">Lead Details</Text>
        )}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Main Lead Header Card */}
        <Card className="mb-4">
          <View className="flex-row justify-between items-start mb-2">
            <View className="flex-1 mr-3">
              <Text className="text-2xl font-bold text-slate-900">{lead.name}</Text>
              <Text className="text-blue-600 text-base font-semibold mt-0.5">
                {lead.phone}
              </Text>
              {lead.email ? (
                <Text className="text-slate-500 text-xs mt-0.5">{lead.email}</Text>
              ) : null}
            </View>

            {lead.campaign?.priority ? (
              <Badge
                label={lead.campaign.priority}
                variant={
                  lead.campaign.priority === 'HIGH'
                    ? 'danger'
                    : lead.campaign.priority === 'MEDIUM'
                    ? 'warning'
                    : 'default'
                }
              />
            ) : null}
          </View>

          {/* Quick Metrics */}
          <View className="flex-row flex-wrap gap-2 mt-3 pt-3 border-t border-slate-100">
            <Badge label={`Stage: ${lead.stage}`} variant="info" />
            {lead.tag ? <Badge label={`Tag: ${lead.tag}`} variant="default" /> : null}
            <Badge
              label={lead.status}
              variant={lead.status === 'OPEN' ? 'success' : 'default'}
            />
            <Badge label={`Attempts: ${lead.attemptCount}`} variant="default" />
          </View>

          {/* Campaign details */}
          <View className="mt-3 bg-slate-50 p-3 rounded-xl border border-slate-200/80">
            <View className="flex-row justify-between py-0.5">
              <Text className="text-slate-500 text-xs font-medium">Campaign</Text>
              <Text className="text-slate-800 text-xs font-bold">
                {lead.campaign?.name || lead.campaignId}
              </Text>
            </View>
            <View className="flex-row justify-between py-0.5">
              <Text className="text-slate-500 text-xs font-medium">Source</Text>
              <Text className="text-slate-700 text-xs font-semibold">{lead.source}</Text>
            </View>
            {lead.nextFollowUpAt ? (
              <View className="flex-row justify-between py-0.5">
                <Text className="text-slate-500 text-xs font-medium">Next Follow-Up</Text>
                <Text className="text-amber-700 text-xs font-bold">
                  {formatActivityDate(lead.nextFollowUpAt)}
                </Text>
              </View>
            ) : null}
          </View>
        </Card>

        {/* CALL ACTION BAR */}
        <View className="mb-5">
          {callActive ? (
            <View className="bg-emerald-50 border border-emerald-300 p-3 rounded-xl mb-3 items-center">
              <Text className="text-emerald-700 text-xs font-bold">
                📞 Call in progress... When finished, app will open Dispose screen automatically.
              </Text>
            </View>
          ) : null}

          {/* Big Call Button */}
          <TouchableOpacity
            onPress={handleStartCall}
            activeOpacity={0.85}
            className="bg-emerald-600 active:bg-emerald-700 py-4 px-6 rounded-2xl flex-row justify-center items-center shadow-md mb-3"
          >
            <Text className="text-xl mr-2">📞</Text>
            <Text className="text-white font-bold text-lg">Call {lead.phone}</Text>
          </TouchableOpacity>

          {/* Secondary Actions: WhatsApp & Dispose */}
          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={handleOpenWhatsApp}
              activeOpacity={0.8}
              className="flex-1 bg-emerald-50 border border-emerald-300 py-3 rounded-xl flex-row justify-center items-center"
            >
              <Text className="text-base mr-1.5">💬</Text>
              <Text className="text-emerald-700 font-bold text-sm">WhatsApp</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleManualDispose}
              activeOpacity={0.8}
              className="flex-1 bg-blue-50 border border-blue-200 py-3 rounded-xl flex-row justify-center items-center"
            >
              <Text className="text-base mr-1.5">📝</Text>
              <Text className="text-blue-700 font-bold text-sm">Dispose Lead</Text>
            </TouchableOpacity>
          </View>

          {/* Quick Direct Reassign to Particular Agent */}
          <TouchableOpacity
            onPress={() => setShowReassignModal(!showReassignModal)}
            activeOpacity={0.8}
            className="mt-3 bg-white border border-slate-200 py-2.5 px-4 rounded-xl flex-row justify-between items-center shadow-xs"
          >
            <View className="flex-row items-center">
              <Text className="text-base mr-2">👤</Text>
              <Text className="text-slate-800 font-bold text-xs">
                {showReassignModal ? 'Hide Agent Transfer' : 'Reassign / Transfer to Particular Agent'}
              </Text>
            </View>
            <Text className="text-blue-600 text-xs font-bold">
              {showReassignModal ? '▲ Close' : '▼ Select Agent'}
            </Text>
          </TouchableOpacity>

          {showReassignModal && (
            <Card className="mt-2.5 bg-slate-50 border border-blue-200 p-3.5 shadow-xs">
              <Text className="text-slate-900 font-bold text-xs mb-1">
                Select Agent to Assign:
              </Text>
              <Text className="text-slate-500 text-[11px] mb-2.5">
                Tapping an agent will immediately transfer this lead to their active calling queue.
              </Text>
              {assignableAgents.length === 0 ? (
                <Text className="text-slate-400 text-xs py-2">Loading active agents...</Text>
              ) : (
                <View className="flex-row flex-wrap gap-2">
                  {assignableAgents.map((agent) => (
                    <TouchableOpacity
                      key={agent._id}
                      onPress={() => reassignMutation.mutate(agent._id)}
                      disabled={reassignMutation.isPending}
                      className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 active:bg-blue-50"
                    >
                      <Text className="text-blue-600 font-bold text-xs">
                        👤 {agent.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </Card>
          )}
        </View>

        {/* Custom Properties Section */}
        {customPropEntries.length > 0 ? (
          <Card className="mb-4">
            <Text className="text-slate-900 font-bold text-sm mb-3">
              📋 Custom Properties
            </Text>
            <View className="gap-2">
              {customPropEntries.map(([key, val]) => (
                <View
                  key={key}
                  className="flex-row justify-between py-1.5 border-b border-slate-100"
                >
                  <Text className="text-slate-500 text-xs capitalize">{key}</Text>
                  <Text className="text-slate-800 text-xs font-semibold">{String(val)}</Text>
                </View>
              ))}
            </View>
          </Card>
        ) : null}

        {/* Contact & Call History Section */}
        <Card>
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-slate-900 font-bold text-sm">🕒 Contact History</Text>
            <Text className="text-slate-500 text-xs font-medium">
              {activities.length} {activities.length === 1 ? 'activity' : 'activities'}
            </Text>
          </View>

          {historyLoading ? (
            <View className="py-6 items-center">
              <ActivityIndicator size="small" color="#2563EB" />
              <Text className="text-slate-500 text-xs mt-2">Loading history...</Text>
            </View>
          ) : activities.length === 0 ? (
            <View className="py-6 items-center">
              <Text className="text-slate-400 text-xs">No previous call activities recorded.</Text>
            </View>
          ) : (
            <View className="gap-2.5">
              {activities.map((act) => {
                const userName =
                  typeof act.userId === 'object' && act.userId ? act.userId.name : 'Agent';
                return (
                  <View
                    key={act._id}
                    className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl"
                  >
                    <View className="flex-row justify-between items-center mb-1">
                      <View className="flex-row items-center gap-1.5">
                        <Badge
                          label={act.connected ? 'Connected' : 'Not Connected'}
                          variant={act.connected ? 'success' : 'danger'}
                        />
                        {act.notConnectedReason ? (
                          <Badge
                            label={act.notConnectedReason.replace(/_/g, ' ')}
                            variant="warning"
                          />
                        ) : null}
                      </View>
                      <Text className="text-slate-600 text-xs font-semibold">
                        ⏱️ {formatSeconds(act.durationSeconds)}
                      </Text>
                    </View>

                    {/* Stage & Tag updated */}
                    <View className="flex-row items-center mt-1.5">
                      <Text className="text-slate-600 text-xs">
                        Stage: <Text className="font-bold text-blue-600">{act.stage}</Text>
                        {act.tag ? ` • Tag: ${act.tag}` : ''}
                      </Text>
                    </View>

                    {/* Remark if present */}
                    {act.remark ? (
                      <Text className="text-slate-700 text-xs mt-1.5 italic bg-white border border-slate-200/80 p-2.5 rounded-lg">
                        "{act.remark}"
                      </Text>
                    ) : null}

                    {/* Follow up set */}
                    {act.followUpAt ? (
                      <Text className="text-amber-700 font-semibold text-xs mt-1">
                        ⏰ Follow-up: {formatActivityDate(act.followUpAt)}
                      </Text>
                    ) : null}

                    {/* Caller and Time */}
                    <View className="flex-row justify-between mt-2 pt-2 border-t border-slate-200/60">
                      <Text className="text-slate-400 text-[10px]">By {userName}</Text>
                      <Text className="text-slate-400 text-[10px]">
                        {formatActivityDate(act.createdAt)}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </Card>
      </ScrollView>

      {/* Permission Rationale Modal */}
      <CallPermissionModal
        visible={showPermissionModal}
        onGrant={handleGrantPermissions}
        onSkip={handleSkipPermissions}
      />
    </SafeAreaView>
  );
};
