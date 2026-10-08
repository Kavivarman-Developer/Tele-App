import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, borderRadius } from '../theme';

interface CrmAvatarProps {
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | number;
  tone?: 'primary' | 'muted' | 'success' | 'warning' | 'auto';
}

const TONE_STYLES = {
  primary: { bg: colors.primaryLight, text: colors.primary },
  muted: { bg: colors.surfaceLight, text: colors.textMuted },
  success: { bg: colors.successLight, text: colors.success },
  warning: { bg: colors.warningLight, text: colors.warning },
};

export const CrmAvatar: React.FC<CrmAvatarProps> = ({
  name,
  size = 'md',
  tone = 'auto',
}) => {
  const getInitials = (text: string) => {
    if (!text) return '??';
    const parts = text.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const getToneStyle = () => {
    if (tone !== 'auto') return TONE_STYLES[tone];
    const charCode = (name || '').charCodeAt(0) || 0;
    const tones: Array<keyof typeof TONE_STYLES> = ['primary', 'muted', 'success', 'warning'];
    return TONE_STYLES[tones[charCode % tones.length]];
  };

  let dimSize = 38;
  let font = 12;

  if (typeof size === 'number') {
    dimSize = size;
    font = Math.round(size * 0.35);
  } else {
    const predefined = {
      sm: { size: 28, font: 10 },
      md: { size: 38, font: 12 },
      lg: { size: 48, font: 15 },
      xl: { size: 64, font: 20 },
    }[size];
    dimSize = predefined.size;
    font = predefined.font;
  }

  const styleTone = getToneStyle();

  return (
    <View
      style={[
        styles.avatar,
        {
          width: dimSize,
          height: dimSize,
          borderRadius: borderRadius.full,
          backgroundColor: styleTone.bg,
        },
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            fontSize: font,
            color: styleTone.text,
          },
        ]}
      >
        {getInitials(name)}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  avatar: {
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  text: {
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
