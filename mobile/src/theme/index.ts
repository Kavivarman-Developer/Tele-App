/**
 * OKBOZ CRM Design System Tokens
 * Inspired by Lovable reference (https://lovable.dev/preview/8L7RkRTJxwHhclcfjoWQapNM3Id8GIKq)
 */

export const colors = {
  // Brand & Primary (Modern Indigo/Blue)
  primary: '#4F46E5', // indigo-600
  primaryHover: '#4338CA', // indigo-700
  primaryDark: '#3730A3', // indigo-800
  primaryLight: '#EEF2FF', // indigo-50
  primarySubtle: '#E0E7FF', // indigo-100

  // Background & Surfaces
  background: '#F8FAFC', // clean slate-50
  surface: '#FFFFFF', // pure white card surface
  surfaceLight: '#F1F5F9', // slate-100
  surfaceMuted: '#F8FAFC',
  overlay: 'rgba(15, 23, 42, 0.4)',

  // Borders & Dividers
  border: '#E2E8F0', // slate-200
  borderSubtle: '#F1F5F9', // slate-100
  borderFocus: '#4F46E5',

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
