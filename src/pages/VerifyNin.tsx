import { FormEvent, useState } from 'react';
import { Navigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../auth';
import { FormSection, PageHeader } from '../components/portal';
import { useToast } from '../components/toast';
import { Alert, Button, Card, Input, Label, Spinner } from '../components/ui';

function apiErrorMessage(e: any, fallback: string) {
  const data = e?.response?.data;
  const errors = data?.errors;
  if (errors && typeof errors === 'object') {
    const first = Object.values(errors).flat().find((v) => typeof v === 'string');
    if (typeof first === 'string' && first.trim()) return first;
  }
  if (typeof data?.message === 'string' && data.message.trim()) return data.message;
  return fallback;
}

export default function VerifyNin() {
  const { auth, refresh } = useAuth();
  const toast = useToast();
  const [nin, setNin] = useState('');
  const [verifying, setVerifying] = useState(false);

  if (!auth?.is_student) {
    return <Navigate to="/" replace />;
  }
  if (auth.nin_verified) {
    return <Navigate to="/" replace />;
  }

  const applicationId = auth.application_id;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (verifying || nin.length !== 11 || !applicationId) return;
    setVerifying(true);
    try {
      const { data } = await api.post(`/api/applications/${applicationId}/nin`, { nin: nin.trim() });
      toast.success(data?.live === false
        ? 'NIN accepted in demo mode. Identity is locked, but this was not a live Prembly check.'
        : 'NIN verified. You can continue using the student portal.');
      await refresh();
    } catch (err: any) {
      toast.error(apiErrorMessage(err, 'NIN verification failed'));
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Identity"
        title="Verify your NIN"
        description="Imported students keep their existing enrolment and do not re-apply. Verify your National Identification Number once to unlock the student portal."
      />
      <Card>
        {!applicationId ? (
          <Alert tone="error">
            Your student record is missing an application file, so NIN cannot be verified here. Contact the registry.
          </Alert>
        ) : (
          <FormSection title="National Identification Number" description="Enter your 11-digit NIN. Names and date of birth from NIMC will be locked on your record.">
            <form onSubmit={submit} className="space-y-4 max-w-md">
              <div>
                <Label htmlFor="nin" required>National Identification Number (NIN)</Label>
                <Input
                  id="nin"
                  inputMode="numeric"
                  maxLength={11}
                  placeholder="11-digit NIN"
                  value={nin}
                  onChange={(e) => setNin(e.target.value.replace(/\D/g, '').slice(0, 11))}
                  autoComplete="off"
                />
              </div>
              <Button type="submit" disabled={verifying || nin.length !== 11} className="bg-sky-600 hover:bg-sky-700 text-white shadow-sm">
                {verifying ? <Spinner label="Verifying…" /> : 'Verify NIN'}
              </Button>
            </form>
          </FormSection>
        )}
      </Card>
    </div>
  );
}
