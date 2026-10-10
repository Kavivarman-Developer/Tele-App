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

import { fetchMyLeads, fetchCampaigns, createWalkInLead, disposeLead } from '../api/leadApi';
import { Lead, RootStackParamList, DetectedCallResult, CustomerTemperature } from '../types';
import { colors } from '../theme';
import { useAuthStore } from '../store/authStore';
import { useCampaignStore } from '../store/campaignStore';
import { useLeadHistoryStore } from '../store/leadHistoryStore';
import { CrmShell } from '../components/CrmShell';
import { LeadQuickModal } from '../components/LeadQuickModal';
import { WhatsAppTemplateModal } from '../components/WhatsAppTemplateModal';
import { NeoPostCallModal } from '../components/NeoPostCallModal';
import { callService } from '../services/call.service';
import { getDialerTelUrl, formatDisplayPhone, normalizePhoneDigits } from '../utils/phoneUtils';
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

const DEMO_LEADS: ScreenshotLead[] = [
  {
    _id: '6ac623d96c84a3753e4573cd',
    name: 'Rohan Mehta',
    phone: '+91 9810000081',
    campaignName: 'Demo Sales Campaign',
    attempts: 2,
    assignedAgent: 'Assigned Agent',
    status: 'New',
    priority: 'High',
    lastContact: '04:09 PM',
  },
  {
    _id: '6ac623d96c84a3753e4573ff',
    name: 'Priya Verma',
    phone: '+91 9810000129',
    campaignName: 'Demo Sales Campaign',
    attempts: 1,
    assignedAgent: 'Assigned Agent',
    status: 'Follow-up',
    priority: 'Medium',
    lastContact: '02:11 PM',
  },
  {
    _id: '6ac623d96c84a3753e4573ce',
    name: 'Reyansh Kulkarni',
    phone: '+91 9810000009',
    campaignName: 'Demo Sales Campaign',
    attempts: 2,
    assignedAgent: 'Assigned Agent',
    status: 'Follow-up',
    priority: 'Low',
    lastContact: '02:50 PM',
  },
  {
    _id: '6ac623d96c84a3753e4573cf',
    name: 'Sneha Chopra',
    phone: '+91 9810000057',
    campaignName: 'Demo Sales Campaign',
    attempts: 1,
    assignedAgent: 'Assigned Agent',
    status: 'New',
    priority: 'High',
    lastContact: '02:39 PM',
  },
  {
    _id: '6ac623d96c84a3753e4573f6',
    name: 'Deepa Kumar',
    phone: '+91 9810000120',
    campaignName: 'Demo Sales Campaign',
    attempts: 2,
    assignedAgent: 'Assigned Agent',
    status: 'New',
    priority: 'Medium',
    lastContact: '11:56 AM',
  },
  {
    _id: 'lead-6',
    name: 'Rahul Deshmukh',
    phone: '+91 9810000084',
    campaignName: 'Demo Sales Campaign',
    attempts: 1,
    assignedAgent: 'Assigned Agent',
    status: 'Follow-up',
    priority: 'Low',
    lastContact: '09:33 AM',
  },
  {
    _id: 'lead-7',
    name: 'Priya Joshi',
    phone: '+91 9810000096',
    campaignName: 'Demo Sales Campaign',
    attempts: 2,
    assignedAgent: 'Assigned Agent',
    status: 'Interested',
    priority: 'High',
    lastContact: '08:57 AM',
  },
  {
    _id: 'lead-8',
    name: 'Karthik Deshmukh',
    phone: '+91 9810000168',
    campaignName: 'Demo Sales Campaign',
    attempts: 2,
    assignedAgent: 'Assigned Agent',
    status: 'Interested',
    priority: 'Medium',
    lastContact: '09:32 AM',
  },
  {
    _id: 'lead-9',
    name: 'Kavya Reddy',
    phone: '+91 9810000108',
    campaignName: 'Demo Sales Campaign',
    attempts: 2,
    assignedAgent: 'Assigned Agent',
    status: 'Follow-up',
    priority: 'Low',
    lastContact: '10:51 AM',
  },
  {
    _id: 'lead-10',
    name: 'Aarav Sundar',
    phone: '+91 9810000060',
    campaignName: 'Demo Sales Campaign',
    attempts: 1,
    assignedAgent: 'Assigned Agent',
    status: 'New',
    priority: 'High',
    lastContact: '02:48 PM',
  },
  {
    _id: 'lead-11',
    name: 'Riya Sundar',
    phone: '+91 9810000132',
    campaignName: 'Demo Sales Campaign',
    attempts: 2,
    assignedAgent: 'Assigned Agent',
    status: 'Follow-up',
    priority: 'Medium',
    lastContact: '08:50 AM',
  },
  {
    _id: 'lead-12',
    name: 'Arjun Mehta',
    phone: '+91 9810000158',
    campaignName: 'Demo Sales Campaign',
    attempts: 2,
    assignedAgent: 'Assigned Agent',
    status: 'Interested',
    priority: 'Low',
    lastContact: '10:47 AM',
  },
];

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
  const { width } = useWindowDimensions();
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

  const [postCallData, setPostCallData] = useState<{
    visible: boolean;
    lead: Lead | null;
    callResult: DetectedCallResult | null;
  }>({
    visible: false,
    lead: null,
    callResult: null,
  });

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

  const {
    data: leadsData,
    isLoading: isLeadsLoading,
    isRefetching: isLeadsRefetching,
    isError: isLeadsError,
    error: leadsError,
    refetch,
  } = useQuery({
    queryKey: ['myLeadsList'],
    queryFn: () => fetchMyLeads({ limit: 100 }),
    refetchInterval: 15000,
    refetchIntervalInBackground: false,
  });

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
    const realLeads = leadsData?.leads || [];
    if (realLeads.length > 0) {
      return realLeads.map((l: Lead, idx: number) => {
        const camp =
          typeof l.campaign === 'object' && l.campaign
            ? l.campaign.name
            : (l as any).campaignName || 'Testing Campaigns';
        const cId =
          typeof l.campaign === 'object' && l.campaign
            ? l.campaign._id
            : l.campaignId;

        const stg =
          l.stage === 'New'
            ? 'New'
            : l.stage === 'Interested'
            ? 'Interested'
            : l.stage === 'Not Interested' || l.stage === 'Closed' || l.stage === 'Lost' || l.status === 'CLOSED'
            ? 'Not Interested'
            : l.stage === 'Not connected'
            ? 'Not connected'
            : l.stage === 'Contacted'
            ? 'Interested'
            : 'Follow-up';

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
          phone: formatDisplayPhone(l.phone),
          campaignName: camp,
          campaignId: cId,
          attempts: l.attemptCount || 0,
          assignedAgent: agentDisplay,
          status: stg as any,
          priority: (idx % 3 === 0 ? 'High' : idx % 3 === 1 ? 'Medium' : 'Low') as any,
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
      // Status filter
      if (selectedFilter !== 'All' && lead.status !== selectedFilter) {
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
  }, [combinedLeads, selectedFilter, selectedCampaign, searchQuery]);

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

        try {
          const result = await callService.getCallResult(dialedLead.phone, startTime);
          setPostCallData({
            visible: true,
            lead: dialedLead,
            callResult: result,
          });
        } catch {
          setPostCallData({
            visible: true,
            lead: dialedLead,
            callResult: { connected: false, durationSeconds: 0 },
          });
        }
      }
    };

    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, [refetch, queryClient]);

  // Handle Save Disposition from NeoPostCallModal
  const handleSavePostCallDisposition = async (payload: {
    connected: boolean;
    stage: string;
    tag?: string | null;
    temperature?: CustomerTemperature;
    notConnectedReason?: string;
    remark?: string;
    followUpAt?: string | null;
    durationSeconds: number;
    callNext?: boolean;
  }) => {
    const targetLead = postCallData.lead;
    if (!targetLead) return;

    try {
      await disposeLead(targetLead._id, {
        connected: payload.connected,
        stage: payload.stage,
        tag: payload.tag || payload.temperature,
        notConnectedReason: payload.notConnectedReason as any,
        remark: payload.remark,
        followUpAt: payload.followUpAt,
        durationSeconds: payload.durationSeconds,
      });

      useLeadHistoryStore.getState().addActivity(targetLead._id, {
        phone: targetLead.phone,
        customerName: targetLead.name,
        agentName: user?.name,
        agentId: user?._id,
        branch: user?.branch,
        connected: payload.connected,
        stage: payload.stage,
        tag: payload.tag || payload.temperature,
        remark: payload.remark,
        followUpAt: payload.followUpAt,
        durationSeconds: payload.durationSeconds,
        notConnectedReason: payload.notConnectedReason,
      });

      toast.success('Call disposition saved!', 'Saved');
      refetch();
      queryClient.invalidateQueries({ queryKey: ['homeDashboard'] });
      queryClient.invalidateQueries({ queryKey: ['homeMyLeadsQueue'] });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save disposition', 'Error');
    }
  };

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
          <View style={[styles.statusPill, { backgroundColor: '#ECFDF5' }]}>
            <Text style={[styles.statusPillText, { color: '#047857' }]}>Interested</Text>
          </View>
        );
      case 'Follow-up':
        return (
          <View style={[styles.statusPill, { backgroundColor: '#FFFBEB' }]}>
            <Text style={[styles.statusPillText, { color: '#B45309' }]}>Follow-up</Text>
          </View>
        );
      case 'New':
        return (
          <View style={[styles.statusPill, { backgroundColor: '#EFF6FF' }]}>
            <Text style={[styles.statusPillText, { color: '#1D4ED8' }]}>New</Text>
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
          <View style={[styles.statusPill, { backgroundColor: '#F1F5F9' }]}>
            <Text style={[styles.statusPillText, { color: '#475569' }]}>Not connected</Text>
          </View>
        );
    }
  };

  // Render Temperature / Customer Importance Badge (NeoDove style)
  const renderPriorityBadge = (priority: ScreenshotLead['priority']) => {
    switch (priority) {
      case 'High':
        return (
          <View
            style={[
              styles.priorityPill,
              {
                backgroundColor: '#FEF2F2',
                borderWidth: 1,
                borderColor: '#FECACA',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 3,
              },
            ]}
          >
            <Flame size={10} color="#DC2626" fill="#DC2626" />
            <Text style={[styles.priorityPillText, { color: '#DC2626', fontWeight: '800' }]}>Hot</Text>
          </View>
        );
      case 'Medium':
        return (
          <View
            style={[
              styles.priorityPill,
              {
                backgroundColor: '#FFFBEB',
                borderWidth: 1,
                borderColor: '#FDE68A',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 3,
              },
            ]}
          >
            <Sun size={10} color="#D97706" />
            <Text style={[styles.priorityPillText, { color: '#D97706', fontWeight: '700' }]}>Warm</Text>
          </View>
        );
      case 'Low':
      default:
        return (
          <View
            style={[
              styles.priorityPill,
              {
                backgroundColor: '#EFF6FF',
                borderWidth: 1,
                borderColor: '#BFDBFE',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 3,
              },
            ]}
          >
            <Snowflake size={10} color="#2563EB" />
            <Text style={[styles.priorityPillText, { color: '#2563EB', fontWeight: '700' }]}>Cold</Text>
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
            colors={['#10B981']}
          />
        }
      >
        {/* Campaign Workspace Context Banner */}
        {selectedCampaign !== 'All campaigns' ? (
          <View style={styles.activeWorkspaceBanner}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
              <View style={styles.activeWorkspaceIcon}>
                <Megaphone size={16} color="#047857" />
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
              <Text style={styles.switchCampBtnText}>Change ➔</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Banner Section: Your lead queue & Actions */}
        <View style={[styles.bannerRow, !isWide && styles.bannerRowMobile]}>
          <View style={!isWide ? styles.bannerTitleBlockMobile : { flex: 1 }}>
            <Text style={styles.bannerTitle}>
              {isAgent ? 'My Telecalling Queue' : 'Your lead queue'}
            </Text>
            <Text style={styles.bannerSubtitle}>
              {isAgent
                ? `${counts.all} leads assigned to ${user?.name || 'You'} (${user?.branch || 'General'} Branch)`
                : `${counts.all} leads ready for your next conversation`}
            </Text>
          </View>

          <View style={[styles.bannerActions, !isWide && styles.bannerActionsMobile]}>
            <TouchableOpacity
              style={[styles.walkInBtn, !isWide && styles.walkInBtnMobile]}
              onPress={() => setShowWalkInModal(true)}
              activeOpacity={0.7}
            >
              <Plus size={14} color="#0F172A" strokeWidth={2.5} />
              <Text style={styles.walkInText}>Walk-in</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.startCallingBtn, !isWide && styles.startCallingBtnMobile]}
              onPress={handleStartCalling}
              activeOpacity={0.8}
            >
              <PhoneCall size={14} color="#FFFFFF" strokeWidth={2.5} />
              <Text style={styles.startCallingText}>Start Calling</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Search & Filter Bar */}
        <View style={[styles.searchBarRow, !isWide && styles.searchBarRowMobile]}>
          <View style={[styles.searchInputWrap, isWide ? { flex: 1 } : styles.searchInputWrapMobile]}>
            <Search size={16} color="#64748B" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name or phone number..."
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

          <View style={[styles.filterControlsRow, !isWide && styles.filterControlsRowMobile]}>
            {/* Campaign Selector Pill */}
            <TouchableOpacity
              style={[styles.campaignSelectBtn, !isWide && styles.campaignSelectBtnMobile]}
              onPress={() => setShowCampaignDropdown(!showCampaignDropdown)}
              activeOpacity={0.7}
            >
              <Text style={styles.campaignSelectText} numberOfLines={1}>{selectedCampaign}</Text>
              <ChevronDown size={14} color="#64748B" />
            </TouchableOpacity>

            {/* Export Icon Button */}
            <TouchableOpacity
              style={styles.exportIconBtn}
              onPress={handleExportLeads}
              disabled={isExporting}
              activeOpacity={0.7}
            >
              {isExporting ? (
                <ActivityIndicator size="small" color="#10B981" />
              ) : (
                <Download size={15} color="#64748B" />
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

          {/* Not Interested / Suppressed */}
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
                selectedFilter === 'Not Interested' && { backgroundColor: '#DC2626' },
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
        </ScrollView>

        {/* Leads Display: Clean Mobile Cards for Mobile, Spacious Table for Wide Desktop */}
        {!isWide ? (
          <View style={styles.mobileListContainer}>
            {isLeadsLoading && !combinedLeads.length ? (
              <View style={styles.loadingCard}>
                <ActivityIndicator size="large" color="#10B981" />
                <Text style={styles.loadingCardText}>Loading lead queue from server...</Text>
              </View>
            ) : isLeadsError && !combinedLeads.length ? (
              <View style={styles.errorCard}>
                <RotateCcw size={32} color="#EF4444" />
                <Text style={styles.errorTitle}>Server Reconnecting</Text>
                <Text style={styles.errorSub}>
                  {(leadsError as any)?.response?.data?.message || (leadsError as any)?.message || 'Connecting to Render cloud backend. Please tap below to retry.'}
                </Text>
                <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()} activeOpacity={0.8}>
                  <Text style={styles.retryBtnText}>Retry Fetching Leads</Text>
                </TouchableOpacity>
              </View>
            ) : filteredLeads.length === 0 ? (
              <View style={styles.emptyStateCard}>
                <Users size={36} color="#94A3B8" />
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
                    <Text style={styles.emptyResetBtnText}>Reset to All Campaigns</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={{
                    marginTop: 12,
                    backgroundColor: '#2563EB',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingVertical: 9,
                    paddingHorizontal: 14,
                    borderRadius: 8,
                  }}
                  onPress={() => navigation.navigate('UploadLeads')}
                  activeOpacity={0.8}
                >
                  <Plus size={14} color="#FFFFFF" strokeWidth={2.5} />
                  <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>
                    Upload Leads CSV
                  </Text>
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
                      <View style={[styles.avatarCircle, { backgroundColor: '#EEF2FF', width: 42, height: 42, borderRadius: 21 }]}>
                        <Text style={[styles.avatarText, { color: '#3730A3', fontSize: 13 }]}>{initials}</Text>
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
                          <Phone size={12} color="#047857" strokeWidth={2} />
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
                        <Users size={12} color="#94A3B8" />
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
                        <MessageCircle size={13} color="#15803D" strokeWidth={2.5} />
                        <Text style={styles.cardWhatsAppBtnText} numberOfLines={1}>WhatsApp</Text>
                      </TouchableOpacity>

                      {/* Open Lead Button */}
                      <TouchableOpacity
                        style={styles.cardOpenLeadBtn}
                        onPress={() => handleOpenLead(item)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.cardOpenLeadBtnText} numberOfLines={1}>Open Lead</Text>
                        <ArrowUpRight size={12} color="#2563EB" />
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
                  <Text style={[styles.thCell, { width: 230 }]}>LEAD</Text>
                  <Text style={[styles.thCell, { width: 220 }]}>CAMPAIGN</Text>
                  <Text style={[styles.thCell, { width: 120 }]}>STATUS</Text>
                  <Text style={[styles.thCell, { width: 100 }]}>PRIORITY</Text>
                  <Text style={[styles.thCell, { width: 110 }]}>LAST CONTACT</Text>
                  <Text style={[styles.thCell, { width: 140, textAlign: 'right' }]}>ACTION</Text>
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
                      <View style={[styles.tdCell, { width: 230, flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
                        <View style={[styles.avatarCircle, { backgroundColor: '#EEF2FF' }]}>
                          <Text style={[styles.avatarText, { color: '#3730A3' }]}>{initials}</Text>
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
                      <View style={[styles.tdCell, { width: 140, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }]}>
                        <TouchableOpacity
                          style={styles.directCallBtn}
                          onPress={() => handleDirectCall(item.phone, item.name, item._id, item.status)}
                          activeOpacity={0.7}
                          accessibilityLabel="Call Lead"
                        >
                          <Phone size={13} color="#047857" strokeWidth={2.5} />
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.directWhatsAppBtn}
                          onPress={() => handleOpenWhatsApp(item)}
                          activeOpacity={0.7}
                          accessibilityLabel="WhatsApp Lead"
                        >
                          <MessageCircle size={13} color="#16A34A" strokeWidth={2.5} />
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.openLeadBtn}
                          onPress={() => handleOpenLead(item)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.openLeadText}>Open lead</Text>
                          <ArrowUpRight size={11} color="#2563EB" />
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
              <Text style={styles.modalTitle}>Add Walk-in Lead</Text>
              <TouchableOpacity onPress={() => setShowWalkInModal(false)}>
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>FULL NAME</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Rahul Sharma"
                placeholderTextColor="#94A3B8"
                value={walkInName}
                onChangeText={setWalkInName}
              />

              <Text style={[styles.inputLabel, { marginTop: 12 }]}>PHONE NUMBER</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. 9876543210"
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
                value={walkInPhone}
                onChangeText={setWalkInPhone}
              />

              <TouchableOpacity
                style={styles.submitBtn}
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
                  <Text style={styles.submitBtnText}>Add to Queue</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
        visible={whatsAppModalData.visible}
        onClose={() => setWhatsAppModalData((prev) => ({ ...prev, visible: false }))}
        customerName={whatsAppModalData.name}
        customerPhone={whatsAppModalData.phone}
      />

      {/* NeoDove Automatic Post-Call Modal */}
      <NeoPostCallModal
        visible={postCallData.visible}
        lead={postCallData.lead}
        callResult={postCallData.callResult}
        onClose={() => setPostCallData((prev) => ({ ...prev, visible: false }))}
        onSaveDisposition={handleSavePostCallDisposition}
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
    paddingBottom: 110,
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
  bannerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  walkInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  walkInText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  startCallingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 8,
    gap: 6,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  startCallingText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  searchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 42,
    minHeight: 42,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
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
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 42,
    minHeight: 42,
    gap: 6,
  },
  campaignSelectText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  exportIconBtn: {
    width: 42,
    height: 42,
    minHeight: 42,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownMenu: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingVertical: 6,
    marginBottom: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  dropdownItem: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  dropdownText: {
    fontSize: 12,
    color: '#475569',
  },
  dropdownTextActive: {
    fontWeight: '700',
    color: '#2563EB',
  },
  filterPillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 20,
    gap: 6,
  },
  filterPillActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  filterPillLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  filterPillLabelActive: {
    color: '#2563EB',
    fontWeight: '700',
  },
  filterCountBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  filterCountBadgeActive: {
    backgroundColor: '#DBEAFE',
  },
  filterCountText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  filterCountTextActive: {
    color: '#1D4ED8',
  },
  tableCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 11,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  thCell: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.4,
  },
  tableDataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  tdCell: {
    justifyContent: 'center',
  },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 11,
    fontWeight: '700',
  },
  leadNameText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  leadPhoneText: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
  campaignTitleText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0F172A',
  },
  campaignSubtitleText: {
    fontSize: 9,
    color: '#94A3B8',
    marginTop: 2,
  },
  statusPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  priorityPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  priorityPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  lastContactText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
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
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    gap: 3,
    height: 28,
  },
  openLeadText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },
  tableFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#FAFAFA',
  },
  tableFooterCount: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  tableFooterStatus: {
    fontSize: 11,
    color: '#94A3B8',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
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
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalBody: {
    gap: 4,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.4,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: '#0F172A',
    marginTop: 4,
  },
  submitBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 18,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  bannerRowMobile: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 12,
  },
  bannerTitleBlockMobile: {
    width: '100%',
  },
  bannerActionsMobile: {
    width: '100%',
    flexDirection: 'row',
    gap: 8,
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
    gap: 8,
  },
  searchInputWrapMobile: {
    width: '100%',
    height: 42,
    minHeight: 42,
  },
  filterControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterControlsRowMobile: {
    width: '100%',
    justifyContent: 'space-between',
  },
  campaignSelectBtnMobile: {
    flex: 1,
  },
  mobileListContainer: {
    gap: 12,
    marginTop: 2,
  },
  mobileLeadCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  cardLeadInfo: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  cardLeadName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
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
    color: '#047857',
  },
  cardBadgesCol: {
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  cardCampaignBadge: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  cardCampaignBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  cardMetaDot: {
    fontSize: 11,
    color: '#CBD5E1',
  },
  cardMetaText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  cardAgentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  cardAgentText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  cardActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  cardCallBtn: {
    flex: 1,
    minWidth: 0,
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    borderRadius: 8,
    paddingHorizontal: 4,
    gap: 4,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
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
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 8,
    paddingHorizontal: 4,
    gap: 4,
  },
  cardWhatsAppBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
  cardOpenLeadBtn: {
    flex: 1.15,
    minWidth: 0,
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 8,
    paddingHorizontal: 4,
    gap: 3,
  },
  cardOpenLeadBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },
  mobileFooterSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  emptyStateCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 8,
  },
  emptyStateSubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    maxWidth: 260,
  },
  emptyResetBtn: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  emptyResetBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
  },
  activeWorkspaceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  activeWorkspaceIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeWorkspaceTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#065F46',
  },
  activeWorkspaceSub: {
    fontSize: 11,
    color: '#047857',
    marginTop: 1,
  },
  switchCampBtn: {
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  switchCampBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  loadingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 36,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingCardText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  errorCard: {
    backgroundColor: '#FEF2F2',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  errorTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#DC2626',
  },
  errorSub: {
    fontSize: 12,
    color: '#7F1D1D',
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 17,
  },
  retryBtn: {
    marginTop: 8,
    backgroundColor: '#DC2626',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
