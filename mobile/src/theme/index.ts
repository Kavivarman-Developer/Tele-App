/**
 * OKBOZ CRM Design System Tokens
 * Inspired by Lovable reference (https://lovable.dev/preview/8L7RkRTJxwHhclcfjoWQapNM3Id8GIKq)
 */

export const colors = {
  // Brand & Primary (NeoDove Signature Royal Purple)
  primary: '#5B2C82', // NeoDove purple
  primaryHover: '#471B69',
  primaryDark: '#3E155C',
  primaryLight: '#F3E8FF', // soft lilac
  primarySubtle: '#EDE9FE',
  headerBg: '#5B2C82', // Solid NeoDove Purple Header

  // Background & Surfaces
  background: '#F5F0FA', // soft lavender/lilac background as seen in NeoDove
  surface: '#FFFFFF', // pure white card surface
  surfaceLight: '#FAF5FF',
  surfaceMuted: '#F5F0FA',
  overlay: 'rgba(91, 44, 130, 0.45)',

  // NeoDove Report Cards Colors
  reportAttempted: '#6347D1', // Purple
  reportConnected: '#EA580C', // Orange
  reportCallTime: '#5B8DEF', // Steel Blue
  reportAvgDuration: '#1D7BF2', // Bright Blue

  // Borders & Dividers
  border: '#E9D5FF', // subtle purple tint border
  borderSubtle: '#F3E8FF',
  borderFocus: '#5B2C82',

  // Typography
  text: '#0F172A', // slate-900 (High contrast)
  textSecondary: '#475569', // slate-600
  textMuted: '#64748B', // slate-500
  textQuiet: '#94A3B8', // slate-400
  textInverse: '#FFFFFF',

  // Semantic Status Tones
  success: '#10B981', // emerald-500
  successHover: '#059669',
  successLight: '#ECFDF5', // emerald-50
  successText: '#047857',

  warning: '#F59E0B', // amber-500
  warningHover: '#D97706',
  warningLight: '#FFFBEB', // amber-50
  warningText: '#B45309',

  danger: '#EF4444', // red-500
  dangerHover: '#DC2626',
  dangerLight: '#FEF2F2', // red-50
  dangerText: '#B91C1C',

  info: '#3B82F6', // blue-500
  infoLight: '#EFF6FF',
  infoText: '#1D4ED8',

  // Pipeline Stage Colors
  stages: {
    New: {
      color: '#4F46E5',
      bg: '#EEF2FF',
      text: '#4338CA',
    },
    Contacted: {
      color: '#F59E0B',
      bg: '#FFFBEB',
      text: '#B45309',
    },
    Interested: {
      color: '#10B981',
      bg: '#ECFDF5',
      text: '#047857',
    },
    'Follow Up': {
      color: '#3B82F6',
      bg: '#EFF6FF',
      text: '#1D4ED8',
    },
    'Follow-up': {
      color: '#3B82F6',
      bg: '#EFF6FF',
      text: '#1D4ED8',
    },
    'Not Interested': {
      color: '#64748B',
      bg: '#F1F5F9',
      text: '#334155',
    },
    Nurture: {
      color: '#64748B',
      bg: '#F1F5F9',
      text: '#334155',
    },
    Converted: {
      color: '#8B5CF6',
      bg: '#F5F3FF',
      text: '#6D28D9',
    },
    Closed: {
      color: '#8B5CF6',
      bg: '#F5F3FF',
      text: '#6D28D9',
    },
    Lost: {
      color: '#EF4444',
      bg: '#FEF2F2',
      text: '#B91C1C',
    },
    Invalid: {
      color: '#EF4444',
      bg: '#FEF2F2',
      text: '#B91C1C',
    },
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const borderRadius = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
};

export const shadows = {
  soft: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  card: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  elevated: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
};
