import React from 'react';
import { View, Text, Modal, TouchableOpacity } from 'react-native';

interface CallPermissionModalProps {
  visible: boolean;
  onGrant: () => void;
  onSkip: () => void;
}

export const CallPermissionModal: React.FC<CallPermissionModalProps> = ({
  visible,
  onGrant,
  onSkip,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onSkip}
    >
      <View className="flex-1 bg-black/60 items-center justify-center p-5">
        <View className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl">
          {/* Header Icon */}
          <View className="items-center mb-4">
            <View className="w-16 h-16 rounded-full bg-blue-100 items-center justify-center mb-3">
              <Text className="text-3xl">📞</Text>
            </View>
            <Text className="text-xl font-bold text-gray-900 text-center">
              Automatic Call Detection
            </Text>
            <Text className="text-xs font-semibold text-blue-600 mt-1 uppercase tracking-wider">
              Android Telecalling Feature
            </Text>
          </View>

          {/* Rationale Body */}
          <Text className="text-sm text-gray-600 text-center leading-5 mb-5">
            To automatically detect how long your call lasted and whether the lead answered, Tele CRM needs access to your Call Log and Phone State.
          </Text>

          {/* Key Advantages */}
          <View className="bg-gray-50 rounded-2xl p-4 mb-5 space-y-3">
            <View className="flex-row items-center">
              <Text className="text-base mr-3">⚡</Text>
              <View className="flex-1">
                <Text className="text-xs font-bold text-gray-800">
                  Instant Duration Tracking
                </Text>
                <Text className="text-[11px] text-gray-500">
                  Saves you from manual stopwatch timing.
                </Text>
              </View>
            </View>

            <View className="flex-row items-center mt-2.5">
              <Text className="text-base mr-3">🎯</Text>
              <View className="flex-1">
                <Text className="text-xs font-bold text-gray-800">
                  Connected vs Unanswered Detection
                </Text>
                <Text className="text-[11px] text-gray-500">
                  Prefills disposition status (duration &gt; 0s).
                </Text>
              </View>
            </View>

            <View className="flex-row items-center mt-2.5">
              <Text className="text-base mr-3">🔒</Text>
              <View className="flex-1">
                <Text className="text-xs font-bold text-gray-800">
                  Private & On-Device Only
                </Text>
                <Text className="text-[11px] text-gray-500">
                  Only lead calls are checked on your device.
                </Text>
              </View>
            </View>
          </View>

          {/* Actions */}
          <View className="space-y-2.5">
            <TouchableOpacity
              onPress={onGrant}
              activeOpacity={0.8}
              className="bg-blue-600 py-3.5 rounded-xl items-center shadow-sm"
            >
              <Text className="text-white font-bold text-sm">
                Enable Auto-Detection
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onSkip}
              activeOpacity={0.7}
              className="py-3 items-center"
            >
              <Text className="text-gray-500 font-semibold text-xs">
                Continue in Manual Mode
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};
