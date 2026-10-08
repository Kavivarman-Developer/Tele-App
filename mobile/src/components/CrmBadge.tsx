import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, borderRadius } from '../theme';

export type CrmBadgeTone =
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'neutral'
  | 'info'
  | 'emerald'
  | 'amber'
  | 'rose'
  | 'indigo'
  | 'slate';

interface CrmBadgeProps {
  label: string;
  tone?: CrmBadgeTone;
  showDot?: boolean;
  size?: 'sm' | 'md';
}

const TONE_MAP: Record<CrmBadgeTone, { bg: string; text: string; dot: string }> = {
  primary: {
    bg: colors.primaryLight,
    text: colors.primary,
    dot: colors.primary,
  },
  indigo: {
    bg: colors.primaryLight,
    text: colors.primary,
    dot: colors.primary,
  },
  success: {
    bg: colors.successLight,
    text: colors.successText,
    dot: colors.success,
  },
  emerald: {
    bg: colors.successLight,
    text: colors.successText,
    dot: colors.success,
  },
  warning: {
    bg: colors.warningLight,
    text: colors.warningText,
    dot: colors.warning,
  },
  amber: {
    bg: colors.warningLight,
    text: colors.warningText,
    dot: colors.warning,
  },
  danger: {
    bg: colors.dangerLight,
    text: colors.dangerText,
    dot: colors.danger,
  },
  rose: {
    bg: colors.dangerLight,
    text: colors.dangerText,
    dot: colors.danger,
  },
  neutral: {
    bg: colors.surfaceLight,
    text: colors.textMuted,
    dot: colors.textQuiet,
  },
  slate: {
    bg: colors.surfaceLight,
    text: colors.textMuted,
    dot: colors.textQuiet,
  },
  info: {
    bg: colors.infoLight,
    text: colors.infoText,
    dot: colors.info,
  },
};

export const CrmBadge: React.FC<CrmBadgeProps> = ({
  label,
  tone = 'neutral',
  showDot = false,
  size = 'sm',
}) => {
  const currentTone = TONE_MAP[tone] || TONE_MAP.neutral;
  const isSm = size === 'sm';

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: currentTone.bg,
          paddingHorizontal: isSm ? 7 : 10,
          paddingVertical: isSm ? 3 : 5,
        },
      ]}
    >
      {showDot ? (
        <View style={[styles.dot, { backgroundColor: currentTone.dot }]} />
      ) : null}
      <Text
        style={[
          styles.text,
          {
            color: currentTone.text,
            fontSize: isSm ? 10 : 12,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.sm,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: borderRadius.full,
    marginRight: 5,
  },
  text: {
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
