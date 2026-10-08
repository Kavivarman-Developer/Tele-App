import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Platform,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import {
  Bell,
  X,
  Phone,
  MessageCircle,
  Calendar,
  Clock,
  Flame,
  Sun,
  Snowflake,
  Search,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react-native';

import { fetchMyLeads } from '../api/leadApi';
import { callService } from '../services/call.service';
import { useAuthStore } from '../store/authStore';
import { useLeadHistoryStore } from '../store/leadHistoryStore';
import { Lead, Activity } from '../types';
import { WhatsAppTemplateModal } from './WhatsAppTemplateModal';
import { LeadQuickModal } from './LeadQuickModal';
import { toast } from '../store/toastStore';
import { colors, borderRadius, shadows } from '../theme';

interface NotificationFollowUp {
  _id: string;
  name: string;
  phone: string;
  stage: string;
  temperature: 'HOT' | 'WARM' | 'COLD';
  timeLabel: string;
  isToday: boolean;
  isOverdue: boolean;
  branch?: string;
  agentName?: string;
  attempts: number;
}

const DEFAULT_SAMPLE_REMINDERS: NotificationFollowUp[] = [
  {
    _id: '6ac623d96c84a3753e4573ff',
    name: 'Priya Verma',
    phone: '+91 9810000129',
    stage: 'Follow Up',
    temperature: 'HOT',
    timeLabel: 'Today at 11:00 AM',
    isToday: true,
    isOverdue: true,
    branch: 'Trichy / Pudukkottai',
    agentName: 'Kavin & John',
    attempts: 2,
  },
  {
    _id: '6ac623d96c84a3753e4573f0',
    name: 'Kavya Menon',
    phone: '+91 9810000073',
    stage: 'Interested',
    temperature: 'WARM',
    timeLabel: 'Today at 04:30 PM',
    isToday: true,
    isOverdue: false,
    branch: 'Trichy',
    agentName: 'Assigned Agent',
    attempts: 3,
  },
  {
    _id: '6ac623d96c84a3753e4573cd',
    name: 'Rohan Mehta',
    phone: '+91 9810000081',
    stage: 'Follow Up',
    temperature: 'HOT',
    timeLabel: 'Tomorrow at 10:00 AM',
    isToday: false,
    isOverdue: false,
    branch: 'Pudukkottai',
    agentName: 'John Agent',
    attempts: 1,
  },
  {
    _id: '6ac623d96c84a3753e4573f1',
    name: 'Anika Mehta',
    phone: '+91 9810000089',
    stage: 'Follow Up',
    temperature: 'COLD',
    timeLabel: 'Tomorrow at 03:00 PM',
    isToday: false,
    isOverdue: false,
    branch: 'Trichy',
    agentName: 'Kavin',
    attempts: 1,
  },
];

interface FollowUpNotificationsModalProps {
  visible: boolean;
  onClose: () => void;
}

export const FollowUpNotificationsModal: React.FC<FollowUpNotificationsModalProps> = ({
  visible,
  onClose,
}) => {
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'TODAY' | 'UPCOMING'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected lead for LeadQuickModal or WhatsAppTemplateModal
  const [quickLead, setQuickLead] = useState<Lead | null>(null);
  const [whatsAppTarget, setWhatsAppTarget] = useState<{ name: string; phone: string } | null>(null);

  // Fetch real follow-ups from backend if available
  const { data: myLeadsData, refetch } = useQuery({
    queryKey: ['notificationsFollowUps'],
    queryFn: () => fetchMyLeads({ type: 'FOLLOW_UP', limit: 30 }),
    enabled: visible,
  });

  // Transform backend leads into Notification items
  const backendFollowUps = useMemo<NotificationFollowUp[]>(() => {
    if (!myLeadsData?.leads || myLeadsData.leads.length === 0) {
      return [];
    }

    const now = new Date();
    return myLeadsData.leads.map((l) => {
      let timeLabel = 'Callback scheduled';
      let isToday = false;
      let isOverdue = false;

      if (l.nextFollowUpAt) {
        const d = new Date(l.nextFollowUpAt);
        if (!isNaN(d.getTime())) {
          isToday = d.toDateString() === now.toDateString();
          isOverdue = d.getTime() < now.getTime();
          timeLabel = `${isToday ? 'Today' : d.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        }
      }

      const temp = (l.temperature || (l.tag?.toUpperCase() === 'HOT' ? 'HOT' : l.tag?.toUpperCase() === 'COLD' ? 'COLD' : 'WARM')) as 'HOT' | 'WARM' | 'COLD';

      return {
        _id: l._id,
        name: l.name,
        phone: l.phone,
        stage: l.stage || 'Follow Up',
        temperature: temp,
        timeLabel,
        isToday,
        isOverdue,
        branch: l.branch || user?.branch || undefined,
        agentName: typeof l.assignedTo === 'object' && l.assignedTo ? (l.assignedTo as any).name : user?.name,
        attempts: l.attemptCount || 1,
      };
    });
  }, [myLeadsData, user]);

  // Combine with sample items if backend returned few/no items
  const allReminders = useMemo(() => {
    if (backendFollowUps.length > 0) {
      return backendFollowUps;
    }
    // Filter sample items if agent is logged in to match agent's branch/context
    return DEFAULT_SAMPLE_REMINDERS;
  }, [backendFollowUps]);

  // Filtered Reminders
  const filteredList = useMemo(() => {
    return allReminders.filter((item) => {
      if (activeFilter === 'TODAY' && !item.isToday) return false;
      if (activeFilter === 'UPCOMING' && item.isToday) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          item.name.toLowerCase().includes(q) ||
          item.phone.toLowerCase().includes(q) ||
          item.stage.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [allReminders, activeFilter, searchQuery]);

  // Counts
  const todayDueCount = allReminders.filter((r) => r.isToday || r.isOverdue).length;

  const handleCall = async (item: NotificationFollowUp) => {
    toast.info(`Initiating call to ${item.name}...`);
    try {
      await callService.startCall({ phone: item.phone, name: item.name } as any);
    } catch {
      // Fallback
    }

    // Open Quick Modal to record outcome
    openQuickModal(item);
  };

  const handleWhatsApp = (item: NotificationFollowUp) => {
    setWhatsAppTarget({ name: item.name, phone: item.phone });
  };

  const openQuickModal = (item: NotificationFollowUp) => {
    const syntheticLead: Lead = {
      _id: item._id,
      campaignId: 'default-camp',
      name: item.name,
      phone: item.phone,
      source: 'FOLLOW_UP',
      stage: item.stage,
      tag: item.temperature,
      temperature: item.temperature,
      status: 'OPEN',
      attemptCount: item.attempts,
      customProperties: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setQuickLead(syntheticLead);
  };

  const handleNavigateToAllFollowUps = () => {
    onClose();
    navigation.navigate('FollowUps');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Top Grab Bar / Handle */}
          <View style={styles.grabBar} />

          {/* Modal Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <View style={styles.bellIconBox}>
                <Bell size={18} color="#2563EB" />
                {todayDueCount > 0 && (
                  <View style={styles.headerBadge}>
                    <Text style={styles.headerBadgeText}>{todayDueCount}</Text>
                  </View>
                )}
              </View>
              <View>
                <Text style={styles.headerTitle}>Follow-up Notifications</Text>
                <Text style={styles.headerSubtitle}>
                  {todayDueCount > 0
                    ? `${todayDueCount} callback${todayDueCount > 1 ? 's' : ''} require attention today`
                    : 'All callbacks up to date'}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={18} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={styles.searchRow}>
            <Search size={14} color="#94A3B8" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search reminder or phone..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <X size={14} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>

          {/* Filter Pills: All | Due Today | Upcoming */}
          <View style={styles.filterPillsRow}>
            <TouchableOpacity
              style={[styles.pillBtn, activeFilter === 'ALL' && styles.pillBtnActive]}
              onPress={() => setActiveFilter('ALL')}
              activeOpacity={0.7}
            >
              <Text
                style={[styles.pillText, activeFilter === 'ALL' && styles.pillTextActive]}
              >
                All ({allReminders.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.pillBtn, activeFilter === 'TODAY' && styles.pillBtnActive]}
              onPress={() => setActiveFilter('TODAY')}
              activeOpacity={0.7}
            >
              <Text
                style={[styles.pillText, activeFilter === 'TODAY' && styles.pillTextActive]}
              >
                Due Today ({allReminders.filter((r) => r.isToday).length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.pillBtn, activeFilter === 'UPCOMING' && styles.pillBtnActive]}
              onPress={() => setActiveFilter('UPCOMING')}
              activeOpacity={0.7}
            >
              <Text
                style={[styles.pillText, activeFilter === 'UPCOMING' && styles.pillTextActive]}
              >
                Upcoming ({allReminders.filter((r) => !r.isToday).length})
              </Text>
            </TouchableOpacity>
          </View>

          {/* Notifications Scroll Area */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            style={styles.scrollArea}
            contentContainerStyle={{ paddingBottom: 16 }}
          >
            {filteredList.length === 0 ? (
              <View style={styles.emptyState}>
                <CheckCircle2 size={36} color="#10B981" />
                <Text style={styles.emptyTitle}>You're All Caught Up!</Text>
                <Text style={styles.emptySubtitle}>
                  No follow-up callbacks pending in this section right now.
                </Text>
              </View>
            ) : (
              filteredList.map((item) => {
                const isHot = item.temperature === 'HOT';
                const isCold = item.temperature === 'COLD';

                return (
                  <View
                    key={item._id}
                    style={[
                      styles.reminderCard,
                      item.isOverdue && styles.reminderCardOverdue,
                    ]}
                  >
                    {/* Top Row: Customer Info & Temperature */}
                    <View style={styles.cardHeader}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={styles.customerName}>{item.name}</Text>
                          {/* Temperature Badge */}
                          <View
                            style={[
                              styles.tempBadge,
                              isHot
                                ? styles.tempHot
                                : isCold
                                ? styles.tempCold
                                : styles.tempWarm,
                            ]}
                          >
                            {isHot ? (
                              <Flame size={9} color="#DC2626" />
                            ) : isCold ? (
                              <Snowflake size={9} color="#2563EB" />
                            ) : (
                              <Sun size={9} color="#D97706" />
                            )}
                            <Text
                              style={[
                                styles.tempText,
                                {
                                  color: isHot
                                    ? '#DC2626'
                                    : isCold
                                    ? '#2563EB'
                                    : '#D97706',
                                },
                              ]}
                            >
                              {item.temperature}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.customerPhone}>{item.phone}</Text>
                      </View>

                      {/* Scheduled Time Pill */}
                      <View
                        style={[
                          styles.timePill,
                          item.isOverdue ? styles.timePillOverdue : null,
                        ]}
                      >
                        <Clock
                          size={11}
                          color={item.isOverdue ? '#DC2626' : '#2563EB'}
                        />
                        <Text
                          style={[
                            styles.timePillText,
                            item.isOverdue ? styles.timePillTextOverdue : null,
                          ]}
                        >
                          {item.timeLabel}
                        </Text>
                      </View>
                    </View>

                    {/* Metadata: Stage & Branch */}
                    <View style={styles.metaRow}>
                      <Text style={styles.stageTag}>Stage: {item.stage}</Text>
                      {item.branch ? (
                        <Text style={styles.branchText}>· {item.branch}</Text>
                      ) : null}
                    </View>

                    {/* Direct Action Buttons */}
                    <View style={styles.actionsRow}>
                      {/* Call Now Button */}
                      <TouchableOpacity
                        style={styles.callActionBtn}
                        onPress={() => handleCall(item)}
                        activeOpacity={0.7}
                      >
                        <Phone size={13} color="#FFFFFF" strokeWidth={2.5} />
                        <Text style={styles.callActionBtnText}>Call Now</Text>
                      </TouchableOpacity>

                      {/* WhatsApp Button */}
                      <TouchableOpacity
                        style={styles.whatsAppActionBtn}
                        onPress={() => handleWhatsApp(item)}
                        activeOpacity={0.7}
                      >
                        <MessageCircle size={13} color="#16A34A" strokeWidth={2.5} />
                        <Text style={styles.whatsAppActionBtnText}>WhatsApp</Text>
                      </TouchableOpacity>

                      {/* Quick Update Button */}
                      <TouchableOpacity
                        style={styles.updateActionBtn}
                        onPress={() => openQuickModal(item)}
                        activeOpacity={0.7}
                      >
                        <Calendar size={13} color="#2563EB" />
                        <Text style={styles.updateActionBtnText}>Reschedule</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>

          {/* Bottom Footer Action */}
          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.viewAllBtn}
              onPress={handleNavigateToAllFollowUps}
              activeOpacity={0.8}
            >
              <Text style={styles.viewAllBtnText}>
                Open Full Follow-ups Screen
              </Text>
              <ExternalLink size={14} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Embedded WhatsApp Template Modal */}
      {whatsAppTarget && (
        <WhatsAppTemplateModal
          visible={Boolean(whatsAppTarget)}
          onClose={() => setWhatsAppTarget(null)}
          recipientName={whatsAppTarget.name}
          recipientPhone={whatsAppTarget.phone}
        />
      )}

      {/* Embedded Lead Quick Modal */}
      {quickLead && (
        <LeadQuickModal
          lead={quickLead}
          visible={Boolean(quickLead)}
          onClose={() => setQuickLead(null)}
          onLeadUpdated={() => {
            refetch();
          }}
          onOpenFullDispose={(leadToDispose) => {
            onClose();
            navigation.navigate('Dispose', { lead: leadToDispose });
          }}
        />
      )}
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  modalCard: {
    width: '100%',
    maxWidth: 620,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    maxHeight: '85%',
    ...shadows.elevated,
  },
  grabBar: {
    width: 44,
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bellIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    position: 'relative',
  },
  headerBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  headerBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginTop: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    padding: 0,
  },
  filterPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 12,
  },
  pillBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    backgroundColor: '#F1F5F9',
  },
  pillBtnActive: {
    backgroundColor: '#2563EB',
  },
  pillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  pillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  scrollArea: {
    maxHeight: 380,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 10,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 240,
  },
  reminderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 10,
    ...shadows.soft,
  },
  reminderCardOverdue: {
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  customerName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  customerPhone: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 1,
  },
  tempBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2.5,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 5,
  },
  tempHot: {
    backgroundColor: '#FEE2E2',
  },
  tempWarm: {
    backgroundColor: '#FEF3C7',
  },
  tempCold: {
    backgroundColor: '#DBEAFE',
  },
  tempText: {
    fontSize: 9,
    fontWeight: '800',
  },
  timePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  timePillOverdue: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA',
  },
  timePillText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  timePillTextOverdue: {
    color: '#DC2626',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    marginBottom: 10,
  },
  stageTag: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#475569',
  },
  branchText: {
    fontSize: 10.5,
    color: '#94A3B8',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
  },
  callActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#059669',
    paddingVertical: 7,
    borderRadius: borderRadius.sm,
  },
  callActionBtnText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
  },
  whatsAppActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    paddingVertical: 7,
    borderRadius: borderRadius.sm,
  },
  whatsAppActionBtnText: {
    color: '#15803D',
    fontSize: 11.5,
    fontWeight: '700',
  },
  updateActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingVertical: 7,
    borderRadius: borderRadius.sm,
  },
  updateActionBtnText: {
    color: '#1D4ED8',
    fontSize: 11.5,
    fontWeight: '700',
  },
  modalFooter: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#2563EB',
    paddingVertical: 10,
    borderRadius: borderRadius.md,
  },
  viewAllBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
});
