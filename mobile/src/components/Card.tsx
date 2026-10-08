import React from 'react';
import { View, ViewProps, StyleSheet } from 'react-native';
import { colors, borderRadius, shadows } from '../theme';

interface CardProps extends ViewProps {
  className?: string;
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ style, children, ...rest }) => {
  return (
    <View style={[styles.card, style]} {...rest}>
      {children}
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
    ...shadows.soft,
  },
});
