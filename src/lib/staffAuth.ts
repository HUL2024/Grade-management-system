// Supabase Auth only natively supports email+password or phone+SMS-OTP.
// To let teachers log in with "phone number + password" without needing an
// SMS provider, we convert their phone number into a hidden internal email
// behind the scenes. Teachers never see or type this — they just use their
// phone number. Administrators/Principals continue to use a real email.

export const STAFF_PHONE_EMAIL_DOMAIN = 'teacher.ajbleadersacademy.internal';

export function sanitizePhone(phone: string): string {
  return phone.replace(/[^0-9]/g, '');
}

export function phoneToInternalEmail(phone: string): string {
  return `${sanitizePhone(phone)}@${STAFF_PHONE_EMAIL_DOMAIN}`;
}

export function isEmailLike(value: string): boolean {
  return value.includes('@');
}
