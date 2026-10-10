/**
 * Clean Minimal Design Tokens for OKBOZ Tele App
 * Unified White + Single Green Accent Palette
 */

export const tokens = {
  colors: {
    background: '#FFFFFF',
    surface: '#FFFFFF',
    primary: '#0F9D58',
    primaryPressed: '#0B7A43',
    primaryTint: '#E6F4EA',
    textPrimary: '#1F2937',
    textSecondary: '#6B7280',
    textMuted: '#9CA3AF',
    border: '#E5E7EB',

    // Preserved Semantic Tag Colors
    tags: {
      hot: { text: '#DC2626', bg: '#FEF2F2', border: '#FCA5A5' },
      warm: { text: '#D97706', bg: '#FFFBEB', border: '#FCD34D' },
      cold: { text: '#2563EB', bg: '#EFF6FF', border: '#93C5FD' },
    },

    // Status Dots
    status: {
      connected: '#0F9D58',
      notConnected: '#EF4444',
      pending: '#F59E0B',
    },
  },

  spacing: {
    xs: 8,
    sm: 12,
    md: 16,
    lg: 24,
  },

  radius: {
    card: 12,
    button: 8,
    chip: 8,
    full: 9999,
  },

  typography: {
    stat: {
      fontSize: 20,
      fontWeight: '500' as const,
      color: '#1F2937',
    },
    title: {
      fontSize: 16,
      fontWeight: '500' as const,
      color: '#1F2937',
    },
    body: {
      fontSize: 14,
      fontWeight: '400' as const,
      color: '#1F2937',
    },
    bodyMedium: {
      fontSize: 14,
      fontWeight: '500' as const,
      color: '#1F2937',
    },
    caption: {
      fontSize: 12,
      fontWeight: '400' as const,
      color: '#6B7280',
    },
    captionMedium: {
      fontSize: 12,
      fontWeight: '500' as const,
      color: '#6B7280',
    },
  },
};
