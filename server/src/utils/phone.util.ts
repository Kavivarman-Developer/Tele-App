/**
 * Normalizes phone numbers to digits only and extracts the last 10 digits (standard Indian mobile format).
 * Returns null if the phone number has fewer than 10 digits.
 */
export const normalizePhone = (rawPhone: unknown): string | null => {
  if (rawPhone === undefined || rawPhone === null) {
    return null;
  }

  const digits = String(rawPhone).replace(/\D/g, '');

  if (digits.length < 10) {
    return null;
  }

  // Extract the last 10 digits
  const last10 = digits.slice(-10);

  // Must be 10 digits
  if (!/^\d{10}$/.test(last10)) {
    return null;
  }

  return last10;
};
