import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  Platform,
  StatusBar as RNStatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  PanelLeftClose,
  PanelLeftOpen,
  ArrowLeft,
  ChevronRight,
  Plus,
  MapPin,
  Shield,
  Bell,
} from 'lucide-react-native';

import { useSidebarStore } from '../store/sidebarStore';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import { CrmSidebarContent, CrmSidebarModalDrawer } from './CrmSidebar';
import { PeriodControl, ReportingPeriod } from './PeriodControl';
import { FollowUpNotificationsModal } from './FollowUpNotificationsModal';
import { colors, borderRadius, shadows } from '../theme';

interface CrmShellProps {
  title: string;
  headerIcon?: React.ReactNode;
  subtitle?: string;
  breadcrumb?: string;
  showBack?: boolean;
  showPeriodControl?: boolean;
  period?: ReportingPeriod;
  onPeriodChange?: (p: ReportingPeriod) => void;
  customDateLabel?: string;
  onPickCustomDate?: () => void;
  rightAction?: React.ReactNode;
  children: React.ReactNode;
}

export const CrmShell: React.FC<CrmShellProps> = ({
  title,
  headerIcon,
  subtitle,
  breadcrumb,
  showBack = false,
  showPeriodControl = false,
  period = 'Today',
  onPeriodChange,
  customDateLabel,
  onPickCustomDate,
  rightAction,
  children,
}) => {
  const navigation = useNavigation<any>();
  const { width } = useWindowDimensions();
  const isWide = width >= 860;

  const { isCollapsed, toggleCollapse, toggleDrawer } = useSidebarStore();
  const { user } = useAuthStore();
  const unreadNotifications = useNotificationStore((s) => s.unreadCount);
  const [showNotifications, setShowNotifications] = useState(false);

  const handleToggle = () => {
    if (isWide) {
      toggleCollapse();
    } else {
      toggleDrawer();
    }
  };

  return (
    <SafeAreaView style={styles.shellContainer} edges={['top']}>
      <RNStatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />
      <View style={styles.shellLayout}>
        {/* Persistent sidebar for wide screen/web */}
        {isWide && (
          <CrmSidebarContent collapsed={isCollapsed} />
        )}

        {/* Main Content Area */}
        <View style={styles.mainContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              {showBack ? (
                <TouchableOpacity
                  style={styles.toggleBtn}
                  onPress={() => navigation.goBack()}
                  activeOpacity={0.7}
                >
                  <ArrowLeft size={18} color={colors.text} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.toggleBtn}
                  onPress={handleToggle}
                  activeOpacity={0.7}
                  accessibilityLabel="Toggle sidebar"
                >
                  {isCollapsed && isWide ? (
                    <PanelLeftOpen size={18} color={colors.text} />
                  ) : (
                    <PanelLeftClose size={18} color={colors.text} />
                  )}
                </TouchableOpacity>
              )}

              <View style={styles.headerTitleGroup}>
                {headerIcon ? <View style={styles.headerIconBox}>{headerIcon}</View> : null}
                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <Text style={styles.headerTitle} numberOfLines={1}>
                      {title}
                    </Text>
                    {user?.branch ? (
                      <View style={styles.headerBranchBadge}>
                        <MapPin size={9} color="#0D9488" />
                        <Text style={styles.headerBranchBadgeText}>{user.branch} Branch</Text>
                      </View>
                    ) : user?.role === 'ADMIN' ? (
                      <View style={styles.headerAdminBadge}>
                        <Shield size={9} color="#4F46E5" />
                        <Text style={styles.headerAdminBadgeText}>All Branches</Text>
                      </View>
                    ) : null}
                  </View>
                  {subtitle ? (
                    <Text style={styles.headerSubtitle} numberOfLines={1}>
                      {subtitle}
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>

            {/* Header Right Actions / Breadcrumb */}
            <View style={styles.headerRight}>
              {isWide && breadcrumb && !showPeriodControl && !rightAction ? (
                <View style={styles.breadcrumbRightRow}>
                  <Text style={styles.breadcrumbText}>{breadcrumb}</Text>
                  <ChevronRight size={11} color={colors.textQuiet} style={{ marginHorizontal: 2 }} />
                  <Text style={[styles.breadcrumbText, { color: colors.textSecondary }]}>
                    {title}
                  </Text>
                </View>
              ) : null}

              {/* On wide desktop screens, PeriodControl sits in the top header */}
              {isWide && showPeriodControl && onPeriodChange ? (
                <View style={styles.periodWrap}>
                  <PeriodControl
                    selected={period}
                    onSelect={onPeriodChange}
                    customDateLabel={customDateLabel}
                    onPickCustomDate={onPickCustomDate}
                  />
                </View>
              ) : null}

              {/* Follow-up Notifications Bell Button */}
              <TouchableOpacity
                style={styles.bellBtn}
                onPress={() => setShowNotifications(true)}
                activeOpacity={0.7}
                accessibilityLabel="Follow-up Notifications"
              >
                <Bell size={17} color={colors.text} />
                {unreadNotifications > 0 ? (
                  <View style={styles.bellBadge}>
                    <Text style={styles.bellBadgeText}>{unreadNotifications}</Text>
                  </View>
                ) : null}
              </TouchableOpacity>

              {rightAction || null}
            </View>
          </View>

          {/* On mobile screens, PeriodControl renders as a dedicated full-width sub-header strip */}
          {!isWide && showPeriodControl && onPeriodChange ? (
            <View style={styles.mobileSubHeader}>
              <PeriodControl
                selected={period}
                onSelect={onPeriodChange}
                customDateLabel={customDateLabel}
                onPickCustomDate={onPickCustomDate}
              />
            </View>
          ) : null}

          {/* Screen Body */}
          <View style={styles.contentWrap}>{children}</View>
        </View>
      </View>

      {/* Slide-over Drawer for Mobile / Release action */}
      <CrmSidebarModalDrawer />

      {/* Top Follow-ups & Reminders Notifications Modal */}
      <FollowUpNotificationsModal
        visible={showNotifications}
        onClose={() => setShowNotifications(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  shellContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: Platform.OS === 'android' ? 6 : 0,
  },
  shellLayout: {
    flex: 1,
    flexDirection: 'row',
  },
  mainContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    height: 64,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    ...shadows.soft,
  },
  mobileSubHeader: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  toggleBtn: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconBox: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
  },
  headerBranchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F0FDFA',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CCFBF1',
  },
  headerBranchBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#0F766E',
  },
  headerAdminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  headerAdminBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#4338CA',
  },
  headerSubtitle: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
  },
  breadcrumbRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surfaceLight,
  },
  breadcrumbText: {
    fontSize: 11,
    color: colors.textQuiet,
    fontWeight: '500',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  periodWrap: {
    marginRight: 4,
  },
  bellBtn: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    position: 'relative',
  },
  bellBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: '#EF4444',
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 2,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  bellBadgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '800',
  },
  contentWrap: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
