import React from 'react';
import { View, Text } from 'react-native';

export type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ label, variant = 'default', className = '' }) => {
  let bgClass = 'bg-slate-100 border-slate-200';
  let textClass = 'text-slate-700';

  if (variant === 'success') {
    bgClass = 'bg-emerald-50 border-emerald-200';
    textClass = 'text-emerald-700';
  } else if (variant === 'warning') {
    bgClass = 'bg-amber-50 border-amber-200';
    textClass = 'text-amber-800';
  } else if (variant === 'danger') {
    bgClass = 'bg-rose-50 border-rose-200';
    textClass = 'text-rose-700';
  } else if (variant === 'info') {
    bgClass = 'bg-blue-50 border-blue-200';
    textClass = 'text-blue-700';
  }

  return (
    <View className={`px-2.5 py-1 rounded-full border self-start ${bgClass} ${className}`}>
      <Text className={`text-xs font-semibold ${textClass}`}>{label}</Text>
    </View>
  );
};
