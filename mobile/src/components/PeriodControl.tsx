import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Calendar } from 'lucide-react-native';
import { colors, borderRadius, shadows } from '../theme';

export type ReportingPeriod = 'Today' | '7 Days' | '30 Days' | 'Custom';

export interface PeriodControlProps {
  selected: ReportingPeriod;
  onSelect: (period: ReportingPeriod) => void;
  customDateLabel?: string;
  onPickCustomDate?: () => void;
}

export const PeriodControl: React.FC<PeriodControlProps> = ({
  selected,
  onSelect,
  customDateLabel,
  onPickCustomDate,
}) => {
  const options: ('Today' | '7 Days' | '30 Days')[] = ['Today', '7 Days', '30 Days'];

  return (
    <View style={styles.container}>
      {options.map((opt) => {
        const isActive = selected === opt;
        return (
          <TouchableOpacity
            key={opt}
            style={[styles.button, isActive && styles.activeButton]}
            onPress={() => onSelect(opt)}
            activeOpacity={0.7}
          >
            <Text
              style={[styles.buttonText, isActive && styles.activeButtonText]}
              numberOfLines={1}
            >
              {opt}
            </Text>
          </TouchableOpacity>
        );
      })}

      {/* Date Picker Button / Custom Date */}
      <TouchableOpacity
        style={[
          styles.button,
          styles.customButton,
          selected === 'Custom' && styles.activeButton,
        ]}
        onPress={() => {
          if (onPickCustomDate) {
            onPickCustomDate();
          } else {
            onSelect('Custom');
          }
        }}
        activeOpacity={0.7}
        accessibilityLabel="Pick custom date"
      >
        <Calendar
          size={12}
          color={selected === 'Custom' ? colors.primary : '#64748B'}
        />
        <Text
          style={[
            styles.buttonText,
            selected === 'Custom' && styles.activeButtonText,
            { marginLeft: 4 },
          ]}
          numberOfLines={1}
        >
          {selected === 'Custom' && customDateLabel ? customDateLabel : 'Date'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: borderRadius.md,
    padding: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  button: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  customButton: {
    paddingHorizontal: 8,
  },
  activeButton: {
    backgroundColor: '#FFFFFF',
    ...shadows.soft,
  },
  buttonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  activeButtonText: {
    color: colors.primary,
    fontWeight: '800',
  },
});
