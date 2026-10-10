import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, User, PhoneCall, RefreshCw, Bell } from 'lucide-react-native';
import { colors, borderRadius, shadows } from '../theme';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import { FollowUpNotificationsModal } from './FollowUpNotificationsModal';

interface CrmHeaderProps {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  rightAction?: React.ReactNode;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const CrmHeader: React.FC<CrmHeaderProps> = ({
  title = 'Tell',
  subtitle,
  showBack = false,
  rightAction,
  onRefresh,
  isRefreshing = false,
}) => {
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const [showNotifications, setShowNotifications] = useState(false);

  return (
    <>
      <View style={styles.header}>
        <View style={styles.leftContainer}>
          {showBack ? (
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
            >
              <ArrowLeft size={20} color="#FFFFFF" />
            </TouchableOpacity>
          ) : (
            <View style={styles.brandMark}>
              <Text style={styles.brandMarkText}>ND</Text>
            </View>
          )}

          <View style={styles.titleWrapper}>
            <Text style={styles.titleText} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.subtitleText} numberOfLines={1}>
              {subtitle || (user?.role === 'ADMIN' ? 'Superuser Workspace' : user?.role === 'MANAGER' ? 'Manager Workspace' : 'Telecalling Agent')}
            </Text>
          </View>
        </View>

        <View style={styles.rightContainer}>
          {onRefresh ? (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={onRefresh}
              activeOpacity={0.7}
              disabled={isRefreshing}
            >
              <RefreshCw
                size={16}
                color={isRefreshing ? '#FFFFFF' : '#ECFDF5'}
              />
            </TouchableOpacity>
          ) : null}

          {/* Follow-up Notifications Bell Button */}
          <TouchableOpacity
            style={styles.bellBtn}
            onPress={() => setShowNotifications(true)}
            activeOpacity={0.7}
            accessibilityLabel="Follow-up Notifications"
          >
            <Bell size={18} color="#FFFFFF" />
            {unreadCount > 0 ? (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{unreadCount}</Text>
              </View>
            ) : null}
          </TouchableOpacity>

          {rightAction || null}
        </View>
      </View>

      {/* Top Follow-ups & Reminders Modal */}
      <FollowUpNotificationsModal
        visible={showNotifications}
        onClose={() => setShowNotifications(false)}
      />
    </>
  );
};

const styles = StyleSheet.create({
  header: {
    height: 60,
    backgroundColor: '#059669',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    ...shadows.card,
  },
  leftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  brandMark: {
    width: 34,
    height: 34,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  brandMarkText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  titleWrapper: {
    flex: 1,
  },
  titleText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  subtitleText: {
    fontSize: 11,
    color: '#ECFDF5',
    marginTop: 1,
    fontWeight: '500',
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    width: 34,
    height: 34,
    borderRadius: borderRadius.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bellBtn: {
    width: 34,
    height: 34,
    borderRadius: borderRadius.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  bellBadge: {
    position: 'absolute',
    top: 3,
    right: 3,
    backgroundColor: '#EF4444',
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 2,
    borderWidth: 1.5,
    borderColor: '#059669',
  },
  bellBadgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '800',
  },
});
