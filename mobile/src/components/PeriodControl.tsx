import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, borderRadius, shadows } from '../theme';

export type ReportingPeriod = 'Today' | '7 Days' | '30 Days';

interface PeriodControlProps {
  selected: ReportingPeriod;
  onSelect: (period: ReportingPeriod) => void;
}

export const PeriodControl: React.FC<PeriodControlProps> = ({
  selected,
  onSelect,
}) => {
  const options: ReportingPeriod[] = ['Today', '7 Days', '30 Days'];

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
            >
              {opt}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.md,
    padding: 3,
  },
  button: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: borderRadius.sm,
  },
  activeButton: {
    backgroundColor: colors.surface,
    ...shadows.soft,
  },
  buttonText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textMuted,
  },
  activeButtonText: {
    color: colors.primary,
    fontWeight: '700',
  },
});
