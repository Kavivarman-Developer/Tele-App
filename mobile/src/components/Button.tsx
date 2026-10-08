import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  TouchableOpacityProps,
} from 'react-native';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: ButtonVariant;
  loading?: boolean;
  className?: string;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
  ...rest
}) => {
  const isDisabled = disabled || loading;

  let bgClass = 'bg-blue-600 active:bg-blue-700 shadow-sm';
  let textClass = 'text-white';
  let borderClass = 'border-transparent';

  if (variant === 'secondary') {
    bgClass = 'bg-slate-100 active:bg-slate-200';
    borderClass = 'border border-slate-200';
    textClass = 'text-slate-800';
  } else if (variant === 'outline') {
    bgClass = 'bg-white active:bg-slate-50';
    borderClass = 'border border-slate-300';
    textClass = 'text-slate-700';
  } else if (variant === 'danger') {
    bgClass = 'bg-rose-600 active:bg-rose-700 shadow-sm';
    textClass = 'text-white';
  }

  if (isDisabled) {
    bgClass += ' opacity-50';
  }

  return (
    <TouchableOpacity
      className={`py-3.5 px-5 rounded-xl flex-row justify-center items-center ${bgClass} ${borderClass}`}
      disabled={isDisabled}
      style={style}
      activeOpacity={0.8}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator size="small" color="#FFFFFF" className="mr-2" />
      ) : null}
      <Text className={`font-semibold text-base ${textClass}`}>{title}</Text>
    </TouchableOpacity>
  );
};
