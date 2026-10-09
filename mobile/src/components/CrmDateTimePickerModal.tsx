import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import {
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  Sparkles,
  Sun,
  Sunset,
  Sunrise,
} from 'lucide-react-native';

export interface CrmDateTimePickerModalProps {
  visible: boolean;
  initialDate?: string | Date | null;
  onClose: () => void;
  onConfirm: (isoDate: string) => void;
  title?: string;
}

const POPULAR_SLOTS = [
  { label: 'Morning', time: '10:00 AM', hour: 10, minute: 0, period: 'AM' as const, icon: Sunrise },
  { label: 'Noon', time: '12:30 PM', hour: 12, minute: 30, period: 'PM' as const, icon: Sun },
  { label: 'Afternoon', time: '03:00 PM', hour: 3, minute: 0, period: 'PM' as const, icon: Sun },
  { label: 'Evening', time: '05:30 PM', hour: 5, minute: 30, period: 'PM' as const, icon: Sunset },
];

export const CrmDateTimePickerModal: React.FC<CrmDateTimePickerModalProps> = ({
  visible,
  initialDate,
  onClose,
  onConfirm,
  title = 'Pick Follow-up Date & Time',
}) => {
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
    return d;
  });

  const [hour12, setHour12] = useState<number>(10);
  const [minute, setMinute] = useState<number>(0);
  const [period, setPeriod] = useState<'AM' | 'PM'>('AM');

  // Initialize when opening
  useEffect(() => {
    if (visible) {
      let init = new Date();
      if (initialDate) {
        const parsed = new Date(initialDate);
        if (!isNaN(parsed.getTime())) {
          init = parsed;
        } else {
          init.setDate(init.getDate() + 1);
          init.setHours(10, 0, 0, 0);
        }
      } else {
        init.setDate(init.getDate() + 1);
        init.setHours(10, 0, 0, 0);
      }

      setSelectedDate(init);
      const rawHours = init.getHours();
      const isPm = rawHours >= 12;
      const h12 = rawHours % 12 === 0 ? 12 : rawHours % 12;
      setHour12(h12);
      setMinute(Math.round(init.getMinutes() / 15) * 15 % 60);
      setPeriod(isPm ? 'PM' : 'AM');
    }
  }, [visible, initialDate]);

  // Quick 1-tap Presets
  const applyPreset = (daysOffset: number, h: number, m: number, p: 'AM' | 'PM') => {
    const target = new Date();
    target.setDate(target.getDate() + daysOffset);
    setSelectedDate(target);
    setHour12(h);
    setMinute(m);
    setPeriod(p);
  };

  // Day buttons
  const isToday = useMemo(() => {
    const now = new Date();
    return (
      selectedDate.getDate() === now.getDate() &&
      selectedDate.getMonth() === now.getMonth() &&
      selectedDate.getFullYear() === now.getFullYear()
    );
  }, [selectedDate]);

  const isTomorrow = useMemo(() => {
    const tom = new Date();
    tom.setDate(tom.getDate() + 1);
    return (
      selectedDate.getDate() === tom.getDate() &&
      selectedDate.getMonth() === tom.getMonth() &&
      selectedDate.getFullYear() === tom.getFullYear()
    );
  }, [selectedDate]);

  const isIn2Days = useMemo(() => {
    const in2 = new Date();
    in2.setDate(in2.getDate() + 2);
    return (
      selectedDate.getDate() === in2.getDate() &&
      selectedDate.getMonth() === in2.getMonth() &&
      selectedDate.getFullYear() === in2.getFullYear()
    );
  }, [selectedDate]);

  const setDayOffset = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    setSelectedDate(d);
  };

  const stepDate = (days: number) => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + days);
    // Don't allow past dates
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    if (next.getTime() < todayStart.getTime()) return;
    setSelectedDate(next);
  };

  // Steppers for hour and minute
  const stepHour = (delta: number) => {
    let next = hour12 + delta;
    if (next > 12) next = 1;
    if (next < 1) next = 12;
    setHour12(next);
  };

  const stepMinute = (delta: number) => {
    let next = minute + delta;
    if (next >= 60) next = 0;
    if (next < 0) next = 45;
    setMinute(next);
  };

  // Preview formatted text
  const previewText = useMemo(() => {
    const dayStr = selectedDate.toLocaleDateString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const formattedMin = minute < 10 ? `0${minute}` : String(minute);
    const formattedHour = hour12 < 10 ? `0${hour12}` : String(hour12);
    return `${dayStr} at ${formattedHour}:${formattedMin} ${period}`;
  }, [selectedDate, hour12, minute, period]);

  // Confirm
  const handleConfirm = () => {
    let finalHours = hour12 % 12;
    if (period === 'PM') {
      finalHours += 12;
    }
    const finalDate = new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate(),
      finalHours,
      minute,
      0,
      0,
    );
    onConfirm(finalDate.toISOString());
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <View style={styles.iconBox}>
                <Clock size={18} color="#2563EB" />
              </View>
              <View>
                <Text style={styles.modalTitle}>{title}</Text>
                <Text style={styles.modalSubtitle}>Quick 1-tap follow-up scheduler</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <X size={18} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Quick Presets Section */}
            <View style={styles.sectionWrap}>
              <View style={styles.sectionHeaderRow}>
                <Sparkles size={14} color="#D97706" />
                <Text style={styles.sectionLabel}>QUICK 1-TAP PRESETS</Text>
              </View>
              <View style={styles.quickPresetsGrid}>
                <TouchableOpacity
                  style={[
                    styles.quickPresetBtn,
                    isToday && hour12 === 5 && period === 'PM' && styles.quickPresetBtnActive,
                  ]}
                  onPress={() => applyPreset(0, 5, 0, 'PM')}
                  activeOpacity={0.7}
                >
                  <Sunset size={14} color="#D97706" />
                  <Text style={styles.quickPresetBtnText}>Today 5:00 PM</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.quickPresetBtn,
                    isTomorrow && hour12 === 10 && period === 'AM' && styles.quickPresetBtnActive,
                  ]}
                  onPress={() => applyPreset(1, 10, 0, 'AM')}
                  activeOpacity={0.7}
                >
                  <Sunrise size={14} color="#2563EB" />
                  <Text style={styles.quickPresetBtnText}>Tomorrow 10 AM</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.quickPresetBtn,
                    isTomorrow && hour12 === 3 && period === 'PM' && styles.quickPresetBtnActive,
                  ]}
                  onPress={() => applyPreset(1, 3, 0, 'PM')}
                  activeOpacity={0.7}
                >
                  <Sun size={14} color="#16A34A" />
                  <Text style={styles.quickPresetBtnText}>Tomorrow 3 PM</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.quickPresetBtn,
                    isIn2Days && hour12 === 10 && period === 'AM' && styles.quickPresetBtnActive,
                  ]}
                  onPress={() => applyPreset(2, 10, 0, 'AM')}
                  activeOpacity={0.7}
                >
                  <Calendar size={14} color="#7C3AED" />
                  <Text style={styles.quickPresetBtnText}>In 2 Days 10 AM</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Step 1: Select Day */}
            <View style={styles.sectionWrap}>
              <Text style={styles.sectionLabel}>1. SELECT DAY</Text>
              <View style={styles.dayTabsRow}>
                <TouchableOpacity
                  style={[styles.dayTab, isToday && styles.dayTabActive]}
                  onPress={() => setDayOffset(0)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.dayTabText, isToday && styles.dayTabTextActive]}>Today</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.dayTab, isTomorrow && styles.dayTabActive]}
                  onPress={() => setDayOffset(1)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.dayTabText, isTomorrow && styles.dayTabTextActive]}>Tomorrow</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.dayTab, isIn2Days && styles.dayTabActive]}
                  onPress={() => setDayOffset(2)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.dayTabText, isIn2Days && styles.dayTabTextActive]}>In 2 Days</Text>
                </TouchableOpacity>
              </View>

              {/* Day Browser Stepper */}
              <View style={styles.dateStepperCard}>
                <TouchableOpacity
                  style={styles.dateStepBtn}
                  onPress={() => stepDate(-1)}
                  activeOpacity={0.7}
                >
                  <ChevronLeft size={18} color="#475569" />
                </TouchableOpacity>

                <View style={styles.dateStepperCenter}>
                  <Text style={styles.dateStepperDay}>
                    {selectedDate.toLocaleDateString([], { weekday: 'long' })}
                  </Text>
                  <Text style={styles.dateStepperDate}>
                    {selectedDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.dateStepBtn}
                  onPress={() => stepDate(1)}
                  activeOpacity={0.7}
                >
                  <ChevronRight size={18} color="#475569" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Step 2: Select Time */}
            <View style={styles.sectionWrap}>
              <Text style={styles.sectionLabel}>2. POPULAR TIME SLOTS</Text>
              <View style={styles.timeSlotsGrid}>
                {POPULAR_SLOTS.map((slot) => {
                  const isSelected =
                    hour12 === slot.hour &&
                    minute === slot.minute &&
                    period === slot.period;
                  const Icon = slot.icon;

                  return (
                    <TouchableOpacity
                      key={slot.time}
                      style={[styles.timeSlotCard, isSelected && styles.timeSlotCardActive]}
                      onPress={() => {
                        setHour12(slot.hour);
                        setMinute(slot.minute);
                        setPeriod(slot.period);
                      }}
                      activeOpacity={0.7}
                    >
                      <Icon size={14} color={isSelected ? '#2563EB' : '#64748B'} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.timeSlotTime, isSelected && styles.timeSlotTimeActive]}>
                          {slot.time}
                        </Text>
                        <Text style={styles.timeSlotLabel}>{slot.label}</Text>
                      </View>
                      {isSelected ? <Check size={14} color="#2563EB" strokeWidth={2.5} /> : null}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Exact Time Stepper */}
              <View style={styles.exactTimeRow}>
                <Text style={styles.exactTimeLabel}>Custom Time:</Text>

                {/* Hour */}
                <View style={styles.stepperGroup}>
                  <TouchableOpacity style={styles.stepMiniBtn} onPress={() => stepHour(-1)}>
                    <Text style={styles.stepMiniBtnText}>-</Text>
                  </TouchableOpacity>
                  <Text style={styles.stepperValue}>{String(hour12).padStart(2, '0')}</Text>
                  <TouchableOpacity style={styles.stepMiniBtn} onPress={() => stepHour(1)}>
                    <Text style={styles.stepMiniBtnText}>+</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.timeColon}>:</Text>

                {/* Minute */}
                <View style={styles.stepperGroup}>
                  <TouchableOpacity style={styles.stepMiniBtn} onPress={() => stepMinute(-15)}>
                    <Text style={styles.stepMiniBtnText}>-</Text>
                  </TouchableOpacity>
                  <Text style={styles.stepperValue}>{String(minute).padStart(2, '0')}</Text>
                  <TouchableOpacity style={styles.stepMiniBtn} onPress={() => stepMinute(15)}>
                    <Text style={styles.stepMiniBtnText}>+</Text>
                  </TouchableOpacity>
                </View>

                {/* AM / PM Toggle */}
                <View style={styles.ampmSwitch}>
                  <TouchableOpacity
                    style={[styles.ampmBtn, period === 'AM' && styles.ampmBtnActive]}
                    onPress={() => setPeriod('AM')}
                  >
                    <Text style={[styles.ampmText, period === 'AM' && styles.ampmTextActive]}>AM</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.ampmBtn, period === 'PM' && styles.ampmBtnActive]}
                    onPress={() => setPeriod('PM')}
                  >
                    <Text style={[styles.ampmText, period === 'PM' && styles.ampmTextActive]}>PM</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Scheduled Preview Box */}
            <View style={styles.previewBox}>
              <View style={styles.previewIconBox}>
                <Calendar size={18} color="#059669" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.previewSub}>SCHEDULED CALLBACK</Text>
                <Text style={styles.previewMain}>{previewText}</Text>
              </View>
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm} activeOpacity={0.8}>
              <Check size={16} color="#FFFFFF" strokeWidth={2.5} />
              <Text style={styles.confirmBtnText}>Set Follow-up Date</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 14,
    elevation: 8,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  modalSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 18,
    gap: 16,
  },
  sectionWrap: {
    gap: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.4,
  },
  quickPresetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickPresetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  quickPresetBtnActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  quickPresetBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  dayTabsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dayTab: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
  },
  dayTabActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  dayTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  dayTabTextActive: {
    color: '#FFFFFF',
  },
  dateStepperCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginTop: 4,
  },
  dateStepBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateStepperCenter: {
    alignItems: 'center',
  },
  dateStepperDay: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  dateStepperDate: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  timeSlotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timeSlotCard: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  timeSlotCardActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  timeSlotTime: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  timeSlotTimeActive: {
    color: '#2563EB',
  },
  timeSlotLabel: {
    fontSize: 10,
    color: '#64748B',
  },
  exactTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 8,
    marginTop: 4,
  },
  exactTimeLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  stepperGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  stepMiniBtn: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepMiniBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#2563EB',
  },
  stepperValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    paddingHorizontal: 6,
  },
  timeColon: {
    fontSize: 14,
    fontWeight: '800',
    color: '#475569',
  },
  ampmSwitch: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 2,
    marginLeft: 'auto',
  },
  ampmBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  ampmBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  ampmText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  ampmTextActive: {
    color: '#2563EB',
  },
  previewBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    padding: 12,
  },
  previewIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#D1FAE5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewSub: {
    fontSize: 10,
    fontWeight: '800',
    color: '#065F46',
    letterSpacing: 0.4,
  },
  previewMain: {
    fontSize: 13,
    fontWeight: '800',
    color: '#047857',
    marginTop: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#FAFAFA',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  confirmBtn: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    backgroundColor: '#2563EB',
    borderRadius: 10,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  confirmBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
