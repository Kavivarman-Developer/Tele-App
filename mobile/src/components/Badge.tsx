import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, borderRadius } from '../theme';

export type BadgeVariant =
  | 'default'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'primary';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  stage?: string;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'default',
  stage,
}) => {
  // If a known pipeline stage is provided, use stage styling
  if (stage && colors.stages[stage as keyof typeof colors.stages]) {
    const stg = colors.stages[stage as keyof typeof colors.stages];
    return (
      <View style={[styles.badge, { backgroundColor: stg.bg }]}>
        <View style={[styles.dot, { backgroundColor: stg.color }]} />
        <Text style={[styles.text, { color: stg.text }]}>{label || stage}</Text>
      </View>
    );
  }

  let bg = colors.surfaceLight;
  let text = colors.textMuted;
  let dot = colors.textQuiet;

  if (variant === 'success') {
    bg = colors.successLight;
    text = colors.successText;
    dot = colors.success;
  } else if (variant === 'warning') {
    bg = colors.warningLight;
    text = colors.warningText;
    dot = colors.warning;
  } else if (variant === 'danger') {
    bg = colors.dangerLight;
    text = colors.dangerText;
    dot = colors.danger;
  } else if (variant === 'info' || variant === 'primary') {
    bg = colors.primaryLight;
    text = colors.primary;
    dot = colors.primary;
  }

  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <View style={[styles.dot, { backgroundColor: dot }]} />
      <Text style={[styles.text, { color: text }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
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
    fontSize: 11,
    fontWeight: '600',
  },
});
