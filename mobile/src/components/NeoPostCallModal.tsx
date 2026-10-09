import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import {
  Phone,
  PhoneOff,
  Clock,
  CheckCircle2,
  CalendarClock,
  Ban,
  MessageCircle,
  X,
  ArrowRight,
  Check,
  Calendar,
} from 'lucide-react-native';
import { Lead, DetectedCallResult, CustomerTemperature } from '../types';
import { colors, borderRadius, shadows } from '../theme';
import { formatDisplayPhone } from '../utils/phoneUtils';
import { CrmDateTimePickerModal } from './CrmDateTimePickerModal';

interface NeoPostCallModalProps {
  visible: boolean;
  lead: Lead | null;
  callResult: DetectedCallResult | null;
  onClose: () => void;
  onSaveDisposition: (payload: {
    connected: boolean;
    stage: string;
    tag?: string | null;
    temperature?: CustomerTemperature;
    notConnectedReason?: string;
    remark?: string;
    followUpAt?: string | null;
    durationSeconds: number;
    callNext?: boolean;
  }) => Promise<void>;
  onCallNext?: () => void;
}

const OUTCOMES = [
  {
    stage: 'Interested',
    label: 'Interested',
    icon: CheckCircle2,
    color: '#059669',
    bg: '#ECFDF5',
    border: '#A7F3D0',
    connected: true,
  },
  {
    stage: 'Follow-up',
    label: 'Call Back',
    icon: CalendarClock,
    color: '#D97706',
    bg: '#FFFBEB',
    border: '#FDE68A',
    connected: true,
  },
  {
    stage: 'Not connected',
    label: 'No Answer',
    icon: PhoneOff,
    color: '#DC2626',
    bg: '#FEF2F2',
    border: '#FECACA',
    connected: false,
  },
  {
    stage: 'Not Interested',
    label: 'Not Interested',
    icon: Ban,
    color: '#64748B',
    bg: '#F8FAFC',
    border: '#E2E8F0',
    connected: true,
  },
];

const NOT_CONNECTED_REASONS = [
  { id: 'DID_NOT_PICK', label: 'Did Not Pick' },
  { id: 'BUSY', label: 'Line Busy' },
  { id: 'SWITCHED_OFF', label: 'Switched Off' },
  { id: 'OUT_OF_COVERAGE', label: 'Not Reachable' },
  { id: 'USER_DISCONNECTED', label: 'Call Cut / Disconnected' },
  { id: 'OTHER', label: 'Other / Language' },
];

const QUICK_NOTES = [
  'Send details on WhatsApp',
  'Interested in attachment',
  'Will visit office',
  'Asked to call back later',
  'Vehicle not available',
];

export const NeoPostCallModal: React.FC<NeoPostCallModalProps> = ({
  visible,
  lead,
  callResult,
  onClose,
  onSaveDisposition,
  onCallNext,
}) => {
  const [selectedStage, setSelectedStage] = useState<string>('Follow-up');
  const [selectedReason, setSelectedReason] = useState<string>('DID_NOT_PICK');
  const [selectedTemperature, setSelectedTemperature] = useState<CustomerTemperature>('WARM');
  const [notes, setNotes] = useState<string>('');
  const [followUpDate, setFollowUpDate] = useState<string | null>(null);
  const [showCustomPicker, setShowCustomPicker] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const durationSec = callResult?.durationSeconds || 0;
  const isAutoConnected = callResult ? callResult.connected : durationSec > 0;

  useEffect(() => {
    if (visible && callResult) {
      if (callResult.connected && callResult.durationSeconds > 0) {
        setSelectedStage('Follow-up');
      } else {
        setSelectedStage('Not connected');
        setSelectedReason('DID_NOT_PICK');
      }
      setNotes('');
      setFollowUpDate(null);
    }
  }, [visible, callResult]);

  if (!visible || !lead) return null;

  // Format Duration string MM:SS
  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(mins).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Quick Preset Callbacks
  const setQuickCallback = (hoursAhead: number, labelHour?: number) => {
    const d = new Date();
    if (labelHour !== undefined) {
      if (d.getHours() >= labelHour) {
        d.setDate(d.getDate() + 1);
      }
      d.setHours(labelHour, 0, 0, 0);
    } else {
      d.setTime(d.getTime() + hoursAhead * 60 * 60 * 1000);
    }
    setFollowUpDate(d.toISOString());
  };

  const handleSave = async (callNext = false) => {
    try {
      setIsSubmitting(true);
      const isConnected = selectedStage !== 'Not connected';
      const isClosing = selectedStage === 'Not Interested';

      await onSaveDisposition({
        connected: isConnected,
        stage: selectedStage === 'Follow-up' ? 'Follow Up' : selectedStage,
        tag: selectedTemperature,
        temperature: selectedTemperature,
        notConnectedReason: isConnected ? undefined : selectedReason,
        remark: notes.trim() || undefined,
        followUpAt: isClosing ? null : followUpDate,
        durationSeconds: durationSec,
        callNext,
      });

      onClose();
      if (callNext && onCallNext) {
        onCallNext();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          {/* Header Bar */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <View style={styles.detectedBadgeRow}>
                {isAutoConnected ? (
                  <View style={[styles.detectedBadge, styles.detectedBadgeConnected]}>
                    <Phone size={11} color="#059669" />
                    <Text style={styles.detectedBadgeTextConnected}>
                      Connected · {formatDuration(durationSec)}
                    </Text>
                  </View>
                ) : (
                  <View style={[styles.detectedBadge, styles.detectedBadgeNotConnected]}>
                    <PhoneOff size={11} color="#DC2626" />
                    <Text style={styles.detectedBadgeTextNotConnected}>
                      Not Connected · 00:00
                    </Text>
                  </View>
                )}
                <Text style={styles.headerSubText}>Automatic Call Detection</Text>
              </View>

              <Text style={styles.leadName} numberOfLines={1}>
                {lead.name}
              </Text>
              <Text style={styles.leadPhone}>{formatDisplayPhone(lead.phone)}</Text>
            </View>

            <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={18} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Outcome Selection (4 Clean Thumb Buttons) */}
            <Text style={styles.sectionHeading}>SELECT CALL OUTCOME</Text>
            <View style={styles.outcomesGrid}>
              {OUTCOMES.map((item) => {
                const isSelected = selectedStage === item.stage;
                const IconComp = item.icon;
                return (
                  <TouchableOpacity
                    key={item.stage}
                    style={[
                      styles.outcomeCard,
                      { borderColor: isSelected ? item.color : '#E2E8F0' },
                      isSelected && { backgroundColor: item.bg },
                    ]}
                    onPress={() => setSelectedStage(item.stage)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.outcomeIconBox, { backgroundColor: item.bg }]}>
                      <IconComp size={16} color={item.color} />
                    </View>
                    <Text style={[styles.outcomeLabel, isSelected && { color: item.color, fontWeight: '800' }]}>
                      {item.label}
                    </Text>
                    {isSelected && (
                      <View style={[styles.checkCircle, { backgroundColor: item.color }]}>
                        <Check size={10} color="#FFFFFF" strokeWidth={3} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* If Follow-Up / Call Back is Selected */}
            {selectedStage === 'Follow-up' && (
              <View style={styles.callbackBox}>
                <Text style={styles.subHeading}>SCHEDULE CALLBACK TIME</Text>
                <View style={styles.quickPresetsRow}>
                  <TouchableOpacity
                    style={[styles.presetChip, followUpDate && styles.presetChipActive]}
                    onPress={() => setQuickCallback(2)}
                  >
                    <Text style={styles.presetChipText}>In 2 Hours</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.presetChip}
                    onPress={() => setQuickCallback(0, 17)}
                  >
                    <Text style={styles.presetChipText}>Evening 5 PM</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.presetChip}
                    onPress={() => setQuickCallback(24, 10)}
                  >
                    <Text style={styles.presetChipText}>Tomorrow 10 AM</Text>
                  </TouchableOpacity>
                </View>

                {/* Custom Date Time Button */}
                <TouchableOpacity
                  style={styles.customDateBtn}
                  onPress={() => setShowCustomPicker(true)}
                  activeOpacity={0.7}
                >
                  <Calendar size={13} color="#059669" />
                  <Text style={styles.customDateBtnText}>
                    {followUpDate
                      ? `Scheduled: ${new Date(followUpDate).toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${new Date(followUpDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                      : 'Pick Custom Date & Exact Time…'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* If Not Connected is Selected */}
            {selectedStage === 'Not connected' && (
              <View style={styles.reasonsBox}>
                <Text style={styles.subHeading}>REASON FOR NO ANSWER</Text>
                <View style={styles.reasonsGrid}>
                  {NOT_CONNECTED_REASONS.map((r) => {
                    const isSelected = selectedReason === r.id;
                    return (
                      <TouchableOpacity
                        key={r.id}
                        style={[styles.reasonChip, isSelected && styles.reasonChipActive]}
                        onPress={() => setSelectedReason(r.id)}
                      >
                        <Text style={[styles.reasonChipText, isSelected && styles.reasonChipTextActive]}>
                          {r.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Quick Remarks */}
            <Text style={[styles.sectionHeading, { marginTop: 12 }]}>CALL NOTES (OPTIONAL)</Text>
            <View style={styles.quickNotesRow}>
              {QUICK_NOTES.map((n) => (
                <TouchableOpacity
                  key={n}
                  style={styles.quickNotePill}
                  onPress={() => setNotes((prev) => (prev ? `${prev} · ${n}` : n))}
                >
                  <Text style={styles.quickNoteText}>+ {n}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.noteInput}
              placeholder="Add remark or customer requirements..."
              placeholderTextColor="#94A3B8"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={2}
            />
          </ScrollView>

          {/* Bottom Actions (Save & Next Lead) */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.primaryNextBtn}
              onPress={() => handleSave(true)}
              disabled={isSubmitting}
              activeOpacity={0.85}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.primaryNextBtnText}>Save & Call Next Lead</Text>
                  <ArrowRight size={15} color="#FFFFFF" strokeWidth={2.5} />
                </>
              )}
            </TouchableOpacity>

            <View style={styles.secondaryRow}>
              <TouchableOpacity
                style={styles.secondarySaveBtn}
                onPress={() => handleSave(false)}
                disabled={isSubmitting}
              >
                <Text style={styles.secondarySaveBtnText}>Save Only</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.skipBtn}
                onPress={onClose}
                disabled={isSubmitting}
              >
                <Text style={styles.skipBtnText}>Skip / Dismiss</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>

      {/* Date & Time Picker Modal */}
      <CrmDateTimePickerModal
        visible={showCustomPicker}
        onClose={() => setShowCustomPicker(false)}
        initialDate={followUpDate ? new Date(followUpDate) : undefined}
        onConfirm={(iso) => {
          setFollowUpDate(iso);
          setShowCustomPicker(false);
        }}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    ...shadows.elevated,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  detectedBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  detectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  detectedBadgeConnected: {
    backgroundColor: '#ECFDF5',
  },
  detectedBadgeNotConnected: {
    backgroundColor: '#FEF2F2',
  },
  detectedBadgeTextConnected: {
    fontSize: 11,
    fontWeight: '800',
    color: '#059669',
  },
  detectedBadgeTextNotConnected: {
    fontSize: 11,
    fontWeight: '800',
    color: '#DC2626',
  },
  headerSubText: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '600',
  },
  leadName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  leadPhone: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginTop: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  body: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sectionHeading: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  subHeading: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    marginBottom: 6,
  },
  outcomesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  outcomeCard: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderRadius: 10,
    padding: 10,
    position: 'relative',
  },
  outcomeIconBox: {
    width: 28,
    height: 28,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  outcomeLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  checkCircle: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  callbackBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  quickPresetsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  presetChip: {
    flex: 1,
    paddingVertical: 7,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    alignItems: 'center',
  },
  presetChipActive: {
    borderColor: '#D97706',
    backgroundColor: '#FFFBEB',
  },
  presetChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  customDateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
  customDateBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#065F46',
  },
  reasonsBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  reasonsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  reasonChip: {
    paddingVertical: 6,
    paddingHorizontal: 9,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
  },
  reasonChipActive: {
    backgroundColor: '#FEF2F2',
    borderColor: '#DC2626',
  },
  reasonChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  reasonChipTextActive: {
    color: '#DC2626',
    fontWeight: '800',
  },
  quickNotesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  quickNotePill: {
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  quickNoteText: {
    fontSize: 10,
    color: '#475569',
    fontWeight: '600',
  },
  noteInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 8,
    fontSize: 12,
    color: '#0F172A',
    textAlignVertical: 'top',
    minHeight: 46,
  },
  footer: {
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 8,
  },
  primaryNextBtn: {
    backgroundColor: '#10B981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    ...shadows.card,
  },
  primaryNextBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  secondaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  secondarySaveBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
  },
  secondarySaveBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  skipBtn: {
    paddingVertical: 9,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
});
