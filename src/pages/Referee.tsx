import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api';
import { Alert, Button, Card, Input, Label, Spinner } from '../components/ui';

export default function Referee() {
  const { token } = useParams();
  const [info, setInfo] = useState<any>(null);
  const [error, setError] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [comments, setComments] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) return;
    api.get(`/api/referee/${token}`)
      .then((r) => setInfo(r.data))
      .catch((e) => setError(e.response?.data?.message || 'This link is invalid or has expired.'));
  }, [token]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token || !file) return;
    setSaving(true);
    try {
      const form = new FormData();
      form.append('file', file);
      if (comments) form.append('comments', comments);
      const { data } = await api.post(`/api/referee/${token}`, form);
      setInfo(data);
      setDone(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Could not upload the letter.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <Card className="max-w-lg mx-auto space-y-4">
        <h1 className="text-lg font-semibold text-slate-900">Recommendation letter</h1>
        {error && <Alert tone="error">{error}</Alert>}
        {!info && !error && <Spinner label="Loading invite…" />}
        {info && (
          <>
            <p className="text-sm text-slate-600">
              {info.applicant_name} has named you as a referee
              {info.programme ? ` for ${info.programme}` : ''}.
            </p>
            {info.status === 'submitted' || done ? (
              <Alert tone="success">Thank you. Your letter has been received.</Alert>
            ) : (
              <form onSubmit={submit} className="space-y-3">
                <div>
                  <Label>Letter (PDF or image)</Label>
                  <Input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                </div>
                <div>
                  <Label>Comments (optional)</Label>
                  <textarea className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" rows={4} value={comments} onChange={(e) => setComments(e.target.value)} />
                </div>
                <Button type="submit" disabled={saving || !file}>{saving ? 'Uploading…' : 'Submit letter'}</Button>
              </form>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
