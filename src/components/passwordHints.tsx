const checks = [
  { label: '8+ characters', test: (p: string) => p.length >= 8 },
  { label: 'Uppercase', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Lowercase', test: (p: string) => /[a-z]/.test(p) },
  { label: 'Number', test: (p: string) => /\d/.test(p) },
  { label: 'Symbol', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

export function PasswordHints({ password, email }: { password: string; email?: string }) {
  return (
    <ul className="text-xs space-y-1">
      {checks.map((c) => (
        <li key={c.label} className={c.test(password) ? 'text-green-700' : 'text-slate-500'}>
          {c.test(password) ? '✓' : '○'} {c.label}
        </li>
      ))}
      {email && (
        <li className={password && password !== email ? 'text-green-700' : 'text-slate-500'}>
          {password && password !== email ? '✓' : '○'} Not the same as email
        </li>
      )}
    </ul>
  );
}

export function passwordValid(password: string, email?: string) {
  return checks.every((c) => c.test(password)) && (!email || password !== email);
}
