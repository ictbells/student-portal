import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../auth';
import { Alert, Card } from '../components/ui';

export default function Status() {
  const { auth } = useAuth();
  const [app, setApp] = useState<any>(null);

  useEffect(() => {
    if (!auth?.application_id) return;
    api.get(`/api/applications/${auth.application_id}`).then((r) => setApp(r.data));
  }, [auth?.application_id]);

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold">Application status</h1>
      <Card className="space-y-2 text-sm">
        <div>Current stage: <strong>{auth?.lifecycle_stage?.replaceAll('_', ' ') || '—'}</strong></div>
        {app?.application_number && <div>Application number: <strong className="font-mono">{app.application_number}</strong></div>}
        {app?.offer_reference && <div>Offer reference: {app.offer_reference}</div>}
        {auth?.unpaid_acceptance_fee && (
          <Alert tone="warning">You have an admission offer. Pay the acceptance fee to become a student. <Link to="/invoices" className="underline">Open invoices</Link></Alert>
        )}
      </Card>
      {app?.reviews?.length > 0 && (
        <Card>
          <h2 className="font-medium mb-2">Review history</h2>
          <ul className="text-sm space-y-2">
            {app.reviews.map((r: any) => (
              <li key={r.id} className="border-b pb-2">{r.from_stage} → {r.to_stage} · {r.decision}</li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
