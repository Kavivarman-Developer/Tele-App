import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';

import { useAuthStore } from '../store/authStore';
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
} from '../api/leadApi';
import {
  User,
  Campaign,
  Pipeline,
  RetryRule,
  CampaignPriority,
  DistributionMode,
  DuplicateMode,
  QuestionType,
  EngagementQuestion,
} from '../types';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { EmptyState } from '../components/EmptyState';

type AdminTab = 'USERS' | 'CAMPAIGNS' | 'UPLOAD' | 'SETTINGS';

export const DashboardScreen: React.FC = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<AdminTab>('USERS');

  // ==========================================
  // 1. USERS SECTION STATE
  // ==========================================
  const [showAddUserModal, setShowAddUserModal] = useState<boolean>(false);
  const [newUserName, setNewUserName] = useState<string>('');
  const [newUserEmail, setNewUserEmail] = useState<string>('');
  const [newUserPhone, setNewUserPhone] = useState<string>('');
  const [newUserPassword, setNewUserPassword] = useState<string>('');
  const [newUserCanReceive, setNewUserCanReceive] = useState<boolean>(true);

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['adminUsers'],
    queryFn: () => fetchUsers(),
  });
  const usersList: User[] = usersData?.users || [];

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
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      {/* Top Header */}
      <View className="bg-white px-5 py-3.5 border-b border-slate-200 flex-row justify-between items-center shadow-xs">
        <View>
          <Text className="text-xl font-black text-slate-900">Management Center</Text>
          <Text className="text-xs text-slate-500 font-medium mt-0.5">
            Admin controls for team, campaigns, and rules
          </Text>
        </View>
        <Badge label={user?.role || 'MANAGER'} variant="warning" />
      </View>

      {/* Segmented Top Navigation Tabs */}
      <View className="px-4 py-2 bg-slate-50 border-b border-slate-200/80">
        <View className="flex-row bg-slate-200/60 p-1 rounded-xl">
          {(
            [
              { label: '👥 Users', value: 'USERS' },
              { label: '📁 Campaigns', value: 'CAMPAIGNS' },
              { label: '📤 Upload', value: 'UPLOAD' },
              { label: '⚙️ Settings', value: 'SETTINGS' },
            ] as Array<{ label: string; value: AdminTab }>
          ).map((tab) => {
            const isSelected = activeTab === tab.value;
            return (
              <TouchableOpacity
                key={tab.value}
                onPress={() => setActiveTab(tab.value)}
                activeOpacity={0.8}
                className={`flex-1 py-1.5 rounded-lg items-center ${
                  isSelected ? 'bg-white shadow-xs' : ''
                }`}
              >
                <Text
                  className={`text-xs font-bold ${
                    isSelected ? 'text-blue-600' : 'text-slate-600'
                  }`}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* =========================================================================
            1. USERS MANAGEMENT TAB
           ========================================================================= */}
        {activeTab === 'USERS' && (
          <View>
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-slate-900 font-bold text-base">
                Team Members ({usersList.length})
              </Text>
              <TouchableOpacity
                onPress={() => setShowAddUserModal(true)}
                className="bg-blue-600 px-3.5 py-1.5 rounded-xl flex-row items-center active:bg-blue-700 shadow-xs"
              >
                <Text className="text-white font-bold text-xs">+ Add Agent</Text>
              </TouchableOpacity>
            </View>

            {/* Add User Modal / Form */}
            {showAddUserModal && (
              <Card className="mb-4 bg-white border-blue-400 shadow-sm">
                <View className="flex-row justify-between items-center mb-3">
                  <Text className="text-slate-900 font-bold text-sm">Add New Agent</Text>
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

                <View className="flex-row justify-between items-center py-2 mb-3">
                  <Text className="text-slate-700 text-xs font-semibold">
                    Can Receive Assigned Leads
                  </Text>
                  <Switch
                    value={newUserCanReceive}
                    onValueChange={setNewUserCanReceive}
                    trackColor={{ false: '#CBD5E1', true: '#2563EB' }}
                  />
                </View>

                <Button
                  title={createUserMutation.isPending ? 'Saving...' : 'Create Agent Account'}
                  onPress={() =>
                    createUserMutation.mutate({
                      name: newUserName.trim(),
                      email: newUserEmail.trim(),
                      phone: newUserPhone.trim(),
                      password: newUserPassword,
                      role: 'AGENT',
                      canReceiveLeads: newUserCanReceive,
                    })
                  }
                  loading={createUserMutation.isPending}
                  disabled={!newUserName.trim() || !newUserEmail.trim() || !newUserPassword}
                />
              </Card>
            )}

            {/* Users List */}
            {usersLoading ? (
              <ActivityIndicator size="small" color="#2563EB" className="py-8" />
            ) : usersList.length === 0 ? (
              <EmptyState title="No Users Found" description="Add agents to start assigning leads." />
            ) : (
              <View className="gap-2.5">
                {usersList.map((u) => (
                  <Card key={u._id} className="p-3.5">
                    <View className="flex-row justify-between items-start mb-2">
                      <View className="flex-1 mr-2">
                        <Text className="text-slate-900 font-bold text-sm">{u.name}</Text>
                        <Text className="text-slate-500 text-xs mt-0.5">{u.email} • {u.phone}</Text>
                      </View>
                      <Badge
                        label={u.role}
                        variant={u.role === 'ADMIN' ? 'danger' : u.role === 'MANAGER' ? 'warning' : 'info'}
                      />
                    </View>

                    {/* Quick Toggles: Active Status & Can Receive Leads */}
                    <View className="pt-2 border-t border-slate-100 flex-row justify-between items-center">
                      <View className="flex-row items-center gap-2">
                        <Text className="text-slate-600 text-xs font-medium">Active:</Text>
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
                          <Text className="text-slate-600 text-xs font-medium">Receive Leads:</Text>
                          <Switch
                            value={u.canReceiveLeads}
                            onValueChange={(val) =>
                              updateUserMutation.mutate({ id: u._id, data: { canReceiveLeads: val } })
                            }
                            trackColor={{ false: '#CBD5E1', true: '#2563EB' }}
                          />
                        </View>
                      )}
                    </View>
                  </Card>
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
              <Text className="text-slate-900 font-bold text-base">
                Campaigns ({campaignsList.length})
              </Text>
              <TouchableOpacity
                onPress={openNewCampaignModal}
                className="bg-blue-600 px-3.5 py-1.5 rounded-xl flex-row items-center active:bg-blue-700 shadow-xs"
              >
                <Text className="text-white font-bold text-xs">+ New Campaign</Text>
              </TouchableOpacity>
            </View>

            {/* Campaign Modal / Editor Form */}
            {showCampaignModal && (
              <Card className="mb-4 bg-white border-blue-400 shadow-sm">
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
                        className={`px-3 py-1.5 rounded-lg border ${
                          isSelected
                            ? 'bg-blue-600 border-blue-600 shadow-xs'
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
                <Text className="text-slate-500 text-xs font-bold uppercase mb-1.5">
                  Priority
                </Text>
                <View className="flex-row gap-2 mb-3">
                  {(['HIGH', 'MEDIUM', 'LOW'] as CampaignPriority[]).map((p) => (
                    <TouchableOpacity
                      key={p}
                      onPress={() => setCampPriority(p)}
                      className={`flex-1 py-1.5 rounded-lg items-center border ${
                        campPriority === p
                          ? 'bg-blue-600 border-blue-600 shadow-xs'
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
                      className={`flex-1 py-1.5 rounded-lg items-center border ${
                        campDistribution === m
                          ? 'bg-blue-600 border-blue-600 shadow-xs'
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

                {/* Duplicate Mode */}
                <Text className="text-slate-500 text-xs font-bold uppercase mb-1.5">
                  Duplicate Policy
                </Text>
                <View className="flex-row gap-2 mb-3">
                  {(['SKIP', 'MERGE', 'CREATE_NEW'] as DuplicateMode[]).map((d) => (
                    <TouchableOpacity
                      key={d}
                      onPress={() => setCampDuplicate(d)}
                      className={`flex-1 py-1.5 rounded-lg items-center border ${
                        campDuplicate === d
                          ? 'bg-blue-600 border-blue-600 shadow-xs'
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
                          className={`px-3 py-1.5 rounded-lg border ${
                            isSelected
                              ? 'bg-emerald-50 border-emerald-500'
                              : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          <Text
                            className={`text-xs font-semibold ${
                              isSelected ? 'text-emerald-800 font-bold' : 'text-slate-700'
                            }`}
                          >
                            {isSelected ? '✓ ' : ''}
                            {agent.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                </View>

                {/* Engagement Form Builder */}
                <View className="pt-3 border-t border-slate-100 mb-4">
                  <View className="flex-row justify-between items-center mb-2">
                    <Text className="text-slate-500 text-xs font-bold uppercase">
                      Questionnaire ({campQuestions.length})
                    </Text>
                    <View className="flex-row gap-1">
                      <TouchableOpacity
                        onPress={() => addEngagementQuestion('TEXT')}
                        className="bg-slate-100 border border-slate-200 px-2 py-1 rounded"
                      >
                        <Text className="text-slate-700 text-[10px] font-semibold">+ Text</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => addEngagementQuestion('NUMBER')}
                        className="bg-slate-100 border border-slate-200 px-2 py-1 rounded"
                      >
                        <Text className="text-slate-700 text-[10px] font-semibold">+ Number</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => addEngagementQuestion('MULTIPLE_CHOICE')}
                        className="bg-slate-100 border border-slate-200 px-2 py-1 rounded"
                      >
                        <Text className="text-slate-700 text-[10px] font-semibold">+ Choice</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {campQuestions.map((q, idx) => (
                    <View
                      key={q.id}
                      className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 mb-2"
                    >
                      <View className="flex-row justify-between items-center">
                        <Text className="text-blue-700 text-xs font-semibold">
                          Q{idx + 1}: {q.label} ({q.type})
                        </Text>
                        <TouchableOpacity onPress={() => removeEngagementQuestion(q.id)}>
                          <Text className="text-red-500 text-xs font-bold">✕</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>

                <Button
                  title={saveCampaignMutation.isPending ? 'Saving...' : 'Save Campaign'}
                  onPress={() => saveCampaignMutation.mutate()}
                  loading={saveCampaignMutation.isPending}
                  disabled={!campName.trim() || !campPipelineId}
                />
              </Card>
            )}

            {/* Campaign Cards List */}
            {campaignsLoading ? (
              <ActivityIndicator size="small" color="#2563EB" className="py-8" />
            ) : campaignsList.length === 0 ? (
              <EmptyState title="No Campaigns" description="Create a campaign to upload and distribute leads." />
            ) : (
              <View className="gap-2.5">
                {campaignsList.map((camp) => (
                  <Card key={camp._id} className="p-3.5">
                    <View className="flex-row justify-between items-start mb-2">
                      <View className="flex-1 mr-2">
                        <Text className="text-slate-900 font-bold text-base">{camp.name}</Text>
                        <Text className="text-slate-500 text-xs mt-0.5 font-medium">
                          Mode: {camp.distributionMode} • Agents: {camp.agentIds?.length || 0}
                        </Text>
                      </View>
                      <Badge
                        label={camp.priority}
                        variant={
                          camp.priority === 'HIGH'
                            ? 'danger'
                            : camp.priority === 'MEDIUM'
                            ? 'warning'
                            : 'default'
                        }
                      />
                    </View>

                    <View className="pt-2.5 border-t border-slate-100 flex-row justify-between items-center">
                      <Text className="text-slate-500 text-xs">
                        Questions: {camp.engagementForm?.length || 0}
                      </Text>
                      <TouchableOpacity
                        onPress={() => openEditCampaignModal(camp)}
                        className="bg-blue-50 border border-blue-200 px-3 py-1 rounded-lg"
                      >
                        <Text className="text-blue-600 text-xs font-bold">Edit Campaign ›</Text>
                      </TouchableOpacity>
                    </View>
                  </Card>
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
            <Text className="text-slate-900 font-bold text-base mb-1">Upload Lead CSV</Text>
            <Text className="text-slate-500 text-xs mb-4 font-medium">
              Select target campaign, pick CSV file, and ingest rows with automatic duplicate handling.
            </Text>

            {/* Step 1: Campaign Selector */}
            <Card className="mb-4">
              <Text className="text-slate-500 text-xs font-bold uppercase mb-2">
                1. Select Target Campaign *
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {campaignsList.map((c) => {
                  const isSelected = uploadCampaignId === c._id;
                  return (
                    <TouchableOpacity
                      key={c._id}
                      onPress={() => setUploadCampaignId(c._id)}
                      className={`px-3 py-2 rounded-xl border ${
                        isSelected
                          ? 'bg-blue-600 border-blue-600 shadow-xs'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
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
            </Card>

            {/* Step 2: Dedicated Agent Assignment (Optional) */}
            <Card className="mb-4">
              <View className="flex-row justify-between items-center mb-1">
                <Text className="text-slate-500 text-xs font-bold uppercase">
                  2. Assign to Particular Agent (Optional)
                </Text>
                {uploadTargetAgentId ? (
                  <TouchableOpacity onPress={() => setUploadTargetAgentId(null)}>
                    <Text className="text-xs text-blue-600 font-bold">Reset to Auto</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              <Text className="text-slate-500 text-[11px] mb-2.5">
                Leave on 'Auto Distribute' or select an agent (e.g. John) to assign all uploaded numbers directly to them.
              </Text>
              <View className="flex-row flex-wrap gap-2">
                <TouchableOpacity
                  onPress={() => setUploadTargetAgentId(null)}
                  className={`px-3 py-2 rounded-xl border ${
                    uploadTargetAgentId === null
                      ? 'bg-blue-600 border-blue-600 shadow-xs'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <Text
                    className={`text-xs font-semibold ${
                      uploadTargetAgentId === null ? 'text-white font-bold' : 'text-slate-700'
                    }`}
                  >
                    🌐 Auto Distribute (Campaign Rules)
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
                            ? 'bg-emerald-600 border-emerald-600 shadow-xs'
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <Text
                          className={`text-xs font-semibold ${
                            isSelected ? 'text-white font-bold' : 'text-slate-700'
                          }`}
                        >
                          👤 {agent.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
              </View>
            </Card>

            {/* Step 3: Pick CSV File */}
            <Card className="mb-4">
              <Text className="text-slate-500 text-xs font-bold uppercase mb-2">
                3. Choose CSV File *
              </Text>
              <TouchableOpacity
                onPress={handlePickDocument}
                activeOpacity={0.8}
                className="p-6 border-2 border-dashed border-slate-300 rounded-2xl items-center bg-slate-50"
              >
                <Text className="text-3xl mb-1">📄</Text>
                <Text className="text-slate-900 font-bold text-sm">
                  {pickedFile ? pickedFile.name : 'Select Lead CSV from Device'}
                </Text>
                <Text className="text-slate-500 text-xs mt-1">
                  {pickedFile
                    ? `Size: ${Math.round((pickedFile.size || 0) / 1024)} KB`
                    : 'Columns: name, phone, email, etc.'}
                </Text>
              </TouchableOpacity>
            </Card>

            {/* Step 3: Upload Action Button */}
            <Button
              title={uploadMutation.isPending ? 'Ingesting CSV Leads...' : 'Upload & Distribute Leads'}
              onPress={() => uploadMutation.mutate()}
              loading={uploadMutation.isPending}
              disabled={uploadMutation.isPending || !uploadCampaignId || !pickedFile}
            />

            {/* Ingest Result Metrics */}
            {uploadResult && (
              <Card className="mt-4 bg-emerald-50 border border-emerald-300">
                <Text className="text-emerald-800 font-bold text-base mb-2">
                  ✅ CSV Ingest Complete
                </Text>
                <View className="flex-row justify-between py-1">
                  <Text className="text-slate-600 text-xs font-medium">Created New Leads:</Text>
                  <Text className="text-emerald-700 font-bold text-xs">{uploadResult.created}</Text>
                </View>
                <View className="flex-row justify-between py-1">
                  <Text className="text-slate-600 text-xs font-medium">Merged Duplicate Leads:</Text>
                  <Text className="text-blue-700 font-bold text-xs">{uploadResult.merged}</Text>
                </View>
                <View className="flex-row justify-between py-1">
                  <Text className="text-slate-600 text-xs font-medium">Skipped Duplicates:</Text>
                  <Text className="text-amber-700 font-bold text-xs">{uploadResult.skipped}</Text>
                </View>
                <View className="flex-row justify-between py-1">
                  <Text className="text-slate-600 text-xs font-medium">Failed Rows:</Text>
                  <Text className="text-red-600 font-bold text-xs">{uploadResult.failed.length}</Text>
                </View>
              </Card>
            )}
          </View>
        )}

        {/* =========================================================================
            4. SETTINGS & RETRY RULES TAB
           ========================================================================= */}
        {activeTab === 'SETTINGS' && (
          <View>
            <Text className="text-slate-900 font-bold text-base mb-1">Organization Policies</Text>
            <Text className="text-slate-500 text-xs mb-4 font-medium">
              Configure calling follow-up requirements and automated retry rules.
            </Text>

            {/* Settings Toggles Card */}
            <Card className="mb-4">
              <Text className="text-slate-900 font-bold text-sm mb-3">Follow-up Policies</Text>

              {/* Allow Dispose without follow-up */}
              <View className="py-2.5 border-b border-slate-100 flex-row justify-between items-center">
                <View className="flex-1 mr-3">
                  <Text className="text-slate-800 text-xs font-bold">
                    Allow Disposing Without Follow-up
                  </Text>
                  <Text className="text-slate-500 text-[11px] mt-0.5">
                    Permit agents to complete calls without picking a next callback time
                  </Text>
                </View>
                <Switch
                  value={currentSettings?.allowDisposeWithoutFollowUp ?? false}
                  onValueChange={(val) =>
                    updateSettingsMutation.mutate({ allowDisposeWithoutFollowUp: val })
                  }
                  trackColor={{ false: '#CBD5E1', true: '#2563EB' }}
                />
              </View>

              {/* Follow-up Mandatory for Not Connected */}
              <View className="py-2.5 flex-row justify-between items-center">
                <View className="flex-1 mr-3">
                  <Text className="text-slate-800 text-xs font-bold">
                    Follow-up Mandatory for Not Connected
                  </Text>
                  <Text className="text-slate-500 text-[11px] mt-0.5">
                    Require scheduling a follow-up date for unanswered calls
                  </Text>
                </View>
                <Switch
                  value={currentSettings?.followUpMandatoryForNotConnected ?? true}
                  onValueChange={(val) =>
                    updateSettingsMutation.mutate({ followUpMandatoryForNotConnected: val })
                  }
                  trackColor={{ false: '#CBD5E1', true: '#2563EB' }}
                />
              </View>
            </Card>

            {/* Retry Rules Editor */}
            <Card>
              <Text className="text-slate-900 font-bold text-sm mb-1">
                🔁 Retry Rules Scheduler
              </Text>
              <Text className="text-slate-500 text-xs mb-3 font-medium">
                Toggle auto-scheduling delays for not-connected reasons
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
            </Card>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};
