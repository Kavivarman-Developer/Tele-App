import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Linking,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  PhoneCall,
  Phone,
  MessageCircle,
  Search,
  X,
  Calendar,
  Clock,
  Flame,
  Sun,
  Snowflake,
  User,
  ArrowUpRight,
  Filter,
  CheckCircle2,
  PhoneOff,
  History,
  RotateCw,
} from 'lucide-react-native';

import { CrmShell } from '../components/CrmShell';
import { useLeadHistoryStore } from '../store/leadHistoryStore';
import { useAuthStore } from '../store/authStore';
import { Activity, CustomerTemperature, Lead } from '../types';
import { formatDisplayPhone, getDialerTelUrl } from '../utils/phoneUtils';
import { WhatsAppTemplateModal } from '../components/WhatsAppTemplateModal';
import { LeadQuickModal } from '../components/LeadQuickModal';
import { toast } from '../store/toastStore';
import { colors, borderRadius, shadows } from '../theme';

type DateFilter = 'TODAY' | 'YESTERDAY' | 'WEEK' | 'ALL';
type StageFilter = 'ALL' | 'CONNECTED' | 'INTERESTED' | 'FOLLOW_UP' | 'NOT_CONNECTED';

export const CallHistoryScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { width } = useWindowDimensions();
  const isWide = width >= 860;

  const { user } = useAuthStore();
  const isAgent = user?.role === 'AGENT';

  const { getAllActivities, loadHistory, logDialedCall } = useLeadHistoryStore();

  const [dateFilter, setDateFilter] = useState<DateFilter>('ALL');
  const [stageFilter, setStageFilter] = useState<StageFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // WhatsApp & Quick Modal States
  const [whatsAppData, setWhatsAppData] = useState<{
    visible: boolean;
    name: string;
    phone: string;
  }>({
    visible: false,
    name: '',
    phone: '',
  });

  const [quickLead, setQuickLead] = useState<Lead | null>(null);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Fetch all activities from store
  const allActivities = useMemo(() => {
    // If agent, can view their calls or branch calls
    return getAllActivities();
  }, [getAllActivities]);

  // Filter activities by date, stage, and search query
  const filteredActivities = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
    const sevenDaysAgo = startOfToday - 6 * 24 * 60 * 60 * 1000;

    return allActivities.filter((act) => {
      const actTime = new Date(act.createdAt).getTime();

      // Date Filter
      if (dateFilter === 'TODAY') {
        if (actTime < startOfToday) return false;
      } else if (dateFilter === 'YESTERDAY') {
        if (actTime < startOfYesterday || actTime >= startOfToday) return false;
      } else if (dateFilter === 'WEEK') {
        if (actTime < sevenDaysAgo) return false;
      }

      // Stage / Connection Filter
      if (stageFilter === 'CONNECTED' && !act.connected) return false;
      if (stageFilter === 'NOT_CONNECTED' && act.connected) return false;
      if (stageFilter === 'INTERESTED' && !act.stage.toLowerCase().includes('interested')) return false;
      if (stageFilter === 'FOLLOW_UP' && !act.stage.toLowerCase().includes('follow')) return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = (act.customerName || '').toLowerCase().includes(q);
        const phoneMatch = (act.phone || '').toLowerCase().includes(q);
        const remarkMatch = (act.remark || '').toLowerCase().includes(q);
        const stageMatch = (act.stage || '').toLowerCase().includes(q);
        return nameMatch || phoneMatch || remarkMatch || stageMatch;
      }

      return true;
    });
  }, [allActivities, dateFilter, stageFilter, searchQuery]);

  // Summary Metrics (NeoDove / Call Center Stats)
  const stats = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const todayCalls = allActivities.filter(
      (a) => new Date(a.createdAt).getTime() >= startOfToday,
    );

    const total = allActivities.length;
    const todayTotal = todayCalls.length;
    const connectedTotal = allActivities.filter((a) => a.connected).length;
    const hotTotal = allActivities.filter((a) => a.temperature === 'HOT' || a.tag === 'HOT').length;
    const followUpsTotal = allActivities.filter((a) => Boolean(a.followUpAt)).length;

    return {
      total,
      todayTotal,
      connectedTotal,
      hotTotal,
      followUpsTotal,
      connectRate: total > 0 ? Math.round((connectedTotal / total) * 100) : 0,
    };
  }, [allActivities]);

  // Handle Redial
  const handleCallAgain = (act: Activity) => {
    if (!act.phone) {
      Alert.alert('No Number', 'Customer phone number is unavailable.');
      return;
    }

    // Immediately log dialed call in history
    logDialedCall({
      phone: act.phone,
      customerName: act.customerName,
      agentName: user?.name,
      agentId: user?._id,
      branch: user?.branch,
    });

    toast.info(`Dialing ${act.customerName || act.phone}...`, 'Calling');

    Linking.openURL(getDialerTelUrl(act.phone)).catch(() => {
      Alert.alert('Call Error', 'Unable to launch dialer on this device.');
    });
  };

  // Handle WhatsApp
  const handleOpenWhatsApp = (act: Activity) => {
    if (!act.phone) return;
    setWhatsAppData({
      visible: true,
      name: act.customerName || 'Customer',
      phone: act.phone,
    });
  };

  // Open Lead Quick Modal
  const handleOpenLead = (act: Activity) => {
    const syntheticLead: Lead = {
      _id: act.leadId || `lead-${Date.now()}`,
      campaignId: act.campaignId || 'camp-1',
      name: act.customerName || 'Customer',
      phone: act.phone || '',
      source: 'DIRECT_CALL',
      stage: act.stage || 'Follow Up',
      tag: act.tag || act.temperature || 'WARM',
      temperature: (act.temperature || act.tag || 'WARM') as CustomerTemperature,
      status: 'OPEN',
      attemptCount: 1,
      customProperties: {},
      nextFollowUpAt: act.followUpAt || undefined,
      createdAt: act.createdAt,
      updatedAt: act.updatedAt,
    };
    setQuickLead(syntheticLead);
  };

  const formatActivityTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      const now = new Date();
      const isToday = d.toDateString() === now.toDateString();
      const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (isToday) {
        return `Today at ${timeStr}`;
      }
      return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${timeStr}`;
    } catch {
      return isoString;
    }
  };

  const formatDuration = (seconds?: number, connected?: boolean) => {
    if (!connected) return 'Not connected';
    if (!seconds || seconds <= 0) return 'Connected';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m === 0) return `${s}s`;
    return `${m}m ${s}s`;
  };

  return (
    <CrmShell
      title="Call History"
      headerIcon={<PhoneCall size={15} color={colors.textSecondary} />}
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
            <Text style={styles.bannerTitle}>Agent Call History</Text>
            <Text style={styles.bannerSubtitle}>
              Every call made by your agents is tracked here. Redial, message on WhatsApp, or review outcomes with a single click.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={() => {
              loadHistory();
              toast.info('Refreshed call history timeline');
            }}
            activeOpacity={0.7}
          >
            <RotateCw size={14} color="#0F172A" />
            <Text style={styles.refreshBtnText}>Refresh</Text>
          </TouchableOpacity>
        </View>

        {/* Top Metric Cards */}
        <View style={styles.statsRow}>
          {/* Card 1: Today Calls */}
          <View style={[styles.statCard, { borderLeftColor: '#2563EB' }]}>
            <Text style={styles.statLabel}>Calls Today</Text>
            <Text style={styles.statValue}>{stats.todayTotal}</Text>
            <Text style={styles.statSub}>{stats.total} total all-time</Text>
          </View>

          {/* Card 2: Connected Calls */}
          <View style={[styles.statCard, { borderLeftColor: '#059669' }]}>
            <Text style={styles.statLabel}>Connected Calls</Text>
            <Text style={styles.statValue}>{stats.connectedTotal}</Text>
            <Text style={styles.statSub}>{stats.connectRate}% connect rate</Text>
          </View>

          {/* Card 3: Hot Leads */}
          <View style={[styles.statCard, { borderLeftColor: '#DC2626' }]}>
            <Text style={styles.statLabel}>Hot Inquiries</Text>
            <Text style={styles.statValue}>{stats.hotTotal}</Text>
            <Text style={styles.statSub}>High conversion</Text>
          </View>

          {/* Card 4: Scheduled Follow-ups */}
          <View style={[styles.statCard, { borderLeftColor: '#D97706' }]}>
            <Text style={styles.statLabel}>Callbacks Set</Text>
            <Text style={styles.statValue}>{stats.followUpsTotal}</Text>
            <Text style={styles.statSub}>Follow-ups saved</Text>
          </View>
        </View>

        {/* Date Filter Tabs */}
        <View style={styles.dateTabsRow}>
          <TouchableOpacity
            style={[styles.dateTab, dateFilter === 'ALL' && styles.dateTabActive]}
            onPress={() => setDateFilter('ALL')}
            activeOpacity={0.7}
          >
            <Text style={[styles.dateTabText, dateFilter === 'ALL' && styles.dateTabTextActive]}>
              All Calls ({allActivities.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dateTab, dateFilter === 'TODAY' && styles.dateTabActive]}
            onPress={() => setDateFilter('TODAY')}
            activeOpacity={0.7}
          >
            <Text style={[styles.dateTabText, dateFilter === 'TODAY' && styles.dateTabTextActive]}>
              Today ({stats.todayTotal})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dateTab, dateFilter === 'YESTERDAY' && styles.dateTabActive]}
            onPress={() => setDateFilter('YESTERDAY')}
            activeOpacity={0.7}
          >
            <Text style={[styles.dateTabText, dateFilter === 'YESTERDAY' && styles.dateTabTextActive]}>
              Yesterday
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dateTab, dateFilter === 'WEEK' && styles.dateTabActive]}
            onPress={() => setDateFilter('WEEK')}
            activeOpacity={0.7}
          >
            <Text style={[styles.dateTabText, dateFilter === 'WEEK' && styles.dateTabTextActive]}>
              Past 7 Days
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search & Filter Bar */}
        <View style={styles.searchRow}>
          <View style={styles.searchInputWrap}>
            <Search size={16} color="#64748B" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search call history by customer name or phone number..."
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
        </View>

        {/* Stage Filter Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.stageFilterScroll}
        >
          <TouchableOpacity
            style={[styles.stagePill, stageFilter === 'ALL' && styles.stagePillActive]}
            onPress={() => setStageFilter('ALL')}
            activeOpacity={0.7}
          >
            <Text style={[styles.stagePillText, stageFilter === 'ALL' && styles.stagePillTextActive]}>
              All Status
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.stagePill, stageFilter === 'CONNECTED' && styles.stagePillActive]}
            onPress={() => setStageFilter('CONNECTED')}
            activeOpacity={0.7}
          >
            <Text style={[styles.stagePillText, stageFilter === 'CONNECTED' && styles.stagePillTextActive]}>
              Connected
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.stagePill, stageFilter === 'INTERESTED' && styles.stagePillActive]}
            onPress={() => setStageFilter('INTERESTED')}
            activeOpacity={0.7}
          >
            <Text style={[styles.stagePillText, stageFilter === 'INTERESTED' && styles.stagePillTextActive]}>
              Interested
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.stagePill, stageFilter === 'FOLLOW_UP' && styles.stagePillActive]}
            onPress={() => setStageFilter('FOLLOW_UP')}
            activeOpacity={0.7}
          >
            <Text style={[styles.stagePillText, stageFilter === 'FOLLOW_UP' && styles.stagePillTextActive]}>
              Follow-ups
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.stagePill, stageFilter === 'NOT_CONNECTED' && styles.stagePillActive]}
            onPress={() => setStageFilter('NOT_CONNECTED')}
            activeOpacity={0.7}
          >
            <Text style={[styles.stagePillText, stageFilter === 'NOT_CONNECTED' && styles.stagePillTextActive]}>
              Not Connected
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Call History Card List */}
        <View style={styles.historyList}>
          {filteredActivities.length === 0 ? (
            <View style={styles.emptyStateCard}>
              <History size={40} color="#94A3B8" />
              <Text style={styles.emptyStateTitle}>No calls found</Text>
              <Text style={styles.emptyStateSubtitle}>
                No past calls match your selected date or filter query.
              </Text>
              {(dateFilter !== 'ALL' || stageFilter !== 'ALL' || searchQuery.length > 0) && (
                <TouchableOpacity
                  style={styles.emptyResetBtn}
                  onPress={() => {
                    setDateFilter('ALL');
                    setStageFilter('ALL');
                    setSearchQuery('');
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.emptyResetBtnText}>Reset Filters</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            filteredActivities.map((act) => {
              const isHot = act.temperature === 'HOT' || act.tag === 'HOT';
              const isCold = act.temperature === 'COLD' || act.tag === 'COLD';
              const agentName =
                typeof act.userId === 'object' && act.userId?.name
                  ? act.userId.name
                  : user?.name || 'Agent';
              const agentBranch =
                act.branch ||
                (typeof act.userId === 'object' && act.userId?.branch ? act.userId.branch : user?.branch);

              const displayName = act.customerName || (act.phone ? `Customer (${formatDisplayPhone(act.phone)})` : 'Lead Contact');

              return (
                <View key={act._id} style={styles.callCard}>
                  {/* Card Header: Customer Info + Temperature & Time */}
                  <View style={styles.callCardHeader}>
                    <View style={styles.customerInfoCol}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={styles.customerNameText} numberOfLines={1}>
                          {displayName}
                        </Text>

                        {/* Temperature Pill */}
                        <View
                          style={[
                            styles.tempPill,
                            isHot ? styles.tempHot : isCold ? styles.tempCold : styles.tempWarm,
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
                              styles.tempPillText,
                              { color: isHot ? '#DC2626' : isCold ? '#2563EB' : '#D97706' },
                            ]}
                          >
                            {isHot ? 'Hot' : isCold ? 'Cold' : 'Warm'}
                          </Text>
                        </View>
                      </View>

                      {/* Phone Number */}
                      <TouchableOpacity
                        style={styles.phoneClickableRow}
                        onPress={() => handleCallAgain(act)}
                        activeOpacity={0.7}
                      >
                        <Phone size={12} color="#059669" />
                        <Text style={styles.customerPhoneText}>
                          {act.phone ? formatDisplayPhone(act.phone) : 'No phone'}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Time Pill & Duration */}
                    <View style={styles.timeDurationCol}>
                      <View style={styles.callTimePill}>
                        <Clock size={11} color="#2563EB" />
                        <Text style={styles.callTimeText}>{formatActivityTime(act.createdAt)}</Text>
                      </View>

                      <View
                        style={[
                          styles.durationBadge,
                          act.connected ? styles.durationConnected : styles.durationMissed,
                        ]}
                      >
                        {act.connected ? (
                          <Phone size={10} color="#059669" />
                        ) : (
                          <PhoneOff size={10} color="#DC2626" />
                        )}
                        <Text
                          style={[
                            styles.durationText,
                            act.connected ? { color: '#059669' } : { color: '#DC2626' },
                          ]}
                        >
                          {formatDuration(act.durationSeconds, act.connected)}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Metadata Row: Stage Pill, Agent Info, Follow-up */}
                  <View style={styles.cardMetaRow}>
                    <View style={styles.stageBadge}>
                      <Text style={styles.stageBadgeText}>{act.stage}</Text>
                    </View>

                    <Text style={styles.metaDot}>•</Text>

                    <View style={styles.agentTag}>
                      <User size={11} color="#64748B" />
                      <Text style={styles.agentTagText}>
                        {agentName}
                        {agentBranch ? ` (${agentBranch})` : ''}
                      </Text>
                    </View>

                    {act.followUpAt ? (
                      <>
                        <Text style={styles.metaDot}>•</Text>
                        <View style={styles.followUpScheduledTag}>
                          <Calendar size={11} color="#0D9488" />
                          <Text style={styles.followUpScheduledText}>
                            Callback scheduled
                          </Text>
                        </View>
                      </>
                    ) : null}
                  </View>

                  {/* Remark / Notes (if present) */}
                  {act.remark ? (
                    <View style={styles.remarkBox}>
                      <Text style={styles.remarkText} numberOfLines={2}>
                        "{act.remark}"
                      </Text>
                    </View>
                  ) : null}

                  {/* Action Buttons Row: [ 📞 Call Again ] [ 💬 WhatsApp ] [ 📋 Open Lead ] */}
                  <View style={styles.cardActionsRow}>
                    {/* Call Again */}
                    <TouchableOpacity
                      style={styles.callAgainBtn}
                      onPress={() => handleCallAgain(act)}
                      activeOpacity={0.8}
                    >
                      <Phone size={13} color="#FFFFFF" strokeWidth={2.5} />
                      <Text style={styles.callAgainBtnText}>Call Again</Text>
                    </TouchableOpacity>

                    {/* WhatsApp */}
                    <TouchableOpacity
                      style={styles.whatsAppBtn}
                      onPress={() => handleOpenWhatsApp(act)}
                      activeOpacity={0.8}
                    >
                      <MessageCircle size={13} color="#15803D" strokeWidth={2.5} />
                      <Text style={styles.whatsAppBtnText}>WhatsApp</Text>
                    </TouchableOpacity>

                    {/* Open Lead */}
                    <TouchableOpacity
                      style={styles.openLeadBtn}
                      onPress={() => handleOpenLead(act)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.openLeadBtnText}>Update Lead</Text>
                      <ArrowUpRight size={13} color="#2563EB" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* WhatsApp Template Modal */}
      {whatsAppData.visible && (
        <WhatsAppTemplateModal
          visible={whatsAppData.visible}
          onClose={() => setWhatsAppData({ visible: false, name: '', phone: '' })}
          recipientName={whatsAppData.name}
          recipientPhone={whatsAppData.phone}
        />
      )}

      {/* Embedded Lead Quick Modal */}
      {quickLead && (
        <LeadQuickModal
          lead={quickLead}
          visible={Boolean(quickLead)}
          onClose={() => setQuickLead(null)}
          onLeadUpdated={() => {
            loadHistory();
          }}
          onOpenFullDispose={(leadToDispose) => {
            setQuickLead(null);
            navigation.navigate('Dispose', { lead: leadToDispose });
          }}
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
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    ...shadows.soft,
  },
  bannerRowMobile: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 12,
  },
  bannerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  bannerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 3,
    lineHeight: 18,
    maxWidth: 580,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  refreshBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    minWidth: 140,
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderLeftWidth: 4,
    ...shadows.soft,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 4,
  },
  statSub: {
    fontSize: 10.5,
    color: '#94A3B8',
    marginTop: 2,
  },
  dateTabsRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.md,
    padding: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
    gap: 4,
  },
  dateTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateTabActive: {
    backgroundColor: '#2563EB',
  },
  dateTabText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748B',
  },
  dateTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  searchRow: {
    marginBottom: 12,
  },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    ...shadows.soft,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    padding: 0,
  },
  stageFilterScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 12,
  },
  stagePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  stagePillActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  stagePillText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748B',
  },
  stagePillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  historyList: {
    gap: 12,
  },
  callCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    ...shadows.soft,
  },
  callCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  customerInfoCol: {
    flex: 1,
    paddingRight: 8,
  },
  customerNameText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  tempPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
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
  tempPillText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  phoneClickableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  customerPhoneText: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '600',
  },
  timeDurationCol: {
    alignItems: 'flex-end',
    gap: 4,
  },
  callTimePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3.5,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  callTimeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  durationConnected: {
    backgroundColor: '#ECFDF5',
  },
  durationMissed: {
    backgroundColor: '#FEF2F2',
  },
  durationText: {
    fontSize: 10,
    fontWeight: '700',
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
    marginBottom: 8,
  },
  stageBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  stageBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#334155',
  },
  metaDot: {
    fontSize: 10,
    color: '#CBD5E1',
  },
  agentTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  agentTagText: {
    fontSize: 10.5,
    color: '#64748B',
    fontWeight: '500',
  },
  followUpScheduledTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F0FDFA',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  followUpScheduledText: {
    fontSize: 10,
    color: '#0F766E',
    fontWeight: '700',
  },
  remarkBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: borderRadius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#CBD5E1',
  },
  remarkText: {
    fontSize: 11.5,
    color: '#475569',
    fontStyle: 'italic',
    lineHeight: 16,
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
  },
  callAgainBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#059669',
    paddingVertical: 8,
    borderRadius: borderRadius.md,
  },
  callAgainBtnText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
  },
  whatsAppBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    paddingVertical: 8,
    borderRadius: borderRadius.md,
  },
  whatsAppBtnText: {
    color: '#15803D',
    fontSize: 11.5,
    fontWeight: '700',
  },
  openLeadBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingVertical: 8,
    borderRadius: borderRadius.md,
  },
  openLeadBtnText: {
    color: '#1D4ED8',
    fontSize: 11.5,
    fontWeight: '700',
  },
  emptyStateCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    padding: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 12,
  },
  emptyStateSubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 280,
  },
  emptyResetBtn: {
    marginTop: 14,
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: borderRadius.md,
  },
  emptyResetBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
