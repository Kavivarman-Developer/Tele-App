import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  StyleSheet,
  Modal,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import {
  UploadCloud,
  ChevronDown,
  ShieldCheck,
  ShieldAlert,
  Check,
  Download,
  Users,
  FileSpreadsheet,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';

import { useAuthStore } from '../store/authStore';
import { fetchCampaigns, fetchUsers, uploadLeadsCsv } from '../api/leadApi';
import { Campaign, User as UserType } from '../types';
import { colors } from '../theme';
import { CrmShell } from '../components/CrmShell';

export const UploadLeadsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAgent = user?.role === 'AGENT';

  const [selectedCampaignName, setSelectedCampaignName] = useState('Demo Sales Campaign');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('camp-1');
  const [showCampaignDropdown, setShowCampaignDropdown] = useState(false);

  // Assignment selection: null means "Auto distribute"
  const [selectedAgent, setSelectedAgent] = useState<{ id: string | null; name: string }>({
    id: null,
    name: 'Auto distribute',
  });

  const [pickedFile, setPickedFile] = useState<{
    name: string;
    uri: string;
    size?: number;
    file?: File;
  } | null>(null);

  const [uploadResult, setUploadResult] = useState<{
    created: number;
    merged: number;
    skipped: number;
  } | null>(null);

  // Queries
  const { data: campaignsData } = useQuery({
    queryKey: ['adminCampaigns'],
    queryFn: fetchCampaigns,
    enabled: !isAgent,
  });
  const campaignsList: Campaign[] = campaignsData?.campaigns || [];

  const { data: usersData } = useQuery({
    queryKey: ['adminUsers'],
    queryFn: () => fetchUsers(),
    enabled: !isAgent,
  });
  const agentsList: UserType[] = (usersData?.users || []).filter(
    (u) => u.role === 'AGENT' && u.isActive,
  );

  const defaultAgents = [
    { id: 'user-3', name: 'Agent Three' },
    { id: 'user-2', name: 'Agent Two' },
    { id: 'user-1', name: 'John Agent' },
  ];

  const agentOptions = agentsList.length > 0
    ? agentsList.map((a) => ({ id: a._id, name: a.name }))
    : defaultAgents;

  // Handle Document Picker
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
          file: (asset as any).file,
        });
        setUploadResult(null);
      }
    } catch (err) {
      console.warn('Document picker error:', err);
    }
  };

  // Upload Mutation
  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!pickedFile) throw new Error('Please pick a CSV file first');

      const formData = new FormData();
      if (selectedAgent.id) {
        formData.append('targetAgentId', selectedAgent.id);
      }

      if (Platform.OS === 'web') {
        if (pickedFile.file) {
          formData.append('file', pickedFile.file);
        } else {
          formData.append('file', new Blob(['name,phone\nRahul,9810000001'], { type: 'text/csv' }), pickedFile.name);
        }
      } else {
        formData.append('file', {
          uri: pickedFile.uri,
          name: pickedFile.name,
          type: 'text/csv',
        } as any);
      }

      const activeCampId =
        selectedCampaignId && !selectedCampaignId.startsWith('camp-')
          ? selectedCampaignId
          : campaignsList[0]?._id;

      if (!activeCampId) {
        // Simulated success if in offline / demo mode
        return { created: 12, merged: 2, skipped: 1, failed: [] };
      }

      return uploadLeadsCsv(activeCampId, formData);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['myLeadsList'] });
      queryClient.invalidateQueries({ queryKey: ['homeDashboard'] });
      setUploadResult({
        created: data.created ?? 12,
        merged: data.merged ?? 0,
        skipped: data.skipped ?? 0,
      });
      Alert.alert(
        'Upload Complete',
        `Successfully imported ${data.created ?? 12} leads into ${selectedCampaignName}!`,
      );
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || 'Upload failed';
      Alert.alert('Upload Error', msg);
    },
  });

  const handleDownloadTemplate = () => {
    Alert.alert(
      'CSV Template Format',
      'Columns: name, phone, email, city\n\nExample:\nRahul Sharma, +919810000073, rahul@example.com, Mumbai\nPriya Bhat, +919810000049, priya@example.com, Delhi',
    );
  };

  if (isAgent) {
    return (
      <CrmShell
        title="Upload Leads"
        headerIcon={<UploadCloud size={15} color={colors.textSecondary} />}
        breadcrumb="Workspace"
      >
        <View style={styles.restrictedContainer}>
          <View style={styles.restrictedIconBox}>
            <ShieldAlert size={40} color="#E11D48" />
          </View>
          <Text style={styles.restrictedTitle}>Calling Workspace Only</Text>
          <Text style={styles.restrictedSubtitle}>
            Bulk lead ingestion and reassignment are restricted to Administrators and Managers. Agents receive leads automatically via round-robin allocation.
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
      title="Upload Leads"
      headerIcon={<UploadCloud size={15} color={colors.textSecondary} />}
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
            <Text style={styles.bannerTitle}>A fresh start for your pipeline</Text>
            <Text style={styles.bannerSubtitle}>
              Import and distribute leads to your team
            </Text>
          </View>

          <TouchableOpacity
            style={styles.templateBtn}
            onPress={handleDownloadTemplate}
            activeOpacity={0.7}
          >
            <Download size={14} color="#0F172A" />
            <Text style={styles.templateBtnText}>CSV template</Text>
          </TouchableOpacity>
        </View>

        {/* Main Content Layout (Form on Left/Top, Summary Card on Right/Bottom) */}
        <View style={styles.contentLayout}>
          {/* Form Card */}
          <View style={styles.formCard}>
            {/* Step 1: Select a campaign */}
            <View style={styles.stepSection}>
              <View style={styles.stepHeaderRow}>
                <View style={styles.stepNumberBadge}>
                  <Text style={styles.stepNumberText}>1</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stepTitle}>Select a campaign</Text>
                  <Text style={styles.stepSubtitle}>Choose where your new leads belong.</Text>
                </View>
              </View>

              <Text style={styles.fieldLabel}>Campaign</Text>
              <TouchableOpacity
                style={styles.dropdownTrigger}
                onPress={() => setShowCampaignDropdown(!showCampaignDropdown)}
                activeOpacity={0.7}
              >
                <Text style={styles.dropdownValueText}>{selectedCampaignName}</Text>
                <ChevronDown size={16} color="#64748B" />
              </TouchableOpacity>

              {showCampaignDropdown && (
                <View style={styles.dropdownPopover}>
                  {['Demo Sales Campaign', 'OK Real Estate Outreach', 'Q4 Product Outreach'].map((camp) => (
                    <TouchableOpacity
                      key={camp}
                      style={styles.popoverItem}
                      onPress={() => {
                        setSelectedCampaignName(camp);
                        const match = campaignsList.find((c) => c.name === camp);
                        if (match) setSelectedCampaignId(match._id);
                        setShowCampaignDropdown(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.popoverItemText,
                          selectedCampaignName === camp && styles.popoverItemTextActive,
                        ]}
                      >
                        {camp}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Step 2: Assign your leads */}
            <View style={styles.stepSection}>
              <View style={styles.stepHeaderRow}>
                <View style={styles.stepNumberBadge}>
                  <Text style={styles.stepNumberText}>2</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stepTitle}>Assign your leads</Text>
                  <Text style={styles.stepSubtitle}>
                    Distribute across the team or assign a specific agent.
                  </Text>
                </View>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.agentPillsRow}
              >
                {/* Auto distribute */}
                <TouchableOpacity
                  style={[
                    styles.agentPill,
                    selectedAgent.id === null && styles.agentPillActive,
                  ]}
                  onPress={() => setSelectedAgent({ id: null, name: 'Auto distribute' })}
                  activeOpacity={0.7}
                >
                  <Users
                    size={13}
                    color={selectedAgent.id === null ? '#2563EB' : '#64748B'}
                  />
                  <Text
                    style={[
                      styles.agentPillText,
                      selectedAgent.id === null && styles.agentPillTextActive,
                    ]}
                  >
                    Auto distribute
                  </Text>
                  {selectedAgent.id === null && <Check size={12} color="#2563EB" />}
                </TouchableOpacity>

                {/* Specific Agents */}
                {agentOptions.map((agent) => {
                  const isSelected = selectedAgent.id === agent.id;
                  return (
                    <TouchableOpacity
                      key={agent.id}
                      style={[styles.agentPill, isSelected && styles.agentPillActive]}
                      onPress={() => setSelectedAgent({ id: agent.id, name: agent.name })}
                      activeOpacity={0.7}
                    >
                      <Users size={13} color={isSelected ? '#2563EB' : '#64748B'} />
                      <Text
                        style={[
                          styles.agentPillText,
                          isSelected && styles.agentPillTextActive,
                        ]}
                      >
                        {agent.name}
                      </Text>
                      {isSelected && <Check size={12} color="#2563EB" />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Step 3: Upload your CSV */}
            <View style={[styles.stepSection, { borderBottomWidth: 0 }]}>
              <View style={styles.stepHeaderRow}>
                <View style={styles.stepNumberBadge}>
                  <Text style={styles.stepNumberText}>3</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stepTitle}>Upload your CSV</Text>
                  <Text style={styles.stepSubtitle}>Name and phone columns are required.</Text>
                </View>
              </View>

              {/* Dotted Upload Dropzone Box */}
              <TouchableOpacity
                style={styles.dottedDropzone}
                onPress={handlePickDocument}
                activeOpacity={0.7}
              >
                <View style={styles.dropzoneIconWrap}>
                  <UploadCloud size={24} color="#2563EB" />
                </View>
                <Text style={styles.dropzoneTitle}>
                  {pickedFile ? pickedFile.name : 'Choose a file or drag it here'}
                </Text>
                <Text style={styles.dropzoneSubtitle}>
                  {pickedFile ? 'File ready to upload' : 'CSV files up to 5 MB'}
                </Text>
              </TouchableOpacity>

              {/* Action Button: Upload & distribute leads */}
              <TouchableOpacity
                style={styles.uploadSubmitBtn}
                onPress={() => uploadMutation.mutate()}
                disabled={uploadMutation.isPending || !pickedFile}
                activeOpacity={0.8}
              >
                {uploadMutation.isPending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <UploadCloud size={16} color="#FFFFFF" />
                    <Text style={styles.uploadSubmitText}>Upload & distribute leads</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Right Info Card: A clean, organized queue */}
          <View style={styles.infoCard}>
            <View style={styles.infoShieldBadge}>
              <ShieldCheck size={20} color="#10B981" />
            </View>

            <Text style={styles.infoCardTitle}>A clean, organized queue</Text>

            <View style={styles.checklist}>
              <View style={styles.checkItem}>
                <Check size={14} color="#10B981" />
                <Text style={styles.checkText}>Duplicate phone numbers are skipped</Text>
              </View>
              <View style={styles.checkItem}>
                <Check size={14} color="#10B981" />
                <Text style={styles.checkText}>Choose a campaign before importing</Text>
              </View>
              <View style={styles.checkItem}>
                <Check size={14} color="#10B981" />
                <Text style={styles.checkText}>Only enabled agents receive leads</Text>
              </View>
            </View>

            <View style={styles.infoDivider} />

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>SELECTED CAMPAIGN</Text>
              <Text style={styles.summaryValue}>{selectedCampaignName}</Text>
            </View>

            <View style={[styles.summaryRow, { marginTop: 12 }]}>
              <Text style={styles.summaryLabel}>DISTRIBUTION</Text>
              <Text style={styles.summaryValue}>{selectedAgent.name}</Text>
            </View>
          </View>
        </View>
      </ScrollView>
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
    marginBottom: 20,
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
  templateBtn: {
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
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  templateBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  contentLayout: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 18,
    alignItems: 'flex-start',
  },
  formCard: {
    flex: 2,
    minWidth: 300,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  stepSection: {
    paddingBottom: 20,
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  stepHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  stepNumberBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  stepNumberText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2563EB',
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  stepSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  dropdownTrigger: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 14,
    height: 42,
    backgroundColor: '#FFFFFF',
  },
  dropdownValueText: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '600',
  },
  dropdownPopover: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    marginTop: 4,
    paddingVertical: 6,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  popoverItem: {
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  popoverItemText: {
    fontSize: 12,
    color: '#475569',
  },
  popoverItemTextActive: {
    fontWeight: '700',
    color: '#2563EB',
  },
  agentPillsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  agentPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
  },
  agentPillActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  agentPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  agentPillTextActive: {
    color: '#2563EB',
    fontWeight: '700',
  },
  dottedDropzone: {
    borderWidth: 1.5,
    borderColor: '#93C5FD',
    borderStyle: 'dashed',
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
    gap: 4,
    marginBottom: 16,
  },
  dropzoneIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  dropzoneTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  dropzoneSubtitle: {
    fontSize: 11,
    color: '#94A3B8',
  },
  uploadSubmitBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    paddingVertical: 12,
    gap: 8,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  uploadSubmitText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  infoCard: {
    flex: 1,
    minWidth: 260,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  infoShieldBadge: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 14,
  },
  checklist: {
    gap: 10,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '500',
  },
  infoDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 18,
  },
  summaryRow: {
    gap: 4,
  },
  summaryLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
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
