import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react-native';
import { useToastStore, ToastType } from '../store/toastStore';
import { borderRadius, shadows } from '../theme';

const TOAST_THEMES: Record<
  ToastType,
  {
    bg: string;
    border: string;
    text: string;
    titleColor: string;
    icon: React.ReactNode;
  }
> = {
  success: {
    bg: '#ECFDF5',
    border: '#A7F3D0',
    text: '#065F46',
    titleColor: '#047857',
    icon: <CheckCircle2 size={18} color="#059669" strokeWidth={2.2} />,
  },
  error: {
    bg: '#FEF2F2',
    border: '#FECACA',
    text: '#991B1B',
    titleColor: '#B91C1C',
    icon: <AlertCircle size={18} color="#DC2626" strokeWidth={2.2} />,
  },
  warning: {
    bg: '#FFFBEB',
    border: '#FDE68A',
    text: '#92400E',
    titleColor: '#B45309',
    icon: <AlertTriangle size={18} color="#D97706" strokeWidth={2.2} />,
  },
  info: {
    bg: '#EFF6FF',
    border: '#BFDBFE',
    text: '#1E40AF',
    titleColor: '#1D4ED8',
    icon: <Info size={18} color="#2563EB" strokeWidth={2.2} />,
  },
};

export const CrmToast: React.FC = () => {
  const { visible, message, title, type, hide } = useToastStore();

  if (!visible) return null;

  const theme = TOAST_THEMES[type] || TOAST_THEMES.info;

  return (
    <SafeAreaInsetsContext.Consumer>
      {(insets) => {
        const topOffset = (insets?.top || 0) + 12;

        return (
          <View
            style={[
              styles.container,
              {
                top: topOffset,
                pointerEvents: 'box-none',
              },
            ]}
          >
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={hide}
              style={[
                styles.toastCard,
                {
                  backgroundColor: theme.bg,
                  borderColor: theme.border,
                },
              ]}
            >
              <View style={styles.iconContainer}>{theme.icon}</View>

              <View style={styles.textContainer}>
                {title ? (
                  <Text style={[styles.title, { color: theme.titleColor }]}>
                    {title}
                  </Text>
                ) : null}
                <Text style={[styles.message, { color: theme.text }]}>
                  {message}
                </Text>
              </View>

              <TouchableOpacity
                onPress={hide}
                style={styles.closeButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={14} color={theme.text} strokeWidth={2} />
              </TouchableOpacity>
            </TouchableOpacity>
          </View>
        );
      }}
    </SafeAreaInsetsContext.Consumer>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 99999,
    elevation: 99999,
  },
  toastCard: {
    maxWidth: 520,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    ...shadows.elevated,
  },
  iconContainer: {
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
    letterSpacing: -0.2,
  },
  message: {
    fontSize: 12.5,
    fontWeight: '500',
    lineHeight: 17,
  },
  closeButton: {
    padding: 4,
    marginLeft: 8,
    opacity: 0.7,
  },
});
