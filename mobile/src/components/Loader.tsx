import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { colors } from '../theme';

interface LoaderProps {
  message?: string;
  size?: 'small' | 'large';
  color?: string;
}

export const Loader: React.FC<LoaderProps> = ({
  message,
  size = 'large',
  color = colors.primary,
}) => {
  return (
    <View className="flex-1 justify-center items-center p-6 bg-transparent">
      <ActivityIndicator size={size} color={color} />
      {message ? (
        <Text className="text-slate-600 text-sm mt-3 text-center">{message}</Text>
      ) : null}
    </View>
  );
};
