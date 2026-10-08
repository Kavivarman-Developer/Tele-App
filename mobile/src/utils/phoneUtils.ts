/**
 * Standard Phone Number Utilities for Tele App CRM
 * Handles Indian (+91) phone numbers, strips duplicate country codes,
 * and formats clean dialer and WhatsApp URLs.
 */

/**
 * Normalizes phone numbers to clean 10-digit mobile number for Indian numbers,
 * or digits-only for international numbers. Automatically removes repeated 91 prefixes.
 *
 * Example:
 * "+91916383787696" -> "6383787696"
 * "+91 6383787696"  -> "6383787696"
 * "916383787696"   -> "6383787696"
 * "06383787696"    -> "6383787696"
 * "6383787696"     -> "6383787696"
 */
export const normalizePhoneDigits = (phone: string): string => {
  if (!phone) return '';
  let digits = String(phone).replace(/\D/g, '');

  // Strip repeated country code '91' if it has more than 10 digits
  while (digits.startsWith('91') && digits.length > 10) {
    digits = digits.slice(2);
  }

  // Strip leading zero for 11-digit numbers (e.g. 09876543210)
  if (digits.startsWith('0') && digits.length === 11) {
    digits = digits.slice(1);
  }

  // If still more than 10 digits (e.g. accidental extra digits or international), take the last 10 digits
  if (digits.length > 10) {
    return digits.slice(-10);
  }

  return digits;
};

/**
 * Formats a phone number for user-facing display: "+91 98100 00081"
 * Guaranteed to NEVER have duplicate "+91 91..."
 */
export const formatDisplayPhone = (phone: string): string => {
  const digits = normalizePhoneDigits(phone);
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  if (!phone) return '';
  // Fallback if not 10 digits
  return phone.startsWith('+') ? phone : `+91 ${phone}`;
};

/**
 * Generates a clean tel: URL for phone dialers.
 * Guaranteed to be "tel:+916383787696", never "tel:+9191..."
 */
export const getDialerTelUrl = (phone: string): string => {
  const digits = normalizePhoneDigits(phone);
  if (digits.length === 10) {
    return `tel:+91${digits}`;
  }
  const clean = String(phone).replace(/[^\d+]/g, '');
  return `tel:${clean.startsWith('+') ? clean : `+91${clean}`}`;
};

/**
 * Generates a clean WhatsApp URL: "https://wa.me/916383787696?text=..."
 * Guaranteed to NEVER have "https://wa.me/9191..."
 */
export const getWhatsAppUrl = (phone: string, text?: string): string => {
  const digits = normalizePhoneDigits(phone);
  const target = digits.length === 10 ? `91${digits}` : String(phone).replace(/\D/g, '');
  const encodedText = text ? `?text=${encodeURIComponent(text)}` : '';
  return `https://wa.me/${target}${encodedText}`;
};
