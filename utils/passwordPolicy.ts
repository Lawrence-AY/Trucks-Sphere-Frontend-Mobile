export const PASSWORD_REQUIREMENTS =
  'Use at least 6 characters, including uppercase and lowercase letters, a number, and a special character. Avoid common or predictable patterns. Spaces are not allowed.';

const PREDICTABLE_PASSWORD_PATTERNS = [
  'password',
  'qwerty',
  'letmein',
  'welcome',
  'admin',
  '123456',
  'abcdef',
];

function hasPredictableSequence(value: string): boolean {
  const normalized = value.toLowerCase();
  return /(?:0123|1234|2345|3456|4567|5678|6789|abcd|bcde|cdef|defg|qwer|wert|erty|rtyu|tyui|yuio|uiop)/.test(normalized);
}

export function getStrongPasswordError(password: string): string | null {
  const missing: string[] = [];

  if (password.length < 6) missing.push('be at least 6 characters long');
  if (!/[a-z]/.test(password)) missing.push('include a lowercase letter');
  if (!/[A-Z]/.test(password)) missing.push('include an uppercase letter');
  if (!/\d/.test(password)) missing.push('include a number');
  if (!/[^A-Za-z0-9\s]/.test(password)) missing.push('include a special character');
  if (/\s/.test(password)) missing.push('not contain spaces');
  if (PREDICTABLE_PASSWORD_PATTERNS.some((pattern) => password.toLowerCase().includes(pattern))) {
    missing.push('not use common words or number patterns');
  }
  if (hasPredictableSequence(password)) {
    missing.push('not use predictable character sequences');
  }
  if (/(.)\1{3,}/.test(password)) {
    missing.push('not repeat the same character four or more times in a row');
  }

  return missing.length ? `Password must ${missing.join(', ')}.` : null;
}

export function getPasswordChangeError(
  currentPassword: string,
  newPassword: string,
  confirmPassword: string,
): string | null {
  if (!currentPassword || !newPassword || !confirmPassword) {
    return 'All password fields are required.';
  }
  if (newPassword !== confirmPassword) {
    return 'New password and confirm password do not match.';
  }
  if (currentPassword === newPassword) {
    return 'New password must be different from current password.';
  }

  return getStrongPasswordError(newPassword);
}
