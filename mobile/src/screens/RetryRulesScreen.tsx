import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Switch,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  RotateCw,
  Save,
  ShieldAlert,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';

import { useAuthStore } from '../store/authStore';
import { fetchRetryRules, updateRetryRule } from '../api/leadApi';
import { RetryRule } from '../types';
import { colors } from '../theme';
import { CrmShell } from '../components/CrmShell';

interface DisplayRetryItem {
  id: string;
  reasonKey: string;
  title: string;
  subtitle: string;
  firstRetryMin: string;
  secondRetryMin: string;
  enabled: boolean;
}

const DEFAULT_RULES: DisplayRetryItem[] = [
  {
    id: 'rule-1',
    reasonKey: 'BUSY',
    title: 'Busy',
    subtitle: 'Automatic retry scheduled',
    firstRetryMin: '10',
    secondRetryMin: '720',
    enabled: true,
  },
  {
    id: 'rule-2',
    reasonKey: 'CALL_NOT_COMPLETED',
    title: 'Call not completed',
    subtitle: 'Automatic retry scheduled',
    firstRetryMin: '15',
    secondRetryMin: '1440',
    enabled: true,
  },
  {
    id: 'rule-3',
    reasonKey: 'DID_NOT_PICK',
    title: 'Did not pick',
    subtitle: 'Automatic retry scheduled',
    firstRetryMin: '60',
    secondRetryMin: '1440',
    enabled: true,
  },
  {
    id: 'rule-4',
    reasonKey: 'INCOMING_NOT_AVAILABLE',
    title: 'Incoming not available',
    subtitle: 'No retry configured',
    firstRetryMin: '60',
    secondRetryMin: '1440',
    enabled: false,
  },
  {
    id: 'rule-5',
    reasonKey: 'INVALID_NUMBER',
    title: 'Invalid number',
    subtitle: 'No retry configured',
    firstRetryMin: '60',
    secondRetryMin: '1440',
    enabled: false,
  },
];

export const RetryRulesScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAgent = user?.role === 'AGENT';

  const { data: retryRulesData, isLoading } = useQuery({
    queryKey: ['adminRetryRules'],
    queryFn: fetchRetryRules,
    enabled: !isAgent,
  });
  const backendRules: RetryRule[] = retryRulesData?.retryRules || [];

  // Local state for interactive editing
  const [rules, setRules] = useState<DisplayRetryItem[]>(DEFAULT_RULES);

  // Sync from backend when loaded
  React.useEffect(() => {
    if (backendRules.length > 0) {
      setRules((prev) => {
        return prev.map((item) => {
          const matched = backendRules.find((r) => r.reason === item.reasonKey);
          if (matched) {
            const step1 = matched.steps?.[0]?.delayMinutes ? String(matched.steps[0].delayMinutes) : item.firstRetryMin;
            const step2 = matched.steps?.[1]?.delayMinutes ? String(matched.steps[1].delayMinutes) : item.secondRetryMin;
            return {
              ...item,
              id: matched._id,
              enabled: matched.enabled,
              firstRetryMin: step1,
              secondRetryMin: step2,
              subtitle: matched.enabled ? 'Automatic retry scheduled' : 'No retry configured',
            };
          }
          return item;
        });
      });
    }
  }, [backendRules]);

  // Mutation to update rule
  const updateMutation = useMutation({
    mutationFn: async (updatedList: DisplayRetryItem[]) => {
      for (const item of updatedList) {
        if (!item.id.startsWith('rule-')) {
          await updateRetryRule(item.id, {
            enabled: item.enabled,
            steps: [
              { delayMinutes: parseInt(item.firstRetryMin, 10) || 15 },
              { delayMinutes: parseInt(item.secondRetryMin, 10) || 1440 },
            ],
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminRetryRules'] });
      Alert.alert('Saved', 'Retry rules schedule saved successfully.');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || 'Failed to save rules';
      Alert.alert('Save Failed', msg);
    },
  });

  const handleToggle = (index: number) => {
    setRules((prev) => {
      const next = [...prev];
      const cur = next[index];
      const newEnabled = !cur.enabled;
      next[index] = {
        ...cur,
        enabled: newEnabled,
        subtitle: newEnabled ? 'Automatic retry scheduled' : 'No retry configured',
      };
      return next;
    });
  };

  const handleUpdateStep = (index: number, field: 'first' | 'second', val: string) => {
    setRules((prev) => {
      const next = [...prev];
      if (field === 'first') {
        next[index].firstRetryMin = val;
      } else {
        next[index].secondRetryMin = val;
      }
      return next;
    });
  };

  if (isAgent) {
    return (
      <CrmShell
        title="Retry Rules"
        headerIcon={<RotateCw size={15} color={colors.textSecondary} />}
        breadcrumb="Workspace"
      >
        <View style={styles.restrictedContainer}>
          <View style={styles.restrictedIconBox}>
            <ShieldAlert size={40} color="#E11D48" />
          </View>
          <Text style={styles.restrictedTitle}>Calling Workspace Only</Text>
          <Text style={styles.restrictedSubtitle}>
            Cadence & retry intervals are configured centrally by Administrators. Agents are restricted from modifying retry policies.
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
      title="Retry Rules"
      headerIcon={<RotateCw size={15} color={colors.textSecondary} />}
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
            <Text style={styles.bannerTitle}>A smarter next attempt</Text>
            <Text style={styles.bannerSubtitle}>
              Schedule another call when the first doesn't connect
            </Text>
          </View>

          <TouchableOpacity
            style={styles.saveRulesBtn}
            onPress={() => updateMutation.mutate(rules)}
            disabled={updateMutation.isPending}
            activeOpacity={0.8}
          >
            {updateMutation.isPending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Save size={14} color="#FFFFFF" strokeWidth={2.5} />
                <Text style={styles.saveRulesText}>Save rules</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Rules Table (Exact Screenshot 8 structure) */}
        <View style={styles.rulesCard}>
          {/* Table Header Row */}
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.thCell, { flex: 2.8 }]}>Call outcome</Text>
            <Text style={[styles.thCell, { flex: 3.2 }]}>Retry schedule</Text>
            <Text style={[styles.thCell, { flex: 1.0, textAlign: 'right' }]}>Enabled</Text>
          </View>

          {/* Table Rows */}
          {rules.map((item, index) => {
            const isLast = index === rules.length - 1;

            return (
              <View
                key={item.id || item.reasonKey}
                style={[styles.tableDataRow, isLast && { borderBottomWidth: 0 }]}
              >
                {/* Column 1: Call outcome */}
                <View style={[styles.tdCell, { flex: 2.8, flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
                  <View style={styles.iconCircle}>
                    <RotateCw size={15} color="#64748B" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.outcomeTitle}>{item.title}</Text>
                    <Text style={styles.outcomeSubtitle}>{item.subtitle}</Text>
                  </View>
                </View>

                {/* Column 2: Retry schedule (First retry & Second retry inputs) */}
                <View style={[styles.tdCell, { flex: 3.2, flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
                  {/* First retry */}
                  <View style={styles.retryInputWrap}>
                    <Text style={styles.retryInputLabel}>First retry</Text>
                    <View style={[styles.inputBox, !item.enabled && styles.inputBoxDisabled]}>
                      <TextInput
                        style={[styles.numericInput, !item.enabled && styles.numericInputDisabled]}
                        value={item.firstRetryMin}
                        onChangeText={(txt) => handleUpdateStep(index, 'first', txt)}
                        keyboardType="numeric"
                        editable={item.enabled}
                      />
                      <Text style={styles.minLabel}>min</Text>
                    </View>
                  </View>

                  {/* Second retry */}
                  <View style={styles.retryInputWrap}>
                    <Text style={styles.retryInputLabel}>Second retry</Text>
                    <View style={[styles.inputBox, !item.enabled && styles.inputBoxDisabled]}>
                      <TextInput
                        style={[styles.numericInput, !item.enabled && styles.numericInputDisabled]}
                        value={item.secondRetryMin}
                        onChangeText={(txt) => handleUpdateStep(index, 'second', txt)}
                        keyboardType="numeric"
                        editable={item.enabled}
                      />
                      <Text style={styles.minLabel}>min</Text>
                    </View>
                  </View>
                </View>

                {/* Column 3: Enabled Switch */}
                <View style={[styles.tdCell, { flex: 1.0, alignItems: 'flex-end' }]}>
                  <Switch
                    value={item.enabled}
                    onValueChange={() => handleToggle(index)}
                    trackColor={{ false: '#E2E8F0', true: '#3B82F6' }}
                    thumbColor="#FFFFFF"
                  />
                </View>
              </View>
            );
          })}
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
  saveRulesBtn: {
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
  saveRulesText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  rulesCard: {
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
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  thCell: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  tableDataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  tdCell: {
    justifyContent: 'center',
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  outcomeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  outcomeSubtitle: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
  },
  retryInputWrap: {
    gap: 4,
  },
  retryInputLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: '#94A3B8',
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    height: 32,
    width: 82,
    justifyContent: 'space-between',
  },
  inputBoxDisabled: {
    backgroundColor: '#F8FAFC',
    borderColor: '#F1F5F9',
  },
  numericInput: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    padding: 0,
    flex: 1,
  },
  numericInputDisabled: {
    color: '#CBD5E1',
  },
  minLabel: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '500',
    marginLeft: 4,
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
