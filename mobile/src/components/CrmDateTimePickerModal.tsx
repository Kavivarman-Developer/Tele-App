import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import {
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  Sparkles,
} from 'lucide-react-native';
import { colors } from '../theme';

export interface CrmDateTimePickerModalProps {
  visible: boolean;
  initialDate?: string | Date | null;
  onClose: () => void;
  onConfirm: (isoDate: string) => void;
  title?: string;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const WEEK_DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const POPULAR_HOURS = [9, 10, 11, 12, 2, 3, 4, 5, 6, 7];
const MINUTES_LIST = [0, 15, 30, 45];

export const CrmDateTimePickerModal: React.FC<CrmDateTimePickerModalProps> = ({
  visible,
  initialDate,
  onClose,
  onConfirm,
  title = 'Pick Follow-up Date & Time',
}) => {
  const now = useMemo(() => new Date(), []);

  // Initialize selected date time
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth());
  const [selectedDay, setSelectedDay] = useState<number>(now.getDate());

  // View state for browsing calendar months
  const [viewYear, setViewYear] = useState<number>(now.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(now.getMonth());

  // Time state
  const [hour12, setHour12] = useState<number>(10);
  const [minute, setMinute] = useState<number>(0);
  const [period, setPeriod] = useState<'AM' | 'PM'>('AM');

  // Reset or initialize when modal becomes visible
  useEffect(() => {
    if (visible) {
      let init = new Date();
      if (initialDate) {
        const parsed = new Date(initialDate);
        if (!isNaN(parsed.getTime())) {
          init = parsed;
        }
      } else {
        // Default: Tomorrow 10 AM
        init.setDate(init.getDate() + 1);
        init.setHours(10, 0, 0, 0);
      }

      setSelectedYear(init.getFullYear());
      setSelectedMonth(init.getMonth());
      setSelectedDay(init.getDate());
      setViewYear(init.getFullYear());
      setViewMonth(init.getMonth());

      const rawHours = init.getHours();
      const isPm = rawHours >= 12;
      const h12 = rawHours % 12 === 0 ? 12 : rawHours % 12;
      setHour12(h12);
      setMinute(Math.round(init.getMinutes() / 15) * 15 % 60);
      setPeriod(isPm ? 'PM' : 'AM');
    }
  }, [visible, initialDate]);

  // Calendar Grid Calculations
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay();
    const daysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const days = [];

    // Empty lead slots before month starts
    for (let i = 0; i < firstDayIndex; i++) {
      days.push({ day: null, isCurrentMonth: false });
    }

    // Days in current month
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      const dayDate = new Date(viewYear, viewMonth, d);
      const isToday =
        dayDate.getDate() === now.getDate() &&
        dayDate.getMonth() === now.getMonth() &&
        dayDate.getFullYear() === now.getFullYear();

      const isPast =
        dayDate.getTime() <
        new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

      const isSelected =
        d === selectedDay &&
        viewMonth === selectedMonth &&
        viewYear === selectedYear;

      days.push({
        day: d,
        isCurrentMonth: true,
        isToday,
        isPast,
        isSelected,
      });
    }

    return days;
  }, [viewYear, viewMonth, selectedYear, selectedMonth, selectedDay, now]);

  // Month navigation
  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  // Quick preset shortcuts
  const applyPreset = (daysOffset: number, h: number, m: number, p: 'AM' | 'PM') => {
    const target = new Date();
    target.setDate(target.getDate() + daysOffset);
    setSelectedYear(target.getFullYear());
    setSelectedMonth(target.getMonth());
    setSelectedDay(target.getDate());
    setViewYear(target.getFullYear());
    setViewMonth(target.getMonth());
    setHour12(h);
    setMinute(m);
    setPeriod(p);
  };

  // Formatted date string for preview
  const previewDateStr = useMemo(() => {
    const d = new Date(selectedYear, selectedMonth, selectedDay);
    const dayName = d.toLocaleDateString([], { weekday: 'short' });
    const monthName = d.toLocaleDateString([], { month: 'short' });
    const formattedMin = minute < 10 ? `0${minute}` : String(minute);
    const formattedHour = hour12 < 10 ? `0${hour12}` : String(hour12);
    return `${dayName}, ${monthName} ${selectedDay}, ${selectedYear} at ${formattedHour}:${formattedMin} ${period}`;
  }, [selectedYear, selectedMonth, selectedDay, hour12, minute, period]);

  // Confirm Selection
  const handleConfirm = () => {
    let finalHours = hour12 % 12;
    if (period === 'PM') {
      finalHours += 12;
    }
    const finalDate = new Date(
      selectedYear,
      selectedMonth,
      selectedDay,
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
                <Calendar size={18} color="#2563EB" />
              </View>
              <View>
                <Text style={styles.modalTitle}>{title}</Text>
                <Text style={styles.modalSubtitle}>Custom follow-up date and time</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <X size={18} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Quick Preset Pills */}
            <View style={styles.presetsWrap}>
              <Text style={styles.sectionLabel}>Quick Presets:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetsRow}>
                <TouchableOpacity
                  style={styles.presetPill}
                  onPress={() => applyPreset(1, 10, 0, 'AM')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.presetPillText}>Tomorrow 10 AM</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.presetPill}
                  onPress={() => applyPreset(1, 3, 0, 'PM')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.presetPillText}>Tomorrow 3 PM</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.presetPill}
                  onPress={() => applyPreset(1, 6, 0, 'PM')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.presetPillText}>Tomorrow 6 PM</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.presetPill}
                  onPress={() => applyPreset(2, 11, 0, 'AM')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.presetPillText}>In 2 Days</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.presetPill}
                  onPress={() => applyPreset(7, 10, 0, 'AM')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.presetPillText}>Next Week</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>

            {/* Calendar Card */}
            <View style={styles.calendarCard}>
              {/* Month Navigation */}
              <View style={styles.monthNavRow}>
                <TouchableOpacity onPress={handlePrevMonth} style={styles.navArrowBtn} activeOpacity={0.7}>
                  <ChevronLeft size={18} color="#334155" />
                </TouchableOpacity>

                <Text style={styles.monthYearTitle}>
                  {MONTH_NAMES[viewMonth]} {viewYear}
                </Text>

                <TouchableOpacity onPress={handleNextMonth} style={styles.navArrowBtn} activeOpacity={0.7}>
                  <ChevronRight size={18} color="#334155" />
                </TouchableOpacity>
              </View>

              {/* Weekday Labels */}
              <View style={styles.weekDaysRow}>
                {WEEK_DAYS.map((wd, idx) => (
                  <Text key={idx} style={styles.weekDayText}>
                    {wd}
                  </Text>
                ))}
              </View>

              {/* Days Grid */}
              <View style={styles.daysGrid}>
                {calendarDays.map((item, idx) => {
                  if (!item.isCurrentMonth || item.day === null) {
                    return <View key={idx} style={styles.emptyDaySlot} />;
                  }

                  return (
                    <TouchableOpacity
                      key={idx}
                      onPress={() => {
                        setSelectedDay(item.day!);
                        setSelectedMonth(viewMonth);
                        setSelectedYear(viewYear);
                      }}
                      disabled={item.isPast}
                      activeOpacity={0.7}
                      style={[
                        styles.daySlot,
                        item.isSelected && styles.daySlotSelected,
                        item.isToday && !item.isSelected && styles.daySlotToday,
                        item.isPast && styles.daySlotPast,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          item.isSelected && styles.dayTextSelected,
                          item.isToday && !item.isSelected && styles.dayTextToday,
                          item.isPast && styles.dayTextPast,
                        ]}
                      >
                        {item.day}
                      </Text>
                      {item.isToday && !item.isSelected && <View style={styles.todayDot} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Time Picker Section */}
            <View style={styles.timeSection}>
              <View style={styles.timeHeaderRow}>
                <View style={styles.labelWithIcon}>
                  <Clock size={15} color="#4F46E5" />
                  <Text style={styles.sectionLabel}>Select Time:</Text>
                </View>

                {/* AM / PM Toggle */}
                <View style={styles.ampmToggleWrap}>
                  <TouchableOpacity
                    style={[styles.ampmBtn, period === 'AM' && styles.ampmBtnActive]}
                    onPress={() => setPeriod('AM')}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.ampmText, period === 'AM' && styles.ampmTextActive]}>
                      AM
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.ampmBtn, period === 'PM' && styles.ampmBtnActive]}
                    onPress={() => setPeriod('PM')}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.ampmText, period === 'PM' && styles.ampmTextActive]}>
                      PM
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Hour Selection Chips */}
              <View style={styles.timeBlock}>
                <Text style={styles.timeSubLabel}>Hour:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timeChipsRow}>
                  {POPULAR_HOURS.map((h) => {
                    const isSelected = hour12 === h;
                    return (
                      <TouchableOpacity
                        key={h}
                        onPress={() => setHour12(h)}
                        style={[styles.timeChip, isSelected && styles.timeChipActive]}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.timeChipText, isSelected && styles.timeChipTextActive]}>
                          {h < 10 ? `0${h}` : h}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Minute Selection Chips */}
              <View style={styles.timeBlock}>
                <Text style={styles.timeSubLabel}>Minute:</Text>
                <View style={styles.minuteChipsRow}>
                  {MINUTES_LIST.map((m) => {
                    const isSelected = minute === m;
                    return (
                      <TouchableOpacity
                        key={m}
                        onPress={() => setMinute(m)}
                        style={[styles.minuteChip, isSelected && styles.minuteChipActive]}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.minuteChipText, isSelected && styles.minuteChipTextActive]}>
                          :{m < 10 ? `0${m}` : m}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>

            {/* Selected Date Time Preview Card */}
            <View style={styles.previewCard}>
              <View style={styles.previewLeft}>
                <Sparkles size={16} color="#0D9488" />
                <View>
                  <Text style={styles.previewTitle}>Scheduled Callback</Text>
                  <Text style={styles.previewValue}>{previewDateStr}</Text>
                </View>
              </View>
            </View>
          </ScrollView>

          {/* Action Footer */}
          <View style={styles.footerRow}>
            <TouchableOpacity onPress={onClose} style={styles.cancelBtn} activeOpacity={0.7}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleConfirm} style={styles.confirmBtn} activeOpacity={0.8}>
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
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: '100%',
    maxWidth: 440,
    maxHeight: '90%',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
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
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 11,
    color: '#64748B',
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    padding: 16,
    gap: 14,
  },
  // Presets
  presetsWrap: {
    gap: 6,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 2,
  },
  presetPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  presetPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  // Calendar Card
  calendarCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
  },
  monthNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  monthYearTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  navArrowBtn: {
    width: 30,
    height: 30,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekDaysRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  weekDayText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  emptyDaySlot: {
    width: '14.28%',
    height: 36,
  },
  daySlot: {
    width: '14.28%',
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    marginVertical: 1,
  },
  daySlotSelected: {
    backgroundColor: '#2563EB',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  daySlotToday: {
    borderWidth: 1,
    borderColor: '#3B82F6',
    backgroundColor: '#EFF6FF',
  },
  daySlotPast: {
    opacity: 0.3,
  },
  dayText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E293B',
  },
  dayTextSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  dayTextToday: {
    color: '#2563EB',
    fontWeight: '800',
  },
  dayTextPast: {
    color: '#94A3B8',
  },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#2563EB',
    marginTop: 1,
  },
  // Time Section
  timeSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    gap: 10,
  },
  timeHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  labelWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ampmToggleWrap: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 2,
  },
  ampmBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  ampmBtnActive: {
    backgroundColor: '#2563EB',
  },
  ampmText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  ampmTextActive: {
    color: '#FFFFFF',
  },
  timeBlock: {
    gap: 5,
  },
  timeSubLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  timeChipsRow: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 2,
  },
  timeChip: {
    width: 36,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeChipActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#4F46E5',
  },
  timeChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  timeChipTextActive: {
    color: '#4F46E5',
    fontWeight: '800',
  },
  minuteChipsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  minuteChip: {
    flex: 1,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  minuteChipActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#4F46E5',
  },
  minuteChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  minuteChipTextActive: {
    color: '#4F46E5',
    fontWeight: '800',
  },
  // Preview
  previewCard: {
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#CCFBF1',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previewLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  previewTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0F766E',
    textTransform: 'uppercase',
  },
  previewValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 1,
  },
  // Footer
  footerRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  confirmBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#2563EB',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  confirmBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
