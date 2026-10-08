import React from 'react';
import { View, Text } from 'react-native';
import { Button } from './Button';

interface EmptyStateProps {
  title: string;
  description?: string;
  actionTitle?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionTitle,
  onAction,
}) => {
  return (
    <View className="flex-1 justify-center items-center p-8 bg-transparent">
      <View className="w-16 h-16 rounded-full bg-slate-100 border border-slate-200 justify-center items-center mb-4">
        <Text className="text-2xl">📋</Text>
      </View>
      <Text className="text-lg font-bold text-slate-800 text-center mb-1.5">{title}</Text>
      {description ? (
        <Text className="text-sm text-slate-500 text-center mb-6 max-w-xs">{description}</Text>
      ) : null}
      {actionTitle && onAction ? (
        <Button title={actionTitle} onPress={onAction} variant="outline" />
      ) : null}
    </View>
  );
};
