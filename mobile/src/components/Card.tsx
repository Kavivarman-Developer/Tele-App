import React from 'react';
import { View, ViewProps } from 'react-native';

interface CardProps extends ViewProps {
  className?: string;
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ className = '', children, ...rest }) => {
  return (
    <View
      className={`bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm ${className}`}
      {...rest}
    >
      {children}
    </View>
  );
};
