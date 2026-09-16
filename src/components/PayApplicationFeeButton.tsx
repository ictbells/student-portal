import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../auth';
import { resolveApplicationFeeInvoiceId, startStudentInvoiceCheckout } from '../lib/onlinePayment';
import { useToast } from './toast';

export function PayApplicationFeeButton({
  className = 'underline font-medium',
  children = 'Pay now',
  busyLabel = 'Opening payment…',
}: {
  className?: string;
  children?: ReactNode;
  busyLabel?: string;
}) {
  const { auth, refresh } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);

  const pay = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const invoiceId = await resolveApplicationFeeInvoiceId(api, {
        applicationId: auth?.application_id,
      });
      if (!invoiceId) {
        toast.error('Application fee invoice is missing. Open transaction history to pay.');
        nav('/invoices');
        return;
      }
      const outcome = await startStudentInvoiceCheckout(api, invoiceId);
      if (outcome === 'demo') {
        toast.success('Application fee paid');
        await refresh();
      }
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Payment could not be started.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <button type="button" onClick={pay} disabled={busy} className={className}>
      {busy ? busyLabel : children}
    </button>
  );
}
