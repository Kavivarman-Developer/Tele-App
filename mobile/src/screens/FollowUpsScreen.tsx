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
} from 'lucide-react-native';

import { fetchMyLeads } from '../api/leadApi';
import { Lead, RootStackParamList } from '../types';
import { colors } from '../theme';
import { useAuthStore } from '../store/authStore';
import { CrmShell } from '../components/CrmShell';
import { LeadQuickModal } from '../components/LeadQuickModal';
import { WhatsAppTemplateModal } from '../components/WhatsAppTemplateModal';
import { getDialerTelUrl, formatDisplayPhone } from '../utils/phoneUtils';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type TabCategory = 'Overdue' | 'Today' | 'Upcoming';

interface FollowUpItem {
  _id: string;
  name: string;
  phone: string;
  campaignName: string;
  attempts: number;
  assignedAgent: string;
  status: 'Interested' | 'Follow-up';
  time: string;
  date: string;
  category: TabCategory;
  temperature?: 'Hot' | 'Warm' | 'Cold';
}

const DEMO_FOLLOWUPS: FollowUpItem[] = [
  {
    _id: '6ac623d96c84a3753e4573f0',
    name: 'Kavya Menon',
    phone: '+91 9810000073',
    campaignName: 'Demo Sales Campaign',
    attempts: 3,
    assignedAgent: 'John Agent',
    status: 'Interested',
    time: '04:13 AM',
    date: 'Oct 8',
    category: 'Today',
  },
  {
    _id: '6ac623d96c84a3753e4573ff',
    name: 'Priya Verma',
    phone: '+91 9810000129',
    campaignName: 'Demo Sales Campaign',
    attempts: 2,
    assignedAgent: 'Kavin (Trichy) / John (Pudukk.)',
    status: 'Interested',
    time: '11:00 AM',
    date: 'Tomorrow',
    category: 'Today',
    temperature: 'Hot',
  },
  {
    _id: '6ac623d96c84a3753e4573f1',
    name: 'Anika Mehta',
    phone: '+91 9810000089',
    campaignName: 'Demo Sales Campaign',
    attempts: 1,
    assignedAgent: 'John Agent',
    status: 'Follow-up',
    time: '05:25 AM',
    date: 'Oct 8',
    category: 'Today',
  },
  {
    _id: 'fu-4',
    name: 'Sneha Joshi',
    phone: '+91 9810000045',
    campaignName: 'Demo Sales Campaign',
    attempts: 2,
    assignedAgent: 'Agent Three',
    status: 'Follow-up',
    time: '12:37 PM',
    date: 'Oct 8',
    category: 'Today',
  },
  {
    _id: 'fu-5',
    name: 'Ayaan Patel',
    phone: '+91 9810000065',
    campaignName: 'Demo Sales Campaign',
    attempts: 3,
    assignedAgent: 'Agent Two',
    status: 'Interested',
    time: '06:12 PM',
    date: 'Oct 8',
    category: 'Today',
  },
  {
    _id: 'fu-6',
    name: 'Reyansh Sundar',
    phone: '+91 9810000011',
    campaignName: 'Demo Sales Campaign',
    attempts: 1,
    assignedAgent: 'John Agent',
    status: 'Follow-up',
    time: '07:05 PM',
    date: 'Oct 8',
    category: 'Today',
  },
  // Overdue items
  {
    _id: 'fu-7',
    name: 'Rohit Verma',
    phone: '+91 9810000022',
    campaignName: 'Demo Sales Campaign',
    attempts: 2,
    assignedAgent: 'John Agent',
    status: 'Follow-up',
    time: '09:00 AM',
    date: 'Oct 7',
    category: 'Overdue',
  },
  {
    _id: 'fu-8',
    name: 'Meera Sen',
    phone: '+91 9810000033',
    campaignName: 'OK Real Estate Outreach',
    attempts: 1,
    assignedAgent: 'Agent Two',
    status: 'Interested',
    time: '11:30 AM',
    date: 'Oct 7',
    category: 'Overdue',
  },
  // Upcoming items
  {
    _id: 'fu-9',
    name: 'Deepak Rao',
    phone: '+91 9810000055',
    campaignName: 'OK Real Estate Outreach',
    attempts: 1,
    assignedAgent: 'Agent Three',
    status: 'Interested',
    time: '10:00 AM',
    date: 'Oct 9',
    category: 'Upcoming',
  },
  {
    _id: 'fu-10',
    name: 'Shreya Das',
    phone: '+91 9810000066',
    campaignName: 'Demo Sales Campaign',
    attempts: 2,
    assignedAgent: 'John Agent',
    status: 'Follow-up',
    time: '02:30 PM',
    date: 'Oct 9',
    category: 'Upcoming',
  },
  {
    _id: 'fu-11',
    name: 'Tarun Nair',
    phone: '+91 9810000077',
    campaignName: 'Demo Sales Campaign',
    attempts: 1,
    assignedAgent: 'Agent Two',
    status: 'Interested',
    time: '04:00 PM',
    date: 'Oct 10',
    category: 'Upcoming',
  },
  {
    _id: 'fu-12',
    name: 'Pooja Hegde',
    phone: '+91 9810000088',
    campaignName: 'OK Real Estate Outreach',
    attempts: 0,
    assignedAgent: 'Agent Three',
    status: 'Follow-up',
    time: '05:30 PM',
    date: 'Oct 10',
    category: 'Upcoming',
  },
];

export const FollowUpsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuthStore();
  const isAgent = user?.role === 'AGENT';
  const [activeTab, setActiveTab] = useState<TabCategory>('Today');
  const [searchQuery, setSearchQuery] = useState('');
  const [quickModalLead, setQuickModalLead] = useState<Lead | null>(null);
  const [whatsAppModalVisible, setWhatsAppModalVisible] = useState(false);
  const [whatsAppTarget, setWhatsAppTarget] = useState<{ name: string; phone: string } | null>(null);

  // Direct Call Handler
  const handleDirectCall = (phone: string) => {
    Linking.openURL(getDialerTelUrl(phone)).catch(() => {
      Alert.alert('Unable to dial', `Could not open phone dialer for ${phone}`);
    });
  };

  // Direct WhatsApp Handler (opens template selector)
  const handleOpenWhatsApp = (item: FollowUpItem) => {
    setWhatsAppTarget({
      name: item.name,
      phone: item.phone,
    });
    setWhatsAppModalVisible(true);
  };

  // Real backend query for follow-ups
  const { data: realFollowupsData, refetch } = useQuery({
    queryKey: ['followUps'],
    queryFn: () => fetchMyLeads({ type: 'FOLLOW_UP', limit: 100 }),
  });

  // Combine real backend follow-ups with default items (strictly filtered for agents)
  const combinedItems: FollowUpItem[] = useMemo(() => {
    const realLeads = realFollowupsData?.leads || [];
    if (realLeads.length > 0) {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const endOfToday = startOfToday + 24 * 60 * 60 * 1000 - 1;

      const agentScopedLeads = isAgent
        ? realLeads.filter((l: Lead) => {
            if (!l.assignedTo) return true;
            if (typeof l.assignedTo === 'string') {
              return l.assignedTo === user?._id || l.assignedTo === user?.email;
            }
            return (
              l.assignedTo._id === user?._id ||
              l.assignedTo.email === user?.email ||
              l.assignedTo.name?.toLowerCase() === user?.name?.toLowerCase()
            );
          })
        : realLeads;

      return agentScopedLeads.map((l: Lead) => {
        const camp = typeof l.campaign === 'object' && l.campaign ? l.campaign.name : 'Demo Sales Campaign';
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

        const agentDisplay = isAgent
          ? `${user?.name || 'You'} (${user?.branch || 'Agent'})`
          : l.assignedTo
          ? typeof l.assignedTo === 'object'
            ? l.assignedTo.name
            : 'Assigned Agent'
          : 'Assigned Agent';

        return {
          _id: l._id,
          name: l.name,
          phone: l.phone.startsWith('+91') ? l.phone : `+91 ${l.phone}`,
          campaignName: camp,
          attempts: l.attemptCount || 0,
          assignedAgent: agentDisplay,
          status: (l.stage === 'Interested' ? 'Interested' : 'Follow-up') as any,
          time: dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          date: dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' }),
          category: cat,
        };
      });
    }

    // Default items: For agents, personalize so other agents' names are never leaked
    if (isAgent) {
      return DEMO_FOLLOWUPS.map((item) => ({
        ...item,
        assignedAgent: `${user?.name || 'You'} (${user?.branch || 'Agent'})`,
      }));
    }

    return DEMO_FOLLOWUPS;
  }, [realFollowupsData, isAgent, user]);

  // Counts
  const overdueCount = combinedItems.filter((i) => i.category === 'Overdue').length || 2;
  const todayCount = combinedItems.filter((i) => i.category === 'Today').length || 6;
  const upcomingCount = combinedItems.filter((i) => i.category === 'Upcoming').length || 4;

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
      stage: item.status === 'Interested' ? 'Interested' : 'Follow Up',
      tag: (item.temperature?.toUpperCase() || (item.status === 'Interested' ? 'HOT' : 'WARM')),
      temperature: (item.temperature?.toUpperCase() || (item.status === 'Interested' ? 'HOT' : 'WARM')) as any,
      status: 'OPEN',
      attemptCount: item.attempts,
      customProperties: { campaign: item.campaignName },
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
        <View style={styles.bannerRow}>
          <View>
            <Text style={styles.bannerTitle}>
              {isAgent ? 'My Scheduled Follow-ups' : 'Every follow-up, in one place'}
            </Text>
            <Text style={styles.bannerSubtitle}>
              {isAgent
                ? `${todayCount} scheduled callbacks for ${user?.name || 'You'} (${user?.branch || 'General'} Branch)`
                : `${todayCount} scheduled conversations · Today`}
            </Text>
          </View>

          {/* Attention Badge */}
          <View style={styles.attentionBadge}>
            <AlertTriangle size={13} color="#B45309" strokeWidth={2.5} />
            <Text style={styles.attentionText}>{overdueCount} need attention</Text>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchBarWrap}>
          <Search size={15} color="#94A3B8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search scheduled leads..."
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

        {/* Filter Tabs: Overdue | Today | Upcoming */}
        <View style={styles.tabsRow}>
          {/* Overdue */}
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'Overdue' && styles.tabBtnActive]}
            onPress={() => setActiveTab('Overdue')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabLabel, activeTab === 'Overdue' && styles.tabLabelActive]}>
              Overdue
            </Text>
            <View style={[styles.tabBadge, activeTab === 'Overdue' && styles.tabBadgeActive]}>
              <Text style={[styles.tabBadgeText, activeTab === 'Overdue' && styles.tabBadgeTextActive]}>
                {overdueCount}
              </Text>
            </View>
          </TouchableOpacity>

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

        {/* Scheduled Follow-up Cards List (Exact Screenshot 3 structure) */}
        <View style={styles.cardsList}>
          {displayedItems.map((item) => {
            const initials = item.name
              .split(' ')
              .map((w) => w[0])
              .join('')
              .toUpperCase()
              .slice(0, 2);

            return (
              <View key={item._id} style={styles.followupCard}>
                {/* Left Column: Calendar Icon + Time + Date */}
                <View style={styles.timeCol}>
                  <CalendarDays size={18} color="#2563EB" />
                  <Text style={styles.timeText}>{item.time}</Text>
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
                  <Text style={styles.personName}>{item.name}</Text>
                  <Text style={styles.personSubtitle}>
                    {formatDisplayPhone(item.phone)} · {item.campaignName}
                  </Text>

                    <View style={styles.metaRow}>
                      {item.status === 'Interested' ? (
                        <View style={[styles.statusPill, { backgroundColor: '#ECFDF5' }]}>
                          <Text style={[styles.statusPillText, { color: '#047857' }]}>Interested</Text>
                        </View>
                      ) : (
                        <View style={[styles.statusPill, { backgroundColor: '#FFFBEB' }]}>
                          <Text style={[styles.statusPillText, { color: '#B45309' }]}>Follow-up</Text>
                        </View>
                      )}

                      {/* Customer Importance / Temperature Badge */}
                      {item.status === 'Interested' || item.temperature === 'Hot' ? (
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            backgroundColor: '#FEF2F2',
                            borderWidth: 1,
                            borderColor: '#FECACA',
                            paddingHorizontal: 6,
                            paddingVertical: 2,
                            borderRadius: 6,
                            gap: 3,
                          }}
                        >
                          <Flame size={9} color="#DC2626" fill="#DC2626" />
                          <Text style={{ fontSize: 9, fontWeight: '800', color: '#DC2626' }}>Hot</Text>
                        </View>
                      ) : (
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            backgroundColor: '#FFFBEB',
                            borderWidth: 1,
                            borderColor: '#FDE68A',
                            paddingHorizontal: 6,
                            paddingVertical: 2,
                            borderRadius: 6,
                            gap: 3,
                          }}
                        >
                          <Sun size={9} color="#D97706" />
                          <Text style={{ fontSize: 9, fontWeight: '700', color: '#D97706' }}>Warm</Text>
                        </View>
                      )}

                      <Text style={styles.attemptsText}>
                        {item.attempts} attempts · {item.assignedAgent}
                      </Text>
                    </View>
                </View>

                {/* Right Column: Scheduled Badge + Direct Actions (Call, WhatsApp, Open Lead) */}
                <View style={styles.rightCol}>
                  <View style={styles.scheduledBadge}>
                    <Text style={styles.scheduledText}>Scheduled</Text>
                  </View>

                  <View style={styles.cardActionsRow}>
                    {/* Direct Call Button */}
                    <TouchableOpacity
                      style={styles.directCallBtn}
                      onPress={() => handleDirectCall(item.phone)}
                      activeOpacity={0.7}
                      accessibilityLabel="Call Lead"
                    >
                      <Phone size={12} color="#047857" strokeWidth={2.5} />
                    </TouchableOpacity>

                    {/* Direct WhatsApp Button */}
                    <TouchableOpacity
                      style={styles.directWhatsAppBtn}
                      onPress={() => handleOpenWhatsApp(item)}
                      activeOpacity={0.7}
                      accessibilityLabel="WhatsApp Lead"
                    >
                      <MessageCircle size={12} color="#16A34A" strokeWidth={2.5} />
                    </TouchableOpacity>

                    {/* Open Lead Button */}
                    <TouchableOpacity
                      style={styles.openLeadBtn}
                      onPress={() => handleOpenLead(item)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.openLeadText}>Open</Text>
                      <ArrowUpRight size={11} color="#0F172A" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Interactive Lovable Lead Modal */}
      <LeadQuickModal
        lead={quickModalLead}
        visible={Boolean(quickModalLead)}
        onClose={() => setQuickModalLead(null)}
        onLeadUpdated={() => {
          refetch();
        }}
        onOpenFullDispose={(leadToDispose) => {
          navigation.navigate('Dispose', { lead: leadToDispose });
        }}
      />

      {/* WhatsApp Template Selector Modal */}
      <WhatsAppTemplateModal
        visible={whatsAppModalVisible}
        onClose={() => setWhatsAppModalVisible(false)}
        recipientName={whatsAppTarget?.name || ''}
        recipientPhone={whatsAppTarget?.phone || ''}
      />
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
    fontSize: 12,
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
    fontSize: 11,
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
  followupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
    gap: 12,
  },
  timeCol: {
    width: 60,
    alignItems: 'center',
    gap: 2,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 4,
  },
  dateText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
  },
  verticalDivider: {
    width: 1,
    height: 48,
    backgroundColor: '#F1F5F9',
  },
  avatarCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 11,
    fontWeight: '700',
  },
  infoCol: {
    flex: 1,
    gap: 2,
  },
  personName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  personSubtitle: {
    fontSize: 11,
    color: '#64748B',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  statusPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusPillText: {
    fontSize: 9,
    fontWeight: '700',
  },
  attemptsText: {
    fontSize: 10,
    color: '#94A3B8',
  },
  rightCol: {
    alignItems: 'flex-end',
    gap: 8,
  },
  scheduledBadge: {
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  scheduledText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B45309',
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  directCallBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  directWhatsAppBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  openLeadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 6,
    gap: 3,
  },
  openLeadText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0F172A',
  },
});
