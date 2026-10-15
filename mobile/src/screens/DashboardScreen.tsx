import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  Platform,
  StatusBar as RNStatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import {
  Users,
  Layers,
  UploadCloud,
  SlidersHorizontal,
  UserPlus,
  Plus,
  Edit2,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Shield,
  Trash2,
  Check,
  MapPin,
  Trophy,
  Target,
  TrendingUp,
  ArrowUpRight,
  PhoneCall,
  Download,
  Menu,
  Phone,
} from 'lucide-react-native';

import { downloadOrShareCsv, SAMPLE_LEADS_TEMPLATE_CSV } from '../utils/csvDownloader';
import { useAuthStore } from '../store/authStore';
import { useSidebarStore } from '../store/sidebarStore';
import {
  fetchUsers,
  createUser,
  updateUser,
  fetchCampaigns,
  createCampaign,
  updateCampaign,
  fetchPipelines,
  uploadLeadsCsv,
  fetchAdminSettings,
  updateAdminSettings,
  fetchRetryRules,
  updateRetryRule,
  fetchDashboardReports,
  fetchUserCallsReport,
  fetchBranches,
} from '../api/leadApi';
import {
  User,
  UserRole,
  Campaign,
  Pipeline,
  RetryRule,
  CampaignPriority,
  DistributionMode,
  DuplicateMode,
  QuestionType,
  EngagementQuestion,
} from '../types';
import { CrmBadge } from '../components/CrmBadge';
import { CrmAvatar } from '../components/CrmAvatar';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { EmptyState } from '../components/EmptyState';

type AdminTab = 'USERS' | 'CAMPAIGNS' | 'UPLOAD' | 'SETTINGS';

export const DashboardScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const isManager = user?.role === 'MANAGER';
  const isAdmin = user?.role === 'ADMIN';
  const isAgent = user?.role === 'AGENT';

  const [activeTab, setActiveTab] = useState<AdminTab>('USERS');
  const [selectedBranch, setSelectedBranch] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'REPORT' | 'MANAGEMENT'>('REPORT');
  const [reportSubTab, setReportSubTab] = useState<'CALL_REPORT' | 'LOGIN_REPORT'>('CALL_REPORT');

  const { data: branchesData } = useQuery({
    queryKey: ['adminBranches'],
    queryFn: fetchBranches,
    enabled: !isAgent,
  });
  const branchesList = branchesData?.branches || [];
  const availableBranchNames = useMemo(() => {
    const fromApi = (branchesList || []).map((b) => b.name);
    const defaults = ['Trichy', 'Pudukkottai', 'Chennai', 'Madurai'];
    return Array.from(new Set([...defaults, ...fromApi])).filter(Boolean);
  }, [branchesList]);

  const { data: dashboardReportsData } = useQuery({
    queryKey: ['adminDashboardReports'],
    queryFn: () => fetchDashboardReports({}),
    enabled: !isAgent,
  });

  const { data: userCallsReportData } = useQuery({
    queryKey: ['adminUserCallsReport'],
    queryFn: () => fetchUserCallsReport(),
    enabled: !isAgent,
  });

  if (isAgent) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: '#FFE4E6', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          <AlertCircle size={36} color="#DC2626" />
        </View>
        <Text style={{ fontSize: 18, fontWeight: '800', color: '#0F172A', marginBottom: 8, textAlign: 'center' }}>
          Management Access Restricted
        </Text>
        <Text style={{ fontSize: 13, color: '#64748B', textAlign: 'center', lineHeight: 20, marginBottom: 24, maxWidth: 320 }}>
          The administration dashboard and team management controls are restricted to administrators. You can view your personal calling performance in My Report.
        </Text>
        <TouchableOpacity
          style={{ backgroundColor: '#0F9D58', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 }}
          onPress={() => navigation.navigate('AgentReports')}
          activeOpacity={0.8}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>Go to My Call Report</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const callsAttempted = dashboardReportsData?.callsMade ?? 0;
  const callsConnected = dashboardReportsData?.connectedCalls ?? 0;
  const totalDurationSec =
    userCallsReportData?.agents?.reduce((sum, a) => sum + (a.totalDurationSeconds || 0), 0) || 0;
  const avgDurationSec = callsConnected > 0 ? Math.round(totalDurationSec / callsConnected) : 0;

  const formatHoursMinutes = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m`;
  };

  const formatMinutesSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
  };

  const filteredAgentLeaderboard = useMemo(() => {
    const list = userCallsReportData?.agents || [];
    const filtered =
      selectedBranch === 'ALL'
        ? list
        : list.filter((a) => (a.branch || 'Trichy').toLowerCase() === selectedBranch.toLowerCase());
    return [...filtered].sort((a, b) => (b.calls || 0) - (a.calls || 0)).slice(0, 3);
  }, [userCallsReportData, selectedBranch]);

  // ========================================== 
  // 1. USERS SECTION STATE
  // ==========================================
  const [showAddUserModal, setShowAddUserModal] = useState<boolean>(false);
  const [newUserName, setNewUserName] = useState<string>('');
  const [newUserEmail, setNewUserEmail] = useState<string>('');
  const [newUserPhone, setNewUserPhone] = useState<string>('');
  const [newUserPassword, setNewUserPassword] = useState<string>('');
  const [newUserRole, setNewUserRole] = useState<UserRole>(isManager ? 'AGENT' : 'MANAGER');
  const [newUserBranch, setNewUserBranch] = useState<string>(user?.branch || 'Trichy');
  const [newUserCanReceive, setNewUserCanReceive] = useState<boolean>(true);

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['adminUsers'],
    queryFn: () => fetchUsers(),
  });
  const usersList: User[] = usersData?.users || [];

  const scopedUsersList = useMemo(() => {
    if (isManager && user?.branch) {
      return usersList.filter((u) => u.branch === user.branch && u.role === 'AGENT');
    }
    return usersList;
  }, [usersList, isManager, user]);

  const createUserMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      setShowAddUserModal(false);
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPhone('');
      setNewUserPassword('');
      if (Platform.OS === 'web') {
        window.alert('Agent Created: New agent user added successfully.');
      } else {
        Alert.alert('Agent Created', 'New agent user added successfully.');
      }
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to create user';
      if (Platform.OS === 'web') {
        window.alert(`Error: ${msg}`);
      } else {
        Alert.alert('Error', msg);
      }
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<User> }) => updateUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to update user';
      if (Platform.OS === 'web') {
        window.alert(`Update Failed: ${msg}`);
      } else {
        Alert.alert('Update Failed', msg);
      }
    },
  });

  // ==========================================
  // 2. CAMPAIGNS SECTION STATE
  // ==========================================
  const [showCampaignModal, setShowCampaignModal] = useState<boolean>(false);
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const [campName, setCampName] = useState<string>('');
  const [campPipelineId, setCampPipelineId] = useState<string>('');
  const [campPriority, setCampPriority] = useState<CampaignPriority>('MEDIUM');
  const [campDistribution, setCampDistribution] = useState<DistributionMode>('EQUAL');
  const [campDuplicate, setCampDuplicate] = useState<DuplicateMode>('SKIP');
  const [campSelectedAgentIds, setCampSelectedAgentIds] = useState<string[]>([]);
  const [campQuestions, setCampQuestions] = useState<EngagementQuestion[]>([]);

  const { data: campaignsData, isLoading: campaignsLoading } = useQuery({
    queryKey: ['adminCampaigns'],
    queryFn: fetchCampaigns,
  });
  const campaignsList: Campaign[] = campaignsData?.campaigns || [];

  const { data: pipelinesData } = useQuery({
    queryKey: ['adminPipelines'],
    queryFn: fetchPipelines,
  });
  const pipelinesList: Pipeline[] = pipelinesData?.pipelines || [];

  const saveCampaignMutation = useMutation({
    mutationFn: async () => {
      const payload: Partial<Campaign> = {
        name: campName.trim(),
        pipelineId: campPipelineId,
        priority: campPriority,
        distributionMode: campDistribution,
        duplicateMode: campDuplicate,
        agentIds: campSelectedAgentIds,
        engagementForm: campQuestions,
      };

      if (editingCampaignId) {
        return updateCampaign(editingCampaignId, payload);
      } else {
        return createCampaign(payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminCampaigns'] });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      setShowCampaignModal(false);
      setEditingCampaignId(null);
      if (Platform.OS === 'web') {
        window.alert('Success: Campaign saved successfully.');
      } else {
        Alert.alert('Success', 'Campaign saved successfully.');
      }
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to save campaign';
      if (Platform.OS === 'web') {
        window.alert(`Error: ${msg}`);
      } else {
        Alert.alert('Error', msg);
      }
    },
  });

  const openNewCampaignModal = () => {
    setEditingCampaignId(null);
    setCampName('');
    setCampPipelineId(pipelinesList[0]?._id || '');
    setCampPriority('MEDIUM');
    setCampDistribution('EQUAL');
    setCampDuplicate('SKIP');
    setCampSelectedAgentIds([]);
    setCampQuestions([]);
    setShowCampaignModal(true);
  };

  const openEditCampaignModal = (camp: Campaign) => {
    setEditingCampaignId(camp._id);
    setCampName(camp.name);
    setCampPipelineId(camp.pipelineId);
    setCampPriority(camp.priority);
    setCampDistribution(camp.distributionMode);
    setCampDuplicate(camp.duplicateMode);
    setCampSelectedAgentIds(camp.agentIds || []);
    setCampQuestions(camp.engagementForm || []);
    setShowCampaignModal(true);
  };

  const addEngagementQuestion = (type: QuestionType) => {
    const newQ: EngagementQuestion = {
      id: `q_${Date.now()}`,
      type,
      label: `New ${type.toLowerCase()} question`,
      options:
        type === 'MULTIPLE_CHOICE' || type === 'CHECKBOX' || type === 'DROPDOWN'
          ? ['Option A', 'Option B']
          : [],
      required: false,
    };
    setCampQuestions([...campQuestions, newQ]);
  };

  const removeEngagementQuestion = (id: string) => {
    setCampQuestions(campQuestions.filter((q) => q.id !== id));
  };

  // ==========================================
  // 3. CSV UPLOAD SECTION STATE
  // ==========================================
  const [uploadCampaignId, setUploadCampaignId] = useState<string | null>(null);
  const [uploadTargetAgentId, setUploadTargetAgentId] = useState<string | null>(null);
  const [pickedFile, setPickedFile] = useState<{
    name: string;
    uri: string;
    size?: number;
    mimeType?: string;
    file?: File;
  } | null>(null);

  const [uploadResult, setUploadResult] = useState<{
    created: number;
    merged: number;
    skipped: number;
    failed: Array<{ row: unknown; reason: string }>;
  } | null>(null);

  const handlePickDocument = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel', '*/*'],
        copyToCacheDirectory: true,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        const asset = res.assets[0];
        setPickedFile({
          name: asset.name,
          uri: asset.uri,
          size: asset.size,
          mimeType: asset.mimeType,
          file: (asset as any).file,
        });
        setUploadResult(null);
      }
    } catch (err) {
      console.warn('Document picker error:', err);
    }
  };

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!uploadCampaignId) throw new Error('Please select a campaign');
      if (!pickedFile) throw new Error('Please pick a CSV file');

      const formData = new FormData();

      if (uploadTargetAgentId) {
        formData.append('targetAgentId', uploadTargetAgentId);
      }

      if (Platform.OS === 'web') {
        if (pickedFile.file) {
          formData.append('file', pickedFile.file);
        } else {
          const resp = await fetch(pickedFile.uri);
          const blob = await resp.blob();
          formData.append('file', blob, pickedFile.name);
        }
      } else {
        formData.append('file', {
          uri: pickedFile.uri,
          name: pickedFile.name,
          type: pickedFile.mimeType || 'text/csv',
        } as any);
      }

      return uploadLeadsCsv(uploadCampaignId, formData);
    },
    onSuccess: (data) => {
      setUploadResult(data);
      queryClient.invalidateQueries({ queryKey: ['myLeads'] });
      queryClient.invalidateQueries({ queryKey: ['adminCampaigns'] });
      const msg = `Created: ${data.created}, Merged: ${data.merged}, Skipped: ${data.skipped}`;
      if (Platform.OS === 'web') {
        window.alert(`Upload Processed: ${msg}`);
      } else {
        Alert.alert('Upload Processed', msg);
      }
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'CSV upload failed';
      if (Platform.OS === 'web') {
        window.alert(`Upload Failed: ${msg}`);
      } else {
        Alert.alert('Upload Failed', msg);
      }
    },
  });

  // ==========================================
  // 4. SETTINGS & RETRY RULES SECTION STATE
  // ==========================================
  const { data: settingsData } = useQuery({
    queryKey: ['adminSettings'],
    queryFn: fetchAdminSettings,
  });

  const { data: retryRulesData } = useQuery({
    queryKey: ['adminRetryRules'],
    queryFn: fetchRetryRules,
  });

  const currentSettings = settingsData?.settings;
  const retryRulesList: RetryRule[] = retryRulesData?.retryRules || [];

  const updateSettingsMutation = useMutation({
    mutationFn: updateAdminSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminSettings'] });
      queryClient.invalidateQueries({ queryKey: ['publicSettings'] });
      if (Platform.OS === 'web') {
        window.alert('Settings Saved: Organization follow-up policies updated.');
      } else {
        Alert.alert('Settings Saved', 'Organization follow-up policies updated.');
      }
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to save settings';
      if (Platform.OS === 'web') {
        window.alert(`Error: ${msg}`);
      } else {
        Alert.alert('Error', msg);
      }
    },
  });

  const toggleRetryRuleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      updateRetryRule(id, { enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminRetryRules'] });
      queryClient.invalidateQueries({ queryKey: ['retryRules'] });
    },
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF', paddingTop: Platform.OS === 'android' ? 6 : 0 }} edges={['top']}>
      <RNStatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />
      {/* Top Header - Clean Minimal */}
      <View style={{ backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB', paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={() => useSidebarStore.getState().toggleDrawer()} style={{ padding: 4 }}>
            <Menu size={22} color="#6B7280" />
          </TouchableOpacity>
          <Text style={{ fontSize: 16, fontWeight: '500', color: '#1F2937' }}>
            {viewMode === 'REPORT' ? 'My Report' : 'Management'}
          </Text>
        </View>

        {(isManager || isAdmin) && (
          <TouchableOpacity
            onPress={() => setViewMode(viewMode === 'REPORT' ? 'MANAGEMENT' : 'REPORT')}
            style={{ backgroundColor: '#E6F4EA', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB' }}
          >
            <Text style={{ color: '#0F9D58', fontSize: 12, fontWeight: '500' }}>
              {viewMode === 'REPORT' ? '⚙️ Management' : '📊 My Report'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Segmented Top Navigation Tabs (Shown in MANAGEMENT mode) */}
      {viewMode === 'MANAGEMENT' && (
        <View style={{ paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}>
          <View style={{ flexDirection: 'row', backgroundColor: '#F9FAFB', padding: 3, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB' }}>
            {(
              [
                { label: 'Team', value: 'USERS', icon: Users },
                { label: 'Campaigns', value: 'CAMPAIGNS', icon: Layers },
                { label: 'Upload CSV', value: 'UPLOAD', icon: UploadCloud },
                { label: 'Settings', value: 'SETTINGS', icon: SlidersHorizontal },
              ] as Array<{ label: string; value: AdminTab; icon: any }>
            ).map((tab) => {
              const isSelected = activeTab === tab.value;
              const Icon = tab.icon;
              return (
                <TouchableOpacity
                  key={tab.value}
                  onPress={() => setActiveTab(tab.value)}
                  activeOpacity={0.8}
                  style={{
                    flex: 1,
                    paddingVertical: 8,
                    borderRadius: 6,
                    alignItems: 'center',
                    flexDirection: 'row',
                    justifyContent: 'center',
                    gap: 6,
                    backgroundColor: isSelected ? '#E6F4EA' : 'transparent',
                  }}
                >
                  <Icon size={14} color={isSelected ? '#0F9D58' : '#6B7280'} />
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: isSelected ? '500' : '400',
                      color: isSelected ? '#0F9D58' : '#6B7280',
                    }}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 110, backgroundColor: '#FFFFFF' }} showsVerticalScrollIndicator={false}>
        {/* =========================================================================
            CLEAN MINIMAL "MY REPORT" SCREEN
           ========================================================================= */}
        {viewMode === 'REPORT' && (
          <View style={{ marginBottom: 20 }}>
            {/* Top Date Range Banner */}
            <View
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 12,
                borderWidth: 1,
                borderColor: '#E5E7EB',
                paddingVertical: 12,
                paddingHorizontal: 16,
                marginBottom: 16,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: '#1F2937', fontWeight: '500', fontSize: 13.5, letterSpacing: 0.2 }}>
                FROM 01-10-2026 - TO 10-10-2026
              </Text>
              <Text style={{ color: '#6B7280', fontWeight: '400', fontSize: 12, marginTop: 3 }}>
                Duration : 10 Day(s)
              </Text>
            </View>

            {/* 4 Clean Minimal Metric Cards (2x2 Grid) */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
              {/* Card 1: Calls Attempted */}
              <View
                style={{
                  flex: 1,
                  minWidth: '46%',
                  backgroundColor: '#FFFFFF',
                  borderRadius: 12,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: '#E5E7EB',
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: '#6B7280', fontWeight: '400', fontSize: 12 }}>
                    Calls Attempted
                  </Text>
                  <Phone size={18} color="#6B7280" />
                </View>
                <Text style={{ color: '#1F2937', fontWeight: '500', fontSize: 20, marginTop: 8 }}>
                  {callsAttempted}
                </Text>
              </View>

              {/* Card 2: Calls Connected */}
              <View
                style={{
                  flex: 1,
                  minWidth: '46%',
                  backgroundColor: '#FFFFFF',
                  borderRadius: 12,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: '#E5E7EB',
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: '#6B7280', fontWeight: '400', fontSize: 12 }}>
                    Calls Connected
                  </Text>
                  <PhoneCall size={18} color="#6B7280" />
                </View>
                <Text style={{ color: '#1F2937', fontWeight: '500', fontSize: 20, marginTop: 8 }}>
                  {callsConnected}
                </Text>
              </View>

              {/* Card 3: Call Time */}
              <View
                style={{
                  flex: 1,
                  minWidth: '46%',
                  backgroundColor: '#FFFFFF',
                  borderRadius: 12,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: '#E5E7EB',
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: '#6B7280', fontWeight: '400', fontSize: 12 }}>
                    Call Time
                  </Text>
                  <Clock size={18} color="#6B7280" />
                </View>
                <Text style={{ color: '#1F2937', fontWeight: '500', fontSize: 20, marginTop: 8 }}>
                  {formatHoursMinutes(totalDurationSec)}
                </Text>
              </View>

              {/* Card 4: Avg Call Duration */}
              <View
                style={{
                  flex: 1,
                  minWidth: '46%',
                  backgroundColor: '#FFFFFF',
                  borderRadius: 12,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: '#E5E7EB',
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: '#6B7280', fontWeight: '400', fontSize: 12 }}>
                    Avg Call Duration
                  </Text>
                  <TrendingUp size={18} color="#6B7280" />
                </View>
                <Text style={{ color: '#1F2937', fontWeight: '500', fontSize: 20, marginTop: 8 }}>
                  {formatMinutesSeconds(avgDurationSec)}
                </Text>
              </View>
            </View>

            {/* Segmented Bottom Tabs: Login Report | Call Report */}
            <View
              style={{
                flexDirection: 'row',
                backgroundColor: '#F9FAFB',
                borderRadius: 8,
                padding: 3,
                marginBottom: 16,
                borderWidth: 1,
                borderColor: '#E5E7EB',
              }}
            >
              <TouchableOpacity
                style={{
                  flex: 1,
                  paddingVertical: 8,
                  alignItems: 'center',
                  borderRadius: 6,
                  backgroundColor: reportSubTab === 'LOGIN_REPORT' ? '#E6F4EA' : 'transparent',
                }}
                onPress={() => setReportSubTab('LOGIN_REPORT')}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: reportSubTab === 'LOGIN_REPORT' ? '500' : '400',
                    color: reportSubTab === 'LOGIN_REPORT' ? '#0F9D58' : '#6B7280',
                  }}
                >
                  Login Report
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{
                  flex: 1,
                  paddingVertical: 8,
                  alignItems: 'center',
                  borderRadius: 6,
                  backgroundColor: reportSubTab === 'CALL_REPORT' ? '#E6F4EA' : 'transparent',
                }}
                onPress={() => setReportSubTab('CALL_REPORT')}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: reportSubTab === 'CALL_REPORT' ? '500' : '400',
                    color: reportSubTab === 'CALL_REPORT' ? '#0F9D58' : '#6B7280',
                  }}
                >
                  Call Report
                </Text>
              </TouchableOpacity>
            </View>

            {/* Content of Sub Tab */}
            {reportSubTab === 'CALL_REPORT' ? (
              <View style={{ gap: 10 }}>
                {[
                  { date: '10-10-2026', attempted: 12, connected: 9, duration: '00h 25m', connectRate: '75%' },
                  { date: '09-10-2026', attempted: 8, connected: 6, duration: '00h 18m', connectRate: '75%' },
                  { date: '08-10-2026', attempted: 4, connected: 3, duration: '00h 08m', connectRate: '75%' },
                ].map((day) => (
                  <View
                    key={day.date}
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: 12,
                      padding: 14,
                      borderWidth: 1,
                      borderColor: '#E5E7EB',
                    }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text style={{ fontWeight: '500', fontSize: 13.5, color: '#1F2937' }}>{day.date}</Text>
                      <View style={{ backgroundColor: '#E6F4EA', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                        <Text style={{ color: '#0F9D58', fontSize: 11, fontWeight: '500' }}>{day.connectRate} Connected</Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                      <Text style={{ fontSize: 12, color: '#6B7280' }}>Attempted: <Text style={{ fontWeight: '500', color: '#1F2937' }}>{day.attempted}</Text></Text>
                      <Text style={{ fontSize: 12, color: '#6B7280' }}>Connected: <Text style={{ fontWeight: '500', color: '#0F9D58' }}>{day.connected}</Text></Text>
                      <Text style={{ fontSize: 12, color: '#6B7280' }}>Duration: <Text style={{ fontWeight: '500', color: '#1F2937' }}>{day.duration}</Text></Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={{ gap: 10 }}>
                {scopedUsersList.slice(0, 5).map((u) => (
                  <View
                    key={u._id}
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: 12,
                      padding: 14,
                      borderWidth: 1,
                      borderColor: '#E5E7EB',
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <View>
                      <Text style={{ fontWeight: '500', fontSize: 13.5, color: '#1F2937' }}>{u.name}</Text>
                      <Text style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{u.branch || 'Trichy'} Branch · {u.role}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#0F9D58' }} />
                        <Text style={{ fontSize: 11, fontWeight: '500', color: '#0F9D58' }}>Logged In</Text>
                      </View>
                      <Text style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>Today at 09:30 AM</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* =========================================================================
            EXECUTIVE DASHBOARD: Branch Selector, 4 KPIs, Funnel, Leaderboard (Management Mode)
           ========================================================================= */}
        {viewMode === 'MANAGEMENT' && (
          <View style={{ gap: 16 }}>
          <View style={{ marginBottom: 20 }}>
          {/* Branch Pill Selector */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}
          >
            {['ALL', ...availableBranchNames].map((br) => {
              const isSelected = selectedBranch.toLowerCase() === br.toLowerCase();
              return (
                <TouchableOpacity
                  key={br}
                  onPress={() => setSelectedBranch(br)}
                  activeOpacity={0.7}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 8,
                    backgroundColor: isSelected ? '#059669' : '#FFFFFF',
                    borderWidth: 1,
                    borderColor: isSelected ? '#059669' : '#E2E8F0',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11.5,
                      fontWeight: '700',
                      color: isSelected ? '#FFFFFF' : '#64748B',
                    }}
                  >
                    {br === 'ALL' ? 'All Branches' : `${br} Branch`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* 4 KPI Cards Grid */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
            {/* Card 1: Total Leads */}
            <View
              style={{
                flex: 1,
                minWidth: '45%',
                backgroundColor: '#FFFFFF',
                borderRadius: 14,
                padding: 14,
                borderWidth: 1,
                borderColor: '#E2E8F0',
              }}
            >
              <Text style={{ fontSize: 10.5, fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>
                Total Leads
              </Text>
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#0F172A', marginTop: 4 }}>
                {dashboardReportsData?.totalLeads ?? 0}
              </Text>
              <Text style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>In active pipeline</Text>
            </View>

            {/* Card 2: Calls Made */}
            <View
              style={{
                flex: 1,
                minWidth: '45%',
                backgroundColor: '#FFFFFF',
                borderRadius: 14,
                padding: 14,
                borderWidth: 1,
                borderColor: '#E2E8F0',
              }}
            >
              <Text style={{ fontSize: 10.5, fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>
                Calls Dialed
              </Text>
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#10B981', marginTop: 4 }}>
                {dashboardReportsData?.callsMade ?? 0}
              </Text>
              <Text style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>Today across team</Text>
            </View>

            {/* Card 3: Connect Rate */}
            <View
              style={{
                flex: 1,
                minWidth: '45%',
                backgroundColor: '#FFFFFF',
                borderRadius: 14,
                padding: 14,
                borderWidth: 1,
                borderColor: '#E2E8F0',
              }}
            >
              <Text style={{ fontSize: 10.5, fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>
                Connect Rate
              </Text>
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#4F46E5', marginTop: 4 }}>
                {dashboardReportsData?.callsMade && dashboardReportsData.callsMade > 0
                  ? ((dashboardReportsData.connectedCalls / dashboardReportsData.callsMade) * 100).toFixed(1) + '%'
                  : '0%'}
              </Text>
              <Text style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>
                {dashboardReportsData?.connectedCalls ?? 0} connected
              </Text>
            </View>

            {/* Card 4: Callbacks Due */}
            <View
              style={{
                flex: 1,
                minWidth: '45%',
                backgroundColor: '#FFFFFF',
                borderRadius: 14,
                padding: 14,
                borderWidth: 1,
                borderColor: '#E2E8F0',
              }}
            >
              <Text style={{ fontSize: 10.5, fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>
                Callbacks Due
              </Text>
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#D97706', marginTop: 4 }}>
                {dashboardReportsData?.followUpsDueToday ?? 0}
              </Text>
              <Text style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>Scheduled for today</Text>
            </View>
          </View>

          {/* Horizontal Funnel Visualization */}
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 14,
              padding: 14,
              borderWidth: 1,
              borderColor: '#E2E8F0',
              marginBottom: 14,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <TrendingUp size={15} color="#4F46E5" />
                <Text style={{ fontSize: 12, fontWeight: '800', color: '#0F172A', letterSpacing: 0.3 }}>
                  CONVERSION FUNNEL
                </Text>
              </View>
              <Text style={{ fontSize: 10.5, color: '#64748B', fontWeight: '600' }}>Live Pipeline</Text>
            </View>

            {/* Horizontal Segments Row */}
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {[
                { name: 'New', count: dashboardReportsData?.leadsByStage?.find(s => s.stage === 'New')?.count ?? 0, color: '#3B82F6', flex: 1.2 },
                { name: 'Contacted', count: dashboardReportsData?.leadsByStage?.find(s => s.stage === 'Contacted')?.count ?? 0, color: '#F59E0B', flex: 1 },
                { name: 'Interested', count: dashboardReportsData?.leadsByStage?.find(s => s.stage === 'Interested')?.count ?? 0, color: '#10B981', flex: 0.8 },
                { name: 'Converted', count: dashboardReportsData?.leadsByStage?.find(s => s.stage === 'Converted')?.count ?? 0, color: '#059669', flex: 0.6 },
              ].map((stage, idx, arr) => (
                <View
                  key={stage.name}
                  style={{
                    flex: stage.flex,
                    backgroundColor: '#F8FAFC',
                    borderRadius: 8,
                    padding: 8,
                    borderLeftWidth: 3,
                    borderLeftColor: stage.color,
                    borderWidth: 1,
                    borderColor: '#E2E8F0',
                  }}
                >
                  <Text style={{ fontSize: 9.5, fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>
                    {stage.name}
                  </Text>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: '#0F172A', marginTop: 2 }}>
                    {stage.count}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Leaderboard with Medal Badges (🥇, 🥈, 🥉) */}
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 14,
              padding: 14,
              borderWidth: 1,
              borderColor: '#E2E8F0',
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Trophy size={15} color="#D97706" />
                <Text style={{ fontSize: 12, fontWeight: '800', color: '#0F172A', letterSpacing: 0.3 }}>
                  TOP AGENTS LEADERBOARD
                </Text>
              </View>
              <Text style={{ fontSize: 10.5, color: '#64748B', fontWeight: '600' }}>Today's Output</Text>
            </View>

            {filteredAgentLeaderboard.length === 0 ? (
              <Text style={{ fontSize: 11.5, color: '#94A3B8', textAlign: 'center', paddingVertical: 8 }}>
                No agent calling activity recorded yet today.
              </Text>
            ) : (
              <View style={{ gap: 8 }}>
                {filteredAgentLeaderboard.map((agent, index) => {
                  const medals = ['🥇 1st', '🥈 2nd', '🥉 3rd'];
                  const medalBadge = medals[index] || `#${index + 1}`;
                  const cRate =
                    agent.calls > 0
                      ? ((agent.connected / agent.calls) * 100).toFixed(0) + '%'
                      : '0%';

                  return (
                    <View
                      key={agent.userId || agent.email}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        backgroundColor: index === 0 ? '#FEFCE8' : '#F8FAFC',
                        borderRadius: 10,
                        paddingVertical: 8,
                        paddingHorizontal: 10,
                        borderWidth: 1,
                        borderColor: index === 0 ? '#FEF08A' : '#E2E8F0',
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={{ fontSize: 13, fontWeight: '800' }}>{medalBadge}</Text>
                        <View>
                          <Text style={{ fontSize: 12.5, fontWeight: '800', color: '#0F172A' }}>
                            {agent.name}
                          </Text>
                          <Text style={{ fontSize: 10.5, color: '#64748B' }}>
                            {agent.branch || 'Trichy'} Branch
                          </Text>
                        </View>
                      </View>

                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={{ fontSize: 12.5, fontWeight: '800', color: '#10B981' }}>
                            {agent.calls} Calls
                          </Text>
                          <Text style={{ fontSize: 10, color: '#64748B' }}>{cRate} Connected</Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </View>

        {/* =========================================================================
            1. USERS MANAGEMENT TAB
           ========================================================================= */}
        {activeTab === 'USERS' && (
          <View>
            <View className="flex-row justify-between items-center mb-3">
              <View>
                <Text className="text-slate-900 font-bold text-base">
                  {isManager
                    ? `${user?.branch || ''} Branch Agents (${scopedUsersList.length})`
                    : `Team Members (${usersList.length})`}
                </Text>
                <Text className="text-slate-500 text-xs font-medium">
                  {isManager
                    ? `Active calling agents in ${user?.branch || 'your'} branch`
                    : 'Active calling agents and privileges'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowAddUserModal(true)}
                activeOpacity={0.8}
                className="bg-indigo-600 px-3 py-2 rounded-xl flex-row items-center gap-1.5 shadow-sm active:bg-indigo-700"
              >
                <Plus size={14} color="#FFFFFF" strokeWidth={2.5} />
                <Text className="text-white font-bold text-xs">
                  {isManager ? `Add ${user?.branch || ''} Agent` : 'Add Member'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Add User Modal / Form */}
            {showAddUserModal && (
              <View className="mb-4 bg-white rounded-2xl p-4 border border-indigo-200 shadow-sm">
                <View className="flex-row justify-between items-center mb-3">
                  <Text className="text-slate-900 font-bold text-sm">
                    {isManager ? `Add ${user?.branch || ''} Agent` : 'Add New Member'}
                  </Text>
                  <TouchableOpacity onPress={() => setShowAddUserModal(false)}>
                    <Text className="text-slate-500 text-xs font-bold">✕ Close</Text>
                  </TouchableOpacity>
                </View>

                <Input
                  label="Agent Full Name"
                  placeholder="e.g. Ramesh Kumar"
                  value={newUserName}
                  onChangeText={setNewUserName}
                />
                <Input
                  label="Email Address"
                  placeholder="ramesh@company.com"
                  value={newUserEmail}
                  onChangeText={setNewUserEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <Input
                  label="Mobile Phone"
                  placeholder="10-digit number"
                  value={newUserPhone}
                  onChangeText={setNewUserPhone}
                  keyboardType="phone-pad"
                />
                <Input
                  label="Initial Password"
                  placeholder="Min 6 characters"
                  value={newUserPassword}
                  onChangeText={setNewUserPassword}
                  isPassword
                />

                {/* Role Picker (Manager vs Agent) */}
                <View className="mb-3">
                  <Text className="text-slate-700 text-xs font-bold mb-1.5">Select Role</Text>
                  {isManager ? (
                    <View className="bg-indigo-50 border border-indigo-200 py-2.5 px-3 rounded-xl flex-row items-center gap-2">
                      <Users size={14} color="#4F46E5" />
                      <Text className="text-indigo-900 text-xs font-bold">
                        Agent (Telecaller) · Scoped to {user?.branch || 'your'} branch
                      </Text>
                    </View>
                  ) : (
                    <View className="flex-row gap-2">
                      <TouchableOpacity
                        onPress={() => setNewUserRole('MANAGER')}
                        className={`flex-1 py-2 px-3 rounded-xl border flex-row items-center justify-center gap-1.5 ${
                          newUserRole === 'MANAGER'
                            ? 'bg-amber-50 border-amber-300'
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <Shield size={13} color={newUserRole === 'MANAGER' ? '#D97706' : '#64748B'} />
                        <Text
                          className={`text-xs font-bold ${
                            newUserRole === 'MANAGER' ? 'text-amber-800' : 'text-slate-600'
                          }`}
                        >
                          Manager (Branch Head)
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => setNewUserRole('AGENT')}
                        className={`flex-1 py-2 px-3 rounded-xl border flex-row items-center justify-center gap-1.5 ${
                          newUserRole === 'AGENT'
                            ? 'bg-indigo-50 border-indigo-300'
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <Users size={13} color={newUserRole === 'AGENT' ? '#4F46E5' : '#64748B'} />
                        <Text
                          className={`text-xs font-bold ${
                            newUserRole === 'AGENT' ? 'text-indigo-800' : 'text-slate-600'
                          }`}
                        >
                          Agent (Telecaller)
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* Branch Assignment Picker */}
                <View className="mb-3">
                  <Text className="text-slate-700 text-xs font-bold mb-1.5">Assign Branch</Text>
                  {isManager ? (
                    <View className="bg-teal-50 border border-teal-200 py-2.5 px-3 rounded-xl flex-row items-center gap-2">
                      <MapPin size={14} color="#0D9488" />
                      <Text className="text-teal-900 text-xs font-bold">
                        {user?.branch || 'Trichy'} Branch (Locked to your branch)
                      </Text>
                    </View>
                  ) : (
                    <View className="flex-row flex-wrap gap-2">
                      {availableBranchNames.map((b) => {
                        const isSelected = newUserBranch === b;
                        return (
                          <TouchableOpacity
                            key={b}
                            onPress={() => setNewUserBranch(b)}
                            className={`py-1.5 px-3 rounded-lg border flex-row items-center gap-1 ${
                              isSelected
                                ? 'bg-teal-50 border-teal-300'
                                : 'bg-slate-50 border-slate-200'
                            }`}
                          >
                            <MapPin size={11} color={isSelected ? '#0D9488' : '#64748B'} />
                            <Text
                              className={`text-xs font-semibold ${
                                isSelected ? 'text-teal-900 font-bold' : 'text-slate-600'
                              }`}
                            >
                              {b}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>

                {(isManager || newUserRole === 'AGENT') && (
                  <View className="flex-row justify-between items-center py-2.5 mb-3 bg-slate-50 px-3 rounded-xl">
                    <View>
                      <Text className="text-slate-800 text-xs font-bold">Receive Auto Leads</Text>
                      <Text className="text-slate-500 text-[11px]">
                        Include in round-robin distributions
                      </Text>
                    </View>
                    <Switch
                      value={newUserCanReceive}
                      onValueChange={setNewUserCanReceive}
                      trackColor={{ false: '#CBD5E1', true: '#4F46E5' }}
                    />
                  </View>
                )}

                <Button
                  title={
                    createUserMutation.isPending
                      ? 'Saving...'
                      : isManager
                      ? `Create ${user?.branch || ''} Agent`
                      : newUserRole === 'MANAGER'
                      ? `Create ${newUserBranch} Manager`
                      : `Create ${newUserBranch} Agent`
                  }
                  onPress={() =>
                    createUserMutation.mutate({
                      name: newUserName.trim(),
                      email: newUserEmail.trim(),
                      phone: newUserPhone.trim(),
                      password: newUserPassword,
                      role: isManager ? 'AGENT' : newUserRole,
                      branch: isManager ? (user?.branch || 'Trichy') : newUserBranch,
                      canReceiveLeads: isManager
                        ? newUserCanReceive
                        : newUserRole === 'MANAGER'
                        ? false
                        : newUserCanReceive,
                    })
                  }
                  loading={createUserMutation.isPending}
                  disabled={!newUserName.trim() || !newUserEmail.trim() || !newUserPassword}
                  variant="primary"
                />
              </View>
            )}

            {/* Users List */}
            {usersLoading ? (
              <ActivityIndicator size="small" color="#4F46E5" className="py-8" />
            ) : scopedUsersList.length === 0 ? (
              <EmptyState title="No Users Found" description="Add agents to start assigning leads." />
            ) : (
              <View className="gap-2.5">
                {scopedUsersList.map((u: User) => (
                  <View
                    key={u._id}
                    className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm"
                  >
                    <View className="flex-row items-center justify-between mb-3">
                      <View className="flex-row items-center gap-3 flex-1 mr-2">
                        <CrmAvatar name={u.name} size={40} />
                        <View className="flex-1">
                          <Text className="text-slate-900 font-bold text-sm" numberOfLines={1}>
                            {u.name}
                          </Text>
                          <Text className="text-slate-500 text-xs mt-0.5">
                            {u.email} • {u.phone}
                          </Text>
                        </View>
                      </View>
                      <View className="flex-row items-center gap-1.5">
                        {u.branch ? (
                          <View className="bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-md flex-row items-center gap-1">
                            <MapPin size={10} color="#0D9488" />
                            <Text className="text-teal-800 text-[10px] font-bold">{u.branch}</Text>
                          </View>
                        ) : null}
                        <CrmBadge
                          label={u.role}
                          tone={
                            u.role === 'ADMIN' ? 'rose' : u.role === 'MANAGER' ? 'amber' : 'indigo'
                          }
                        />
                      </View>
                    </View>

                    {/* Toggles */}
                    <View className="pt-2.5 border-t border-slate-100 flex-row justify-between items-center">
                      <View className="flex-row items-center gap-2">
                        <Text className="text-slate-600 text-xs font-semibold">Active:</Text>
                        <Switch
                          value={u.isActive}
                          onValueChange={(val) =>
                            updateUserMutation.mutate({ id: u._id, data: { isActive: val } })
                          }
                          trackColor={{ false: '#CBD5E1', true: '#10B981' }}
                        />
                      </View>

                      {u.role === 'AGENT' && (
                        <View className="flex-row items-center gap-2">
                          <Text className="text-slate-600 text-xs font-semibold">
                            Receive Leads:
                          </Text>
                          <Switch
                            value={u.canReceiveLeads}
                            onValueChange={(val) =>
                              updateUserMutation.mutate({
                                id: u._id,
                                data: { canReceiveLeads: val },
                              })
                            }
                            trackColor={{ false: '#CBD5E1', true: '#4F46E5' }}
                          />
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* =========================================================================
            2. CAMPAIGNS MANAGEMENT TAB
           ========================================================================= */}
        {activeTab === 'CAMPAIGNS' && (
          <View>
            <View className="flex-row justify-between items-center mb-3">
              <View>
                <Text className="text-slate-900 font-bold text-base">
                  Campaigns ({campaignsList.length})
                </Text>
                <Text className="text-slate-500 text-xs font-medium">
                  Outreach groups & question flows
                </Text>
              </View>
              <TouchableOpacity
                onPress={openNewCampaignModal}
                activeOpacity={0.8}
                className="bg-indigo-600 px-3 py-2 rounded-xl flex-row items-center gap-1.5 shadow-sm active:bg-indigo-700"
              >
                <Plus size={14} color="#FFFFFF" strokeWidth={2.5} />
                <Text className="text-white font-bold text-xs">New Campaign</Text>
              </TouchableOpacity>
            </View>

            {/* Campaign Modal / Editor Form */}
            {showCampaignModal && (
              <View className="mb-4 bg-white rounded-2xl p-4 border border-indigo-200 shadow-sm">
                <View className="flex-row justify-between items-center mb-3">
                  <Text className="text-slate-900 font-bold text-sm">
                    {editingCampaignId ? 'Edit Campaign' : 'Create Campaign'}
                  </Text>
                  <TouchableOpacity onPress={() => setShowCampaignModal(false)}>
                    <Text className="text-slate-500 text-xs font-bold">✕ Close</Text>
                  </TouchableOpacity>
                </View>

                <Input
                  label="Campaign Name *"
                  placeholder="e.g. Q4 Real Estate Outreach"
                  value={campName}
                  onChangeText={setCampName}
                />

                {/* Pipeline Picker */}
                <Text className="text-slate-500 text-xs font-bold uppercase mb-1.5">
                  Pipeline *
                </Text>
                <View className="flex-row flex-wrap gap-1.5 mb-3">
                  {pipelinesList.map((pipe) => {
                    const isSelected = campPipelineId === pipe._id;
                    return (
                      <TouchableOpacity
                        key={pipe._id}
                        onPress={() => setCampPipelineId(pipe._id)}
                        className={`px-3 py-1.5 rounded-xl border ${
                          isSelected
                            ? 'bg-indigo-600 border-indigo-600 shadow-sm'
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <Text
                          className={`text-xs font-semibold ${
                            isSelected ? 'text-white' : 'text-slate-700'
                          }`}
                        >
                          {pipe.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Priority Selector */}
                <Text className="text-slate-500 text-xs font-bold uppercase mb-1.5">Priority</Text>
                <View className="flex-row gap-2 mb-3">
                  {(['HIGH', 'MEDIUM', 'LOW'] as CampaignPriority[]).map((p) => (
                    <TouchableOpacity
                      key={p}
                      onPress={() => setCampPriority(p)}
                      className={`flex-1 py-2 rounded-xl items-center border ${
                        campPriority === p
                          ? 'bg-indigo-600 border-indigo-600 shadow-sm'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <Text
                        className={`text-xs font-bold ${
                          campPriority === p ? 'text-white' : 'text-slate-700'
                        }`}
                      >
                        {p}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Distribution Mode */}
                <Text className="text-slate-500 text-xs font-bold uppercase mb-1.5">
                  Distribution Mode
                </Text>
                <View className="flex-row gap-2 mb-3">
                  {(['EQUAL', 'CONDITIONAL'] as DistributionMode[]).map((m) => (
                    <TouchableOpacity
                      key={m}
                      onPress={() => setCampDistribution(m)}
                      className={`flex-1 py-2 rounded-xl items-center border ${
                        campDistribution === m
                          ? 'bg-indigo-600 border-indigo-600 shadow-sm'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <Text
                        className={`text-xs font-bold ${
                          campDistribution === m ? 'text-white' : 'text-slate-700'
                        }`}
                      >
                        {m}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Duplicate Policy */}
                <Text className="text-slate-500 text-xs font-bold uppercase mb-1.5">
                  Duplicate Policy
                </Text>
                <View className="flex-row gap-2 mb-3">
                  {(['SKIP', 'MERGE', 'CREATE_NEW'] as DuplicateMode[]).map((d) => (
                    <TouchableOpacity
                      key={d}
                      onPress={() => setCampDuplicate(d)}
                      className={`flex-1 py-2 rounded-xl items-center border ${
                        campDuplicate === d
                          ? 'bg-indigo-600 border-indigo-600 shadow-sm'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <Text
                        className={`text-xs font-bold ${
                          campDuplicate === d ? 'text-white' : 'text-slate-700'
                        }`}
                      >
                        {d}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Assign Agents */}
                <Text className="text-slate-500 text-xs font-bold uppercase mb-1.5">
                  Assigned Agents ({campSelectedAgentIds.length})
                </Text>
                <View className="flex-row flex-wrap gap-1.5 mb-4">
                  {usersList
                    .filter((u) => u.role === 'AGENT' && u.isActive)
                    .map((agent) => {
                      const isSelected = campSelectedAgentIds.includes(agent._id);
                      return (
                        <TouchableOpacity
                          key={agent._id}
                          onPress={() => {
                            if (isSelected) {
                              setCampSelectedAgentIds(
                                campSelectedAgentIds.filter((id) => id !== agent._id),
                              );
                            } else {
                              setCampSelectedAgentIds([...campSelectedAgentIds, agent._id]);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-xl border flex-row items-center gap-1.5 ${
                            isSelected
                              ? 'bg-emerald-50 border-emerald-500'
                              : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          {isSelected ? (
                            <Check size={12} color="#059669" strokeWidth={3} />
                          ) : null}
                          <Text
                            className={`text-xs font-semibold ${
                              isSelected ? 'text-emerald-800 font-bold' : 'text-slate-700'
                            }`}
                          >
                            {agent.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                </View>

                {/* Engagement Form Questions */}
                <View className="pt-3 border-t border-slate-100 mb-4">
                  <View className="flex-row justify-between items-center mb-2">
                    <Text className="text-slate-500 text-xs font-bold uppercase">
                      Questionnaire ({campQuestions.length})
                    </Text>
                    <View className="flex-row gap-1">
                      <TouchableOpacity
                        onPress={() => addEngagementQuestion('TEXT')}
                        className="bg-slate-100 border border-slate-200 px-2 py-1 rounded-lg"
                      >
                        <Text className="text-slate-700 text-[10px] font-semibold">+ Text</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => addEngagementQuestion('NUMBER')}
                        className="bg-slate-100 border border-slate-200 px-2 py-1 rounded-lg"
                      >
                        <Text className="text-slate-700 text-[10px] font-semibold">+ Number</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => addEngagementQuestion('MULTIPLE_CHOICE')}
                        className="bg-slate-100 border border-slate-200 px-2 py-1 rounded-lg"
                      >
                        <Text className="text-slate-700 text-[10px] font-semibold">+ Choice</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {campQuestions.map((q, idx) => (
                    <View
                      key={q.id}
                      className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 mb-2 flex-row justify-between items-center"
                    >
                      <Text className="text-indigo-700 text-xs font-semibold flex-1">
                        Q{idx + 1}: {q.label} ({q.type})
                      </Text>
                      <TouchableOpacity onPress={() => removeEngagementQuestion(q.id)}>
                        <Text className="text-rose-500 text-xs font-bold">✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>

                <Button
                  title={saveCampaignMutation.isPending ? 'Saving...' : 'Save Campaign'}
                  onPress={() => saveCampaignMutation.mutate()}
                  loading={saveCampaignMutation.isPending}
                  disabled={!campName.trim() || !campPipelineId}
                  variant="primary"
                />
              </View>
            )}

            {/* Campaign Cards List */}
            {campaignsLoading ? (
              <ActivityIndicator size="small" color="#4F46E5" className="py-8" />
            ) : campaignsList.length === 0 ? (
              <EmptyState
                title="No Campaigns"
                description="Create a campaign to upload and distribute leads."
              />
            ) : (
              <View className="gap-2.5">
                {campaignsList.map((camp) => (
                  <View
                    key={camp._id}
                    className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm"
                  >
                    <View className="flex-row justify-between items-start mb-2">
                      <View className="flex-1 mr-2">
                        <Text className="text-slate-900 font-bold text-base">{camp.name}</Text>
                        <Text className="text-slate-500 text-xs mt-0.5 font-medium">
                          Mode: {camp.distributionMode} • Agents: {camp.agentIds?.length || 0}
                        </Text>
                      </View>
                      <CrmBadge
                        label={camp.priority}
                        tone={
                          camp.priority === 'HIGH'
                            ? 'rose'
                            : camp.priority === 'MEDIUM'
                            ? 'amber'
                            : 'slate'
                        }
                      />
                    </View>

                    <View className="pt-2.5 border-t border-slate-100 flex-row justify-between items-center">
                      <Text className="text-slate-500 text-xs font-medium">
                        Form Questions: {camp.engagementForm?.length || 0}
                      </Text>
                      <TouchableOpacity
                        onPress={() => openEditCampaignModal(camp)}
                        className="bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-xl flex-row items-center gap-1"
                      >
                        <Edit2 size={12} color="#4F46E5" />
                        <Text className="text-indigo-700 text-xs font-bold">Edit</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* =========================================================================
            3. CSV LEAD UPLOAD TAB
           ========================================================================= */}
        {activeTab === 'UPLOAD' && (
          <View>
            <View className="mb-4 flex-row items-center justify-between">
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text className="text-slate-900 font-bold text-base">Bulk Lead Ingest</Text>
                <Text className="text-slate-500 text-xs font-medium">
                  Upload CSV file with automatic deduplication
                </Text>
              </View>
              <TouchableOpacity
                onPress={async () => {
                  const res = await downloadOrShareCsv('lead_upload_template.csv', SAMPLE_LEADS_TEMPLATE_CSV);
                  if (res.success) {
                    Alert.alert('Template Ready', res.message);
                  }
                }}
                activeOpacity={0.7}
                className="flex-row items-center gap-1.5 px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl"
              >
                <Download size={13} color="#0F172A" />
                <Text className="text-xs font-bold text-slate-800">CSV Template</Text>
              </TouchableOpacity>
            </View>

            {/* Step 1: Campaign Selector */}
            <View className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm mb-4">
              <Text className="text-slate-900 font-bold text-xs uppercase tracking-wider mb-2.5">
                1. Select Target Campaign *
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {campaignsList.map((c) => {
                  const isSelected = uploadCampaignId === c._id;
                  return (
                    <TouchableOpacity
                      key={c._id}
                      onPress={() => setUploadCampaignId(c._id)}
                      className={`px-3 py-2 rounded-xl border flex-row items-center gap-1.5 ${
                        isSelected
                          ? 'bg-indigo-600 border-indigo-600 shadow-sm'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      {isSelected ? <Check size={12} color="#FFFFFF" strokeWidth={3} /> : null}
                      <Text
                        className={`text-xs font-semibold ${
                          isSelected ? 'text-white' : 'text-slate-700'
                        }`}
                      >
                        {c.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Step 2: Dedicated Agent Assignment */}
            <View className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm mb-4">
              <View className="flex-row justify-between items-center mb-1">
                <Text className="text-slate-900 font-bold text-xs uppercase tracking-wider">
                  2. Agent Distribution
                </Text>
                {uploadTargetAgentId && (
                  <TouchableOpacity onPress={() => setUploadTargetAgentId(null)}>
                    <Text className="text-xs text-indigo-600 font-bold">Reset Auto</Text>
                  </TouchableOpacity>
                )}
              </View>
              <Text className="text-slate-500 text-xs mb-3 font-medium">
                Leave on 'Auto Round-Robin' or assign all leads directly to a single agent
              </Text>
              <View className="flex-row flex-wrap gap-2">
                <TouchableOpacity
                  onPress={() => setUploadTargetAgentId(null)}
                  className={`px-3 py-2 rounded-xl border ${
                    uploadTargetAgentId === null
                      ? 'bg-indigo-600 border-indigo-600 shadow-sm'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <Text
                    className={`text-xs font-semibold ${
                      uploadTargetAgentId === null ? 'text-white' : 'text-slate-700'
                    }`}
                  >
                    Auto Round-Robin
                  </Text>
                </TouchableOpacity>

                {usersList
                  .filter((u) => u.role === 'AGENT' && u.isActive)
                  .map((agent) => {
                    const isSelected = uploadTargetAgentId === agent._id;
                    return (
                      <TouchableOpacity
                        key={agent._id}
                        onPress={() => setUploadTargetAgentId(agent._id)}
                        className={`px-3 py-2 rounded-xl border ${
                          isSelected
                            ? 'bg-emerald-600 border-emerald-600 shadow-sm'
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <Text
                          className={`text-xs font-semibold ${
                            isSelected ? 'text-white' : 'text-slate-700'
                          }`}
                        >
                          {agent.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
              </View>
            </View>

            {/* Step 3: Pick CSV File */}
            <View className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm mb-4">
              <Text className="text-slate-900 font-bold text-xs uppercase tracking-wider mb-2.5">
                3. Choose CSV File *
              </Text>
              <TouchableOpacity
                onPress={handlePickDocument}
                activeOpacity={0.8}
                className="p-6 border-2 border-dashed border-slate-300 rounded-2xl items-center bg-slate-50 active:bg-slate-100"
              >
                <FileSpreadsheet size={32} color="#4F46E5" />
                <Text className="text-slate-900 font-bold text-sm mt-2">
                  {pickedFile ? pickedFile.name : 'Tap to select CSV file from device'}
                </Text>
                <Text className="text-slate-500 text-xs mt-1">
                  {pickedFile
                    ? `Size: ${Math.round((pickedFile.size || 0) / 1024)} KB`
                    : 'Accepted columns: name, phone, email, notes, etc.'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Upload Action */}
            <Button
              title={
                uploadMutation.isPending ? 'Ingesting CSV Leads...' : 'Upload & Distribute Leads'
              }
              onPress={() => uploadMutation.mutate()}
              loading={uploadMutation.isPending}
              disabled={uploadMutation.isPending || !uploadCampaignId || !pickedFile}
              variant="primary"
            />

            {/* Ingest Result Metrics */}
            {uploadResult && (
              <View className="mt-4 bg-emerald-50 border border-emerald-300 rounded-2xl p-4">
                <View className="flex-row items-center gap-2 mb-2">
                  <CheckCircle2 size={18} color="#059669" />
                  <Text className="text-emerald-900 font-bold text-base">
                    CSV Ingestion Complete
                  </Text>
                </View>
                <View className="flex-row justify-between py-1">
                  <Text className="text-slate-600 text-xs font-medium">Created Leads:</Text>
                  <Text className="text-emerald-800 font-bold text-xs">{uploadResult.created}</Text>
                </View>
                <View className="flex-row justify-between py-1">
                  <Text className="text-slate-600 text-xs font-medium">Merged Existing Leads:</Text>
                  <Text className="text-indigo-800 font-bold text-xs">{uploadResult.merged}</Text>
                </View>
                <View className="flex-row justify-between py-1">
                  <Text className="text-slate-600 text-xs font-medium">Skipped Duplicates:</Text>
                  <Text className="text-amber-800 font-bold text-xs">{uploadResult.skipped}</Text>
                </View>
                <View className="flex-row justify-between py-1">
                  <Text className="text-slate-600 text-xs font-medium">Failed Rows:</Text>
                  <Text className="text-rose-800 font-bold text-xs">
                    {uploadResult.failed.length}
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* =========================================================================
            4. SETTINGS & RETRY RULES TAB
           ========================================================================= */}
        {activeTab === 'SETTINGS' && (
          <View>
            <View className="mb-4">
              <Text className="text-slate-900 font-bold text-base">Organization Policies</Text>
              <Text className="text-slate-500 text-xs font-medium">
                Mandatory follow-up gates and automated retry schedules
              </Text>
            </View>

            {/* Follow-up Policies */}
            <View className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm mb-4">
              <Text className="text-slate-900 font-bold text-sm mb-3">Callback Requirements</Text>

              <View className="py-3 border-b border-slate-100 flex-row justify-between items-center">
                <View className="flex-1 mr-3">
                  <Text className="text-slate-800 text-xs font-bold">
                    Allow Disposing Without Follow-up
                  </Text>
                  <Text className="text-slate-500 text-[11px] mt-0.5">
                    Permit agents to finish calls without picking next callback time
                  </Text>
                </View>
                <Switch
                  value={currentSettings?.allowDisposeWithoutFollowUp ?? false}
                  onValueChange={(val) =>
                    updateSettingsMutation.mutate({ allowDisposeWithoutFollowUp: val })
                  }
                  trackColor={{ false: '#CBD5E1', true: '#4F46E5' }}
                />
              </View>

              <View className="py-3 flex-row justify-between items-center">
                <View className="flex-1 mr-3">
                  <Text className="text-slate-800 text-xs font-bold">
                    Follow-up Mandatory for Not Connected
                  </Text>
                  <Text className="text-slate-500 text-[11px] mt-0.5">
                    Require scheduling callback when lead does not answer
                  </Text>
                </View>
                <Switch
                  value={currentSettings?.followUpMandatoryForNotConnected ?? true}
                  onValueChange={(val) =>
                    updateSettingsMutation.mutate({ followUpMandatoryForNotConnected: val })
                  }
                  trackColor={{ false: '#CBD5E1', true: '#4F46E5' }}
                />
              </View>
            </View>

            {/* Retry Rules Scheduler */}
            <View className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
              <View className="flex-row items-center gap-2 mb-1">
                <Clock size={16} color="#4F46E5" />
                <Text className="text-slate-900 font-bold text-sm">Retry Rules Scheduler</Text>
              </View>
              <Text className="text-slate-500 text-xs mb-3 font-medium">
                Auto-calculated callback delays for unanswered calls
              </Text>

              <View className="gap-2">
                {retryRulesList.map((rule) => {
                  const stepText = rule.steps
                    .map((s, idx) => `Step ${idx + 1}: ${s.delayMinutes}m`)
                    .join(' • ');

                  return (
                    <View
                      key={rule._id}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex-row justify-between items-center"
                    >
                      <View className="flex-1 mr-2">
                        <Text className="text-slate-900 text-xs font-bold">
                          {rule.reason.replace(/_/g, ' ')}
                        </Text>
                        <Text className="text-slate-500 text-[11px] mt-0.5">
                          {rule.steps.length > 0 ? stepText : 'No retry steps configured'}
                        </Text>
                      </View>

                      <Switch
                        value={rule.enabled}
                        onValueChange={(val) =>
                          toggleRetryRuleMutation.mutate({ id: rule._id, enabled: val })
                        }
                        trackColor={{ false: '#CBD5E1', true: '#10B981' }}
                      />
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        )}
        </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};
