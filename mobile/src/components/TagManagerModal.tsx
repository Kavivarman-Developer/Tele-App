import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import {
  X,
  BookmarkCheck,
  Building2,
  ShieldCheck,
  Users,
  AlertTriangle,
  Flame,
  Percent,
  PhoneCall,
  Send,
} from 'lucide-react-native';
import { useAuthStore } from '../store/authStore';
import { useLeadHistoryStore } from '../store/leadHistoryStore';
import { notificationService } from '../services/notification.service';
import { storage } from '../utils/storage';
import { formatDisplayPhone } from '../utils/phoneUtils';
import { toast } from '../store/toastStore';

export interface TaggedLeadRecord {
  id: string;
  type: 'MANAGER_TAG';
  leadId?: string;
  customerName: string;
  customerPhone: string;
  agentName: string;
  agentId?: string;
  branch: string;
  targetRole: 'BOTH' | 'MANAGER' | 'ADMIN';
  reason: string;
  note: string;
  createdAt: string;
}

export const TAG_REASONS = [
  { label: 'VIP / High Value Deal', emoji: '💰', icon: Flame, color: '#DC2626', bg: '#FEF2F2' },
  { label: 'Customer Escalation', emoji: '⚠️', icon: AlertTriangle, color: '#D97706', bg: '#FFFBEB' },
  { label: 'Special Discount Approval', emoji: '🏷️', icon: Percent, color: '#059669', bg: '#ECFDF5' },
  { label: 'Urgent Callback Needed', emoji: '📞', icon: PhoneCall, color: '#2563EB', bg: '#EFF6FF' },
];

interface TagManagerModalProps {
  visible: boolean;
  onClose: () => void;
  customerName: string;
  customerPhone: string;
  leadId?: string;
  onSuccess?: () => void;
}

export const TagManagerModal: React.FC<TagManagerModalProps> = ({
  visible,
  onClose,
  customerName,
  customerPhone,
  leadId,
  onSuccess,
}) => {
  const { user } = useAuthStore();
  const [targetRole, setTargetRole] = useState<'BOTH' | 'MANAGER' | 'ADMIN'>('BOTH');
  const [selectedReason, setSelectedReason] = useState<string>(TAG_REASONS[0].label);
  const [note, setNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const branchName = user?.branch || 'Main Branch';

  const handleSubmit = async () => {
    setIsSubmitting(true);
    const targetLabel =
      targetRole === 'BOTH'
        ? `Branch Manager (${branchName}) & Admin`
        : targetRole === 'MANAGER'
        ? `Branch Manager (${branchName})`
        : 'Admin';

    const noteText = note.trim() || selectedReason;

    try {
      // 1. Persist tagged notification in local storage
      const existingRaw = await storage.getItem('tele_crm_tagged_lead_notifications');
      const existingList: TaggedLeadRecord[] = existingRaw ? JSON.parse(existingRaw) : [];

      const newRecord: TaggedLeadRecord = {
        id: 'tag_' + Date.now(),
        type: 'MANAGER_TAG',
        leadId,
        customerName: customerName || 'Lead Contact',
        customerPhone: customerPhone || '',
        agentName: user?.name || 'Agent',
        agentId: user?._id,
        branch: branchName,
        targetRole,
        reason: selectedReason,
        note: noteText,
        createdAt: new Date().toISOString(),
      };

      await storage.setItem(
        'tele_crm_tagged_lead_notifications',
        JSON.stringify([newRecord, ...existingList]),
      );

      // 2. Also register in assigned lead notifications for manager visibility
      const assignedRaw = await storage.getItem('tele_crm_assigned_lead_notifications');
      const assignedList = assignedRaw ? JSON.parse(assignedRaw) : [];
      await storage.setItem(
        'tele_crm_assigned_lead_notifications',
        JSON.stringify([
          {
            type: 'MANAGER_TAG',
            leadId,
            customerName,
            customerPhone,
            agentName: user?.name || 'Agent',
            branch: branchName,
            targetRole,
            reason: selectedReason,
            note: noteText,
            timestamp: new Date().toISOString(),
          },
          ...assignedList,
        ]),
      );

      // 3. Auto-log activity on the lead timeline
      if (leadId) {
        useLeadHistoryStore.getState().addActivity(leadId, {
          phone: customerPhone,
          customerName,
          agentName: user?.name,
          agentId: user?._id,
          branch: user?.branch,
          connected: false,
          type: 'UPDATE',
          stage: 'Tagged to Manager',
          remark: `🏷️ Tagged to ${targetLabel}: [${selectedReason}] ${noteText}`,
          durationSeconds: 0,
        });
      }

      // 4. Trigger immediate OS native notification banner
      await notificationService.sendImmediateNotification(
        `🚨 Lead Tagged by ${user?.name || 'Agent'}`,
        `${customerName} (${formatDisplayPhone(customerPhone)}) — ${selectedReason}: ${noteText}`,
        { leadId, customerPhone },
      );

      toast.success(
        `Lead tagged to ${targetLabel}! Notification sent.`,
        'Manager Notified',
      );

      setNote('');
      if (onSuccess) onSuccess();
      onClose();
    } catch {
      toast.error('Failed to send manager tag notification');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerTitleWrap}>
                <View style={styles.tagIconCircle}>
                  <BookmarkCheck size={18} color="#D97706" />
                </View>
                <View>
                  <Text style={styles.headerTitle}>Tag Lead to Manager / Admin</Text>
                  <Text style={styles.headerSubtitle}>
                    Sends an urgent priority notification to branch management
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Customer Info Card */}
              <View style={styles.customerBox}>
                <View style={styles.customerAvatar}>
                  <Text style={styles.customerAvatarText}>
                    {(customerName || 'CL').slice(0, 2).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.customerName}>{customerName || 'Lead Contact'}</Text>
                  <Text style={styles.customerPhone}>
                    📞 {formatDisplayPhone(customerPhone)} • {branchName}
                  </Text>
                </View>
              </View>

              {/* 1. Select Recipient */}
              <Text style={styles.sectionLabel}>
                WHO SHOULD BE NOTIFIED?<Text style={styles.asterisk}>*</Text>
              </Text>
              <View style={styles.recipientRow}>
                {/* Both */}
                <TouchableOpacity
                  style={[
                    styles.recipientCard,
                    targetRole === 'BOTH' && styles.recipientCardActive,
                  ]}
                  onPress={() => setTargetRole('BOTH')}
                  activeOpacity={0.7}
                >
                  <Users size={16} color={targetRole === 'BOTH' ? '#0F9D58' : '#64748B'} />
                  <Text
                    style={[
                      styles.recipientCardText,
                      targetRole === 'BOTH' && styles.recipientCardTextActive,
                    ]}
                  >
                    Both (Admin & Manager)
                  </Text>
                </TouchableOpacity>

                {/* Branch Manager */}
                <TouchableOpacity
                  style={[
                    styles.recipientCard,
                    targetRole === 'MANAGER' && styles.recipientCardActive,
                  ]}
                  onPress={() => setTargetRole('MANAGER')}
                  activeOpacity={0.7}
                >
                  <Building2 size={16} color={targetRole === 'MANAGER' ? '#0F9D58' : '#64748B'} />
                  <Text
                    style={[
                      styles.recipientCardText,
                      targetRole === 'MANAGER' && styles.recipientCardTextActive,
                    ]}
                  >
                    Branch Manager
                  </Text>
                </TouchableOpacity>

                {/* Admin */}
                <TouchableOpacity
                  style={[
                    styles.recipientCard,
                    targetRole === 'ADMIN' && styles.recipientCardActive,
                  ]}
                  onPress={() => setTargetRole('ADMIN')}
                  activeOpacity={0.7}
                >
                  <ShieldCheck size={16} color={targetRole === 'ADMIN' ? '#0F9D58' : '#64748B'} />
                  <Text
                    style={[
                      styles.recipientCardText,
                      targetRole === 'ADMIN' && styles.recipientCardTextActive,
                    ]}
                  >
                    Admin Only
                  </Text>
                </TouchableOpacity>
              </View>

              {/* 2. Tag Reason */}
              <Text style={styles.sectionLabel}>
                TAG REASON / CATEGORY<Text style={styles.asterisk}>*</Text>
              </Text>
              <View style={styles.reasonGrid}>
                {TAG_REASONS.map((item) => {
                  const isSelected = selectedReason === item.label;
                  return (
                    <TouchableOpacity
                      key={item.label}
                      style={[
                        styles.reasonChip,
                        isSelected && {
                          backgroundColor: item.bg,
                          borderColor: item.color,
                          borderWidth: 1.5,
                        },
                      ]}
                      onPress={() => setSelectedReason(item.label)}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: 13 }}>{item.emoji}</Text>
                      <Text
                        style={[
                          styles.reasonChipText,
                          isSelected && { color: item.color, fontWeight: '700' },
                        ]}
                      >
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* 3. Note / Message */}
              <Text style={styles.sectionLabel}>EXPLANATION NOTE / DETAILS FOR MANAGER</Text>
              <TextInput
                style={styles.noteInput}
                placeholder="Explain why you are tagging this customer (e.g. Customer asking for bulk discount, requires approval)..."
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                value={note}
                onChangeText={setNote}
              />

              {/* Action Buttons */}
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={onClose}
                  disabled={isSubmitting}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.submitBtn}
                  onPress={handleSubmit}
                  disabled={isSubmitting}
                  activeOpacity={0.85}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Send size={15} color="#FFFFFF" strokeWidth={2.5} />
                      <Text style={styles.submitBtnText}>Send Tag & Notify</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  sheet: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    maxHeight: '90%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 12,
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  tagIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  customerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  customerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E6F4EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F9D58',
  },
  customerName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  customerPhone: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#0F9D58',
    marginTop: 2,
  },
  sectionLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#475569',
    letterSpacing: 0.4,
    marginBottom: 8,
    marginTop: 4,
  },
  asterisk: {
    color: '#DC2626',
  },
  recipientRow: {
    gap: 8,
    marginBottom: 16,
  },
  recipientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  recipientCardActive: {
    borderColor: '#0F9D58',
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
  },
  recipientCardText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  recipientCardTextActive: {
    color: '#0F9D58',
    fontWeight: '700',
  },
  reasonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  reasonChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  reasonChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  noteInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: 12,
    fontSize: 13,
    color: '#1E293B',
    minHeight: 70,
    marginBottom: 20,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  submitBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#0F9D58',
    shadowColor: '#0F9D58',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  submitBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
