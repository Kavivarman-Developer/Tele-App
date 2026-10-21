import React, { useState } from 'react';
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  StatusBar as RNStatusBar,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ShieldCheck, Phone, Eye, EyeOff, AlertCircle, Mail, Lock } from 'lucide-react-native';
import { useSafeTopPadding } from '../utils/safeArea';
import { useAuthStore } from '../store/authStore';

// ======================================================================
// DESIGN TOKENS — same palette/rhythm as the rest of the app (HomeScreen)
// ======================================================================
const T = {
  radius: { sm: 10, md: 14, lg: 20 },
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
  color: {
    bg: '#F6FAF8',
    surface: '#FFFFFF',
    surfaceSunken: '#F8FAFC',
    border: '#E7EAEE',
    text: '#111827',
    textMuted: '#6B7280',
    textFaint: '#9CA3AF',
    primary: '#0F9D58',
    primaryDark: '#0B7A44',
    primaryTint: '#E6F4EA',
    danger: '#DC2626',
    dangerTint: '#FEF2F2',
  },
};

// ----------------------------------------------------------------------
// Decorative background — a faint, line-art "mobility sketch" scattered 
// behind the card (pins, two-wheeler, auto, building, road) to echo the
// reference mood board. Purely decorative: non-interactive, zero effect
// on layout or behaviour of the form below it.
// ----------------------------------------------------------------------
const SketchBackground: React.FC = () => (
  <View style={StyleSheet.absoluteFill} pointerEvents="none">
    <Text style={[styles.sketchGlyph, { top: '4%', left: '6%', fontSize: 46, transform: [{ rotate: '-8deg' }] }]}>📍</Text>
    <Text style={[styles.sketchGlyph, { top: '10%', right: '8%', fontSize: 60, transform: [{ rotate: '6deg' }] }]}>🏍️</Text>
    <Text style={[styles.sketchGlyph, { top: '22%', left: '-2%', fontSize: 70, transform: [{ rotate: '-4deg' }] }]}>🛺</Text>
    <Text style={[styles.sketchGlyph, { top: '30%', right: '-4%', fontSize: 54, transform: [{ rotate: '10deg' }] }]}>🏛️</Text>
    <Text style={[styles.sketchGlyph, { bottom: '26%', left: '4%', fontSize: 50, transform: [{ rotate: '7deg' }] }]}>🛵</Text>
    <Text style={[styles.sketchGlyph, { bottom: '16%', right: '6%', fontSize: 58, transform: [{ rotate: '-6deg' }] }]}>🚗</Text>
    <Text style={[styles.sketchGlyph, { bottom: '6%', left: '-2%', fontSize: 64, transform: [{ rotate: '5deg' }] }]}>🚙</Text>
    <Text style={[styles.sketchGlyph, { bottom: '2%', right: '-2%', fontSize: 50, transform: [{ rotate: '-10deg' }] }]}>📦</Text>
    <Text style={[styles.sketchGlyph, { top: '48%', left: '2%', fontSize: 30, transform: [{ rotate: '0deg' }] }]}>🚦</Text>
    <Text style={[styles.sketchGlyph, { top: '52%', right: '4%', fontSize: 34, transform: [{ rotate: '0deg' }] }]}>🗺️</Text>
  </View>
);

export const LoginScreen: React.FC = () => {
  const { width } = useWindowDimensions();
  const isWide = width >= 860;
  const safeTopPadding = useSafeTopPadding(isWide);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login, isLoading, error, clearError } = useAuthStore();

  const handleLogin = async () => {
    if (!email.trim() || !password) return;
    await login(email.trim(), password);
  };

  const canSubmit = Boolean(email.trim() && password) && !isLoading;

  return (
    <SafeAreaView style={[styles.safeArea, { paddingTop: safeTopPadding }]} edges={['left', 'right']}>
      <RNStatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />
      <SketchBackground />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Brand Logo & Header */}
          <View style={styles.brandBlock}>
            <View style={styles.logoBadge}>
              <Phone size={30} color="#FFFFFF" strokeWidth={2.5} />
            </View>
            <Text style={styles.brandTitle}>Hi Talk</Text>
            <Text style={styles.brandSubtitle}>High-velocity calling & lead management</Text>
          </View>

          {/* Sign-in Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Sign in to your desk</Text>
            <Text style={styles.cardSubtitle}>
              Enter your agent or manager credentials to start calling
            </Text>

            {/* Error Banner */}
            {error ? (
              <View style={styles.errorBanner}>
                <AlertCircle size={16} color={T.color.danger} />
                <Text style={styles.errorBannerText}>{error}</Text>
              </View>
            ) : null}

            {/* Email Field */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Email address</Text>
              <View style={styles.inputWrap}>
                <Mail size={16} color={T.color.textFaint} />
                <TextInput
                  style={styles.input}
                  placeholder="name@company.com"
                  placeholderTextColor={T.color.textFaint}
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (error) clearError();
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            {/* Password Field */}
            <View style={[styles.fieldGroup, { marginBottom: T.space.xl - 2 }]}>
              <Text style={styles.fieldLabel}>Password</Text>
              <View style={styles.inputWrap}>
                <Lock size={16} color={T.color.textFaint} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your password"
                  placeholderTextColor={T.color.textFaint}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (error) clearError();
                  }}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  {showPassword ? (
                    <EyeOff size={18} color={T.color.textMuted} />
                  ) : (
                    <Eye size={18} color={T.color.textMuted} />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Sign In CTA */}
            <TouchableOpacity
              onPress={handleLogin}
              disabled={!canSubmit}
              activeOpacity={0.85}
              style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.submitBtnText}>Sign in to workspace</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Footer: security note + locale badges, echoing the brand sketch */}
          <View style={styles.footerBlock}>
            <View style={styles.securityRow}>
              <ShieldCheck size={15} color={T.color.primary} />
              <Text style={styles.securityText}>Encrypted session · Strict branch isolation</Text>
            </View>
            <View style={styles.localeRow}>
              <Text style={styles.localeText}>🇮🇳  Made for India</Text>
              <View style={styles.localeDot} />
              <Text style={styles.localeText}>❤️  Crafted in Tamil Nadu</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: T.color.bg,
  },
  sketchGlyph: {
    position: 'absolute',
    opacity: 0.07,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: T.space.xl,
  },

  // Brand block
  brandBlock: {
    alignItems: 'center',
    marginBottom: T.space.xl + 4,
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: T.radius.lg,
    backgroundColor: T.color.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: T.space.md + 2,
    shadowColor: T.color.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 6,
  },
  brandTitle: {
    fontSize: 27,
    fontWeight: '800',
    color: T.color.text,
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    fontSize: 13,
    color: T.color.textMuted,
    marginTop: 4,
    fontWeight: '500',
  },

  // Card
  card: {
    backgroundColor: T.color.surface,
    borderRadius: T.radius.lg,
    padding: T.space.xl,
    borderWidth: 1,
    borderColor: T.color.border,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.07,
    shadowRadius: 20,
    elevation: 4,
    marginBottom: T.space.xl,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: T.color.text,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 12.5,
    color: T.color.textMuted,
    marginBottom: T.space.lg + 4,
    lineHeight: 17,
  },

  errorBanner: {
    backgroundColor: T.color.dangerTint,
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: T.radius.sm,
    padding: T.space.md - 1,
    marginBottom: T.space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.space.sm,
  },
  errorBannerText: {
    fontSize: 12,
    fontWeight: '600',
    color: T.color.danger,
    flex: 1,
  },

  fieldGroup: {
    marginBottom: T.space.lg,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: T.color.textMuted,
    marginBottom: T.space.sm - 2,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.color.surfaceSunken,
    borderWidth: 1,
    borderColor: T.color.border,
    borderRadius: T.radius.sm,
    paddingHorizontal: T.space.md + 2,
    height: 50,
    gap: T.space.sm + 2,
  },
  input: {
    flex: 1,
    fontSize: 13.5,
    color: T.color.text,
    padding: 0,
  },

  submitBtn: {
    height: 52,
    backgroundColor: T.color.primary,
    borderRadius: T.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: T.color.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 3,
  },
  submitBtnDisabled: {
    backgroundColor: '#A7B6AF',
    shadowOpacity: 0,
    elevation: 0,
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Footer
  footerBlock: {
    alignItems: 'center',
    gap: T.space.md,
  },
  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.space.sm - 2,
  },
  securityText: {
    fontSize: 12,
    color: T.color.textMuted,
    fontWeight: '500',
  },
  localeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.space.sm + 2,
  },
  localeText: {
    fontSize: 12,
    color: T.color.textMuted,
    fontWeight: '600',
  },
  localeDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: T.color.textFaint,
  },
});