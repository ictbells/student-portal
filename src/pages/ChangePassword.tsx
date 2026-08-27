import { FormEvent, useMemo, useState } from 'react';
import api, { networkErrorMessage } from '../api';
import { useAuth } from '../auth';
import { PageHeader } from '../components/portal';
import { PasswordHints, passwordValid } from '../components/passwordHints';
import { useToast } from '../components/toast';
import { Button, Card, Label, PasswordInput, Spinner } from '../components/ui';

export default function ChangePassword() {
  const { auth } = useAuth();
  const toast = useToast();
  const email = auth?.user?.email || '';
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  const mismatch = Boolean(confirm) && password !== confirm;
  const ok = useMemo(
    () => Boolean(currentPassword) && passwordValid(password, email) && password === confirm,
    [currentPassword, password, confirm, email],
  );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      toast.error('Enter your current password.');
      return;
    }
    if (password !== confirm) {
      toast.error('Passwords do not match.');
      return;
    }
    setSaving(true);
    try {
      await api.patch('/api/me', {
        current_password: currentPassword,
        password,
        password_confirmation: confirm,
      });
      setCurrentPassword('');
      setPassword('');
      setConfirm('');
      toast.success('Password updated.');
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
      const errors = ax.response?.data?.errors;
      toast.error(
        errors
          ? Object.values(errors).flat().join(' ')
          : networkErrorMessage(err, 'Could not update password.'),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Account"
        title="Change password"
        description="Enter your current password, then choose a new one that meets the checks below."
      />
      <Card className="max-w-lg">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="current">Current password</Label>
            <PasswordInput
              id="current"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          <div>
            <Label htmlFor="password">New password</Label>
            <PasswordInput
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
          </div>
          <div>
            <Label htmlFor="confirm">Confirm new password</Label>
            <PasswordInput
              id="confirm"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              autoComplete="new-password"
            />
            {mismatch && <p className="mt-1 text-xs text-rose-700">Passwords do not match.</p>}
          </div>
          <PasswordHints password={password} email={email} />
          <Button
            type="submit"
            disabled={!ok || saving}
            className="w-full bg-sky-600 hover:bg-sky-700 text-white disabled:opacity-50"
          >
            {saving ? <Spinner label="Saving…" className="text-white" /> : <span className="text-white">Update password</span>}
          </Button>
        </form>
      </Card>
    </div>
  );
}
