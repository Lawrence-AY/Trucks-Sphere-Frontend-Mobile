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

const PASSWORD_CHARACTER_SETS = [
  'ABCDEFGHJKLMNPQRSTUVWXYZ',
  'abcdefghijkmnopqrstuvwxyz',
  '23456789',
  '!@#$%*+=?',
];

function randomIndex(limit: number): number {
  const cryptoApi = (globalThis as any).crypto;
  if (cryptoApi?.getRandomValues) {
    const value = new Uint32Array(1);
    cryptoApi.getRandomValues(value);
    return value[0] % limit;
  }
  return Math.floor(Math.random() * limit);
}

/** Generates a password that satisfies the app's password policy. */
export function generateStrongPassword(length = 16): string {
  const safeLength = Math.max(12, length);
  const allCharacters = PASSWORD_CHARACTER_SETS.join('');

  // Generate again only if a rare random combination triggers a predictable
  // sequence rule. This keeps the suggested value valid by construction.
  for (;;) {
    const characters = PASSWORD_CHARACTER_SETS.map((set) => set[randomIndex(set.length)]);
    while (characters.length < safeLength) characters.push(allCharacters[randomIndex(allCharacters.length)]);
    for (let index = characters.length - 1; index > 0; index -= 1) {
      const swapIndex = randomIndex(index + 1);
      [characters[index], characters[swapIndex]] = [characters[swapIndex], characters[index]];
    }
    const password = characters.join('');
    if (!getStrongPasswordError(password)) return password;
  }
}

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
