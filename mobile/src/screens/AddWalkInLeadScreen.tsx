import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, UserPlus, Layers, Check, Phone, Mail, User } from 'lucide-react-native';

import { fetchCampaigns, createWalkInLead } from '../api/leadApi';
import { RootStackParamList, Campaign } from '../types';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { CrmBadge } from '../components/CrmBadge';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const AddWalkInLeadScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const queryClient = useQueryClient();

  const [name, setName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);

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

      if (Platform.OS === 'web') {
        window.alert(`Walk-in lead "${name.trim()}" successfully created!`);
        navigation.goBack();
        return;
      }

      Alert.alert(
        'Lead Created',
        `Walk-in lead "${name.trim()}" successfully added to campaign queue.`,
        [
          {
            text: 'View Leads',
            onPress: () => navigation.goBack(),
          },
        ],
      );
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to create lead';
      if (Platform.OS === 'web') {
        window.alert(`Creation Failed: ${msg}`);
      } else {
        Alert.alert('Creation Failed', msg);
      }
    },
  });

  const handleSubmit = () => {
    if (!name.trim()) {
      if (Platform.OS === 'web') {
        window.alert('Validation Error: Customer name is required.');
      } else {
        Alert.alert('Validation Error', 'Customer name is required.');
      }
      return;
    }

    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      if (Platform.OS === 'web') {
        window.alert('Validation Error: Please enter a valid 10-digit phone number.');
      } else {
        Alert.alert('Validation Error', 'Please enter a valid 10-digit phone number.');
      }
      return;
    }

    if (!selectedCampaignId) {
      if (Platform.OS === 'web') {
        window.alert('Validation Error: Please select a campaign for this lead.');
      } else {
        Alert.alert('Validation Error', 'Please select a campaign for this lead.');
      }
      return;
    }

    createLeadMutation.mutate();
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F8FAFC]" edges={['top']}>
      {/* Top Header */}
      <View className="bg-white px-4 py-3.5 border-b border-slate-200 flex-row justify-between items-center">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="flex-row items-center gap-1.5 p-1 -ml-1"
        >
          <ArrowLeft size={18} color="#64748B" />
          <Text className="text-slate-600 text-xs font-bold uppercase tracking-wider">Cancel</Text>
        </TouchableOpacity>
        <Text className="text-slate-900 font-bold text-base">Add Walk-in Lead</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Customer Information Card */}
        <View className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm mb-4">
          <View className="flex-row items-center gap-2 mb-4">
            <UserPlus size={18} color="#4F46E5" />
            <Text className="text-slate-900 font-bold text-sm">Customer Details</Text>
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
        <View className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm mb-6">
          <View className="flex-row items-center gap-2 mb-2">
            <Layers size={18} color="#4F46E5" />
            <Text className="text-slate-900 font-bold text-sm">Target Campaign *</Text>
          </View>
          <Text className="text-slate-500 text-xs mb-3 font-medium">
            Select which campaign will receive and prioritize this lead
          </Text>

          {campaignsLoading ? (
            <ActivityIndicator size="small" color="#4F46E5" />
          ) : campaigns.length === 0 ? (
            <Text className="text-slate-500 text-xs py-2">
              No active campaigns available for your account.
            </Text>
          ) : (
            <View className="gap-2.5">
              {campaigns.map((camp) => {
                const isSelected = selectedCampaignId === camp._id;
                return (
                  <TouchableOpacity
                    key={camp._id}
                    onPress={() => setSelectedCampaignId(camp._id)}
                    activeOpacity={0.8}
                    className={`p-3.5 rounded-xl border flex-row justify-between items-center ${
                      isSelected
                        ? 'bg-indigo-50 border-indigo-600 shadow-sm'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <View className="flex-1 mr-2">
                      <Text
                        className={`text-sm font-bold ${
                          isSelected ? 'text-indigo-900' : 'text-slate-900'
                        }`}
                      >
                        {camp.name}
                      </Text>
                      <View className="flex-row items-center gap-2 mt-1">
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
                        <Text className="text-slate-400 text-[11px] font-medium">
                          Mode: {camp.distributionMode}
                        </Text>
                      </View>
                    </View>
                    {isSelected ? (
                      <View className="w-6 h-6 rounded-full bg-indigo-600 items-center justify-center">
                        <Check size={14} color="#FFFFFF" strokeWidth={3} />
                      </View>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        <Button
          title={createLeadMutation.isPending ? 'Saving Lead...' : 'Create Walk-in Lead'}
          onPress={handleSubmit}
          loading={createLeadMutation.isPending}
          disabled={createLeadMutation.isPending}
          variant="primary"
        />
      </ScrollView>
    </SafeAreaView>
  );
};
