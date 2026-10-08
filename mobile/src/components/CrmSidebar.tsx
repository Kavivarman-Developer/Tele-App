import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Dimensions,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  LayoutGrid,
  Users,
  CalendarCheck2,
  Megaphone,
  Upload,
  Settings2,
  RotateCw,
  User as UserIcon,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronRight,
  X,
} from 'lucide-react-native';

import { useSidebarStore } from '../store/sidebarStore';
import { useAuthStore } from '../store/authStore';
import { CrmAvatar } from './CrmAvatar';
import { colors, borderRadius, shadows } from '../theme';

interface NavItemConfig {
  name: string;
  route: string;
  label: string;
  icon: any;
  badge?: string | number;
}

const WORKSPACE_ITEMS: NavItemConfig[] = [
  { name: 'Home', route: 'Home', label: 'Home', icon: LayoutGrid },
  { name: 'MyLeads', route: 'MyLeads', label: 'My Leads', icon: Users },
  { name: 'FollowUps', route: 'FollowUps', label: 'Follow ups', icon: CalendarCheck2, badge: 7 },
];

const MANAGEMENT_ITEMS: NavItemConfig[] = [
  { name: 'Team', route: 'Team', label: 'Users', icon: Users },
  { name: 'Campaigns', route: 'Campaigns', label: 'Campaigns', icon: Megaphone },
  { name: 'UploadLeads', route: 'UploadLeads', label: 'Upload Leads', icon: Upload },
  { name: 'Settings', route: 'Settings', label: 'Settings', icon: Settings2 },
  { name: 'RetryRules', route: 'RetryRules', label: 'Retry Rules', icon: RotateCw },
];

export const CrmSidebarContent: React.FC<{
  collapsed?: boolean;
  onNavigate?: () => void;
  showCloseButton?: boolean;
}> = ({ collapsed = false, onNavigate, showCloseButton = false }) => {
  const navigation = useNavigation<any>();
  const { currentRoute, setCurrentRoute, toggleCollapse } = useSidebarStore();
  const { user } = useAuthStore();

  const handleNav = (route: string) => {
    setCurrentRoute(route);
    onNavigate?.();
    navigation.navigate(route);
  };

  const roleLabel = user?.branch
    ? `📍 ${user.branch} · ${user.role}`
    : user?.role === 'ADMIN'
    ? '🛡️ Admin (All Branches)'
    : user?.role === 'MANAGER'
    ? '🏢 Manager Role'
    : 'Agent Role';

  const filteredManagementItems = MANAGEMENT_ITEMS.filter((item) => {
    // Agents have NO access to management/settings controls; focus strictly on calling
    if (user?.role === 'AGENT') return false;
    // Managers can only view branch team and campaigns; Settings & RetryRules are Admin only
    if (user?.role === 'MANAGER') {
      return item.route === 'Team' || item.route === 'Campaigns';
    }
    return true;
  });

  return (
    <View style={[styles.sidebarContainer, collapsed ? styles.sidebarCollapsed : styles.sidebarExpanded]}>
      {/* Brand Header */}
      <View style={[styles.brandWrap, collapsed && styles.brandWrapCollapsed]}>
        <TouchableOpacity
          style={styles.brandLeft}
          onPress={() => handleNav('Home')}
          activeOpacity={0.8}
        >
          <View style={styles.brandMark}>
            <Text style={styles.brandMarkText}>OK</Text>
          </View>
          {!collapsed && (
            <View style={styles.brandTextWrap}>
              <Text style={styles.brandTitle}>
                <Text style={{ fontWeight: '800' }}>OKBOZ</Text>
                <Text style={{ fontWeight: '500', color: colors.textSecondary }}> Admin</Text>
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {showCloseButton ? (
          <TouchableOpacity
            style={styles.iconToggleBtn}
            onPress={onNavigate}
            activeOpacity={0.7}
          >
            <X size={18} color={colors.textMuted} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.iconToggleBtn}
            onPress={toggleCollapse}
            activeOpacity={0.7}
            accessibilityLabel={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <PanelLeftOpen size={18} color={colors.textMuted} />
            ) : (
              <PanelLeftClose size={18} color={colors.textMuted} />
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Nav List */}
      <ScrollView
        style={styles.navScroll}
        contentContainerStyle={styles.navScrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Section 1: Workspace */}
        {!collapsed && <Text style={styles.sectionHeading}>WORKSPACE</Text>}
        {WORKSPACE_ITEMS.map((item) => {
          const isActive = currentRoute === item.route;
          const Icon = item.icon;

          return (
            <TouchableOpacity
              key={item.route}
              style={[
                styles.navBtn,
                collapsed && styles.navBtnCollapsed,
                isActive && styles.navBtnActive,
              ]}
              onPress={() => handleNav(item.route)}
              activeOpacity={0.75}
            >
              <Icon
                size={18}
                color={isActive ? colors.primary : colors.textMuted}
                strokeWidth={isActive ? 2.5 : 2}
              />
              {!collapsed && (
                <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
                  {item.label}
                </Text>
              )}
              {!collapsed && item.badge ? (
                <View style={styles.navBadge}>
                  <Text style={styles.navBadgeText}>{item.badge}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}

        {/* Section 2: Management (Strictly hidden from Agents) */}
        {filteredManagementItems.length > 0 && (
          <>
            <View style={styles.divider} />
            {!collapsed && <Text style={styles.sectionHeading}>MANAGEMENT</Text>}
            {filteredManagementItems.map((item) => {
              const isActive = currentRoute === item.route;
              const Icon = item.icon;

              return (
                <TouchableOpacity
                  key={item.route}
                  style={[
                    styles.navBtn,
                    collapsed && styles.navBtnCollapsed,
                    isActive && styles.navBtnActive,
                  ]}
                  onPress={() => handleNav(item.route)}
                  activeOpacity={0.75}
                >
                  <Icon
                    size={18}
                    color={isActive ? colors.primary : colors.textMuted}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                  {!collapsed && (
                    <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
                      {item.label}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </>
        )}
      </ScrollView>

      {/* Sidebar Bottom: Account Card */}
      <View style={[styles.sidebarBottom, collapsed && styles.sidebarBottomCollapsed]}>
        <TouchableOpacity
          style={[styles.accountBtn, collapsed && styles.accountBtnCollapsed]}
          onPress={() => handleNav('Profile')}
          activeOpacity={0.8}
        >
          <View style={styles.avatarWrap}>
            <CrmAvatar name={user?.name || 'Agent'} size={collapsed ? 32 : 36} />
            <View style={styles.statusDot} />
          </View>
          {!collapsed && (
            <View style={styles.accountTextWrap}>
              <Text style={styles.accountName} numberOfLines={1}>
                {user?.name || 'Agent User'}
              </Text>
              <Text style={styles.accountRole} numberOfLines={1}>
                {roleLabel}
              </Text>
            </View>
          )}
          {!collapsed && <ChevronRight size={16} color={colors.textQuiet} />}
        </TouchableOpacity>
      </View>
    </View>
  );
};

export const CrmSidebarModalDrawer: React.FC = () => {
  const { isOpenMobileDrawer, closeDrawer } = useSidebarStore();

  return (
    <Modal
      visible={isOpenMobileDrawer}
      transparent
      animationType="fade"
      onRequestClose={closeDrawer}
    >
      <View style={styles.drawerOverlay}>
        <TouchableOpacity
          style={styles.drawerBackdrop}
          activeOpacity={1}
          onPress={closeDrawer}
        />
        <View style={styles.drawerSheet}>
          <CrmSidebarContent collapsed={false} onNavigate={closeDrawer} showCloseButton />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  sidebarContainer: {
    backgroundColor: colors.surface,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  sidebarExpanded: {
    width: 250,
  },
  sidebarCollapsed: {
    width: 68,
  },
  brandWrap: {
    height: 64,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  brandWrapCollapsed: {
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  brandLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandMark: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandMarkText: {
    color: colors.textInverse,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  brandTextWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
  },
  brandBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: borderRadius.xs,
  },
  iconToggleBtn: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navScroll: {
    flex: 1,
  },
  navScrollContent: {
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  sectionHeading: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textQuiet,
    letterSpacing: 0.8,
    marginTop: 8,
    marginBottom: 6,
    paddingHorizontal: 8,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderSubtle,
    marginVertical: 12,
    marginHorizontal: 4,
  },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: borderRadius.sm,
    marginBottom: 3,
    gap: 10,
  },
  navBtnCollapsed: {
    justifyContent: 'center',
    paddingHorizontal: 0,
    gap: 0,
  },
  navBtnActive: {
    backgroundColor: colors.primaryLight,
  },
  navLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    flex: 1,
  },
  navLabelActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  navBadge: {
    backgroundColor: colors.warningLight,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: borderRadius.full,
  },
  navBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.warningText,
  },
  sidebarBottom: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    backgroundColor: colors.surface,
  },
  sidebarBottomCollapsed: {
    padding: 8,
    alignItems: 'center',
  },
  accountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 4,
    borderRadius: borderRadius.sm,
  },
  accountBtnCollapsed: {
    justifyContent: 'center',
    gap: 0,
    padding: 0,
  },
  avatarWrap: {
    position: 'relative',
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: borderRadius.full,
    backgroundColor: colors.success,
    position: 'absolute',
    bottom: -1,
    right: -1,
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  accountTextWrap: {
    flex: 1,
  },
  accountName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  accountRole: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '500',
    marginTop: 1,
  },
  drawerOverlay: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.overlay,
  },
  drawerBackdrop: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  drawerSheet: {
    width: 270,
    height: '100%',
    backgroundColor: colors.surface,
    ...shadows.elevated,
  },
});
