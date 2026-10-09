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
} from 'lucide-react-native';

import { fetchMyLeads } from '../api/leadApi';
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
type TabCategory = 'Today' | 'Overdue' | 'Upcoming';

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

  const { logDialedCall } = useLeadHistoryStore();

  // Direct Call Handler
  const handleDirectCall = (item: FollowUpItem) => {
    logDialedCall({
      leadId: item._id,
      phone: item.phone,
      customerName: item.name,
      agentName: user?.name,
      agentId: user?._id,
      branch: user?.branch,
    });
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
            temperature: (act.temperature || 'WARM') as any,
            rawDate: dateObj,
          });
        }
      }
    }

    // Sort by due date soonest first
    return list.sort((a, b) => a.rawDate.getTime() - b.rawDate.getTime());
  }, [realFollowupsData, user]);

  // Counts strictly from real follow-ups
  const todayCount = combinedItems.filter((i) => i.category === 'Today').length;
  const overdueCount = combinedItems.filter((i) => i.category === 'Overdue').length;
  const upcomingCount = combinedItems.filter((i) => i.category === 'Upcoming').length;

  // Filtered List
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

  // Open Lead
  const handleOpenLead = (item: FollowUpItem) => {
    const syntheticLead: Lead = {
      _id: item._id,
      campaignId: 'default-camp',
      name: item.name,
      phone: item.phone,
      source: 'FOLLOW_UP',
      stage: item.status,
      tag: item.temperature || 'WARM',
      temperature: item.temperature || 'WARM',
      status: 'OPEN',
      attemptCount: item.attempts,
      customProperties: { campaign: item.campaignName },
      nextFollowUpAt: item.rawDate.toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setQuickModalLead(syntheticLead);
  };

  return (
    <CrmShell
      title="Scheduled Follow-ups"
      headerIcon={<CalendarDays size={15} color={colors.textSecondary} />}
      breadcrumb="Workspace"
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Banner Section */}
        <View style={[styles.bannerRow, !isWide && styles.bannerRowMobile]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>
              {isAgent ? 'My Scheduled Follow-ups' : 'Follow-up Callbacks'}
            </Text>
            <Text style={styles.bannerSubtitle}>
              {todayCount > 0
                ? `${todayCount} scheduled callback${todayCount > 1 ? 's' : ''} for today`
                : 'All follow-up callbacks are up to date.'}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {overdueCount > 0 && (
              <View style={styles.attentionBadge}>
                <AlertTriangle size={13} color="#B45309" strokeWidth={2.5} />
                <Text style={styles.attentionText}>{overdueCount} overdue</Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.refreshBtn}
              onPress={() => {
                refetch();
                toast.info('Refreshed scheduled follow-ups');
              }}
              activeOpacity={0.7}
            >
              <RotateCw size={13} color="#0F172A" />
              <Text style={styles.refreshBtnText}>Refresh</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchBarWrap}>
          <Search size={15} color="#94A3B8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search scheduled follow-ups..."
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

        {/* Filter Tabs: Today | Overdue | Upcoming */}
        <View style={styles.tabsRow}>
          {/* Today */}
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'Today' && styles.tabBtnActive]}
            onPress={() => setActiveTab('Today')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabLabel, activeTab === 'Today' && styles.tabLabelActive]}>
              Today
            </Text>
            <View style={[styles.tabBadge, activeTab === 'Today' && styles.tabBadgeActive]}>
              <Text style={[styles.tabBadgeText, activeTab === 'Today' && styles.tabBadgeTextActive]}>
                {todayCount}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Overdue */}
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'Overdue' && styles.tabBtnActive]}
            onPress={() => setActiveTab('Overdue')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabLabel, activeTab === 'Overdue' && styles.tabLabelActive]}>
              Overdue
            </Text>
            <View
              style={[
                styles.tabBadge,
                overdueCount > 0 && { backgroundColor: '#FEE2E2' },
                activeTab === 'Overdue' && styles.tabBadgeActive,
              ]}
            >
              <Text
                style={[
                  styles.tabBadgeText,
                  overdueCount > 0 && { color: '#DC2626' },
                  activeTab === 'Overdue' && styles.tabBadgeTextActive,
                ]}
              >
                {overdueCount}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Upcoming */}
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'Upcoming' && styles.tabBtnActive]}
            onPress={() => setActiveTab('Upcoming')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabLabel, activeTab === 'Upcoming' && styles.tabLabelActive]}>
              Upcoming
            </Text>
            <View style={[styles.tabBadge, activeTab === 'Upcoming' && styles.tabBadgeActive]}>
              <Text style={[styles.tabBadgeText, activeTab === 'Upcoming' && styles.tabBadgeTextActive]}>
                {upcomingCount}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Follow-up Cards List */}
        <View style={styles.cardsList}>
          {displayedItems.length === 0 ? (
            <View style={styles.emptyStateCard}>
              <CheckCircle2 size={36} color="#10B981" />
              <Text style={styles.emptyStateTitle}>
                {activeTab === 'Today'
                  ? 'No follow-up callbacks scheduled for today'
                  : activeTab === 'Overdue'
                  ? 'No overdue callbacks'
                  : 'No upcoming follow-ups scheduled'}
              </Text>
              <Text style={styles.emptyStateSubtitle}>
                {activeTab === 'Today'
                  ? 'You are all caught up! Great job staying on top of your customer follow-ups.'
                  : 'Callbacks scheduled for future dates will appear here.'}
              </Text>
              <TouchableOpacity
                style={styles.emptyActionBtn}
                onPress={() => navigation.navigate('MyLeads')}
                activeOpacity={0.8}
              >
                <Phone size={13} color="#FFFFFF" strokeWidth={2.5} />
                <Text style={styles.emptyActionBtnText}>Go to Calling Queue</Text>
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

              return (
                <View key={item._id} style={styles.followupCard}>
                  {/* Left Column: Calendar Icon + Time + Date */}
                  <View style={styles.timeCol}>
                    <Clock size={16} color={item.category === 'Overdue' ? '#DC2626' : '#2563EB'} />
                    <Text
                      style={[
                        styles.timeText,
                        item.category === 'Overdue' && { color: '#DC2626' },
                      ]}
                    >
                      {item.time}
                    </Text>
                    <Text style={styles.dateText}>{item.date}</Text>
                  </View>

                  {/* Vertical Divider */}
                  <View style={styles.verticalDivider} />

                  {/* Avatar */}
                  <View style={[styles.avatarCircle, { backgroundColor: '#EEF2FF' }]}>
                    <Text style={[styles.avatarText, { color: '#3730A3' }]}>{initials}</Text>
                  </View>

                  {/* Center: Name, Subtitle, Badges */}
                  <View style={styles.infoCol}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <Text style={styles.personName}>{item.name}</Text>
                      {/* Customer Importance / Temperature Badge */}
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
                          <Flame size={9} color="#DC2626" fill="#DC2626" />
                        ) : isCold ? (
                          <Snowflake size={9} color="#2563EB" />
                        ) : (
                          <Sun size={9} color="#D97706" />
                        )}
                        <Text
                          style={[
                            styles.tempBadgeText,
                            { color: isHot ? '#DC2626' : isCold ? '#2563EB' : '#D97706' },
                          ]}
                        >
                          {item.temperature || 'Warm'}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.personSubtitle}>
                      {formatDisplayPhone(item.phone)} · {item.campaignName}
                    </Text>

                    <View style={styles.metaRow}>
                      <View style={styles.statusPill}>
                        <Text style={styles.statusPillText}>{item.status}</Text>
                      </View>
                      <Text style={styles.attemptsText}>
                        {item.attempts} {item.attempts === 1 ? 'attempt' : 'attempts'}
                      </Text>
                    </View>
                  </View>

                  {/* Right Column: Direct Actions (Call, WhatsApp, Open Lead) */}
                  <View style={styles.rightCol}>
                    <View style={styles.cardActionsRow}>
                      {/* Direct Call Button */}
                      <TouchableOpacity
                        style={styles.directCallBtn}
                        onPress={() => handleDirectCall(item)}
                        activeOpacity={0.8}
                        accessibilityLabel="Call Lead"
                      >
                        <Phone size={13} color="#FFFFFF" strokeWidth={2.5} />
                        <Text style={styles.directCallBtnText}>Call</Text>
                      </TouchableOpacity>

                      {/* Direct WhatsApp Button */}
                      <TouchableOpacity
                        style={styles.directWhatsAppBtn}
                        onPress={() => handleOpenWhatsApp(item)}
                        activeOpacity={0.8}
                        accessibilityLabel="WhatsApp Lead"
                      >
                        <MessageCircle size={14} color="#047857" strokeWidth={2.5} />
                      </TouchableOpacity>

                      {/* Open Lead Button */}
                      <TouchableOpacity
                        style={styles.openLeadBtn}
                        onPress={() => handleOpenLead(item)}
                        activeOpacity={0.7}
                      >
                        <ArrowUpRight size={14} color="#64748B" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Interactive Lovable Lead Modal */}
      {quickModalLead && (
        <LeadQuickModal
          lead={quickModalLead}
          visible={Boolean(quickModalLead)}
          onClose={() => setQuickModalLead(null)}
          onLeadUpdated={() => {
            refetch();
          }}
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
    paddingBottom: 40,
  },
  bannerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 12,
  },
  bannerRowMobile: {
    flexDirection: 'column',
    alignItems: 'flex-start',
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
  attentionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 20,
    gap: 6,
  },
  attentionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  refreshBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  searchBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
    gap: 8,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 12.5,
    color: '#0F172A',
    paddingVertical: 0,
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    gap: 6,
  },
  tabBtnActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  tabLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748B',
  },
  tabLabelActive: {
    color: '#2563EB',
    fontWeight: '700',
  },
  tabBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  tabBadgeActive: {
    backgroundColor: '#DBEAFE',
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  tabBadgeTextActive: {
    color: '#1D4ED8',
  },
  cardsList: {
    gap: 10,
  },
  emptyStateCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    padding: 36,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...shadows.soft,
  },
  emptyStateTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 12,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    maxWidth: 300,
  },
  emptyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#4F46E5',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    marginTop: 16,
  },
  emptyActionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  followupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 14,
    ...shadows.soft,
    gap: 12,
  },
  timeCol: {
    width: 58,
    alignItems: 'center',
    gap: 2,
  },
  timeText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  dateText: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#94A3B8',
  },
  verticalDivider: {
    width: 1,
    height: 44,
    backgroundColor: '#F1F5F9',
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 12,
    fontWeight: '700',
  },
  infoCol: {
    flex: 1,
    gap: 2,
  },
  personName: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  tempBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  tempHot: {
    backgroundColor: '#FEE2E2',
  },
  tempWarm: {
    backgroundColor: '#FEF3C7',
  },
  tempCold: {
    backgroundColor: '#EFF6FF',
  },
  tempBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  personSubtitle: {
    fontSize: 11,
    color: '#64748B',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  statusPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  statusPillText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#475569',
  },
  attemptsText: {
    fontSize: 10,
    color: '#94A3B8',
  },
  rightCol: {
    alignItems: 'flex-end',
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  directCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#10B981',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 6,
  },
  directCallBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  directWhatsAppBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  openLeadBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
