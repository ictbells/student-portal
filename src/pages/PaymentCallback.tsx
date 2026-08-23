import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../auth';
import AuthLayout from '../layout/AuthLayout';
import { Alert, Button, Spinner } from '../components/ui';

export default function PaymentCallback() {
  const [searchParams] = useSearchParams();
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(true);
  const nav = useNavigate();
  const { refresh } = useAuth();

  useEffect(() => {
    const reference = searchParams.get('reference') || searchParams.get('trxref');
    if (!reference) {
      setError('Payment reference was not returned. If you completed payment, contact admissions.');
      setVerifying(false);
      return;
    }

    api.get(`/api/payments/paystack/verify/${encodeURIComponent(reference)}`)
      .then(async () => {
        await refresh();
        nav('/apply', { replace: true });
      })
      .catch((err: any) => {
        setError(err.response?.data?.message || 'Payment could not be confirmed. Try again or contact admissions.');
        setVerifying(false);
      });
  }, [nav, refresh, searchParams]);

  return (
    <AuthLayout
      title="Confirming payment"
      subtitle="Please wait while we confirm your payment."
    >
      {verifying && !error && (
        <div className="flex justify-center py-8">
          <Spinner label="Confirming payment…" />
        </div>
      )}
      {error && (
        <div className="space-y-4">
          <Alert tone="error">{error}</Alert>
          <Button onClick={() => nav('/apply')} className="w-full bg-sky-500 hover:bg-sky-600 text-white">
            Back to application
          </Button>
        </div>
      )}
    </AuthLayout>
  );
}
