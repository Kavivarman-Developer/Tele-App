import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  Linking,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, UserPlus, Layers, Check, Phone, Mail, User, PhoneCall, BookmarkCheck } from 'lucide-react-native';

import { fetchCampaigns, createWalkInLead } from '../api/leadApi';
import { RootStackParamList, Campaign } from '../types';
import { Input } from '../components/Input';
import { CrmBadge } from '../components/CrmBadge';
import { useAuthStore } from '../store/authStore';
import { getDialerTelUrl } from '../utils/phoneUtils';
import { toast } from '../store/toastStore';
import { shadows } from '../theme';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const AddWalkInLeadScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const [name, setName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [isDialAfterSave, setIsDialAfterSave] = useState<boolean>(false);

  // Fetch campaigns assigned to current user
  const { data: campaignData, isLoading: campaignsLoading } = useQuery({
    queryKey: ['campaigns'],
    queryFn: fetchCampaigns,
  });

  const campaigns: Campaign[] = (campaignData?.campaigns || []).filter(
    (c) => c.isActive !== false,
  );

  // Set default campaign when loaded
  React.useEffect(() => {
    if (!selectedCampaignId && campaigns.length > 0) {
      setSelectedCampaignId(campaigns[0]._id);
    }
  }, [campaigns, selectedCampaignId]);

  // Mutation for creating walk-in lead
  const createLeadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCampaignId) throw new Error('Please select a campaign');
      return createWalkInLead(selectedCampaignId, {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['myLeads'] });
      queryClient.invalidateQueries({ queryKey: ['followUps'] });
      queryClient.invalidateQueries({ queryKey: ['myLeadsList'] });
      queryClient.invalidateQueries({ queryKey: ['homeMyLeadsQueue'] });
      queryClient.invalidateQueries({ queryKey: ['homeDashboard'] });

      if (isDialAfterSave && phone.trim()) {
        toast.info(`Dialing ${name.trim()}...`, 'Calling');
        Linking.openURL(getDialerTelUrl(phone.trim())).catch(() => {
          Alert.alert('Call Error', 'Could not open phone dialer on this device.');
        });
        navigation.goBack();
        return;
      }

      toast.success(`Walk-in lead "${name.trim()}" added to queue`, 'Lead Saved');
      navigation.goBack();
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to create lead';
      Alert.alert('Creation Failed', msg);
    },
  });

  const handleValidateAndSubmit = (dialNow: boolean) => {
    if (!name.trim()) {
      Alert.alert('Validation Error', 'Customer full name is required.');
      return;
    }

    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      Alert.alert('Validation Error', 'Please enter a valid 10-digit phone number.');
      return;
    }

    if (!selectedCampaignId) {
      Alert.alert('Validation Error', 'Please select a campaign for this lead.');
      return;
    }

    setIsDialAfterSave(dialNow);
    createLeadMutation.mutate();
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Top Header */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.cancelBtn}
          activeOpacity={0.7}
        >
          <ArrowLeft size={18} color="#64748B" />
          <Text style={styles.cancelBtnText}>CANCEL</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Walk-in Lead</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Customer Information Card (Compact 3 Fields) */}
        <View style={styles.formCard}>
          <View style={styles.cardHeadingRow}>
            <UserPlus size={18} color="#4F46E5" />
            <Text style={styles.cardHeadingTitle}>Customer Details</Text>
          </View>

          <Input
            label="Full Name *"
            placeholder="e.g. Ramesh Sundaram"
            value={name}
            onChangeText={setName}
          />

          <Input
            label="Phone Number *"
            placeholder="10-digit mobile number"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />

          <Input
            label="Email Address (Optional)"
            placeholder="ramesh@gmail.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        {/* Campaign Selection Card */}
        <View style={styles.formCard}>
          <View style={styles.cardHeadingRow}>
            <Layers size={18} color="#4F46E5" />
            <Text style={styles.cardHeadingTitle}>Target Campaign *</Text>
          </View>
          <Text style={styles.cardHeadingSub}>
            Select which campaign will receive and prioritize this lead
          </Text>

          {campaignsLoading ? (
            <ActivityIndicator size="small" color="#4F46E5" />
          ) : campaigns.length === 0 ? (
            <Text style={{ fontSize: 12, color: '#64748B', paddingVertical: 8 }}>
              No active campaigns available for your account.
            </Text>
          ) : (
            <View style={{ gap: 8 }}>
              {campaigns.map((camp) => {
                const isSelected = selectedCampaignId === camp._id;
                return (
                  <TouchableOpacity
                    key={camp._id}
                    onPress={() => setSelectedCampaignId(camp._id)}
                    activeOpacity={0.8}
                    style={[
                      styles.campaignOptionCard,
                      isSelected && styles.campaignOptionCardActive,
                    ]}
                  >
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text
                        style={[
                          styles.campaignNameText,
                          isSelected && { color: '#312E81' },
                        ]}
                      >
                        {camp.name}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
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
                        <Text style={{ fontSize: 11, color: '#94A3B8' }}>
                          Mode: {camp.distributionMode}
                        </Text>
                      </View>
                    </View>
                    {isSelected ? (
                      <View style={styles.selectedCheckCircle}>
                        <Check size={14} color="#FFFFFF" strokeWidth={3} />
                      </View>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Two Clear CTA Buttons (Save to Queue / Save & Call Now) */}
        <View style={styles.actionButtonsCol}>
          {/* 1. Save & Call Now (Emerald Green, min 48px) */}
          <TouchableOpacity
            style={[styles.primaryActionBtn, styles.callNowBtn, createLeadMutation.isPending && { opacity: 0.7 }]}
            onPress={() => handleValidateAndSubmit(true)}
            disabled={createLeadMutation.isPending}
            activeOpacity={0.85}
          >
            {createLeadMutation.isPending && isDialAfterSave ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <PhoneCall size={18} color="#FFFFFF" strokeWidth={2.5} />
                <Text style={styles.callNowBtnText}>SAVE & CALL NOW</Text>
              </>
            )}
          </TouchableOpacity>

          {/* 2. Save to Queue (Clean Outline/Indigo, min 48px) */}
          <TouchableOpacity
            style={[styles.primaryActionBtn, styles.saveQueueBtn, createLeadMutation.isPending && { opacity: 0.7 }]}
            onPress={() => handleValidateAndSubmit(false)}
            disabled={createLeadMutation.isPending}
            activeOpacity={0.85}
          >
            {createLeadMutation.isPending && !isDialAfterSave ? (
              <ActivityIndicator size="small" color="#4F46E5" />
            ) : (
              <>
                <BookmarkCheck size={18} color="#4F46E5" strokeWidth={2.5} />
                <Text style={styles.saveQueueBtnText}>Save to My Queue</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: Platform.OS === 'android' ? 6 : 0,
  },
  topHeader: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 4,
  },
  cancelBtnText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  headerTitle: {
    color: '#0F172A',
    fontWeight: '800',
    fontSize: 16,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 110,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    ...shadows.soft,
  },
  cardHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  cardHeadingTitle: {
    color: '#0F172A',
    fontWeight: '800',
    fontSize: 15,
  },
  cardHeadingSub: {
    color: '#64748B',
    fontSize: 12,
    marginBottom: 12,
    lineHeight: 16,
  },
  campaignOptionCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  campaignOptionCardActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#4F46E5',
  },
  campaignNameText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  selectedCheckCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonsCol: {
    gap: 12,
    marginTop: 6,
  },
  primaryActionBtn: {
    minHeight: 52,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  callNowBtn: {
    backgroundColor: '#10B981',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 3,
  },
  callNowBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  saveQueueBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#C7D2FE',
  },
  saveQueueBtnText: {
    color: '#4F46E5',
    fontSize: 14,
    fontWeight: '800',
  },
});
