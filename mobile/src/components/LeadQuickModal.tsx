import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Linking,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  Phone,
  MessageCircle,
  X,
  Calendar,
  Clock,
  Check,
  ChevronRight,
  UserCheck,
  Flame,
  Sun,
  Snowflake,
  History,
  FileEdit,
  ShieldAlert,
  Ban,
  CheckCircle2,
} from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';

import { Lead, Activity, CustomerTemperature } from '../types';
import { CrmAvatar } from './CrmAvatar';
import { colors, borderRadius, shadows } from '../theme';
import { disposeLead, fetchLeadHistory } from '../api/leadApi';
import { WhatsAppTemplateModal } from './WhatsAppTemplateModal';
import { LeadTimeline } from './LeadTimeline';
import { useLeadHistoryStore } from '../store/leadHistoryStore';
import { useAuthStore } from '../store/authStore';
import { CrmDateTimePickerModal } from './CrmDateTimePickerModal';
import { toast } from '../store/toastStore';
import { getDialerTelUrl, formatDisplayPhone } from '../utils/phoneUtils';

interface LeadQuickModalProps {
  lead: Lead | null;
  visible: boolean;
  onClose: () => void;
  onLeadUpdated?: () => void;
  onOpenFullDispose?: (lead: Lead) => void;
}

const STAGE_OPTIONS = [
  'Interested',
  'Follow-up',
  'Not connected',
  'Not Interested',
  'Closed',
];

const LOST_REASONS = [
  { label: 'Price High / Budget', code: 'PRICE_HIGH', emoji: '💰' },
  { label: 'Bought Elsewhere', code: 'COMPETITOR', emoji: '🏢' },
  { label: 'Not Interested / Not Needed', code: 'NOT_NEEDED', emoji: '❌' },
  { label: 'Wrong Number / Invalid', code: 'WRONG_NUMBER', emoji: '📵' },
  { label: 'Do Not Call (DND)', code: 'DND', emoji: '⛔' },
];

type ModalTab = 'DISPOSITION' | 'HISTORY';

export const LeadQuickModal: React.FC<LeadQuickModalProps> = ({
  lead,
  visible,
  onClose,
  onLeadUpdated,
  onOpenFullDispose,
}) => {
  if (!lead) return null;

  const currentUser = useAuthStore((s) => s.user);
  const currentUserName = currentUser?.name || 'John Agent';

  const { getHistoryForLead, addActivity, loadHistory } = useLeadHistoryStore();

  const [activeTab, setActiveTab] = useState<ModalTab>('DISPOSITION');
  const [selectedStage, setSelectedStage] = useState(lead.stage || 'Interested');
  const [selectedTemperature, setSelectedTemperature] = useState<CustomerTemperature>(
    (lead.tag?.toUpperCase() as CustomerTemperature) || 'WARM',
  );
  const [notes, setNotes] = useState('');
  const [followUpDate, setFollowUpDate] = useState<string>(lead.nextFollowUpAt || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);

  useEffect(() => {
    loadHistory();
  }, []);

  // Reset states when a new lead is opened
  useEffect(() => {
    if (lead) {
      setSelectedStage(lead.stage || 'Interested');
      const leadTag = (lead.tag || '').toUpperCase();
      if (leadTag === 'HOT' || leadTag === 'WARM' || leadTag === 'COLD') {
        setSelectedTemperature(leadTag as CustomerTemperature);
      } else {
        setSelectedTemperature('WARM');
      }
      setFollowUpDate(lead.nextFollowUpAt || '');
      setNotes('');
      setActiveTab('DISPOSITION');
    }
  }, [lead?._id]);

  // Query Backend Lead History
  const { data: backendHistoryData, isLoading: isHistoryLoading, refetch: refetchHistory } = useQuery({
    queryKey: ['leadHistory', lead._id],
    queryFn: () => fetchLeadHistory(lead._id),
    enabled: visible && Boolean(lead._id),
  });

  // Combine backend history with local store history
  const combinedActivities: Activity[] = useMemo(() => {
    const backendActivities = backendHistoryData?.activities || [];
    const localActivities = getHistoryForLead(lead._id, lead.phone);

    // If backend has activities, merge; else fallback to local
    if (backendActivities.length > 0) {
      const existingIds = new Set(backendActivities.map((a) => a._id));
      const nonDuplicateLocal = localActivities.filter((a) => !existingIds.has(a._id));
      return [...backendActivities, ...nonDuplicateLocal].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    }

    return localActivities;
  }, [backendHistoryData, lead._id, lead.phone, getHistoryForLead]);

  const cleanPhone = (lead.phone || '').replace(/\D/g, '');
  const campaignName =
    typeof lead.campaign === 'object' && lead.campaign?.name
      ? lead.campaign.name
      : 'Demo Sales Campaign';

  const handleCall = () => {
    const isSuppressed =
      lead.stage === 'Not Interested' ||
      lead.stage === 'Closed' ||
      selectedStage === 'Not Interested' ||
      selectedStage === 'Closed' ||
      lead.status === 'CLOSED';

    const triggerCall = () => {
      useLeadHistoryStore.getState().logDialedCall({
        leadId: lead._id,
        phone: lead.phone,
        customerName: lead.name,
        agentName: currentUser?.name || 'Agent',
        agentId: currentUser?._id || currentUser?.email,
        branch: currentUser?.branch || 'General',
      });
      Linking.openURL(getDialerTelUrl(lead.phone)).catch(() => {
        Alert.alert('Error', 'Unable to initiate phone call on this device');
      });
    };

    if (isSuppressed) {
      Alert.alert(
        '⚠️ Customer Not Interested',
        `This customer previously stated they are Not Interested. Calling again might cause customer irritation or complaints.\n\nAre you sure you want to dial anyway?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Call Anyway', style: 'destructive', onPress: triggerCall },
        ],
      );
      return;
    }

    triggerCall();
  };

  const handleWhatsApp = () => {
    setShowWhatsAppModal(true);
  };

  // Helper for quick follow-up scheduling
  const setQuickFollowUp = (hoursAhead: number, specificHour?: number) => {
    const d = new Date();
    if (specificHour !== undefined) {
      // Calculate target date
      const daysToAdd = hoursAhead >= 24 ? Math.floor(hoursAhead / 24) : 1;
      d.setDate(d.getDate() + daysToAdd);
      d.setHours(specificHour, 0, 0, 0);
    } else {
      d.setTime(d.getTime() + hoursAhead * 60 * 60 * 1000);
    }
    setFollowUpDate(d.toISOString());
  };

  const formatScheduledDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      const now = new Date();
      const isTomorrow =
        d.getDate() === now.getDate() + 1 &&
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear();

      const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (isTomorrow) {
        return `Tomorrow at ${timeStr}`;
      }
      return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${timeStr}`;
    } catch {
      return isoStr;
    }
  };

  const handleQuickSave = async () => {
    try {
      setIsSubmitting(true);
      const isClosing = selectedStage === 'Not Interested' || selectedStage === 'Closed';
      const isConnected = selectedStage !== 'Not connected';

      // 1. Log to backend if connected
      try {
        await disposeLead(lead._id, {
          connected: isConnected,
          notConnectedReason: isConnected ? undefined : 'DID_NOT_PICK',
          stage: selectedStage === 'Follow-up' ? 'Follow Up' : selectedStage,
          tag: selectedTemperature,
          remark: notes.trim() || `Stage set to ${selectedStage} (${selectedTemperature})`,
          followUpAt: isClosing ? undefined : (followUpDate ? new Date(followUpDate).toISOString() : undefined),
          durationSeconds: 0,
          answers: [],
        });
      } catch (backendErr) {
        // If backend fails (e.g. mock lead or offline), continue to record locally
        console.log('Backend dispose notice:', backendErr);
      }

      // 2. Add to lead history store so timeline immediately captures this agent's update
      addActivity(lead._id, {
        phone: lead.phone,
        branch: currentUser?.branch,
        agentName: currentUserName,
        agentId: currentUser?._id,
        connected: isConnected,
        stage: selectedStage === 'Follow-up' ? 'Follow Up' : selectedStage,
        tag: selectedTemperature,
        temperature: selectedTemperature,
        remark: notes.trim() || `Updated status to ${selectedStage} (${selectedTemperature})`,
        followUpAt: isClosing ? null : (followUpDate || null),
        durationSeconds: 0,
        notConnectedReason: isConnected ? undefined : 'DID_NOT_PICK',
      });

      refetchHistory();
      onLeadUpdated?.();

      if (isClosing) {
        toast.success(
          `${lead.name} marked as ${selectedStage} · Archived from active queue`,
          'Lead Closed & Suppressed',
        );
      } else {
        toast.success(
          `${lead.name} updated to ${selectedStage} (${selectedTemperature})${
            followUpDate ? ` · Next: ${formatScheduledDate(followUpDate)}` : ''
          }`,
          'Lead Updated',
        );
      }
      onClose();
    } catch (err: any) {
      Alert.alert('Update Failed', err?.message || 'Could not update lead');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Modal
        visible={visible && !showWhatsAppModal}
        transparent
        animationType="fade"
        onRequestClose={onClose}
      >
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.headerTitleWrap}>
                <Text style={styles.leadName}>{lead.name}</Text>
                <Text style={styles.campaignSub}>
                  {campaignName} · {lead.attemptCount || 0} attempts
                </Text>
              </View>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <X size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Quick Contact Bar */}
            <View style={styles.contactBox}>
              <CrmAvatar name={lead.name} size="md" />
              <View style={styles.contactInfo}>
                <Text style={styles.contactName}>{lead.name}</Text>
                <Text style={styles.contactPhone}>{formatDisplayPhone(lead.phone)}</Text>
              </View>

              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[styles.circleBtn, styles.callBtn]}
                  onPress={handleCall}
                  activeOpacity={0.7}
                  accessibilityLabel="Call Lead"
                >
                  <Phone size={16} color="#FFFFFF" strokeWidth={2.5} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.circleBtn, styles.whatsappBtn]}
                  onPress={handleWhatsApp}
                  activeOpacity={0.7}
                  accessibilityLabel="WhatsApp Lead"
                >
                  <MessageCircle size={16} color="#FFFFFF" strokeWidth={2.5} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Segmented Tabs: 1. Update / Disposition  |  2. History Timeline */}
            <View style={styles.tabBar}>
              <TouchableOpacity
                style={[styles.tabButton, activeTab === 'DISPOSITION' && styles.tabButtonActive]}
                onPress={() => setActiveTab('DISPOSITION')}
                activeOpacity={0.8}
              >
                <FileEdit
                  size={14}
                  color={activeTab === 'DISPOSITION' ? '#2563EB' : '#64748B'}
                />
                <Text
                  style={[
                    styles.tabButtonText,
                    activeTab === 'DISPOSITION' && styles.tabButtonTextActive,
                  ]}
                >
                  Update & Follow-up
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabButton, activeTab === 'HISTORY' && styles.tabButtonActive]}
                onPress={() => setActiveTab('HISTORY')}
                activeOpacity={0.8}
              >
                <History
                  size={14}
                  color={activeTab === 'HISTORY' ? '#2563EB' : '#64748B'}
                />
                <Text
                  style={[
                    styles.tabButtonText,
                    activeTab === 'HISTORY' && styles.tabButtonTextActive,
                  ]}
                >
                  Call History ({combinedActivities.length})
                </Text>
              </TouchableOpacity>
            </View>

            {/* TAB CONTENT */}
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 20 }}
            >
              {activeTab === 'DISPOSITION' ? (
                /* TAB 1: DISPOSITION & FOLLOW-UP FORM */
                <View>
                  {/* Customer Importance / Temperature Rating (NeoDove style) */}
                  <View style={styles.formField}>
                    <View style={styles.labelWithIcon}>
                      <Flame size={13} color="#EF4444" />
                      <Text style={styles.fieldLabel}>
                        Customer Importance / Temperature
                      </Text>
                    </View>
                    <View style={styles.temperatureRow}>
                      {/* HOT */}
                      <TouchableOpacity
                        style={[
                          styles.tempChip,
                          styles.tempChipHot,
                          selectedTemperature === 'HOT' && styles.tempChipHotActive,
                        ]}
                        onPress={() => setSelectedTemperature('HOT')}
                        activeOpacity={0.7}
                      >
                        <Flame
                          size={13}
                          color={selectedTemperature === 'HOT' ? '#DC2626' : '#EF4444'}
                          fill={selectedTemperature === 'HOT' ? '#DC2626' : 'transparent'}
                        />
                        <Text
                          style={[
                            styles.tempChipText,
                            selectedTemperature === 'HOT' && styles.tempChipTextHotActive,
                          ]}
                        >
                          Hot (High)
                        </Text>
                      </TouchableOpacity>

                      {/* WARM */}
                      <TouchableOpacity
                        style={[
                          styles.tempChip,
                          styles.tempChipWarm,
                          selectedTemperature === 'WARM' && styles.tempChipWarmActive,
                        ]}
                        onPress={() => setSelectedTemperature('WARM')}
                        activeOpacity={0.7}
                      >
                        <Sun
                          size={13}
                          color={selectedTemperature === 'WARM' ? '#B45309' : '#F59E0B'}
                        />
                        <Text
                          style={[
                            styles.tempChipText,
                            selectedTemperature === 'WARM' && styles.tempChipTextWarmActive,
                          ]}
                        >
                          Warm (Medium)
                        </Text>
                      </TouchableOpacity>

                      {/* COLD */}
                      <TouchableOpacity
                        style={[
                          styles.tempChip,
                          styles.tempChipCold,
                          selectedTemperature === 'COLD' && styles.tempChipColdActive,
                        ]}
                        onPress={() => setSelectedTemperature('COLD')}
                        activeOpacity={0.7}
                      >
                        <Snowflake
                          size={13}
                          color={selectedTemperature === 'COLD' ? '#1D4ED8' : '#3B82F6'}
                        />
                        <Text
                          style={[
                            styles.tempChipText,
                            selectedTemperature === 'COLD' && styles.tempChipTextColdActive,
                          ]}
                        >
                          Cold (Low)
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Stage Selector */}
                  <View style={styles.formField}>
                    <Text style={styles.fieldLabel}>Lead status / Stage</Text>
                    <View style={styles.stagesRow}>
                      {STAGE_OPTIONS.map((stg) => {
                        const isSelected = selectedStage === stg;
                        return (
                          <TouchableOpacity
                            key={stg}
                            style={[
                              styles.stageChip,
                              isSelected && styles.stageChipSelected,
                              (stg === 'Not Interested' || stg === 'Closed') &&
                                isSelected && {
                                  backgroundColor: '#FEE2E2',
                                  borderColor: '#EF4444',
                                },
                            ]}
                            onPress={() => {
                              setSelectedStage(stg);
                              if (stg === 'Not Interested' || stg === 'Closed') {
                                setSelectedTemperature('COLD');
                                setFollowUpDate('');
                              }
                            }}
                            activeOpacity={0.7}
                          >
                            <Text
                              style={[
                                styles.stageChipText,
                                isSelected && styles.stageChipTextSelected,
                                (stg === 'Not Interested' || stg === 'Closed') &&
                                  isSelected && { color: '#B91C1C' },
                              ]}
                            >
                              {stg}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* Conversation Notes */}
                  <View style={styles.formField}>
                    <Text style={styles.fieldLabel}>Conversation Notes / Feedback</Text>
                    <TextInput
                      style={styles.notesInput}
                      placeholder="Add notes about what customer said (e.g. requested service details, call tomorrow morning)..."
                      placeholderTextColor={colors.textQuiet}
                      value={notes}
                      onChangeText={setNotes}
                      multiline
                      numberOfLines={3}
                      textAlignVertical="top"
                    />
                  </View>

                  {/* CONDITIONAL: If Not Interested or Closed, Show DND & Lost Reason Safeguard; Else Show Schedule Follow-up */}
                  {selectedStage === 'Not Interested' || selectedStage === 'Closed' ? (
                    <View style={styles.suppressionCard}>
                      <View style={styles.suppressionHeader}>
                        <View style={styles.suppressionIconBadge}>
                          <Ban size={15} color="#DC2626" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.suppressionTitle}>Lead Suppression & DND Safeguard</Text>
                          <Text style={styles.suppressionDesc}>
                            This customer will be marked as Closed and immediately removed from your active calling queue and reminders so you won't accidentally call them again.
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.lostReasonsTitle}>Select Reason (1-Tap):</Text>
                      <View style={styles.lostReasonsWrap}>
                        {LOST_REASONS.map((r) => {
                          const isReasonActive = notes.includes(r.label);
                          return (
                            <TouchableOpacity
                              key={r.code}
                              style={[
                                styles.lostReasonChip,
                                isReasonActive && styles.lostReasonChipActive,
                              ]}
                              onPress={() => {
                                setSelectedTemperature('COLD');
                                setFollowUpDate('');
                                setNotes((prev) =>
                                  prev && !prev.includes(r.label)
                                    ? `${prev.trim()} · Reason: ${r.label}`
                                    : r.label,
                                );
                              }}
                              activeOpacity={0.7}
                            >
                              <Text style={styles.lostReasonEmoji}>{r.emoji}</Text>
                              <Text
                                style={[
                                  styles.lostReasonText,
                                  isReasonActive && styles.lostReasonTextActive,
                                ]}
                              >
                                {r.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  ) : (
                    /* Regular Quick Follow-up Presets (Tomorrow & Fast Scheduler) */
                    <View style={styles.formField}>
                      <View style={styles.labelWithIcon}>
                        <Calendar size={13} color="#2563EB" />
                        <Text style={styles.fieldLabel}>Schedule Follow-up</Text>
                      </View>

                      <View style={styles.quickDateRow}>
                        <TouchableOpacity
                          style={styles.quickDateBtn}
                          onPress={() => setQuickFollowUp(24, 10)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.quickDateText}>Tomorrow 10 AM</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.quickDateBtn}
                          onPress={() => setQuickFollowUp(24, 15)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.quickDateText}>Tomorrow 3 PM</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.quickDateBtn}
                          onPress={() => setQuickFollowUp(24, 18)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.quickDateText}>Tomorrow 6 PM</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.quickDateBtn}
                          onPress={() => setQuickFollowUp(3)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.quickDateText}>Today +3h</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.quickDateBtn}
                          onPress={() => setQuickFollowUp(48, 10)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.quickDateText}>In 2 Days</Text>
                        </TouchableOpacity>
                      </View>

                      {/* Interactive Custom Date & Time Picker Button */}
                      <TouchableOpacity
                        style={styles.customDatePickerBtn}
                        onPress={() => setShowCustomDatePicker(true)}
                        activeOpacity={0.8}
                      >
                        <Calendar size={14} color="#2563EB" />
                        <Text style={styles.customDatePickerBtnText}>
                          Pick Custom Date & Time...
                        </Text>
                      </TouchableOpacity>

                      {followUpDate ? (
                        <View style={styles.scheduledBanner}>
                          <Clock size={14} color="#0D9488" />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.scheduledBannerLabel}>Scheduled Callback:</Text>
                            <Text style={styles.scheduledBannerText}>
                              {formatScheduledDate(followUpDate)}
                            </Text>
                          </View>
                          <TouchableOpacity
                            onPress={() => setShowCustomDatePicker(true)}
                            style={styles.changeDateBtn}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.changeDateText}>Change</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => setFollowUpDate('')}
                            style={styles.clearFollowUpBtn}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.clearFollowUpText}>Clear</Text>
                          </TouchableOpacity>
                        </View>
                      ) : null}
                    </View>
                  )}

                  {/* Full Disposition Form Link */}
                  {onOpenFullDispose ? (
                    <TouchableOpacity
                      style={styles.fullDisposeLink}
                      onPress={() => {
                        onClose();
                        onOpenFullDispose(lead);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.fullDisposeLeft}>
                        <UserCheck size={16} color={colors.primary} />
                        <Text style={styles.fullDisposeText}>
                          Complete Full Call Form & Custom Questions
                        </Text>
                      </View>
                      <ChevronRight size={16} color={colors.textQuiet} />
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : (
                /* TAB 2: CALL HISTORY & MULTI-AGENT TIMELINE */
                <View style={{ paddingTop: 4 }}>
                  <LeadTimeline
                    activities={combinedActivities}
                    isLoading={isHistoryLoading}
                  />
                </View>
              )}
            </ScrollView>

            {/* Modal Actions Footer */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={onClose}
                disabled={isSubmitting}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveBtn, isSubmitting && { opacity: 0.7 }]}
                onPress={handleQuickSave}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Check size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.saveBtnText}>Save Update</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* WhatsApp Template Selector Modal */}
      <WhatsAppTemplateModal
        visible={showWhatsAppModal}
        onClose={() => setShowWhatsAppModal(false)}
        customerName={lead.name}
        customerPhone={cleanPhone}
      />

      {/* Interactive Custom Date & Time Picker Modal */}
      <CrmDateTimePickerModal
        visible={showCustomDatePicker}
        initialDate={followUpDate || undefined}
        onClose={() => setShowCustomDatePicker(false)}
        onConfirm={(isoDate) => setFollowUpDate(isoDate)}
        title={`Follow-up for ${lead.name}`}
      />
    </>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxHeight: '92%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    ...shadows.elevated,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  headerTitleWrap: {
    flex: 1,
  },
  leadName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  campaignSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  contactBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  contactInfo: {
    flex: 1,
    marginLeft: 12,
  },
  contactName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  contactPhone: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  circleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  callBtn: {
    backgroundColor: '#10B981',
  },
  whatsappBtn: {
    backgroundColor: '#16A34A',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 3,
    marginBottom: 14,
    gap: 4,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  tabButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  tabButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  tabButtonTextActive: {
    color: '#2563EB',
    fontWeight: '700',
  },
  formField: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  labelWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  temperatureRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tempChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  tempChipHot: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  tempChipHotActive: {
    backgroundColor: '#FEE2E2',
    borderColor: '#DC2626',
    borderWidth: 2,
  },
  tempChipWarm: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  tempChipWarmActive: {
    backgroundColor: '#FEF3C7',
    borderColor: '#D97706',
    borderWidth: 2,
  },
  tempChipCold: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  tempChipColdActive: {
    backgroundColor: '#DBEAFE',
    borderColor: '#2563EB',
    borderWidth: 2,
  },
  tempChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  tempChipTextHotActive: {
    color: '#DC2626',
    fontWeight: '800',
  },
  tempChipTextWarmActive: {
    color: '#D97706',
    fontWeight: '800',
  },
  tempChipTextColdActive: {
    color: '#2563EB',
    fontWeight: '800',
  },
  stagesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  stageChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  stageChipSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  stageChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  stageChipTextSelected: {
    color: '#2563EB',
    fontWeight: '700',
  },
  notesInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 10,
    fontSize: 12,
    color: '#0F172A',
    minHeight: 70,
  },
  quickDateRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  quickDateBtn: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  quickDateText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#334155',
  },
  customDatePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#93C5FD',
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  customDatePickerBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  scheduledBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginTop: 8,
    gap: 8,
  },
  scheduledBannerLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#0F766E',
    textTransform: 'uppercase',
  },
  scheduledBannerText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 1,
  },
  changeDateBtn: {
    backgroundColor: '#CCFBF1',
    borderWidth: 1,
    borderColor: '#5EEAD4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  changeDateText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0F766E',
  },
  clearFollowUpBtn: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  clearFollowUpText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },
  fullDisposeLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  fullDisposeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fullDisposeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  cancelBtn: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  cancelBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: '#2563EB',
  },
  saveBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  suppressionCard: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  suppressionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 10,
  },
  suppressionIconBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  suppressionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#991B1B',
  },
  suppressionDesc: {
    fontSize: 10,
    fontWeight: '500',
    color: '#7F1D1D',
    marginTop: 2,
    lineHeight: 14,
  },
  lostReasonsTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#991B1B',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  lostReasonsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  lostReasonChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 7,
  },
  lostReasonChipActive: {
    backgroundColor: '#DC2626',
    borderColor: '#B91C1C',
  },
  lostReasonEmoji: {
    fontSize: 12,
  },
  lostReasonText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#991B1B',
  },
  lostReasonTextActive: {
    color: '#FFFFFF',
  },
});
