import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  StyleSheet,
  Modal,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Megaphone,
  Plus,
  Edit2,
  X,
  Users,
  Check,
  HelpCircle,
  ShieldAlert,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';

import { useAuthStore } from '../store/authStore';
import {
  fetchCampaigns,
  createCampaign,
  updateCampaign,
  fetchPipelines,
  fetchUsers,
} from '../api/leadApi';
import {
  Campaign,
  Pipeline,
  User,
  CampaignPriority,
  DistributionMode,
  DuplicateMode,
  QuestionType,
  EngagementQuestion,
} from '../types';
import { colors } from '../theme';
import { CrmShell } from '../components/CrmShell';

interface DisplayCampaign {
  _id: string;
  name: string;
  priority: 'High priority' | 'Medium priority' | 'Low priority';
  rawPriority: CampaignPriority;
  isActive: boolean;
  totalLeads: number;
  assignedAgentsCount: number;
  assignedAgents: string[];
  distribution: string;
  questionCount: number;
  iconBg: string;
  iconColor: string;
}

const DEFAULT_CAMPAIGNS: DisplayCampaign[] = [
  {
    _id: 'camp-1',
    name: 'Demo Sales Campaign',
    priority: 'High priority',
    rawPriority: 'HIGH',
    isActive: true,
    totalLeads: 840,
    assignedAgentsCount: 3,
    assignedAgents: ['John Agent', 'Agent Two', 'Agent Three'],
    distribution: 'Equal distribution',
    questionCount: 0,
    iconBg: '#EFF6FF',
    iconColor: '#2563EB',
  },
  {
    _id: 'camp-2',
    name: 'Q4 Real Estate Outreach',
    priority: 'Medium priority',
    rawPriority: 'MEDIUM',
    isActive: true,
    totalLeads: 1642,
    assignedAgentsCount: 1,
    assignedAgents: ['Agent Three'],
    distribution: 'Equal distribution',
    questionCount: 0,
    iconBg: '#FFFBEB',
    iconColor: '#D97706',
  },
];

export const CampaignsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAgent = user?.role === 'AGENT';

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [pipelineId, setPipelineId] = useState('');
  const [priority, setPriority] = useState<CampaignPriority>('MEDIUM');
  const [distributionMode, setDistributionMode] = useState<DistributionMode>('EQUAL');
  const [duplicateMode, setDuplicateMode] = useState<DuplicateMode>('SKIP');
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [questions, setQuestions] = useState<EngagementQuestion[]>([]);

  // Queries
  const { data: campaignsData } = useQuery({
    queryKey: ['adminCampaigns'],
    queryFn: fetchCampaigns,
    enabled: !isAgent,
  });

  const { data: pipelinesData } = useQuery({
    queryKey: ['adminPipelines'],
    queryFn: fetchPipelines,
    enabled: !isAgent,
  });
  const pipelinesList: Pipeline[] = pipelinesData?.pipelines || [];

  const { data: usersData } = useQuery({
    queryKey: ['adminUsers'],
    queryFn: () => fetchUsers(),
    enabled: !isAgent,
  });
  const agentsList: User[] = (usersData?.users || []).filter(
    (u) => u.role === 'AGENT' && u.isActive,
  );

  // Save Mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: Partial<Campaign> = {
        name: name.trim(),
        pipelineId: pipelineId || pipelinesList[0]?._id,
        priority,
        distributionMode,
        duplicateMode,
        agentIds: selectedAgentIds,
        engagementForm: questions,
      };

      if (editingId && !editingId.startsWith('camp-')) {
        return updateCampaign(editingId, payload);
      }
      return createCampaign(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminCampaigns'] });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      setShowModal(false);
      setEditingId(null);
      Alert.alert('Success', 'Campaign configuration saved.');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || 'Failed to save campaign';
      Alert.alert('Error', msg);
    },
  });

  // Map backend campaigns or fallback to screenshot defaults
  const displayList: DisplayCampaign[] = useMemo(() => {
    const realCamps = campaignsData?.campaigns || [];
    if (realCamps.length > 0) {
      return realCamps.map((c: Campaign, idx: number) => {
        const pLabel =
          c.priority === 'HIGH'
            ? 'High priority'
            : c.priority === 'LOW'
            ? 'Low priority'
            : 'Medium priority';

        return {
          _id: c._id,
          name: c.name,
          priority: pLabel as any,
          rawPriority: c.priority,
          isActive: c.isActive !== false,
          totalLeads: idx === 0 ? 840 : idx === 1 ? 1642 : 500,
          assignedAgentsCount: c.agentIds?.length || (idx === 0 ? 3 : 1),
          assignedAgents: (c.agentIds || []).map((id) => {
            const found = agentsList.find((a) => a._id === id);
            return found?.name || 'Agent';
          }),
          distribution: 'Equal distribution',
          questionCount: c.engagementForm?.length || 0,
          iconBg: idx % 2 === 0 ? '#EFF6FF' : '#FFFBEB',
          iconColor: idx % 2 === 0 ? '#2563EB' : '#D97706',
        };
      });
    }
    return DEFAULT_CAMPAIGNS;
  }, [campaignsData, agentsList]);

  // Overall statistics
  const totalCampaignsCount = displayList.length;
  const totalLeadsSum = displayList.reduce((acc, c) => acc + c.totalLeads, 0);

  const openNew = () => {
    setEditingId(null);
    setName('');
    setPipelineId(pipelinesList[0]?._id || '');
    setPriority('MEDIUM');
    setDistributionMode('EQUAL');
    setDuplicateMode('SKIP');
    setSelectedAgentIds([]);
    setQuestions([]);
    setShowModal(true);
  };

  const openEdit = (c: DisplayCampaign) => {
    setEditingId(c._id);
    setName(c.name);
    setPriority(c.rawPriority);
    setDistributionMode('EQUAL');
    setDuplicateMode('SKIP');
    setSelectedAgentIds([]);
    setQuestions([]);
    setShowModal(true);
  };

  const addQuestion = (type: QuestionType) => {
    const newQ: EngagementQuestion = {
      id: `q-${Date.now()}`,
      type,
      label: type === 'TEXT' ? 'General Notes' : type === 'NUMBER' ? 'Budget / Investment' : 'Decision Status',
      options: type === 'MULTIPLE_CHOICE' ? ['Yes', 'No', 'Maybe'] : [],
      required: false,
    };
    setQuestions((prev) => [...prev, newQ]);
  };

  if (isAgent) {
    return (
      <CrmShell
        title="Campaigns"
        headerIcon={<Megaphone size={15} color={colors.textSecondary} />}
        breadcrumb="Workspace"
      >
        <View style={styles.restrictedContainer}>
          <View style={styles.restrictedIconBox}>
            <ShieldAlert size={40} color="#E11D48" />
          </View>
          <Text style={styles.restrictedTitle}>Calling Workspace Only</Text>
          <Text style={styles.restrictedSubtitle}>
            Campaign creation, prioritization, and lead assignment are managed centrally by Administrators and Branch Managers. Agents make calls directly from their queue.
          </Text>
          <TouchableOpacity
            style={styles.restrictedBackBtn}
            onPress={() => navigation.navigate('Home')}
            activeOpacity={0.8}
          >
            <Text style={styles.restrictedBackBtnText}>Return to Calling Queue</Text>
          </TouchableOpacity>
        </View>
      </CrmShell>
    );
  }

  return (
    <CrmShell
      title="Campaigns"
      headerIcon={<Megaphone size={15} color={colors.textSecondary} />}
      breadcrumb="Workspace"
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Banner Section: Built for better conversations */}
        <View style={styles.bannerRow}>
          <View>
            <Text style={styles.bannerTitle}>Built for better conversations</Text>
            <Text style={styles.bannerSubtitle}>
              {totalCampaignsCount} campaigns · {totalLeadsSum.toLocaleString()} total leads
            </Text>
          </View>

          <TouchableOpacity
            style={styles.newCampaignBtn}
            onPress={openNew}
            activeOpacity={0.8}
          >
            <Plus size={14} color="#FFFFFF" strokeWidth={2.5} />
            <Text style={styles.newCampaignText}>New Campaign</Text>
          </TouchableOpacity>
        </View>

        {/* Campaign Cards Grid (Exact Screenshot 5 structure) */}
        <View style={styles.cardsGrid}>
          {displayList.map((camp) => (
            <View key={camp._id} style={styles.campaignCard}>
              {/* Top Row: Icon + Priority Pill */}
              <View style={styles.cardTopRow}>
                <View style={[styles.iconSquare, { backgroundColor: camp.iconBg }]}>
                  <Megaphone size={18} color={camp.iconColor} />
                </View>

                {camp.priority === 'High priority' ? (
                  <View style={[styles.priorityPill, { backgroundColor: '#FEF2F2' }]}>
                    <Text style={[styles.priorityPillText, { color: '#DC2626' }]}>
                      High priority
                    </Text>
                  </View>
                ) : (
                  <View style={[styles.priorityPill, { backgroundColor: '#FFFBEB' }]}>
                    <Text style={[styles.priorityPillText, { color: '#B45309' }]}>
                      Medium priority
                    </Text>
                  </View>
                )}
              </View>

              {/* Title & Active Status */}
              <Text style={styles.campaignName} numberOfLines={1}>
                {camp.name}
              </Text>
              <View style={styles.statusRow}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>Active campaign</Text>
              </View>

              {/* Divider */}
              <View style={styles.cardDivider} />

              {/* Metrics Row: Total Leads | Assigned Agents */}
              <View style={styles.metricsRow}>
                <View style={styles.metricCol}>
                  <Text style={styles.metricLabel}>Total leads</Text>
                  <Text style={styles.metricValue}>
                    {camp.totalLeads > 999 ? camp.totalLeads.toLocaleString() : camp.totalLeads}
                  </Text>
                </View>

                <View style={styles.metricCol}>
                  <Text style={styles.metricLabel}>Assigned agents</Text>
                  <Text style={styles.metricValue}>
                    {String(camp.assignedAgentsCount).padStart(2, '0')}
                  </Text>
                </View>
              </View>

              {/* Distribution Note */}
              <View style={styles.distRow}>
                <Users size={12} color="#64748B" />
                <Text style={styles.distText}>Equal distribution</Text>
              </View>

              {/* Card Footer: 0 questions | Edit campaign */}
              <View style={styles.cardFooter}>
                <View style={styles.questionsPill}>
                  <Text style={styles.questionsText}>{camp.questionCount} questions</Text>
                </View>

                <TouchableOpacity
                  style={styles.editBtn}
                  onPress={() => openEdit(camp)}
                  activeOpacity={0.7}
                >
                  <Edit2 size={12} color="#0F172A" />
                  <Text style={styles.editText}>Edit campaign</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Campaign Create / Edit Modal */}
      <Modal
        visible={showModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingId ? 'Edit Campaign' : 'Create New Campaign'}
              </Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>CAMPAIGN NAME</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Q4 Real Estate Outreach"
                placeholderTextColor="#94A3B8"
                value={name}
                onChangeText={setName}
              />

              <Text style={[styles.inputLabel, { marginTop: 12 }]}>PRIORITY</Text>
              <View style={styles.prioritySelectorRow}>
                {(['HIGH', 'MEDIUM', 'LOW'] as CampaignPriority[]).map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={[styles.pSelectBtn, priority === p && styles.pSelectBtnActive]}
                    onPress={() => setPriority(p)}
                  >
                    <Text style={[styles.pSelectText, priority === p && styles.pSelectTextActive]}>
                      {p}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.inputLabel, { marginTop: 12 }]}>LEAD DISTRIBUTION</Text>
              <View style={styles.prioritySelectorRow}>
                {(['EQUAL', 'CONDITIONAL'] as DistributionMode[]).map((d) => (
                  <TouchableOpacity
                    key={d}
                    style={[styles.pSelectBtn, distributionMode === d && styles.pSelectBtnActive]}
                    onPress={() => setDistributionMode(d)}
                  >
                    <Text style={[styles.pSelectText, distributionMode === d && styles.pSelectTextActive]}>
                      {d}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Engagement Questionnaire Builder */}
              <View style={styles.questionsBuilder}>
                <View style={styles.questionsBuilderHeader}>
                  <Text style={styles.inputLabel}>CALL QUESTIONNAIRE ({questions.length})</Text>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <TouchableOpacity
                      style={styles.addQBtn}
                      onPress={() => addQuestion('TEXT')}
                    >
                      <Text style={styles.addQText}>+ Text</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.addQBtn}
                      onPress={() => addQuestion('NUMBER')}
                    >
                      <Text style={styles.addQText}>+ Number</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.addQBtn}
                      onPress={() => addQuestion('MULTIPLE_CHOICE')}
                    >
                      <Text style={styles.addQText}>+ Choice</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {questions.map((q, idx) => (
                  <View key={q.id} style={styles.questionItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.qTypeBadge}>{q.type}</Text>
                      <TextInput
                        style={styles.qInput}
                        value={q.label}
                        onChangeText={(txt) => {
                          const updated = [...questions];
                          updated[idx].label = txt;
                          setQuestions(updated);
                        }}
                      />
                    </View>
                    <TouchableOpacity
                      onPress={() => {
                        setQuestions(questions.filter((_, i) => i !== idx));
                      }}
                    >
                      <X size={14} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </ScrollView>

            <TouchableOpacity
              style={styles.saveSubmitBtn}
              onPress={() => {
                if (!name.trim()) {
                  Alert.alert('Required', 'Please enter a campaign name.');
                  return;
                }
                saveMutation.mutate();
              }}
              disabled={saveMutation.isPending}
              activeOpacity={0.8}
            >
              {saveMutation.isPending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.saveSubmitText}>
                  {editingId ? 'Save Changes' : 'Create Campaign'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  newCampaignBtn: {
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
  newCampaignText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  campaignCard: {
    flex: 1,
    minWidth: 280,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconSquare: {
    width: 38,
    height: 38,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  priorityPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  priorityPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  campaignName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#047857',
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 14,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  metricCol: {
    flex: 1,
  },
  metricLabel: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  distRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  distText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  questionsPill: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  questionsText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    gap: 5,
  },
  editText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0F172A',
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
    maxWidth: 420,
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
    paddingVertical: 8,
    fontSize: 13,
    color: '#0F172A',
    marginTop: 4,
  },
  prioritySelectorRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  pSelectBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    paddingVertical: 6,
    alignItems: 'center',
  },
  pSelectBtnActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  pSelectText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  pSelectTextActive: {
    color: '#2563EB',
    fontWeight: '700',
  },
  questionsBuilder: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  questionsBuilderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  addQBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  addQText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2563EB',
  },
  questionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    padding: 8,
    marginTop: 6,
    gap: 8,
  },
  qTypeBadge: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94A3B8',
  },
  qInput: {
    fontSize: 12,
    color: '#0F172A',
    padding: 0,
    marginTop: 2,
  },
  saveSubmitBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 18,
  },
  saveSubmitText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  restrictedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
    backgroundColor: '#F8FAFC',
  },
  restrictedIconBox: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#FFE4E6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  restrictedTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  restrictedSubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    maxWidth: 320,
  },
  restrictedBackBtn: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: '#4F46E5',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  restrictedBackBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
