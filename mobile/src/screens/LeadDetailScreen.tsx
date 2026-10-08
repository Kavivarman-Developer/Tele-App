import React, { useEffect, useRef, useState, useMemo } from 'react';
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
  StyleSheet,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Phone,
  MessageCircle,
  Clock,
  Calendar,
  Users,
  CheckCircle2,
  AlertCircle,
  FileText,
  UserCheck,
  ChevronDown,
  ChevronUp,
  Flame,
  Sun,
  Snowflake,
} from 'lucide-react-native';

import { callService } from '../services/call.service';
import { fetchLeadHistory, reassignLead, fetchAssignableUsers } from '../api/leadApi';
import { RootStackParamList, Activity, Lead } from '../types';
import { colors, borderRadius, shadows } from '../theme';
import { CrmHeader } from '../components/CrmHeader';
import { CrmAvatar } from '../components/CrmAvatar';
import { Badge } from '../components/Badge';
import { CallPermissionModal } from '../components/CallPermissionModal';
import { LeadTimeline } from '../components/LeadTimeline';
import { useLeadHistoryStore } from '../store/leadHistoryStore';
import { useAuthStore } from '../store/authStore';
import { getWhatsAppUrl, getDialerTelUrl, formatDisplayPhone } from '../utils/phoneUtils';

type ScreenRouteProp = RouteProp<RootStackParamList, 'LeadDetail'>;
type ScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const LeadDetailScreen: React.FC = () => {
  const { user } = useAuthStore();
  const isManagerOrAdmin = user?.role === 'ADMIN' || user?.role === 'MANAGER';
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

  // Active assignable agents
  const { data: usersData } = useQuery({
    queryKey: ['assignableUsers'],
    queryFn: fetchAssignableUsers,
    enabled: showReassignModal,
  });
  const assignableAgents = usersData?.users || [];

  // Reassignment Mutation
  const reassignMutation = useMutation({
    mutationFn: (targetUserId: string) => reassignLead(currentLead._id, targetUserId),
    onSuccess: (data, targetUserId) => {
      queryClient.invalidateQueries({ queryKey: ['myLeads'] });
      queryClient.invalidateQueries({ queryKey: ['leadHistory', currentLead._id] });
      const targetAgentName =
        assignableAgents.find((a) => a._id === targetUserId)?.name || 'Agent';
      setCurrentLead(data.lead);
      setShowReassignModal(false);
      Alert.alert('Lead Reassigned', `Lead transferred to ${targetAgentName}.`);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to reassign lead';
      Alert.alert('Reassign Failed', msg);
    },
  });

  // AppState Listener
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      const prevAppState = appStateRef.current;
      appStateRef.current = nextAppState;

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
          .catch(() => {
            navigation.navigate('Dispose', {
              lead,
              callDurationSeconds: 0,
              isCallConnected: false,
              detectionMethod: 'MANUAL',
              queue,
              queueIndex,
            });
          });
      }
    };

    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, [lead, navigation, queue, queueIndex]);

  // Lead History Query
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['leadHistory', currentLead._id],
    queryFn: () => fetchLeadHistory(currentLead._id),
  });

  const { getHistoryForLead } = useLeadHistoryStore();

  const combinedActivities: Activity[] = useMemo(() => {
    const backend = historyData?.activities || [];
    const local = getHistoryForLead(currentLead._id);
    if (backend.length > 0) {
      const existingIds = new Set(backend.map((a) => a._id));
      const nonDup = local.filter((a) => !existingIds.has(a._id));
      return [...backend, ...nonDup].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    }
    return local;
  }, [historyData, currentLead._id, getHistoryForLead]);

  const initiateCall = async () => {
    isCallingRef.current = true;
    callStartTimeRef.current = Date.now();
    setCallActive(true);

    try {
      await callService.startCall(currentLead);
    } catch {
      isCallingRef.current = false;
      callStartTimeRef.current = null;
      setCallActive(false);
      Alert.alert('Call Failed', 'Unable to initiate phone call.');
    }
  };

  const handlePressCall = async () => {
    if (Platform.OS === 'android' && !skipPermissionCheckRef.current) {
      const hasPerm = await callService.checkPermissions();
      if (!hasPerm) {
        setShowPermissionModal(true);
        return;
      }
    }
    await initiateCall();
  };

  const handleGrantPermissions = async () => {
    setShowPermissionModal(false);
    await callService.requestPermissions();
    await initiateCall();
  };

  const handleSkipPermissions = async () => {
    setShowPermissionModal(false);
    skipPermissionCheckRef.current = true;
    await initiateCall();
  };

  const handleDirectWhatsApp = () => {
    Linking.openURL(getWhatsAppUrl(lead.phone)).catch(() => {
      Alert.alert('Error', 'WhatsApp is not installed.');
    });
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m > 0 ? `${m}m ` : ''}${s}s`;
  };

  const formatActivityDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  const campaignName =
    typeof lead.campaign === 'object' && lead.campaign?.name
      ? lead.campaign.name
      : 'Demo Sales Campaign';
  const customPropEntries = Object.entries(currentLead.customProperties || {});

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <CrmHeader
        title="Lead Details"
        subtitle={lead.name}
        showBack
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Lead Hero Profile Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <CrmAvatar name={currentLead.name} size="lg" />
            <View style={styles.heroInfo}>
              <Text style={styles.heroName}>{currentLead.name}</Text>
              <Text style={styles.heroPhone}>{formatDisplayPhone(currentLead.phone)}</Text>
              <View style={styles.badgeRow}>
                <Badge label={currentLead.stage} stage={currentLead.stage} />
                {currentLead.tag ? (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor:
                        currentLead.tag.toUpperCase() === 'HOT'
                          ? '#FEF2F2'
                          : currentLead.tag.toUpperCase() === 'COLD'
                          ? '#EFF6FF'
                          : '#FFFBEB',
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: 6,
                      gap: 4,
                    }}
                  >
                    {currentLead.tag.toUpperCase() === 'HOT' ? (
                      <Flame size={11} color="#DC2626" fill="#DC2626" />
                    ) : currentLead.tag.toUpperCase() === 'COLD' ? (
                      <Snowflake size={11} color="#2563EB" />
                    ) : (
                      <Sun size={11} color="#D97706" />
                    )}
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: '800',
                        color:
                          currentLead.tag.toUpperCase() === 'HOT'
                            ? '#DC2626'
                            : currentLead.tag.toUpperCase() === 'COLD'
                            ? '#2563EB'
                            : '#D97706',
                      }}
                    >
                      {currentLead.tag.toUpperCase()}
                    </Text>
                  </View>
                ) : null}
                <View style={styles.campaignBadge}>
                  <Text style={styles.campaignBadgeText}>{campaignName}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Quick Outreach Action Buttons */}
          <View style={styles.actionGrid}>
            <TouchableOpacity
              style={[styles.primaryActionBtn, styles.callBtn]}
              onPress={handlePressCall}
              activeOpacity={0.8}
            >
              <Phone size={18} color={colors.surface} />
              <Text style={styles.actionBtnText}>
                {callActive ? 'Calling…' : 'Call Lead'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.primaryActionBtn, styles.whatsappBtn]}
              onPress={handleDirectWhatsApp}
              activeOpacity={0.8}
            >
              <MessageCircle size={18} color={colors.surface} />
              <Text style={styles.actionBtnText}>WhatsApp</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.primaryActionBtn, styles.disposeBtn]}
              onPress={() =>
                navigation.navigate('Dispose', {
                  lead: currentLead,
                  callDurationSeconds: 0,
                  isCallConnected: true,
                  detectionMethod: 'MANUAL',
                  queue,
                  queueIndex,
                })
              }
              activeOpacity={0.8}
            >
              <UserCheck size={18} color={colors.surface} />
              <Text style={styles.actionBtnText}>Log Call</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Lead Details & Metadata */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Overview</Text>

          <View style={styles.metaList}>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Total Attempts</Text>
              <Text style={styles.metaValue}>{currentLead.attemptCount || 0} times</Text>
            </View>

            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Lead Status</Text>
              <Text style={styles.metaValue}>{currentLead.status}</Text>
            </View>

            {currentLead.nextFollowUpAt ? (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Scheduled Follow-up</Text>
                <Text style={[styles.metaValue, { color: colors.primary }]}>
                  {formatActivityDate(currentLead.nextFollowUpAt)}
                </Text>
              </View>
            ) : null}

            {currentLead.email ? (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Email Address</Text>
                <Text style={styles.metaValue}>{currentLead.email}</Text>
              </View>
            ) : null}
          </View>

          {/* Quick Agent Reassign (Manager & Admin Only) */}
          {isManagerOrAdmin && (
            <>
              <TouchableOpacity
                style={styles.reassignToggleBtn}
                onPress={() => setShowReassignModal(!showReassignModal)}
                activeOpacity={0.7}
              >
                <View style={styles.reassignLeft}>
                  <Users size={16} color={colors.primary} />
                  <Text style={styles.reassignToggleText}>
                    {showReassignModal ? 'Hide Agent Transfer' : 'Transfer to Another Agent'}
                  </Text>
                </View>
                {showReassignModal ? (
                  <ChevronUp size={16} color={colors.textQuiet} />
                ) : (
                  <ChevronDown size={16} color={colors.textQuiet} />
                )}
              </TouchableOpacity>

              {showReassignModal ? (
                <View style={styles.reassignBox}>
                  <Text style={styles.reassignTitle}>Select Agent to Reassign:</Text>
                  <Text style={styles.reassignSub}>
                    Tapping an agent will immediately move this lead to their queue.
                  </Text>
                  <View style={styles.agentsList}>
                    {assignableAgents.map((ag) => (
                      <TouchableOpacity
                        key={ag._id}
                        style={styles.agentSelectChip}
                        onPress={() => reassignMutation.mutate(ag._id)}
                        disabled={reassignMutation.isPending}
                        activeOpacity={0.7}
                      >
                        <CrmAvatar name={ag.name} size="sm" />
                        <Text style={styles.agentSelectName}>{ag.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ) : null}
            </>
          )}
        </View>

        {/* Custom Properties */}
        {customPropEntries.length > 0 ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Custom Lead Fields</Text>
            <View style={styles.metaList}>
              {customPropEntries.map(([k, v]) => (
                <View key={k} style={styles.metaRow}>
                  <Text style={styles.metaLabel}>{k.toUpperCase()}</Text>
                  <Text style={styles.metaValue}>{String(v)}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Contact & Call History Timeline (Multi-Agent Audit Trail) */}
        <View style={styles.sectionCard}>
          <LeadTimeline
            activities={combinedActivities}
            isLoading={historyLoading}
          />
        </View>
      </ScrollView>

      {/* Permission Modal */}
      <CallPermissionModal
        visible={showPermissionModal}
        onGrant={handleGrantPermissions}
        onSkip={handleSkipPermissions}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  heroCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    ...shadows.soft,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  heroInfo: {
    flex: 1,
    marginLeft: 14,
  },
  heroName: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  heroPhone: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
    fontWeight: '500',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 6,
  },
  campaignBadge: {
    backgroundColor: colors.surfaceLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
  },
  campaignBadgeText: {
    fontSize: 10,
    color: colors.textQuiet,
    fontWeight: '600',
  },
  actionGrid: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  primaryActionBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: borderRadius.md,
    gap: 6,
  },
  callBtn: {
    backgroundColor: colors.success,
  },
  whatsappBtn: {
    backgroundColor: '#25D366',
  },
  disposeBtn: {
    backgroundColor: colors.primary,
  },
  actionBtnText: {
    color: colors.surface,
    fontSize: 12,
    fontWeight: '700',
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    ...shadows.soft,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  metaList: {
    gap: 8,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  metaLabel: {
    fontSize: 12,
    color: colors.textMuted,
  },
  metaValue: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  reassignToggleBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.sm,
    marginTop: 12,
  },
  reassignLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reassignToggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  reassignBox: {
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.sm,
    padding: 12,
    marginTop: 8,
  },
  reassignTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
  },
  reassignSub: {
    fontSize: 10,
    color: colors.textQuiet,
    marginTop: 2,
    marginBottom: 8,
  },
  agentsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  agentSelectChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    gap: 6,
  },
  agentSelectName: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyCount: {
    fontSize: 11,
    color: colors.textQuiet,
  },
  emptyHistoryText: {
    fontSize: 12,
    color: colors.textQuiet,
    textAlign: 'center',
    marginVertical: 16,
  },
  timelineList: {
    gap: 10,
    marginTop: 10,
  },
  activityItem: {
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.sm,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  activityTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  activityBadgeRow: {
    flexDirection: 'row',
    gap: 6,
  },
  activityDuration: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  activityStage: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 6,
  },
  remarkBox: {
    backgroundColor: colors.surface,
    padding: 8,
    borderRadius: borderRadius.xs,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    marginBottom: 6,
  },
  remarkText: {
    fontSize: 11,
    fontStyle: 'italic',
    color: colors.textSecondary,
  },
  activityFollowUp: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.warningText,
    marginBottom: 6,
  },
  activityFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  activityMetaText: {
    fontSize: 9,
    color: colors.textQuiet,
  },
});
