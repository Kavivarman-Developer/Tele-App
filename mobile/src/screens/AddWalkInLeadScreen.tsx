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

import { fetchCampaigns, createWalkInLead } from '../api/leadApi';
import { RootStackParamList, Campaign } from '../types';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { Card } from '../components/Card';

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
        'Lead Processed',
        `Walk-in lead "${name.trim()}" successfully created under campaign.`,
        [
          {
            text: 'View My Leads',
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
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      {/* Top Header */}
      <View className="bg-white px-4 py-3.5 border-b border-slate-200 flex-row justify-between items-center shadow-xs">
        <TouchableOpacity onPress={() => navigation.goBack()} className="p-1 -ml-1">
          <Text className="text-blue-600 text-sm font-bold">‹ Cancel</Text>
        </TouchableOpacity>
        <Text className="text-slate-900 font-bold text-base">Add Walk-in Lead</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Card className="mb-4">
          <Text className="text-slate-900 font-bold text-sm mb-3">Customer Information</Text>

          <Input
            label="Full Name *"
            placeholder="e.g. Rahul Verma"
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
            placeholder="rahul@example.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </Card>

        {/* Campaign Picker */}
        <Card className="mb-6">
          <Text className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">
            Target Campaign *
          </Text>

          {campaignsLoading ? (
            <ActivityIndicator size="small" color="#2563EB" />
          ) : campaigns.length === 0 ? (
            <Text className="text-slate-500 text-xs py-2">
              No active campaigns available for your account.
            </Text>
          ) : (
            <View className="gap-2">
              {campaigns.map((camp) => {
                const isSelected = selectedCampaignId === camp._id;
                return (
                  <TouchableOpacity
                    key={camp._id}
                    onPress={() => setSelectedCampaignId(camp._id)}
                    activeOpacity={0.8}
                    className={`p-3.5 rounded-xl border flex-row justify-between items-center ${
                      isSelected
                        ? 'bg-blue-50 border-blue-500'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <View className="flex-1 mr-2">
                      <Text
                        className={`text-sm font-semibold ${
                          isSelected ? 'text-blue-700 font-bold' : 'text-slate-800'
                        }`}
                      >
                        {camp.name}
                      </Text>
                      <Text className="text-slate-500 text-xs mt-0.5">
                        Priority: {camp.priority} • Mode: {camp.distributionMode}
                      </Text>
                    </View>
                    {isSelected ? (
                      <Text className="text-blue-600 font-bold text-base">✓</Text>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </Card>

        <Button
          title={createLeadMutation.isPending ? 'Saving Lead...' : 'Create Walk-in Lead'}
          onPress={handleSubmit}
          loading={createLeadMutation.isPending}
          disabled={createLeadMutation.isPending}
        />
      </ScrollView>
    </SafeAreaView>
  );
};
