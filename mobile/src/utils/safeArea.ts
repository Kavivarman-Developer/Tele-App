import { Platform, StatusBar as RNStatusBar } from 'react-native';
import { useSafeAreaInsets, EdgeInsets } from 'react-native-safe-area-context';

/**
 * Calculates a reliable safe top padding (in density-independent pixels)
 * to ensure headers and touchable controls never overlap the device's
 * camera notch, punch hole, or system status bar on Android, iOS, and Mobile Web/PWA.
 */
export function calculateSafeTopPadding(insets: EdgeInsets, isWide = false): number {
  if (Platform.OS === 'android') {
    const androidStatusHeight = RNStatusBar.currentHeight || 28;
    return Math.max(insets.top, androidStatusHeight, 32);
  }

  if (Platform.OS === 'ios') {
    return Math.max(insets.top, 44);
  }

  // Platform.OS === 'web'
  if (!isWide) {
    if (typeof window !== 'undefined') {
      const isStandalone =
        Boolean((window.navigator as any)?.standalone) ||
        Boolean(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);

      if (isStandalone) {
        return Math.max(insets.top, 36);
      }
    }
    // Clean mobile browser clearance so header touch targets never clash with browser chrome
    return Math.max(insets.top, 14);
  }

  // Desktop wide screen web: no status bar or notch
  return 0;
}

/**
 * React hook returning dynamic safe top padding for the current viewport & device.
 */
export function useSafeTopPadding(isWide = false): number {
  const insets = useSafeAreaInsets();
  return calculateSafeTopPadding(insets, isWide);
}
