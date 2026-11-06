// Mirror of the server-side password policy (userController.js) so users get
// instant feedback instead of a round-trip. The server remains the real gate.

// Individual rules — used by BOTH the strength gate and the live checklist, so
// the UI and the actual validation can never drift apart.
export const PASSWORD_RULES = [
  { label: 'At least 8 characters', test: (pw) => pw.length >= 8 },
  { label: 'An uppercase letter (A–Z)', test: (pw) => /[A-Z]/.test(pw) },
  { label: 'A lowercase letter (a–z)', test: (pw) => /[a-z]/.test(pw) },
  { label: 'A number (0–9)', test: (pw) => /\d/.test(pw) },
  { label: 'A special character (!@#…)', test: (pw) => /[^A-Za-z0-9]/.test(pw) },
]

export const isStrongPassword = (pw) =>
  typeof pw === 'string' && PASSWORD_RULES.every((rule) => rule.test(pw))

export const PASSWORD_REQUIREMENTS =
  'Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a special character.'
