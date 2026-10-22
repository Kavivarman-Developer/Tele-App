import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  Linking,
  AppState,
  AppStateStatus,
  useWindowDimensions,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSidebarStore } from '../store/sidebarStore';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  X,
  PhoneCall,
  Plus,
  ArrowUpRight,
  ChevronDown,
  Download,
  Users,
  Phone,
  MessageCircle,
  Flame,
  Sun,
  Snowflake,
  Megaphone,
  RotateCcw,
} from 'lucide-react-native';

import { fetchMyLeads, fetchCampaigns, createWalkInLead, MyLeadsResponse } from '../api/leadApi';
import { storage } from '../utils/storage';
import { Lead, RootStackParamList } from '../types';
import { colors } from '../theme';
import { useAuthStore } from '../store/authStore';
import { useCampaignStore } from '../store/campaignStore';
import { CrmShell } from '../components/CrmShell';
import { LeadSummaryModal } from '../components/LeadSummaryModal';
import { WhatsAppTemplateModal } from '../components/WhatsAppTemplateModal';
import { callService } from '../services/call.service';
import { getDialerTelUrl, formatDisplayPhone, normalizePhoneDigits, isLeadLostOrSuppressed } from '../utils/phoneUtils';
import { toast } from '../store/toastStore';
import { downloadOrShareCsv, convertLeadsToCsv } from '../utils/csvDownloader';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface ScreenshotLead {
  _id: string;
  name: string;
  phone: string;
  campaignName: string;
  campaignId?: string;
  attempts: number;
  assignedAgent: string;
  status: 'New' | 'Interested' | 'Follow-up' | 'Not connected' | 'Not Interested';
  priority: 'High' | 'Medium' | 'Low';
  lastContact: string;
}

// ======================================================================
// DESIGN TOKENS — shared palette/rhythm with the rest of the app
// ======================================================================
const T = {
  radius: { sm: 10, md: 14, lg: 16 },
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20 },
  color: {
    bg: '#F6F8FA',
    surface: '#FFFFFF',
    surfaceSunken: '#F8FAFC',
    border: '#E7EAEE',
    borderStrong: '#D7DCE3',
    text: '#111827',
    textMuted: '#6B7280',
    textFaint: '#9CA3AF',
    primary: '#0F9D58',
    primaryDark: '#0B7A44',
    primaryTint: '#E6F4EA',
    danger: '#DC2626',
    dangerTint: '#FEF2F2',
    info: '#2563EB',
    infoTint: '#EFF6FF',
    warn: '#D97706',
    warnTint: '#FFFBEB',
  },
  shadowCard: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
};

export const MyLeadsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const {
    selectedCampaignName,
    selectedCampaignId,
    setSelectedCampaign: setStoreCampaign,
  } = useCampaignStore();
  const isAgent = user?.role === 'AGENT';
  const isManagerOrAdmin = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const { width } = useWindowDimensions();

  const handleNavigateToCampaigns = () => {
    useSidebarStore.getState().setCurrentRoute('Campaigns');
    navigation.navigate('Campaigns' as any);
  };
  const isWide = width >= 860;

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'All' | 'New' | 'Interested' | 'Follow-up' | 'Not connected' | 'Not Interested'>('All');
  const selectedCampaign = selectedCampaignName || 'All campaigns';
  const [showCampaignDropdown, setShowCampaignDropdown] = useState(false);
  const [quickModalLead, setQuickModalLead] = useState<Lead | null>(null);

  // Call Detection State & Refs
  const isCallingRef = useRef<boolean>(false);
  const callStartTimeRef = useRef<number | null>(null);
  const callingLeadRef = useRef<Lead | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // WhatsApp Template Modal State
  const [whatsAppModalData, setWhatsAppModalData] = useState<{
    visible: boolean;
    name: string;
    phone: string;
  }>({
    visible: false,
    name: '',
    phone: '',
  });

  // Walk-in modal state
  const [showWalkInModal, setShowWalkInModal] = useState(false);
  const [walkInName, setWalkInName] = useState('');
  const [walkInPhone, setWalkInPhone] = useState('');

  // Fetch real campaigns & leads from backend
  const { data: campaignData, refetch: refetchCampaigns } = useQuery({
    queryKey: ['campaigns'],
    queryFn: fetchCampaigns,
  });

  // Instant Offline / Cold-Start Cache State (loads in < 2ms)
  const [cachedLeadsData, setCachedLeadsData] = useState<MyLeadsResponse | null>(null);

  useEffect(() => {
    storage.getItem('tele_crm_my_leads_cache_v2').then((saved) => {
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed && Array.isArray(parsed.leads) && parsed.leads.length > 0) {
            setCachedLeadsData(parsed);
          }
        } catch {}
      }
    });
  }, []);

  const {
    data: leadsData,
    isLoading: isLeadsLoading,
    isRefetching: isLeadsRefetching,
    isError: isLeadsError,
    error: leadsError,
    refetch,
  } = useQuery({
    queryKey: ['myLeadsList'],
    queryFn: () => fetchMyLeads({ limit: 5000 }),
    refetchInterval: 15000,
    refetchIntervalInBackground: false,
    staleTime: 1000 * 60 * 3, // 3 minutes cache TTL
  });

  useEffect(() => {
    if (leadsData && Array.isArray(leadsData.leads) && leadsData.leads.length > 0) {
      setCachedLeadsData(leadsData);
      storage.setItem('tele_crm_my_leads_cache_v2', JSON.stringify(leadsData)).catch(() => {});
    }
  }, [leadsData]);

  const effectiveLeadsData = leadsData || cachedLeadsData;

  // Mutation to add walk-in lead
  const walkInMutation = useMutation({
    mutationFn: (newLead: { name: string; phone: string; campaignId?: string }) => {
      const campId = newLead.campaignId || selectedCampaignId || campaignData?.campaigns?.[0]?._id || 'default';
      return createWalkInLead(campId, {
        name: newLead.name,
        phone: normalizePhoneDigits(newLead.phone),
      });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['myLeadsList'] });
      queryClient.invalidateQueries({ queryKey: ['homeMyLeadsQueue'] });
      queryClient.invalidateQueries({ queryKey: ['homeDashboard'] });
      refetch();
      setShowWalkInModal(false);
      setWalkInName('');
      setWalkInPhone('');
      toast.success(`Walk-in lead "${variables.name}" added to queue!`, 'Lead Added');
    },
    onError: (err: any) => {
      Alert.alert('Error', err?.response?.data?.message || err?.message || 'Failed to add walk-in lead.');
    },
  });

  // Real backend leads (backend /api/leads/my is already strictly scoped to logged-in user)
  const combinedLeads: ScreenshotLead[] = useMemo(() => {
    const rawLeads = effectiveLeadsData?.leads || [];
    const realLeads = [...rawLeads].sort((a: Lead, b: Lead) => {
      const aCalled = (a.attemptCount && a.attemptCount > 0) || a.lastContactedAt ? 1 : 0;
      const bCalled = (b.attemptCount && b.attemptCount > 0) || b.lastContactedAt ? 1 : 0;
      if (aCalled !== bCalled) return aCalled - bCalled;
      if (aCalled === 1 && bCalled === 1) {
        const aTime = a.lastContactedAt ? new Date(a.lastContactedAt).getTime() : 0;
        const bTime = b.lastContactedAt ? new Date(b.lastContactedAt).getTime() : 0;
        if (aTime !== bTime) return aTime - bTime;
      }
      return 0;
    });
    if (realLeads.length > 0) {
      return realLeads.map((l: Lead, idx: number) => {
        const camp =
          typeof l.campaign === 'object' && l.campaign
            ? l.campaign.name
            : (l as any).campaignName || 'General';
        const cId =
          typeof l.campaign === 'object' && l.campaign
            ? l.campaign._id
            : l.campaignId;

        const normalizedStage = l.stage.trim().toLowerCase();
        const stg =
          normalizedStage === 'new'
            ? 'New'
            : normalizedStage === 'interested'
            ? 'Interested'
            : normalizedStage === 'not interested' ||
              normalizedStage === 'closed' ||
              normalizedStage === 'lost' ||
              l.status === 'CLOSED'
            ? 'Not Interested'
            : normalizedStage === 'not connected'
            ? 'Not connected'
            : normalizedStage === 'contacted'
            ? 'Interested'
            : 'Follow-up';

        const agentDisplay = isAgent
          ? `${user?.name || 'You'} (${user?.branch || 'Agent'})`
          : l.assignedTo
          ? typeof l.assignedTo === 'object'
            ? l.assignedTo.name
            : 'Assigned Agent'
          : 'Assigned Agent';

        const leadPriority: 'High' | 'Medium' | 'Low' =
          l.tag?.toUpperCase() === 'HOT'
            ? 'High'
            : l.tag?.toUpperCase() === 'COLD'
            ? 'Low'
            : typeof l.campaign === 'object' && (l.campaign as any)?.priority === 'HIGH'
            ? 'High'
            : typeof l.campaign === 'object' && (l.campaign as any)?.priority === 'LOW'
            ? 'Low'
            : 'Medium';

        return {
          _id: l._id,
          name: l.name,
          phone: formatDisplayPhone(l.phone),
          campaignName: camp,
          campaignId: cId,
          attempts: l.attemptCount || 0,
          assignedAgent: agentDisplay,
          status: stg as any,
          priority: leadPriority,
          lastContact: new Date(l.updatedAt || Date.now()).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
        };
      });
    }

    return [];
  }, [leadsData, isAgent, user]);

  // Dynamic available campaign options from backend & leads
  const availableCampaignOptions = useMemo(() => {
    const list = ['All campaigns'];
    const backendNames = (campaignData?.campaigns || []).map((c) => c.name);
    combinedLeads.forEach((l) => {
      if (l.campaignName && !backendNames.includes(l.campaignName)) {
        backendNames.push(l.campaignName);
      }
    });
    return Array.from(new Set([...list, ...backendNames]));
  }, [campaignData, combinedLeads]);

  // Compute status pill counts based on active campaign selection
  const counts = useMemo(() => {
    const scopedLeads = combinedLeads.filter((l) => {
      if (selectedCampaign === 'All campaigns') return true;
      return (
        l.campaignName.toLowerCase() === selectedCampaign.toLowerCase() ||
        (selectedCampaignId && l.campaignId === selectedCampaignId)
      );
    });

    const all = scopedLeads.length;
    const n = scopedLeads.filter((l) => l.status === 'New').length;
    const interested = scopedLeads.filter((l) => l.status === 'Interested').length;
    const followup = scopedLeads.filter((l) => l.status === 'Follow-up').length;
    const notConn = scopedLeads.filter((l) => l.status === 'Not connected').length;
    const notInterested = scopedLeads.filter((l) => l.status === 'Not Interested').length;
    return { all, new: n, interested, followup, notConnected: notConn, notInterested };
  }, [combinedLeads, selectedCampaign, selectedCampaignId]);

  // Filtered Leads
  const filteredLeads = useMemo(() => {
    return combinedLeads.filter((lead) => {
      // Campaign filter (scoped strictly to selected campaign)
      if (selectedCampaign !== 'All campaigns') {
        const matchesName = lead.campaignName.toLowerCase() === selectedCampaign.toLowerCase();
        const matchesId = selectedCampaignId && lead.campaignId === selectedCampaignId;
        if (!matchesName && !matchesId) {
          return false;
        }
      }

      const isLost = isLeadLostOrSuppressed(lead as any) || lead.status === 'Not Interested';

      // Status filter
      if (selectedFilter === 'All') {
        // By default in All (Active Working Leads), hide Customer Lost / Not Interested so telecallers don't disturb them
        if (isLost) {
          return false;
        }
      } else if (selectedFilter === 'Not Interested') {
        // Strictly show Customer Lost in this archive tab
        if (!isLost) {
          return false;
        }
      } else if (lead.status !== selectedFilter) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          lead.name.toLowerCase().includes(q) ||
          lead.phone.toLowerCase().includes(q) ||
          lead.campaignName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [combinedLeads, selectedFilter, selectedCampaign, searchQuery, selectedCampaignId]);

  const [isExporting, setIsExporting] = useState(false);

  const handleExportLeads = async () => {
    try {
      if (filteredLeads.length === 0) {
        toast.info('No leads found in this view to export', 'Empty Queue');
        return;
      }
      setIsExporting(true);
      const csvContent = convertLeadsToCsv(filteredLeads);
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `leads_export_${timestamp}.csv`;
      const res = await downloadOrShareCsv(filename, csvContent);
      if (res.success) {
        toast.success(`Exported ${filteredLeads.length} leads to CSV!`, 'Export Ready');
      } else {
        toast.error(res.message, 'Export Failed');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Could not export leads', 'Export Error');
    } finally {
      setIsExporting(false);
    }
  };

  // Handle Direct Call
  const handleDirectCall = async (
    phone: string,
    customerName?: string,
    leadId?: string,
    leadStatus?: string,
  ) => {
    if (!phone.trim()) {
      Alert.alert('Invalid Number', 'Unable to initiate call.');
      return;
    }

    const isSuppressed = leadStatus === 'Not Interested' || leadStatus === 'Closed';

    const executeCall = async () => {
      // 1. Resolve Lead object
      const foundLead = (leadsData?.leads || []).find((l: Lead) => l._id === leadId || l.phone === phone);
      const activeLead: Lead = foundLead || {
        _id: leadId || 'lead-' + Date.now(),
        campaignId: 'default',
        name: customerName || 'Lead Contact',
        phone,
        source: 'DIRECT',
        stage: leadStatus || 'New',
        status: 'OPEN',
        attemptCount: 1,
        customProperties: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      callingLeadRef.current = activeLead;
      callStartTimeRef.current = Date.now();
      isCallingRef.current = true;

      toast.info(`Calling ${customerName || phone}...`, 'Dialing');

      try {
        await callService.startCall(activeLead);
      } catch (err) {
        isCallingRef.current = false;
        callStartTimeRef.current = null;
        callingLeadRef.current = null;
        Alert.alert('Call Error', 'Unable to open phone dialer on this device.');
      }
    };

    if (isSuppressed) {
      if (isAgent) {
        Alert.alert(
          'Customer Suppressed',
          `${customerName || 'This customer'} is marked as not interested and cannot be called from the agent queue.`,
        );
        return;
      }

      Alert.alert(
        '⚠️ Customer Not Interested',
        `${customerName || 'This customer'} was marked as "Not Interested". Calling again may cause customer irritation.\n\nAre you sure you want to dial anyway?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Call Anyway', style: 'destructive', onPress: executeCall },
        ],
      );
      return;
    }

    await executeCall();
  };

  // AppState Listener: Detect returning from dialer in MyLeadsScreen
  useEffect(() => {
    const handleAppStateChange = async (nextState: AppStateStatus) => {
      const prevState = appStateRef.current;
      appStateRef.current = nextState;

      if (
        (prevState === 'background' || prevState === 'inactive') &&
        nextState === 'active' &&
        isCallingRef.current &&
        callStartTimeRef.current !== null &&
        callingLeadRef.current !== null
      ) {
        const startTime = callStartTimeRef.current;
        const dialedLead = callingLeadRef.current;
        isCallingRef.current = false;
        callStartTimeRef.current = null;

        let result: { connected: boolean; durationSeconds: number };
        try {
          result = await callService.getCallResult(dialedLead.phone, startTime);
        } catch {
          result = { connected: false, durationSeconds: 0 };
        }

        navigation.navigate('Dispose', {
          lead: dialedLead,
          initialTab: 'DISPOSE LEAD',
          callDurationSeconds: result.connected ? result.durationSeconds : 0,
          isCallConnected: result.connected,
          callAttempt: true,
          detectionMethod: 'AUTOMATIC',
        });
      }
    };

    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, [navigation]);

  // Handle Direct WhatsApp
  const handleOpenWhatsApp = (lead: ScreenshotLead) => {
    setWhatsAppModalData({
      visible: true,
      name: lead.name,
      phone: lead.phone,
    });
  };

  // Handle Open Lead Modal
  const handleOpenLead = (item: ScreenshotLead) => {
    const syntheticLead: Lead = {
      _id: item._id,
      campaignId: 'default-camp',
      name: item.name,
      phone: item.phone,
      source: 'WALK_IN',
      stage:
        item.status === 'Interested'
          ? 'Interested'
          : item.status === 'New'
          ? 'New'
          : item.status === 'Not connected'
          ? 'Not connected'
          : item.status === 'Follow-up'
          ? 'Follow-up'
          : item.status === 'Not Interested'
          ? 'Not Interested'
          : 'Follow Up',
      tag: item.priority === 'High' ? 'HOT' : item.priority === 'Medium' ? 'WARM' : 'COLD',
      temperature: (item.priority === 'High' ? 'HOT' : item.priority === 'Medium' ? 'WARM' : 'COLD') as any,
      status: item.status === 'Not Interested' ? 'CLOSED' : 'OPEN',
      attemptCount: item.attempts,
      customProperties: { campaign: item.campaignName, priority: item.priority },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setQuickModalLead(syntheticLead);
  };

  // Start Calling Queue
  const handleStartCalling = () => {
    if (filteredLeads.length === 0) {
      Alert.alert('Queue Empty', 'No leads ready to call in current filter.');
      return;
    }
    handleDirectCall(filteredLeads[0].phone, filteredLeads[0].name, filteredLeads[0]._id);
  };

  // Render Status Badge
  const renderStatusBadge = (status: ScreenshotLead['status']) => {
    switch (status) {
      case 'Interested':
        return (
          <View style={[styles.statusPill, { backgroundColor: T.color.primaryTint }]}>
            <Text style={[styles.statusPillText, { color: T.color.primaryDark }]}>Interested</Text>
          </View>
        );
      case 'Follow-up':
        return (
          <View style={[styles.statusPill, { backgroundColor: T.color.warnTint }]}>
            <Text style={[styles.statusPillText, { color: T.color.warn }]}>Follow-up</Text>
          </View>
        );
      case 'New':
        return (
          <View style={[styles.statusPill, { backgroundColor: T.color.infoTint }]}>
            <Text style={[styles.statusPillText, { color: T.color.info }]}>New</Text>
          </View>
        );
      case 'Not Interested':
        return (
          <View
            style={[
              styles.statusPill,
              { backgroundColor: '#FEE2E2', borderColor: '#FECACA', borderWidth: 1 },
            ]}
          >
            <Text style={[styles.statusPillText, { color: '#B91C1C', fontWeight: '700' }]}>
              Not Interested
            </Text>
          </View>
        );
      case 'Not connected':
      default:
        return (
          <View style={[styles.statusPill, { backgroundColor: T.color.surfaceSunken }]}>
            <Text style={[styles.statusPillText, { color: T.color.textMuted }]}>Not connected</Text>
          </View>
        );
    }
  };

  // Render Temperature / Customer Importance Badge
  const renderPriorityBadge = (priority: ScreenshotLead['priority']) => {
    switch (priority) {
      case 'High':
        return (
          <View style={[styles.priorityPill, styles.priorityPillHot]}>
            <Flame size={10} color={T.color.danger} fill={T.color.danger} />
            <Text style={[styles.priorityPillText, { color: T.color.danger }]}>Hot</Text>
          </View>
        );
      case 'Medium':
        return (
          <View style={[styles.priorityPill, styles.priorityPillWarm]}>
            <Sun size={10} color={T.color.warn} />
            <Text style={[styles.priorityPillText, { color: T.color.warn }]}>Warm</Text>
          </View>
        );
      case 'Low':
      default:
        return (
          <View style={[styles.priorityPill, styles.priorityPillCold]}>
            <Snowflake size={10} color={T.color.info} />
            <Text style={[styles.priorityPillText, { color: T.color.info }]}>Cold</Text>
          </View>
        );
    }
  };

  return (
    <CrmShell
      title="My Leads"
      headerIcon={<Users size={15} color={colors.textSecondary} />}
      breadcrumb="Workspace"
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLeadsRefetching}
            onRefresh={() => {
              refetch();
              refetchCampaigns();
            }}
            colors={[T.color.primary]}
          />
        }
      >
        {/* Campaign Workspace Context Banner */}
        {selectedCampaign !== 'All campaigns' ? (
          <View style={styles.activeWorkspaceBanner}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: T.space.sm, flex: 1 }}>
              <View style={styles.activeWorkspaceIcon}>
                <Megaphone size={16} color={T.color.primaryDark} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.activeWorkspaceTitle} numberOfLines={1}>
                  Campaign: {selectedCampaign}
                </Text>
                <Text style={styles.activeWorkspaceSub}>
                  {counts.all} numbers strictly isolated in this campaign
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.switchCampBtn}
              onPress={() => navigation.navigate('CampaignSelect' as any)}
              activeOpacity={0.7}
            >
              <Text style={styles.switchCampBtnText}>Change</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Banner Section: Your lead queue & Actions */}
        <View style={[styles.bannerRow, !isWide && styles.bannerRowMobile]}>
          <View style={!isWide ? styles.bannerTitleBlockMobile : { flex: 1 }}>
            <Text style={styles.bannerTitle}>
              {isAgent ? 'My telecalling queue' : 'Your lead queue'}
            </Text>
            <Text style={styles.bannerSubtitle}>
              {isAgent
                ? `${counts.all} leads assigned to ${user?.name || 'You'} (${user?.branch || 'General'} Branch)`
                : `${counts.all} leads ready for your next conversation`}
            </Text>
          </View>

          <View style={[styles.bannerActions, !isWide && styles.bannerActionsMobile]}>
            {isManagerOrAdmin && (
              <TouchableOpacity
                style={[styles.campaignNavBtn, !isWide && styles.campaignNavBtnMobile]}
                onPress={handleNavigateToCampaigns}
                activeOpacity={0.7}
              >
                <Megaphone size={14} color="#0D9488" strokeWidth={2.4} />
                <Text style={styles.campaignNavBtnText}>Campaigns</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.walkInBtn, !isWide && styles.walkInBtnMobile]}
              onPress={() => setShowWalkInModal(true)}
              activeOpacity={0.7}
            >
              <Plus size={14} color={T.color.text} strokeWidth={2.5} />
              <Text style={styles.walkInText}>Walk-in</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.startCallingBtn, !isWide && styles.startCallingBtnMobile]}
              onPress={handleStartCalling}
              activeOpacity={0.8}
            >
              <PhoneCall size={14} color="#FFFFFF" strokeWidth={2.5} />
              <Text style={styles.startCallingText}>Start calling</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Search & Filter Bar */}
        <View style={[styles.searchBarRow, !isWide && styles.searchBarRowMobile]}>
          <View style={[styles.searchInputWrap, isWide ? { flex: 1 } : styles.searchInputWrapMobile]}>
            <Search size={16} color={T.color.textFaint} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name or phone number"
              placeholderTextColor={T.color.textFaint}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={14} color={T.color.textFaint} />
              </TouchableOpacity>
            )}
          </View>

          <View style={[styles.filterControlsRow, !isWide && styles.filterControlsRowMobile]}>
            {/* Campaign Selector Pill */}
            <TouchableOpacity
              style={[styles.campaignSelectBtn, !isWide && styles.campaignSelectBtnMobile]}
              onPress={() => setShowCampaignDropdown(!showCampaignDropdown)}
              activeOpacity={0.7}
            >
              <Text style={styles.campaignSelectText} numberOfLines={1}>{selectedCampaign}</Text>
              <ChevronDown size={14} color={T.color.textMuted} />
            </TouchableOpacity>

            {/* Export Icon Button */}
            <TouchableOpacity
              style={styles.exportIconBtn}
              onPress={handleExportLeads}
              disabled={isExporting}
              activeOpacity={0.7}
            >
              {isExporting ? (
                <ActivityIndicator size="small" color={T.color.primary} />
              ) : (
                <Download size={15} color={T.color.textMuted} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Campaign Dropdown Menu */}
        {showCampaignDropdown && (
          <View style={styles.dropdownMenu}>
            {availableCampaignOptions.map((camp) => (
              <TouchableOpacity
                key={camp}
                style={styles.dropdownItem}
                onPress={() => {
                  const matched = (campaignData?.campaigns || []).find((c) => c.name === camp);
                  setStoreCampaign(matched ? matched._id : null, camp);
                  setShowCampaignDropdown(false);
                }}
              >
                <Text
                  style={[
                    styles.dropdownText,
                    selectedCampaign === camp && styles.dropdownTextActive,
                  ]}
                >
                  {camp}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Status Filter Tabs Row */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterPillsRow}
        >
          {/* All */}
          <TouchableOpacity
            style={[styles.filterPill, selectedFilter === 'All' && styles.filterPillActive]}
            onPress={() => setSelectedFilter('All')}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterPillLabel, selectedFilter === 'All' && styles.filterPillLabelActive]}>
              All
            </Text>
            <View style={[styles.filterCountBadge, selectedFilter === 'All' && styles.filterCountBadgeActive]}>
              <Text style={[styles.filterCountText, selectedFilter === 'All' && styles.filterCountTextActive]}>
                {counts.all}
              </Text>
            </View>
          </TouchableOpacity>

          {/* New */}
          <TouchableOpacity
            style={[styles.filterPill, selectedFilter === 'New' && styles.filterPillActive]}
            onPress={() => setSelectedFilter('New')}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterPillLabel, selectedFilter === 'New' && styles.filterPillLabelActive]}>
              New
            </Text>
            <View style={[styles.filterCountBadge, selectedFilter === 'New' && styles.filterCountBadgeActive]}>
              <Text style={[styles.filterCountText, selectedFilter === 'New' && styles.filterCountTextActive]}>
                {counts.new}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Interested */}
          <TouchableOpacity
            style={[styles.filterPill, selectedFilter === 'Interested' && styles.filterPillActive]}
            onPress={() => setSelectedFilter('Interested')}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterPillLabel, selectedFilter === 'Interested' && styles.filterPillLabelActive]}>
              Interested
            </Text>
            <View style={[styles.filterCountBadge, selectedFilter === 'Interested' && styles.filterCountBadgeActive]}>
              <Text style={[styles.filterCountText, selectedFilter === 'Interested' && styles.filterCountTextActive]}>
                {counts.interested}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Follow-up */}
          <TouchableOpacity
            style={[styles.filterPill, selectedFilter === 'Follow-up' && styles.filterPillActive]}
            onPress={() => setSelectedFilter('Follow-up')}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterPillLabel, selectedFilter === 'Follow-up' && styles.filterPillLabelActive]}>
              Follow-up
            </Text>
            <View style={[styles.filterCountBadge, selectedFilter === 'Follow-up' && styles.filterCountBadgeActive]}>
              <Text style={[styles.filterCountText, selectedFilter === 'Follow-up' && styles.filterCountTextActive]}>
                {counts.followup}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Not connected */}
          <TouchableOpacity
            style={[styles.filterPill, selectedFilter === 'Not connected' && styles.filterPillActive]}
            onPress={() => setSelectedFilter('Not connected')}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterPillLabel, selectedFilter === 'Not connected' && styles.filterPillLabelActive]}>
              Not connected
            </Text>
            <View style={[styles.filterCountBadge, selectedFilter === 'Not connected' && styles.filterCountBadgeActive]}>
              <Text style={[styles.filterCountText, selectedFilter === 'Not connected' && styles.filterCountTextActive]}>
                {counts.notConnected}
              </Text>
            </View>
          </TouchableOpacity>

          {!isAgent && (
            <TouchableOpacity
              style={[
                styles.filterPill,
                selectedFilter === 'Not Interested' && styles.filterPillActive,
                selectedFilter === 'Not Interested' && { backgroundColor: '#FEE2E2', borderColor: '#EF4444' },
              ]}
              onPress={() => setSelectedFilter('Not Interested')}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterPillLabel,
                  selectedFilter === 'Not Interested' && { color: '#B91C1C', fontWeight: '800' },
                ]}
              >
                Not Interested
              </Text>
              <View
                style={[
                  styles.filterCountBadge,
                  selectedFilter === 'Not Interested' && { backgroundColor: T.color.danger },
                ]}
              >
                <Text
                  style={[
                    styles.filterCountText,
                    selectedFilter === 'Not Interested' && { color: '#FFFFFF' },
                  ]}
                >
                  {counts.notInterested}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        </ScrollView>

        {/* Leads Display: Clean Mobile Cards for Mobile, Spacious Table for Wide Desktop */}
        {!isWide ? (
          <View style={styles.mobileListContainer}>
            {isLeadsLoading && !combinedLeads.length ? (
              <View style={styles.loadingCard}>
                <ActivityIndicator size="large" color={T.color.primary} />
                <Text style={styles.loadingCardText}>Loading lead queue from server...</Text>
              </View>
            ) : isLeadsError && !combinedLeads.length ? (
              <View style={styles.errorCard}>
                <RotateCcw size={32} color={T.color.danger} />
                <Text style={styles.errorTitle}>Server reconnecting</Text>
                <Text style={styles.errorSub}>
                  {(leadsError as any)?.response?.data?.message || (leadsError as any)?.message || 'Connecting to Render cloud backend. Please tap below to retry.'}
                </Text>
                <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()} activeOpacity={0.8}>
                  <Text style={styles.retryBtnText}>Retry fetching leads</Text>
                </TouchableOpacity>
              </View>
            ) : filteredLeads.length === 0 ? (
              <View style={styles.emptyStateCard}>
                <Users size={36} color={T.color.textFaint} />
                <Text style={styles.emptyStateTitle}>No leads found</Text>
                <Text style={styles.emptyStateSubtitle}>
                  {selectedCampaign !== 'All campaigns'
                    ? `No leads found under "${selectedCampaign}". Switch campaign or reset filter.`
                    : 'No leads match your current search query or filter selection.'}
                </Text>
                {(selectedFilter !== 'All' || selectedCampaign !== 'All campaigns' || searchQuery.length > 0) && (
                  <TouchableOpacity
                    style={styles.emptyResetBtn}
                    onPress={() => {
                      setSelectedFilter('All');
                      setStoreCampaign(null, 'All campaigns');
                      setSearchQuery('');
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.emptyResetBtnText}>Reset to all campaigns</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.emptyUploadBtn}
                  onPress={() => navigation.navigate('UploadLeads')}
                  activeOpacity={0.8}
                >
                  <Plus size={14} color="#FFFFFF" strokeWidth={2.5} />
                  <Text style={styles.emptyUploadBtnText}>Upload leads CSV</Text>
                </TouchableOpacity>
              </View>
            ) : (
              filteredLeads.map((item) => {
                const initials = item.name
                  .split(' ')
                  .filter(Boolean)
                  .map((w) => w[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2) || 'LD';

                return (
                  <View key={item._id} style={styles.mobileLeadCard}>
                    {/* Header Row: Avatar, Name & Phone, Badges */}
                    <View style={styles.cardHeaderRow}>
                      <View style={styles.avatarCircleLg}>
                        <Text style={styles.avatarTextLg}>{initials}</Text>
                      </View>

                      <View style={styles.cardLeadInfo}>
                        <Text style={styles.cardLeadName} numberOfLines={1}>
                          {item.name}
                        </Text>
                        <TouchableOpacity
                          onPress={() => handleDirectCall(item.phone, item.name, item._id, item.status)}
                          activeOpacity={0.7}
                          style={styles.cardPhoneTouch}
                        >
                          <Phone size={12} color={T.color.primaryDark} strokeWidth={2} />
                          <Text style={styles.cardPhoneText}>{item.phone}</Text>
                        </TouchableOpacity>
                      </View>

                      {/* Badges on Right: Priority on top, Status below */}
                      <View style={styles.cardBadgesCol}>
                        {renderPriorityBadge(item.priority)}
                        <View style={{ marginTop: 4 }}>
                          {renderStatusBadge(item.status)}
                        </View>
                      </View>
                    </View>

                    {/* Metadata Row: Campaign, Attempts, Last Contact */}
                    <View style={styles.cardMetaRow}>
                      <View style={styles.cardCampaignBadge}>
                        <Text style={styles.cardCampaignBadgeText} numberOfLines={1}>
                          {item.campaignName}
                        </Text>
                      </View>

                      <Text style={styles.cardMetaDot}>•</Text>

                      <Text style={styles.cardMetaText}>
                        {item.attempts} {item.attempts === 1 ? 'attempt' : 'attempts'}
                      </Text>

                      <Text style={styles.cardMetaDot}>•</Text>

                      <Text style={styles.cardMetaText}>
                        {item.lastContact}
                      </Text>
                    </View>

                    {/* Assigned Agent Row */}
                    {item.assignedAgent ? (
                      <View style={styles.cardAgentRow}>
                        <Users size={12} color={T.color.textFaint} />
                        <Text style={styles.cardAgentText} numberOfLines={1}>
                          {item.assignedAgent}
                        </Text>
                      </View>
                    ) : null}

                    {/* Action Buttons Row */}
                    <View style={styles.cardActionRow}>
                      {/* Call Button */}
                      <TouchableOpacity
                        style={styles.cardCallBtn}
                        onPress={() => handleDirectCall(item.phone, item.name, item._id, item.status)}
                        activeOpacity={0.8}
                      >
                        <Phone size={13} color="#FFFFFF" strokeWidth={2.5} />
                        <Text style={styles.cardCallBtnText} numberOfLines={1}>Call</Text>
                      </TouchableOpacity>

                      {/* WhatsApp Button */}
                      <TouchableOpacity
                        style={styles.cardWhatsAppBtn}
                        onPress={() => handleOpenWhatsApp(item)}
                        activeOpacity={0.8}
                      >
                        <MessageCircle size={13} color={T.color.primaryDark} strokeWidth={2.5} />
                        <Text style={styles.cardWhatsAppBtnText} numberOfLines={1}>WhatsApp</Text>
                      </TouchableOpacity>

                      {/* Open Lead Button */}
                      <TouchableOpacity
                        style={styles.cardOpenLeadBtn}
                        onPress={() => handleOpenLead(item)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.cardOpenLeadBtnText} numberOfLines={1}>Open lead</Text>
                        <ArrowUpRight size={12} color={T.color.info} />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}

            {/* Mobile Footer Count */}
            {filteredLeads.length > 0 && (
              <View style={styles.mobileFooterSummary}>
                <Text style={styles.tableFooterCount}>Showing {filteredLeads.length} leads</Text>
                <Text style={styles.tableFooterStatus}>All leads synced</Text>
              </View>
            )}
          </View>
        ) : (
          /* Desktop / Wide Screen Table */
          <View style={styles.tableCard}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ minWidth: 920 }}>
                {/* Table Header */}
                <View style={styles.tableHeaderRow}>
                  <Text style={[styles.thCell, { width: 230 }]}>Lead</Text>
                  <Text style={[styles.thCell, { width: 220 }]}>Campaign</Text>
                  <Text style={[styles.thCell, { width: 120 }]}>Status</Text>
                  <Text style={[styles.thCell, { width: 100 }]}>Priority</Text>
                  <Text style={[styles.thCell, { width: 110 }]}>Last contact</Text>
                  <Text style={[styles.thCell, { width: 140, textAlign: 'right' }]}>Action</Text>
                </View>

                {/* Table Rows */}
                {filteredLeads.map((item, idx) => {
                  const isLast = idx === filteredLeads.length - 1;
                  const initials = item.name
                    .split(' ')
                    .filter(Boolean)
                    .map((w) => w[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2) || 'LD';

                  return (
                    <View
                      key={item._id}
                      style={[styles.tableDataRow, isLast && { borderBottomWidth: 0 }]}
                    >
                      {/* Lead Cell: Avatar + Name + Phone */}
                      <View style={[styles.tdCell, { width: 230, flexDirection: 'row', alignItems: 'center', gap: T.space.sm + 2 }]}>
                        <View style={styles.avatarCircle}>
                          <Text style={styles.avatarText}>{initials}</Text>
                        </View>
                        <View style={{ flex: 1, paddingRight: 8 }}>
                          <Text style={styles.leadNameText} numberOfLines={1}>
                            {item.name}
                          </Text>
                          <Text style={styles.leadPhoneText}>{item.phone}</Text>
                        </View>
                      </View>

                      {/* Campaign Cell */}
                      <View style={[styles.tdCell, { width: 220, paddingRight: 12 }]}>
                        <Text style={styles.campaignTitleText} numberOfLines={1}>
                          {item.campaignName}
                        </Text>
                        <Text style={styles.campaignSubtitleText} numberOfLines={1}>
                          {item.attempts} attempts · {item.assignedAgent}
                        </Text>
                      </View>

                      {/* Status Cell */}
                      <View style={[styles.tdCell, { width: 120 }]}>
                        {renderStatusBadge(item.status)}
                      </View>

                      {/* Priority Cell */}
                      <View style={[styles.tdCell, { width: 100 }]}>
                        {renderPriorityBadge(item.priority)}
                      </View>

                      {/* Last Contact */}
                      <View style={[styles.tdCell, { width: 110 }]}>
                        <Text style={styles.lastContactText}>{item.lastContact}</Text>
                      </View>

                      {/* Actions: Direct Call | Direct WhatsApp | Open Lead */}
                      <View style={[styles.tdCell, { width: 140, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: T.space.sm - 2 }]}>
                        <TouchableOpacity
                          style={styles.directCallBtn}
                          onPress={() => handleDirectCall(item.phone, item.name, item._id, item.status)}
                          activeOpacity={0.7}
                          accessibilityLabel="Call Lead"
                        >
                          <Phone size={13} color={T.color.primaryDark} strokeWidth={2.5} />
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.directWhatsAppBtn}
                          onPress={() => handleOpenWhatsApp(item)}
                          activeOpacity={0.7}
                          accessibilityLabel="WhatsApp Lead"
                        >
                          <MessageCircle size={13} color={T.color.primaryDark} strokeWidth={2.5} />
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.openLeadBtn}
                          onPress={() => handleOpenLead(item)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.openLeadText}>Open lead</Text>
                          <ArrowUpRight size={11} color={T.color.info} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}

                {/* Table Footer */}
                <View style={styles.tableFooter}>
                  <Text style={styles.tableFooterCount}>{filteredLeads.length} leads</Text>
                  <Text style={styles.tableFooterStatus}>All leads loaded</Text>
                </View>
              </View>
            </ScrollView>
          </View>
        )}
      </ScrollView>

      {/* Walk-in Add Lead Modal */}
      <Modal
        visible={showWalkInModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowWalkInModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add walk-in lead</Text>
              <TouchableOpacity onPress={() => setShowWalkInModal(false)}>
                <X size={18} color={T.color.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>Full name</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Rahul Sharma"
                placeholderTextColor={T.color.textFaint}
                value={walkInName}
                onChangeText={setWalkInName}
              />

              <Text style={[styles.inputLabel, { marginTop: T.space.md }]}>Phone number</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. 9876543210"
                placeholderTextColor={T.color.textFaint}
                keyboardType="phone-pad"
                value={walkInPhone}
                onChangeText={setWalkInPhone}
              />

              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={() => {
                  if (!walkInName.trim() || !walkInPhone.trim()) {
                    Alert.alert('Required Fields', 'Please enter both name and phone number.');
                    return;
                  }
                  walkInMutation.mutate({
                    name: walkInName.trim(),
                    phone: walkInPhone.trim(),
                  });
                }}
                disabled={walkInMutation.isPending}
                activeOpacity={0.8}
              >
                {walkInMutation.isPending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSubmitBtnText}>Add to queue</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Interactive Lovable Lead Modal */}
      {Boolean(quickModalLead) && (
        <LeadSummaryModal
          lead={quickModalLead}
          visible={Boolean(quickModalLead)}
          onClose={() => setQuickModalLead(null)}
          onOpenDisposition={(leadToDispose) => {
            navigation.navigate('Dispose', {
              lead: leadToDispose,
              initialTab: 'DISPOSE LEAD',
            });
          }}
        />
      )}

      {/* WhatsApp Template Selector Modal */}
      <WhatsAppTemplateModal
        visible={whatsAppModalData.visible}
        onClose={() => setWhatsAppModalData((prev) => ({ ...prev, visible: false }))}
        customerName={whatsAppModalData.name}
        customerPhone={whatsAppModalData.phone}
      />

    </CrmShell>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: T.color.bg,
  },
  contentContainer: {
    padding: T.space.lg,
    paddingBottom: 110,
    maxWidth: 1280,
    width: '100%',
    alignSelf: 'center',
  },
  bannerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    flexWrap: 'wrap',
    gap: 14,
  },
  bannerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  bannerSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 3,
    fontWeight: '500',
  },
  bannerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  campaignNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
    paddingVertical: 9,
    paddingHorizontal: 15,
    borderRadius: 10,
    gap: 6,
    shadowColor: '#0F766E',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  campaignNavBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F766E',
  },
  walkInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 6,
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  walkInText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  startCallingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F9D58',
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 10,
    gap: 8,
    shadowColor: '#0F9D58',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  startCallingText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  searchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 44,
    gap: 10,
    shadowColor: '#0F172A',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    color: '#0F172A',
    paddingVertical: 0,
    height: '100%',
  },
  campaignSelectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 44,
    gap: 8,
    shadowColor: '#0F172A',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  campaignSelectText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  exportIconBtn: {
    width: 44,
    height: 44,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  dropdownMenu: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 6,
    marginBottom: 16,
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  dropdownItem: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  dropdownText: {
    fontSize: 13,
    color: '#334155',
  },
  dropdownTextActive: {
    fontWeight: '700',
    color: '#0F9D58',
  },
  filterPillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    paddingVertical: 2,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    gap: 8,
  },
  filterPillActive: {
    backgroundColor: '#0F9D58',
    borderColor: '#0F9D58',
    shadowColor: '#0F9D58',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  filterPillLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  filterPillLabelActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  filterCountBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
  },
  filterCountBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  filterCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  filterCountTextActive: {
    color: '#FFFFFF',
  },

  // Desktop table
  tableCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  thCell: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableDataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  tdCell: {
    justifyContent: 'center',
  },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0284C7',
  },
  avatarCircleLg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarTextLg: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0284C7',
  },
  leadNameText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  leadPhoneText: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  campaignTitleText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#1E293B',
  },
  campaignSubtitleText: {
    fontSize: 10.5,
    color: '#94A3B8',
    marginTop: 3,
  },
  statusPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  priorityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  priorityPillHot: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  priorityPillWarm: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  priorityPillCold: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  priorityPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  lastContactText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  directCallBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  directWhatsAppBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  openLeadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    gap: 4,
    height: 32,
  },
  openLeadText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#2563EB',
  },
  tableFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#F8FAFC',
  },
  tableFooterCount: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  tableFooterStatus: {
    fontSize: 11,
    color: T.color.textFaint,
  },

  // Walk-in modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: T.space.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: T.color.surface,
    borderRadius: T.radius.md,
    padding: T.space.lg + 4,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: T.space.lg,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: T.color.text,
  },
  modalBody: {
    gap: 4,
  },
  inputLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    color: T.color.textMuted,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: T.color.border,
    backgroundColor: T.color.surfaceSunken,
    borderRadius: T.radius.sm - 2,
    paddingHorizontal: T.space.md,
    paddingVertical: T.space.sm + 1,
    fontSize: 13,
    color: T.color.text,
    marginTop: T.space.xs + 2,
  },
  modalSubmitBtn: {
    backgroundColor: T.color.primary,
    borderRadius: T.radius.sm - 2,
    paddingVertical: T.space.md,
    alignItems: 'center',
    marginTop: T.space.lg + 2,
  },
  modalSubmitBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  // Mobile responsive variants
  bannerRowMobile: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: T.space.md,
  },
  bannerTitleBlockMobile: {
    width: '100%',
  },
  bannerActionsMobile: {
    width: '100%',
    flexDirection: 'row',
    gap: T.space.sm,
  },
  campaignNavBtnMobile: {
    flex: 1,
    justifyContent: 'center',
  },
  walkInBtnMobile: {
    flex: 1,
    justifyContent: 'center',
  },
  startCallingBtnMobile: {
    flex: 1.3,
    justifyContent: 'center',
  },
  searchBarRowMobile: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: T.space.sm,
  },
  searchInputWrapMobile: {
    width: '100%',
    height: 44,
    minHeight: 44,
  },
  filterControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.space.sm,
  },
  filterControlsRowMobile: {
    width: '100%',
    justifyContent: 'space-between',
  },
  campaignSelectBtnMobile: {
    flex: 1,
  },

  // Mobile card list
  mobileListContainer: {
    gap: T.space.md,
    marginTop: 2,
  },
  mobileLeadCard: {
    backgroundColor: T.color.surface,
    borderRadius: T.radius.md,
    borderWidth: 1,
    borderColor: T.color.border,
    padding: T.space.md + 2,
    ...T.shadowCard,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: T.space.md,
  },
  cardLeadInfo: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  cardLeadName: {
    fontSize: 15,
    fontWeight: '800',
    color: T.color.text,
    letterSpacing: -0.2,
  },
  cardPhoneTouch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  cardPhoneText: {
    fontSize: 13,
    fontWeight: '600',
    color: T.color.primaryDark,
  },
  cardBadgesCol: {
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: T.space.sm - 2,
    marginTop: T.space.md,
    paddingTop: T.space.sm + 2,
    borderTopWidth: 1,
    borderTopColor: T.color.surfaceSunken,
  },
  cardCampaignBadge: {
    backgroundColor: T.color.surfaceSunken,
    borderWidth: 1,
    borderColor: T.color.border,
    borderRadius: T.radius.sm - 4,
    paddingHorizontal: T.space.sm,
    paddingVertical: 2,
  },
  cardCampaignBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  cardMetaDot: {
    fontSize: 11,
    color: T.color.textFaint,
  },
  cardMetaText: {
    fontSize: 11,
    color: T.color.textMuted,
    fontWeight: '500',
  },
  cardAgentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.space.sm - 2,
    marginTop: T.space.sm,
  },
  cardAgentText: {
    fontSize: 11,
    color: T.color.textMuted,
    fontWeight: '500',
  },
  cardActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.space.sm - 2,
    marginTop: T.space.md,
    paddingTop: T.space.md,
    borderTopWidth: 1,
    borderTopColor: T.color.surfaceSunken,
  },
  cardCallBtn: {
    flex: 1,
    minWidth: 0,
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.color.primary,
    borderRadius: T.radius.sm - 2,
    paddingHorizontal: 4,
    gap: 4,
    shadowColor: T.color.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2,
    elevation: 2,
  },
  cardCallBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  cardWhatsAppBtn: {
    flex: 1.15,
    minWidth: 0,
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.color.primaryTint,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: T.radius.sm - 2,
    paddingHorizontal: 4,
    gap: 4,
  },
  cardWhatsAppBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: T.color.primaryDark,
  },
  cardOpenLeadBtn: {
    flex: 1.15,
    minWidth: 0,
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.color.infoTint,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: T.radius.sm - 2,
    paddingHorizontal: 4,
    gap: 3,
  },
  cardOpenLeadBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: T.color.info,
  },
  mobileFooterSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: T.space.md,
    paddingHorizontal: 4,
  },

  // Empty / loading / error states
  emptyStateCard: {
    backgroundColor: T.color.surface,
    borderRadius: T.radius.md,
    borderWidth: 1,
    borderColor: T.color.border,
    padding: T.space.xl + 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: T.space.sm,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: T.color.text,
    marginTop: T.space.sm,
  },
  emptyStateSubtitle: {
    fontSize: 12,
    color: T.color.textMuted,
    textAlign: 'center',
    maxWidth: 260,
  },
  emptyResetBtn: {
    marginTop: T.space.sm,
    paddingHorizontal: T.space.md,
    paddingVertical: T.space.sm,
    backgroundColor: T.color.infoTint,
    borderRadius: T.radius.sm - 2,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  emptyResetBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: T.color.info,
  },
  emptyUploadBtn: {
    marginTop: T.space.sm + 2,
    backgroundColor: T.color.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.space.sm - 2,
    paddingVertical: T.space.sm + 1,
    paddingHorizontal: T.space.md + 2,
    borderRadius: T.radius.sm - 2,
  },
  emptyUploadBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  activeWorkspaceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: T.color.primaryTint,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: T.radius.md,
    paddingHorizontal: T.space.md + 2,
    paddingVertical: T.space.sm + 2,
    marginBottom: T.space.md,
  },
  activeWorkspaceIcon: {
    width: 32,
    height: 32,
    borderRadius: T.radius.sm - 2,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeWorkspaceTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: T.color.primaryDark,
  },
  activeWorkspaceSub: {
    fontSize: 11,
    color: T.color.primaryDark,
    marginTop: 1,
  },
  switchCampBtn: {
    backgroundColor: T.color.primary,
    paddingHorizontal: T.space.md,
    paddingVertical: T.space.sm - 2,
    borderRadius: T.radius.sm - 2,
  },
  switchCampBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  loadingCard: {
    backgroundColor: T.color.surface,
    borderRadius: T.radius.md,
    borderWidth: 1,
    borderColor: T.color.border,
    padding: T.space.xl + 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: T.space.md,
  },
  loadingCardText: {
    fontSize: 13,
    color: T.color.textMuted,
    fontWeight: '600',
  },
  errorCard: {
    backgroundColor: T.color.dangerTint,
    borderRadius: T.radius.md,
    borderWidth: 1,
    borderColor: '#FECACA',
    padding: T.space.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: T.space.sm,
  },
  errorTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: T.color.danger,
  },
  errorSub: {
    fontSize: 12,
    color: '#7F1D1D',
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 17,
  },
  retryBtn: {
    marginTop: T.space.sm,
    backgroundColor: T.color.danger,
    paddingHorizontal: T.space.md,
    paddingVertical: T.space.sm,
    borderRadius: T.radius.sm - 2,
  },
  retryBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});