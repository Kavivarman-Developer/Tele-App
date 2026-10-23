import React from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { Plus } from 'lucide-react-native';
import { useDialerStore } from '../store/dialerStore';

interface FloatingDialpadFabProps {
  bottomOffset?: number;
  hideOnWide?: boolean;
}

export const FloatingDialpadFab: React.FC<FloatingDialpadFabProps> = ({
  bottomOffset,
  hideOnWide = false,
}) => {
  const { width } = useWindowDimensions();
  const isWide = width >= 860;
  const isDialerOpen = useDialerStore((s) => s.isOpen);

  // If dialpad modal is currently open, hide the FAB
  if (isDialerOpen) {
    return null;
  }

  if (hideOnWide && isWide) {
    return null;
  }

  const effectiveBottom =
    bottomOffset !== undefined
      ? bottomOffset
      : isWide
      ? 28
      : 78; // 78px on mobile floats comfortably above the bottom tab bar

  const effectiveRight = isWide ? 28 : 20;

  return (
    <TouchableOpacity
      style={[
        styles.fab,
        {
          bottom: effectiveBottom,
          right: effectiveRight,
        },
      ]}
      onPress={() => useDialerStore.getState().openDialer()}
      activeOpacity={0.82}
      accessibilityLabel="Open Phone Keypad"
      accessibilityRole="button"
    >
      <Plus size={28} color="#FFFFFF" strokeWidth={3} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0F9D58',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F9D58',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.38,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 99,
  },
});
