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
  Ban,
  PhoneOff,
  CheckCircle2,
  CalendarClock,
  ArrowRight,
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

const OUTCOME_OPTIONS = [
  { stage: 'Interested', label: 'Interested', icon: CheckCircle2, color: '#10B981', bg: '#ECFDF5', border: '#A7F3D0' },
  { stage: 'Follow-up', label: 'Follow-up', icon: CalendarClock, color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  { stage: 'Not connected', label: 'Not Connected', icon: PhoneOff, color: '#64748B', bg: '#F1F5F9', border: '#CBD5E1' },
  { stage: 'Not Interested', label: 'Not Interested', icon: Ban, color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
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
      : 'Outreach Campaign';

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

      // 1. Log to backend
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
          `${lead.name} marked as ${selectedStage} · Suppressed from active queue`,
          'Lead Closed',
        );
      } else {
        toast.success(
          `${lead.name} updated to ${selectedStage} (${selectedTemperature})${
            followUpDate ? ` · Next: ${formatScheduledDate(followUpDate)}` : ''
          }`,
          'Saved',
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
        animationType="slide"
        onRequestClose={onClose}
      >
        <View style={styles.sheetOverlay}>
          <View style={styles.sheetCard}>
            {/* Sheet Handle */}
            <View style={styles.handleBar} />

            {/* Header: Lead Info + Actions */}
            <View style={styles.headerRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetLeadName} numberOfLines={1}>
                  {lead.name}
                </Text>
                <Text style={styles.sheetLeadPhone}>
                  {formatDisplayPhone(lead.phone)} · {campaignName}
                </Text>
              </View>

              <View style={styles.headerActionIcons}>
                <TouchableOpacity
                  style={[styles.headerCircleBtn, styles.headerCallBtn]}
                  onPress={handleCall}
                  activeOpacity={0.7}
                >
                  <Phone size={15} color="#FFFFFF" strokeWidth={2.5} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.headerCircleBtn, styles.headerWhatsAppBtn]}
                  onPress={handleWhatsApp}
                  activeOpacity={0.7}
                >
                  <MessageCircle size={15} color="#FFFFFF" strokeWidth={2.5} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={onClose}
                  activeOpacity={0.7}
                >
                  <X size={16} color="#64748B" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Segmented Tabs */}
            <View style={styles.tabBar}>
              <TouchableOpacity
                style={[styles.tabButton, activeTab === 'DISPOSITION' && styles.tabButtonActive]}
                onPress={() => setActiveTab('DISPOSITION')}
                activeOpacity={0.8}
              >
                <FileEdit
                  size={14}
                  color={activeTab === 'DISPOSITION' ? '#4F46E5' : '#64748B'}
                />
                <Text
                  style={[
                    styles.tabButtonText,
                    activeTab === 'DISPOSITION' && styles.tabButtonTextActive,
                  ]}
                >
                  Call Outcome
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabButton, activeTab === 'HISTORY' && styles.tabButtonActive]}
                onPress={() => setActiveTab('HISTORY')}
                activeOpacity={0.8}
              >
                <History
                  size={14}
                  color={activeTab === 'HISTORY' ? '#4F46E5' : '#64748B'}
                />
                <Text
                  style={[
                    styles.tabButtonText,
                    activeTab === 'HISTORY' && styles.tabButtonTextActive,
                  ]}
                >
                  Timeline ({combinedActivities.length})
                </Text>
              </TouchableOpacity>
            </View>

            {/* Tab Body */}
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.sheetScrollContent}
            >
              {activeTab === 'DISPOSITION' ? (
                <View>
                  {/* 1. Big Tactile Outcome Chips (NeoDove signature) */}
                  <View style={styles.formSection}>
                    <Text style={styles.fieldSectionTitle}>SELECT CALL OUTCOME</Text>
                    <View style={styles.outcomeGrid}>
                      {OUTCOME_OPTIONS.map((item) => {
                        const isSelected = selectedStage === item.stage;
                        const IconComponent = item.icon;
                        return (
                          <TouchableOpacity
                            key={item.stage}
                            style={[
                              styles.outcomeCard,
                              isSelected && {
                                backgroundColor: item.bg,
                                borderColor: item.color,
                                borderWidth: 2,
                              },
                            ]}
                            onPress={() => {
                              setSelectedStage(item.stage);
                              if (item.stage === 'Not Interested') {
                                setSelectedTemperature('COLD');
                                setFollowUpDate('');
                              } else if (item.stage === 'Interested') {
                                setSelectedTemperature('HOT');
                              }
                            }}
                            activeOpacity={0.7}
                          >
                            <View
                              style={[
                                styles.outcomeIconWrap,
                                { backgroundColor: isSelected ? '#FFFFFF' : item.bg },
                              ]}
                            >
                              <IconComponent
                                size={16}
                                color={isSelected ? item.color : '#64748B'}
                                strokeWidth={2.5}
                              />
                            </View>
                            <Text
                              style={[
                                styles.outcomeLabel,
                                isSelected && { color: item.color, fontWeight: '800' },
                              ]}
                            >
                              {item.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* 2. Customer Priority / Temperature */}
                  <View style={styles.formSection}>
                    <Text style={styles.fieldSectionTitle}>CUSTOMER TEMPERATURE</Text>
                    <View style={styles.tempRow}>
                      {/* HOT */}
                      <TouchableOpacity
                        style={[
                          styles.tempPill,
                          selectedTemperature === 'HOT' && styles.tempPillHotActive,
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
                            styles.tempPillText,
                            selectedTemperature === 'HOT' && styles.tempPillTextHot,
                          ]}
                        >
                          Hot
                        </Text>
                      </TouchableOpacity>

                      {/* WARM */}
                      <TouchableOpacity
                        style={[
                          styles.tempPill,
                          selectedTemperature === 'WARM' && styles.tempPillWarmActive,
                        ]}
                        onPress={() => setSelectedTemperature('WARM')}
                        activeOpacity={0.7}
                      >
                        <Sun
                          size={13}
                          color={selectedTemperature === 'WARM' ? '#D97706' : '#F59E0B'}
                        />
                        <Text
                          style={[
                            styles.tempPillText,
                            selectedTemperature === 'WARM' && styles.tempPillTextWarm,
                          ]}
                        >
                          Warm
                        </Text>
                      </TouchableOpacity>

                      {/* COLD */}
                      <TouchableOpacity
                        style={[
                          styles.tempPill,
                          selectedTemperature === 'COLD' && styles.tempPillColdActive,
                        ]}
                        onPress={() => setSelectedTemperature('COLD')}
                        activeOpacity={0.7}
                      >
                        <Snowflake
                          size={13}
                          color={selectedTemperature === 'COLD' ? '#2563EB' : '#3B82F6'}
                        />
                        <Text
                          style={[
                            styles.tempPillText,
                            selectedTemperature === 'COLD' && styles.tempPillTextCold,
                          ]}
                        >
                          Cold
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* 3. Conditional: Lost Reason OR Follow-up Scheduler */}
                  {selectedStage === 'Not Interested' || selectedStage === 'Closed' ? (
                    <View style={styles.suppressionBox}>
                      <View style={styles.suppressionHead}>
                        <Ban size={15} color="#DC2626" />
                        <Text style={styles.suppressionTitle}>Lead DND & Suppression Safeguard</Text>
                      </View>
                      <Text style={styles.suppressionSub}>
                        This number will be removed from your active queue so customer irritation is prevented.
                      </Text>

                      <Text style={styles.lostReasonsHeading}>SELECT REASON (1-TAP):</Text>
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
                              <Text style={{ fontSize: 12 }}>{r.emoji}</Text>
                              <Text
                                style={[
                                  styles.lostReasonChipText,
                                  isReasonActive && styles.lostReasonChipTextActive,
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
                    /* Regular Quick Follow-up Presets */
                    <View style={styles.formSection}>
                      <View style={styles.fieldHeaderWithAction}>
                        <Text style={styles.fieldSectionTitle}>SCHEDULE FOLLOW-UP</Text>
                        {followUpDate ? (
                          <TouchableOpacity onPress={() => setFollowUpDate('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Text style={styles.clearDateText}>Clear Date</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>

                      <View style={styles.quickPresetRow}>
                        <TouchableOpacity
                          style={styles.presetChip}
                          onPress={() => setQuickFollowUp(24, 10)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.presetChipText}>Tomorrow 10 AM</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.presetChip}
                          onPress={() => setQuickFollowUp(24, 15)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.presetChipText}>Tomorrow 3 PM</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.presetChip}
                          onPress={() => setQuickFollowUp(24, 18)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.presetChipText}>Tomorrow 6 PM</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.presetChip}
                          onPress={() => setQuickFollowUp(48, 10)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.presetChipText}>In 2 Days</Text>
                        </TouchableOpacity>
                      </View>

                      {/* Custom Date & Time Picker */}
                      <TouchableOpacity
                        style={styles.customDateBtn}
                        onPress={() => setShowCustomDatePicker(true)}
                        activeOpacity={0.8}
                      >
                        <Calendar size={14} color="#4F46E5" />
                        <Text style={styles.customDateBtnText}>
                          {followUpDate ? formatScheduledDate(followUpDate) : 'Pick Custom Date & Time...'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* 4. Notes Input */}
                  <View style={styles.formSection}>
                    <Text style={styles.fieldSectionTitle}>CONVERSATION NOTES</Text>
                    <TextInput
                      style={styles.notesBox}
                      placeholder="Add brief notes about customer needs, price discussed, or questions asked..."
                      placeholderTextColor="#94A3B8"
                      value={notes}
                      onChangeText={setNotes}
                      multiline
                      numberOfLines={3}
                      textAlignVertical="top"
                    />
                  </View>

                  {/* Full Disposition Form Link */}
                  {onOpenFullDispose ? (
                    <TouchableOpacity
                      style={styles.fullFormLink}
                      onPress={() => {
                        onClose();
                        onOpenFullDispose(lead);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <UserCheck size={14} color="#4F46E5" />
                        <Text style={styles.fullFormLinkText}>Complete Full Multi-Step Form</Text>
                      </View>
                      <ChevronRight size={14} color="#64748B" />
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : (
                /* TAB 2: CALL HISTORY */
                <View style={{ paddingTop: 4 }}>
                  <LeadTimeline
                    activities={combinedActivities}
                    isLoading={isHistoryLoading}
                  />
                </View>
              )}
            </ScrollView>

            {/* Bottom Primary Button */}
            <View style={styles.sheetFooter}>
              <TouchableOpacity
                style={[styles.saveNextBtn, isSubmitting && { opacity: 0.7 }]}
                onPress={handleQuickSave}
                disabled={isSubmitting}
                activeOpacity={0.85}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={styles.saveNextBtnText}>Save & Next Lead</Text>
                    <ArrowRight size={16} color="#FFFFFF" strokeWidth={2.5} />
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
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  sheetCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24,
    ...shadows.elevated,
  },
  handleBar: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sheetLeadName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  sheetLeadPhone: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  headerActionIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerCircleBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCallBtn: {
    backgroundColor: '#10B981',
  },
  headerWhatsAppBtn: {
    backgroundColor: '#16A34A',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
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
    paddingVertical: 7,
    borderRadius: 8,
    gap: 6,
  },
  tabButtonActive: {
    backgroundColor: '#FFFFFF',
    ...shadows.soft,
  },
  tabButtonText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748B',
  },
  tabButtonTextActive: {
    color: '#4F46E5',
    fontWeight: '700',
  },
  sheetScrollContent: {
    paddingBottom: 16,
  },
  formSection: {
    marginBottom: 14,
  },
  fieldSectionTitle: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  outcomeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  outcomeCard: {
    flex: 1,
    minWidth: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  outcomeIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  outcomeLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  tempRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tempPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tempPillHotActive: {
    backgroundColor: '#FEE2E2',
    borderColor: '#DC2626',
    borderWidth: 1.5,
  },
  tempPillWarmActive: {
    backgroundColor: '#FEF3C7',
    borderColor: '#D97706',
    borderWidth: 1.5,
  },
  tempPillColdActive: {
    backgroundColor: '#DBEAFE',
    borderColor: '#2563EB',
    borderWidth: 1.5,
  },
  tempPillText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748B',
  },
  tempPillTextHot: {
    color: '#DC2626',
    fontWeight: '800',
  },
  tempPillTextWarm: {
    color: '#D97706',
    fontWeight: '800',
  },
  tempPillTextCold: {
    color: '#2563EB',
    fontWeight: '800',
  },
  suppressionBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  suppressionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  suppressionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#991B1B',
  },
  suppressionSub: {
    fontSize: 10.5,
    color: '#7F1D1D',
    marginBottom: 10,
    lineHeight: 15,
  },
  lostReasonsHeading: {
    fontSize: 10,
    fontWeight: '800',
    color: '#991B1B',
    marginBottom: 6,
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
    borderRadius: 8,
  },
  lostReasonChipActive: {
    backgroundColor: '#DC2626',
    borderColor: '#B91C1C',
  },
  lostReasonChipText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#991B1B',
  },
  lostReasonChipTextActive: {
    color: '#FFFFFF',
  },
  fieldHeaderWithAction: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  clearDateText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#DC2626',
  },
  quickPresetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  presetChip: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  presetChipText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#334155',
  },
  customDateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  customDateBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#4F46E5',
  },
  notesBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 10,
    fontSize: 12,
    color: '#0F172A',
    minHeight: 64,
  },
  fullFormLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 2,
  },
  fullFormLinkText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F46E5',
  },
  sheetFooter: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  saveNextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#4F46E5',
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  saveNextBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});
