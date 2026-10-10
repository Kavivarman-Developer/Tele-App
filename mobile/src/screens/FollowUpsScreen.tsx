import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Linking,
  useWindowDimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarDays,
  Search,
  X,
  ArrowUpRight,
  AlertTriangle,
  Phone,
  MessageCircle,
  Flame,
  Sun,
  Snowflake,
  CheckCircle2,
  Clock,
  RotateCw,
  Clock3,
  Calendar,
  CalendarClock,
  FileEdit,
} from 'lucide-react-native';

import { fetchMyLeads, disposeLead } from '../api/leadApi';
import { Lead, RootStackParamList } from '../types';
import { colors, borderRadius, shadows } from '../theme';
import { useAuthStore } from '../store/authStore';
import { useLeadHistoryStore } from '../store/leadHistoryStore';
import { CrmShell } from '../components/CrmShell';
import { LeadQuickModal } from '../components/LeadQuickModal';
import { WhatsAppTemplateModal } from '../components/WhatsAppTemplateModal';
import { getDialerTelUrl, formatDisplayPhone } from '../utils/phoneUtils';
import { toast } from '../store/toastStore';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type TabCategory = 'Overdue' | 'Today' | 'Upcoming';

interface FollowUpItem {
  _id: string;
  name: string;
  phone: string;
  campaignName: string;
  attempts: number;
  assignedAgent: string;
  status: string;
  time: string;
  date: string;
  category: TabCategory;
  temperature?: 'HOT' | 'WARM' | 'COLD';
  rawDate: Date;
  lastRemark?: string;
}

export const FollowUpsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuthStore();
  const isAgent = user?.role === 'AGENT';
  const { width } = useWindowDimensions();
  const isWide = width >= 860;

  const [activeTab, setActiveTab] = useState<TabCategory>('Today');
  const [searchQuery, setSearchQuery] = useState('');
  const [quickModalLead, setQuickModalLead] = useState<Lead | null>(null);
  const [whatsAppModalVisible, setWhatsAppModalVisible] = useState(false);
  const [whatsAppTarget, setWhatsAppTarget] = useState<{ name: string; phone: string } | null>(null);

  const { addActivity } = useLeadHistoryStore();

  // Direct Call Handler
  const handleDirectCall = (item: FollowUpItem) => {
    toast.info(`Dialing ${item.name}...`, 'Calling');
    Linking.openURL(getDialerTelUrl(item.phone)).catch(() => {
      Alert.alert('Unable to dial', `Could not open phone dialer for ${item.phone}`);
    });
  };

  // Direct WhatsApp Handler
  const handleOpenWhatsApp = (item: FollowUpItem) => {
    setWhatsAppTarget({
      name: item.name,
      phone: item.phone,
    });
    setWhatsAppModalVisible(true);
  };

  // Quick Snooze Handler (Snooze +2 Hours or Tomorrow 10 AM)
  const handleQuickSnooze = (item: FollowUpItem, hoursAhead: number = 2) => {
    Alert.alert(
      'Snooze Follow-up',
      `Reschedule callback for ${item.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: '+2 Hours',
          onPress: async () => {
            const nextTime = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
            try {
              await disposeLead(item._id, {
                connected: false,
                callAttempt: false,
                stage: 'Follow Up',
                remark: 'Snoozed by 2 hours',
                followUpAt: nextTime,
                durationSeconds: 0,
              });
            } catch {}
            addActivity(item._id, {
              phone: item.phone,
              agentName: user?.name || 'Agent',
              agentId: user?._id,
              connected: false,
              type: 'UPDATE',
              stage: 'Follow Up',
              remark: 'Follow-up snoozed +2 hours',
              followUpAt: nextTime,
              durationSeconds: 0,
            });
            refetch();
            toast.success(`Rescheduled ${item.name} for 2 hours later`, 'Snoozed');
          },
        },
        {
          text: 'Tomorrow 10 AM',
          onPress: async () => {
            const d = new Date();
            d.setDate(d.getDate() + 1);
            d.setHours(10, 0, 0, 0);
            const nextTime = d.toISOString();
            try {
              await disposeLead(item._id, {
                connected: false,
                callAttempt: false,
                stage: 'Follow Up',
                remark: 'Snoozed to Tomorrow 10 AM',
                followUpAt: nextTime,
                durationSeconds: 0,
              });
            } catch {}
            addActivity(item._id, {
              phone: item.phone,
              agentName: user?.name || 'Agent',
              agentId: user?._id,
              connected: false,
              type: 'UPDATE',
              stage: 'Follow Up',
              remark: 'Follow-up snoozed to Tomorrow 10 AM',
              followUpAt: nextTime,
              durationSeconds: 0,
            });
            refetch();
            toast.success(`Rescheduled ${item.name} for Tomorrow 10 AM`, 'Snoozed');
          },
        },
      ],
    );
  };

  // Real backend query for follow-ups
  const { data: realFollowupsData, refetch, isRefetching } = useQuery({
    queryKey: ['followUps'],
    queryFn: () => fetchMyLeads({ type: 'FOLLOW_UP', limit: 100 }),
  });

  // Extract real follow-ups from backend leads and local follow-ups
  const combinedItems: FollowUpItem[] = useMemo(() => {
    const list: FollowUpItem[] = [];
    const seenIds = new Set<string>();

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endOfToday = startOfToday + 24 * 60 * 60 * 1000 - 1;

    // 1. From real backend leads
    const realLeads = realFollowupsData?.leads || [];
    for (const l of realLeads) {
      if (!l._id || seenIds.has(l._id)) continue;
      seenIds.add(l._id);

      const camp = typeof l.campaign === 'object' && l.campaign ? l.campaign.name : 'Campaign';
      const dateObj = l.nextFollowUpAt ? new Date(l.nextFollowUpAt) : new Date();
      const fTime = dateObj.getTime();

      let cat: TabCategory = 'Today';
      if (fTime < now.getTime()) {
        cat = 'Overdue';
      } else if (fTime >= startOfToday && fTime <= endOfToday) {
        cat = 'Today';
      } else {
        cat = 'Upcoming';
      }

      const temp = (l.temperature || (l.tag?.toUpperCase() === 'HOT' ? 'HOT' : l.tag?.toUpperCase() === 'COLD' ? 'COLD' : 'WARM')) as 'HOT' | 'WARM' | 'COLD';
      const lastNote = l.customProperties?.lastRemark || (l.attemptCount && l.attemptCount > 0 ? 'Requested detailed callback' : 'Initial follow-up scheduled');

      list.push({
        _id: l._id,
        name: l.name,
        phone: l.phone,
        campaignName: camp,
        attempts: l.attemptCount || 1,
        assignedAgent: user?.name || 'You',
        status: l.stage || 'Follow Up',
        time: dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        date: dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' }),
        category: cat,
        temperature: temp,
        rawDate: dateObj,
        lastRemark: lastNote,
      });
    }

    // 2. From local activities that scheduled a followUpAt
    const localActs = useLeadHistoryStore.getState().getAllActivities(user?._id || user?.name);
    for (const act of localActs) {
      if (act.followUpAt && act.leadId && !seenIds.has(act.leadId)) {
        seenIds.add(act.leadId);
        const dateObj = new Date(act.followUpAt);
        if (!isNaN(dateObj.getTime())) {
          const fTime = dateObj.getTime();
          let cat: TabCategory = 'Today';
          if (fTime < now.getTime()) {
            cat = 'Overdue';
          } else if (fTime >= startOfToday && fTime <= endOfToday) {
            cat = 'Today';
          } else {
            cat = 'Upcoming';
          }

          list.push({
            _id: act.leadId,
            name: act.customerName || 'Lead Contact',
            phone: act.phone || '',
            campaignName: 'Assigned Leads',
            attempts: 1,
            assignedAgent: user?.name || 'You',
            status: act.stage || 'Follow Up',
            time: dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            date: dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' }),
            category: cat,
            temperature: (act.temperature as any) || 'WARM',
            rawDate: dateObj,
            lastRemark: act.remark || 'Scheduled callback note',
          });
        }
      }
    }

    return list.sort((a, b) => a.rawDate.getTime() - b.rawDate.getTime());
  }, [realFollowupsData, user]);

  // Tab counts
  const overdueCount = useMemo(() => combinedItems.filter((i) => i.category === 'Overdue').length, [combinedItems]);
  const todayCount = useMemo(() => combinedItems.filter((i) => i.category === 'Today').length, [combinedItems]);
  const upcomingCount = useMemo(() => combinedItems.filter((i) => i.category === 'Upcoming').length, [combinedItems]);

  // Filtered Items
  const displayedItems = useMemo(() => {
    return combinedItems.filter((item) => {
      if (item.category !== activeTab) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          item.name.toLowerCase().includes(q) ||
          item.phone.toLowerCase().includes(q) ||
          item.campaignName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [combinedItems, activeTab, searchQuery]);

  // Countdown Helper
  const getCountdownLabel = (rawDate: Date, cat: TabCategory) => {
    const diffMs = rawDate.getTime() - Date.now();
    const diffMins = Math.round(diffMs / (60 * 1000));

    if (diffMs < 0) {
      const pastMins = Math.abs(diffMins);
      if (pastMins < 60) return `Overdue by ${pastMins}m`;
      const pastHours = Math.floor(pastMins / 60);
      return `Overdue by ${pastHours}h ${pastMins % 60}m`;
    }
    if (diffMins < 60) {
      return `Due in ${Math.max(1, diffMins)} mins`;
    }
    const hours = Math.floor(diffMins / 60);
    if (hours < 24) {
      return `Due in ${hours}h ${diffMins % 60}m`;
    }
    const days = Math.floor(hours / 24);
    return `In ${days} day${days > 1 ? 's' : ''}`;
  };

  const handleOpenLead = (item: FollowUpItem) => {
    const syntheticLead: Lead = {
      _id: item._id,
      campaignId: 'default-camp',
      name: item.name,
      phone: item.phone,
      source: 'OUTREACH',
      stage: item.status,
      tag: item.temperature,
      temperature: item.temperature,
      status: 'OPEN',
      attemptCount: item.attempts,
      nextFollowUpAt: item.rawDate.toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      customProperties: { campaign: item.campaignName, lastRemark: item.lastRemark || '' },
    };
    setQuickModalLead(syntheticLead);
  };

  return (
    <CrmShell
      title="Scheduled Follow-ups"
      headerIcon={<CalendarClock size={15} color={colors.textSecondary} />}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Header Summary */}
        <View style={styles.headerBanner}>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>Follow-up Callbacks</Text>
            <Text style={styles.bannerSubtitle}>
              {todayCount > 0
                ? `${todayCount} scheduled callbacks for today`
                : 'All follow-up callbacks are organized.'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={() => {
              refetch();
              toast.info('Refreshed callbacks');
            }}
            activeOpacity={0.7}
          >
            <RotateCw size={13} color="#0F172A" />
            <Text style={styles.refreshBtnText}>Refresh</Text>
          </TouchableOpacity>
        </View>

        {/* Overdue Attention Banner if any */}
        {overdueCount > 0 && (
          <TouchableOpacity
            style={styles.overdueAlertBanner}
            onPress={() => setActiveTab('Overdue')}
            activeOpacity={0.8}
          >
            <AlertTriangle size={16} color="#DC2626" strokeWidth={2.5} />
            <View style={{ flex: 1 }}>
              <Text style={styles.overdueAlertTitle}>
                {overdueCount} Overdue Callback{overdueCount > 1 ? 's' : ''} Require Immediate Attention!
              </Text>
              <Text style={styles.overdueAlertSub}>
                Tap here to clear and call overdue customers now.
              </Text>
            </View>
            <ArrowUpRight size={14} color="#DC2626" />
          </TouchableOpacity>
        )}

        {/* Sticky Search Bar */}
        <View style={styles.searchBarWrap}>
          <Search size={16} color="#64748B" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search scheduled contact by name or number..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={14} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>

        {/* 3 Segmented Tabs: Overdue🔴 / Today🟡 / Upcoming🔵 */}
        <View style={styles.segmentedTabsRow}>
          {/* Overdue Tab */}
          <TouchableOpacity
            style={[
              styles.tabBtn,
              activeTab === 'Overdue' && styles.tabBtnActiveOverdue,
            ]}
            onPress={() => setActiveTab('Overdue')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.tabLabel,
                activeTab === 'Overdue' && { color: '#DC2626', fontWeight: '800' },
              ]}
            >
              Overdue
            </Text>
            <View
              style={[
                styles.tabBadge,
                { backgroundColor: overdueCount > 0 ? '#FEE2E2' : '#F1F5F9' },
                activeTab === 'Overdue' && { backgroundColor: '#DC2626' },
              ]}
            >
              <Text
                style={[
                  styles.tabBadgeText,
                  { color: overdueCount > 0 ? '#DC2626' : '#64748B' },
                  activeTab === 'Overdue' && { color: '#FFFFFF' },
                ]}
              >
                {overdueCount}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Today Tab */}
          <TouchableOpacity
            style={[
              styles.tabBtn,
              activeTab === 'Today' && styles.tabBtnActiveToday,
            ]}
            onPress={() => setActiveTab('Today')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.tabLabel,
                activeTab === 'Today' && { color: '#D97706', fontWeight: '800' },
              ]}
            >
              Today
            </Text>
            <View
              style={[
                styles.tabBadge,
                { backgroundColor: todayCount > 0 ? '#FEF3C7' : '#F1F5F9' },
                activeTab === 'Today' && { backgroundColor: '#D97706' },
              ]}
            >
              <Text
                style={[
                  styles.tabBadgeText,
                  { color: todayCount > 0 ? '#D97706' : '#64748B' },
                  activeTab === 'Today' && { color: '#FFFFFF' },
                ]}
              >
                {todayCount}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Upcoming Tab */}
          <TouchableOpacity
            style={[
              styles.tabBtn,
              activeTab === 'Upcoming' && styles.tabBtnActiveUpcoming,
            ]}
            onPress={() => setActiveTab('Upcoming')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.tabLabel,
                activeTab === 'Upcoming' && { color: '#2563EB', fontWeight: '800' },
              ]}
            >
              Upcoming
            </Text>
            <View
              style={[
                styles.tabBadge,
                { backgroundColor: upcomingCount > 0 ? '#EFF6FF' : '#F1F5F9' },
                activeTab === 'Upcoming' && { backgroundColor: '#2563EB' },
              ]}
            >
              <Text
                style={[
                  styles.tabBadgeText,
                  { color: upcomingCount > 0 ? '#2563EB' : '#64748B' },
                  activeTab === 'Upcoming' && { color: '#FFFFFF' },
                ]}
              >
                {upcomingCount}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Cards List */}
        <View style={styles.cardsList}>
          {displayedItems.length === 0 ? (
            <View style={styles.emptyStateCard}>
              <CheckCircle2 size={38} color="#10B981" />
              <Text style={styles.emptyStateTitle}>
                {activeTab === 'Today'
                  ? 'No follow-up callbacks due today! 🎉'
                  : activeTab === 'Overdue'
                  ? 'Zero overdue callbacks! Great job. 👍'
                  : 'No upcoming callbacks scheduled.'}
              </Text>
              <Text style={styles.emptyStateSubtitle}>
                {activeTab === 'Today'
                  ? 'You are all caught up with your scheduled calls.'
                  : 'Future follow-ups will appear here automatically.'}
              </Text>
              <TouchableOpacity
                style={styles.emptyQueueBtn}
                onPress={() => navigation.navigate('MyLeads')}
                activeOpacity={0.8}
              >
                <Phone size={14} color="#FFFFFF" strokeWidth={2.5} />
                <Text style={styles.emptyQueueBtnText}>Go to Calling Queue</Text>
              </TouchableOpacity>
            </View>
          ) : (
            displayedItems.map((item) => {
              const initials = item.name
                .split(' ')
                .filter(Boolean)
                .map((w) => w[0])
                .join('')
                .toUpperCase()
                .slice(0, 2) || 'LD';
              const isHot = item.temperature === 'HOT';
              const isCold = item.temperature === 'COLD';
              const isOverdue = item.category === 'Overdue';
              const countdownText = getCountdownLabel(item.rawDate, item.category);

              return (
                <View key={item._id} style={styles.followupCard}>
                  {/* Top Row: Avatar + Name & Phone + Countdown Badge */}
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.avatarCircle}>
                      <Text style={styles.avatarText}>{initials}</Text>
                    </View>

                    <View style={styles.leadInfoCol}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.customerName} numberOfLines={1}>
                          {item.name}
                        </Text>
                        {/* Priority Pill */}
                        <View
                          style={[
                            styles.priorityPill,
                            isHot
                              ? styles.priorityHot
                              : isCold
                              ? styles.priorityCold
                              : styles.priorityWarm,
                          ]}
                        >
                          {isHot ? (
                            <Flame size={10} color="#DC2626" fill="#DC2626" />
                          ) : isCold ? (
                            <Snowflake size={10} color="#2563EB" />
                          ) : (
                            <Sun size={10} color="#D97706" />
                          )}
                          <Text
                            style={[
                              styles.priorityPillText,
                              { color: isHot ? '#DC2626' : isCold ? '#2563EB' : '#D97706' },
                            ]}
                          >
                            {item.temperature || 'Warm'}
                          </Text>
                        </View>
                      </View>

                      {/* Phone Number */}
                      <Text style={styles.customerPhone}>
                        {formatDisplayPhone(item.phone)}
                      </Text>
                    </View>

                    {/* Countdown Badge Pill */}
                    <View
                      style={[
                        styles.countdownBadge,
                        isOverdue
                          ? styles.countdownBadgeOverdue
                          : item.category === 'Today'
                          ? styles.countdownBadgeToday
                          : styles.countdownBadgeUpcoming,
                      ]}
                    >
                      <Clock3
                        size={11}
                        color={
                          isOverdue ? '#DC2626' : item.category === 'Today' ? '#D97706' : '#2563EB'
                        }
                      />
                      <Text
                        style={[
                          styles.countdownText,
                          {
                            color:
                              isOverdue ? '#DC2626' : item.category === 'Today' ? '#D97706' : '#2563EB',
                          },
                        ]}
                      >
                        {countdownText}
                      </Text>
                    </View>
                  </View>

                  {/* Last Remark Preview Line */}
                  <View style={styles.remarkPreviewBox}>
                    <Clock size={12} color="#64748B" />
                    <Text style={styles.remarkPreviewText} numberOfLines={1}>
                      {item.lastRemark || 'Customer requested callback to discuss details'}
                    </Text>
                  </View>

                  {/* Bottom Action Row (Tactile buttons, min 48px height) */}
                  <View style={styles.actionButtonsRow}>
                    {/* Call Now Button */}
                    <TouchableOpacity
                      style={styles.callNowBtn}
                      onPress={() => handleDirectCall(item)}
                      activeOpacity={0.85}
                    >
                      <Phone size={15} color="#FFFFFF" strokeWidth={2.5} />
                      <Text style={styles.callNowBtnText}>Call Now</Text>
                    </TouchableOpacity>

                    {/* Snooze Button */}
                    <TouchableOpacity
                      style={styles.snoozeBtn}
                      onPress={() => handleQuickSnooze(item)}
                      activeOpacity={0.8}
                    >
                      <Clock3 size={14} color="#D97706" strokeWidth={2.5} />
                      <Text style={styles.snoozeBtnText}>Snooze</Text>
                    </TouchableOpacity>

                    {/* WhatsApp Button */}
                    <TouchableOpacity
                      style={styles.iconBtn}
                      onPress={() => handleOpenWhatsApp(item)}
                      activeOpacity={0.8}
                    >
                      <MessageCircle size={15} color="#15803D" strokeWidth={2.5} />
                    </TouchableOpacity>

                    {/* Details / Modal Button */}
                    <TouchableOpacity
                      style={styles.iconBtn}
                      onPress={() => handleOpenLead(item)}
                      activeOpacity={0.8}
                    >
                      <FileEdit size={15} color="#4F46E5" strokeWidth={2} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Embedded Lead Quick Modal */}
      {quickModalLead && (
        <LeadQuickModal
          lead={quickModalLead}
          visible={Boolean(quickModalLead)}
          onClose={() => setQuickModalLead(null)}
          onOpenFullDispose={(leadToDispose) => {
            setQuickModalLead(null);
            navigation.navigate('Dispose', { lead: leadToDispose });
          }}
        />
      )}

      {/* WhatsApp Template Selector Modal */}
      {whatsAppModalVisible && (
        <WhatsAppTemplateModal
          visible={whatsAppModalVisible}
          onClose={() => setWhatsAppModalVisible(false)}
          recipientName={whatsAppTarget?.name || ''}
          recipientPhone={whatsAppTarget?.phone || ''}
        />
      )}
    </CrmShell>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 110,
  },
  headerBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  bannerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.4,
  },
  bannerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  refreshBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  overdueAlertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  overdueAlertTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#991B1B',
  },
  overdueAlertSub: {
    fontSize: 11,
    color: '#B91C1C',
    marginTop: 1,
  },
  searchBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    paddingVertical: 0,
  },
  segmentedTabsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
  },
  tabBtnActiveOverdue: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
    borderWidth: 1.5,
  },
  tabBtnActiveToday: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderWidth: 1.5,
  },
  tabBtnActiveUpcoming: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1.5,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  tabBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  cardsList: {
    gap: 12,
  },
  followupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    ...shadows.soft,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4F46E5',
  },
  leadInfoCol: {
    flex: 1,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  customerPhone: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  priorityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
    borderWidth: 1,
  },
  priorityHot: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  priorityWarm: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  priorityCold: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  priorityPillText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  countdownBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  countdownBadgeOverdue: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  countdownBadgeToday: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  countdownBadgeUpcoming: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  countdownText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  remarkPreviewBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginBottom: 12,
  },
  remarkPreviewText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
    flex: 1,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  callNowBtn: {
    flex: 1.5,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#10B981',
    borderRadius: 10,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 2,
  },
  callNowBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  snoozeBtn: {
    flex: 1.1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
  },
  snoozeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#D97706',
  },
  iconBtn: {
    width: 48,
    height: 48,
    minHeight: 48,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyStateCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...shadows.soft,
  },
  emptyStateTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 10,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 260,
    lineHeight: 16,
  },
  emptyQueueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 14,
  },
  emptyQueueBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
