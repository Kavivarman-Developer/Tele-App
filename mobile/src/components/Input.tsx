import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
} from 'react-native';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string | null;
  className?: string;
  isPassword?: boolean;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  isPassword = false,
  secureTextEntry,
  ...rest
}) => {
  const [isSecure, setIsSecure] = useState<boolean>(isPassword || Boolean(secureTextEntry));

  return (
    <View className="w-full mb-4">
      {label ? <Text className="text-slate-700 font-semibold text-sm mb-1.5">{label}</Text> : null}
      <View
        className={`flex-row items-center bg-white border rounded-xl px-3.5 ${
          error ? 'border-red-500' : 'border-slate-300'
        }`}
      >
        <TextInput
          className="flex-1 py-3 text-slate-900 text-base"
          placeholderTextColor="#94A3B8"
          secureTextEntry={isSecure}
          autoCapitalize="none"
          {...rest}
        />
        {isPassword ? (
          <TouchableOpacity onPress={() => setIsSecure(!isSecure)} className="p-1">
            <Text className="text-slate-500 text-xs font-semibold">
              {isSecure ? 'SHOW' : 'HIDE'}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {error ? <Text className="text-red-500 text-xs mt-1 font-medium">{error}</Text> : null}
    </View>
  );
};
