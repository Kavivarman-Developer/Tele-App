import React, { useEffect, useMemo, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Alert,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, History, MessageCircle, Phone, X } from 'lucide-react-native';

import { fetchLeadHistory } from '../api/leadApi';
import { Activity, Lead, RootStackParamList } from '../types';
import { useAuthStore } from '../store/authStore';
import { useLeadHistoryStore } from '../store/leadHistoryStore';
import { formatDisplayPhone, getDialerTelUrl, isLeadLostOrSuppressed } from '../utils/phoneUtils';
import { LeadTimeline, deduplicateActivities } from './LeadTimeline';
import { WhatsAppTemplateModal } from './WhatsAppTemplateModal';

interface LeadSummaryModalProps {
  lead: Lead | null;
  visible: boolean;
  onClose: () => void;
  onOpenDisposition?: (lead: Lead) => void;
  onOpenFullDispose?: (lead: Lead) => void;
}

type ModalTab = 'SUMMARY' | 'HISTORY';

export const LeadSummaryModal: React.FC<LeadSummaryModalProps> = ({
  lead,
  visible,
  onClose,
  onOpenDisposition,
  onOpenFullDispose,
}) => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const user = useAuthStore((state) => state.user);
  const { getHistoryForLead, loadHistory } = useLeadHistoryStore();
  const [activeTab, setActiveTab] = useState<ModalTab>('SUMMARY');
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (lead) setActiveTab('SUMMARY');
  }, [lead?._id]);

  const { data: backendHistoryData, isLoading: isHistoryLoading } = useQuery({
    queryKey: ['leadHistory', lead?._id],
    queryFn: () => (lead ? fetchLeadHistory(lead._id) : Promise.resolve({ activities: [] })),
    enabled: visible && Boolean(lead?._id),
  });

  const activities: Activity[] = useMemo(() => {
    if (!lead) return [];
    const backendActivities = backendHistoryData?.activities || [];
    const localActivities = getHistoryForLead(lead._id, lead.phone);
    const backendIds = new Set(backendActivities.map((activity) => activity._id));
    return deduplicateActivities(
      [...backendActivities, ...localActivities.filter((activity) => !backendIds.has(activity._id))]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    );
  }, [backendHistoryData, getHistoryForLead, lead]);

  if (!lead || !visible) return null;

  const campaignName =
    typeof lead.campaign === 'object' && lead.campaign
      ? lead.campaign.name
      : typeof lead.campaign === 'string' && lead.campaign
      ? lead.campaign
      : 'General';

  const handleCall = () => {
    const isSuppressed = isLeadLostOrSuppressed(lead);
    const dial = () => {
      Linking.openURL(getDialerTelUrl(lead.phone)).catch(() => {
        Alert.alert('Error', 'Unable to initiate phone call on this device.');
      });
    };

    if (!isSuppressed) {
      dial();
      return;
    }

    if (user?.role === 'AGENT') {
      Alert.alert(
        'Customer Suppressed',
        'This customer is marked as not interested and cannot be called from the agent queue.',
      );
      return;
    }

    Alert.alert(
      'Customer Not Interested',
      'This customer was marked as not interested. Calling again may cause customer irritation.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Call Anyway', style: 'destructive', onPress: dial },
      ],
    );
  };

  const openDisposition = () => {
    onClose();
    if (onOpenDisposition) {
      onOpenDisposition(lead);
    } else if (onOpenFullDispose) {
      onOpenFullDispose(lead);
    } else {
      navigation.navigate('Dispose', { lead, initialTab: 'DISPOSE LEAD' });
    }
  };

  return (
    <>
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.handle} />

            <View style={styles.header}>
              <View style={styles.leadInfo}>
                <Text style={styles.name} numberOfLines={1}>{lead.name}</Text>
                <Text style={styles.phone}>{formatDisplayPhone(lead.phone)} · {campaignName}</Text>
              </View>
              <TouchableOpacity style={[styles.iconButton, styles.callButton]} onPress={handleCall}>
                <Phone size={16} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.iconButton, styles.whatsAppButton]}
                onPress={() => setShowWhatsAppModal(true)}
              >
                <MessageCircle size={16} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.iconButton, styles.closeButton]} onPress={onClose}>
                <X size={17} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.tabs}>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'SUMMARY' && styles.activeTab]}
                onPress={() => setActiveTab('SUMMARY')}
              >
                <Text style={[styles.tabText, activeTab === 'SUMMARY' && styles.activeTabText]}>
                  Lead
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'HISTORY' && styles.activeTab]}
                onPress={() => setActiveTab('HISTORY')}
              >
                <History size={14} color={activeTab === 'HISTORY' ? '#059669' : '#64748B'} />
                <Text style={[styles.tabText, activeTab === 'HISTORY' && styles.activeTabText]}>
                  Timeline ({activities.length})
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.body}
              contentContainerStyle={styles.bodyContent}
              showsVerticalScrollIndicator={false}
            >
              {activeTab === 'SUMMARY' ? (
                <View style={styles.summaryCard}>
                  <Text style={styles.eyebrow}>LEAD DETAILS</Text>
                  <Text style={styles.summaryText}>
                    Record the call outcome, not-connected reason, follow-up date, and any next action
                    together in the disposition form.
                  </Text>
                  {lead.nextFollowUpAt ? (
                    <Text style={styles.followUpText}>
                      Next follow-up: {new Date(lead.nextFollowUpAt).toLocaleString()}
                    </Text>
                  ) : null}
                  <TouchableOpacity style={styles.openFormButton} onPress={openDisposition}>
                    <Text style={styles.openFormText}>Open Lead Disposition Form</Text>
                    <ArrowRight size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              ) : (
                <LeadTimeline activities={activities} isLoading={isHistoryLoading} />
              )}
            </ScrollView>

            {activeTab === 'SUMMARY' ? (
              <TouchableOpacity style={styles.primaryButton} onPress={openDisposition}>
                <Text style={styles.primaryButtonText}>Update Lead Outcome</Text>
                <ArrowRight size={16} color="#FFFFFF" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.secondaryButton} onPress={onClose}>
                <Text style={styles.secondaryButtonText}>Close History</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      <WhatsAppTemplateModal
        visible={showWhatsAppModal}
        onClose={() => setShowWhatsAppModal(false)}
        customerName={lead.name}
        customerPhone={lead.phone}
      />
    </>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '88%',
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 24,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    backgroundColor: '#FFFFFF',
  },
  handle: {
    width: 38,
    height: 4,
    marginBottom: 14,
    borderRadius: 2,
    alignSelf: 'center',
    backgroundColor: '#CBD5E1',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  leadInfo: {
    flex: 1,
  },
  name: {
    color: '#0F172A',
    fontSize: 17,
    fontWeight: '800',
  },
  phone: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 3,
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callButton: {
    backgroundColor: '#10B981',
  },
  whatsAppButton: {
    backgroundColor: '#16A34A',
  },
  closeButton: {
    backgroundColor: '#F1F5F9',
  },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    flex: 1,
    paddingVertical: 9,
    borderRadius: 9,
  },
  activeTab: {
    backgroundColor: '#ECFDF5',
  },
  tabText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
  },
  activeTabText: {
    color: '#059669',
  },
  body: {
    maxHeight: 380,
  },
  bodyContent: {
    paddingVertical: 14,
  },
  summaryCard: {
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
  },
  eyebrow: {
    marginBottom: 8,
    color: '#64748B',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  summaryText: {
    color: '#334155',
    fontSize: 13,
    lineHeight: 19,
  },
  followUpText: {
    marginTop: 12,
    color: '#047857',
    fontSize: 12,
    fontWeight: '700',
  },
  openFormButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 18,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#059669',
  },
  openFormText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: '#059669',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  secondaryButton: {
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  secondaryButtonText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '700',
  },
});
