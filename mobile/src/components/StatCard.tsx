import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ArrowUpRight } from 'lucide-react-native';
import { colors, borderRadius, shadows } from '../theme';

interface StatCardProps {
  label: string;
  value: string | number;
  note?: string;
  sub?: string;
  icon?: React.ReactNode;
  showProgress?: boolean;
  progressPercent?: number;
  avatarStack?: React.ReactNode;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  note,
  sub,
  icon,
  showProgress = false,
  progressPercent = 75,
  avatarStack,
}) => {
  const isPositive = note?.includes('+');
  const isStable = note?.includes('Stable');

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <Text style={styles.eyebrow}>{label}</Text>
        {icon ? <View style={styles.iconWrap}>{icon}</View> : null}
      </View>

      <View style={styles.valueRow}>
        <Text style={styles.valueText}>{value}</Text>
        {note ? (
          <View
            style={[
              styles.noteBadge,
              isPositive && styles.notePositive,
              isStable && styles.noteStable,
            ]}
          >
            {isPositive ? (
              <ArrowUpRight size={12} color={colors.success} style={{ marginRight: 2 }} />
            ) : null}
            <Text
              style={[
                styles.noteText,
                isPositive && styles.noteTextPositive,
                isStable && styles.noteTextStable,
              ]}
            >
              {note}
            </Text>
          </View>
        ) : null}
      </View>

      {showProgress ? (
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.min(100, Math.max(0, progressPercent))}%` },
            ]}
          />
        </View>
      ) : null}

      {avatarStack ? (
        <View style={styles.avatarStackWrap}>{avatarStack}</View>
      ) : null}

      {sub ? <Text style={styles.subText}>{sub}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: 16,
    minHeight: 140,
    justifyContent: 'space-between',
    ...shadows.soft,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textQuiet,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  iconWrap: {
    opacity: 0.7,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginTop: 10,
  },
  valueText: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
  },
  noteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.xs,
    backgroundColor: colors.surfaceLight,
  },
  notePositive: {
    backgroundColor: colors.successLight,
  },
  noteStable: {
    backgroundColor: colors.warningLight,
  },
  noteText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
  },
  noteTextPositive: {
    color: colors.successText,
  },
  noteTextStable: {
    color: colors.warningText,
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.xs,
    overflow: 'hidden',
    marginTop: 12,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  avatarStackWrap: {
    marginTop: 10,
  },
  subText: {
    fontSize: 10,
    color: colors.textQuiet,
    marginTop: 8,
  },
});
