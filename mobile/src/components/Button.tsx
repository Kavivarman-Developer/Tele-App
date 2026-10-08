import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  TouchableOpacityProps,
  StyleSheet,
  View,
} from 'react-native';
import { colors, borderRadius, shadows } from '../theme';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'subtle';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: ButtonVariant;
  loading?: boolean;
  icon?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export const Button: React.FC<ButtonProps> = ({
  title,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
  size = 'md',
  style,
  ...rest
}) => {
  const isDisabled = disabled || loading;

  const getVariantStyles = () => {
    switch (variant) {
      case 'secondary':
        return {
          container: { backgroundColor: colors.surfaceLight, borderColor: colors.border, borderWidth: 1 },
          text: { color: colors.text },
          indicator: colors.text,
        };
      case 'outline':
        return {
          container: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
          text: { color: colors.textSecondary },
          indicator: colors.primary,
        };
      case 'danger':
        return {
          container: { backgroundColor: colors.danger },
          text: { color: colors.surface },
          indicator: colors.surface,
        };
      case 'subtle':
        return {
          container: { backgroundColor: colors.primaryLight },
          text: { color: colors.primary },
          indicator: colors.primary,
        };
      case 'primary':
      default:
        return {
          container: { backgroundColor: colors.primary, ...shadows.soft },
          text: { color: colors.surface },
          indicator: colors.surface,
        };
    }
  };

  const vStyles = getVariantStyles();

  const sizeStyles = {
    sm: { paddingVertical: 8, paddingHorizontal: 12, fontSize: 12 },
    md: { paddingVertical: 12, paddingHorizontal: 18, fontSize: 14 },
    lg: { paddingVertical: 14, paddingHorizontal: 22, fontSize: 16 },
  }[size];

  return (
    <TouchableOpacity
      style={[
        styles.button,
        vStyles.container,
        {
          paddingVertical: sizeStyles.paddingVertical,
          paddingHorizontal: sizeStyles.paddingHorizontal,
          opacity: isDisabled ? 0.6 : 1,
        },
        style,
      ]}
      disabled={isDisabled}
      activeOpacity={0.8}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={vStyles.indicator}
          style={{ marginRight: 8 }}
        />
      ) : icon ? (
        <View style={{ marginRight: 8 }}>{icon}</View>
      ) : null}
      <Text style={[styles.text, vStyles.text, { fontSize: sizeStyles.fontSize }]}>
        {title}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: borderRadius.md,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
