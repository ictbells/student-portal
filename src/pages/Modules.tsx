import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../auth';
import { Card } from '../components/ui';

export function Profile() {
  const { auth } = useAuth();
  const s = auth?.user?.student;
  if (!auth?.is_student || !s) {
    return <p className="text-slate-600">Your student record opens after acceptance fee and student creation.</p>;
  }
  return (
    <Card>
      <h1 className="text-xl font-semibold mb-4">My student record</h1>
      <p className="text-sm text-slate-500 mb-4">NIN identity fields are locked.</p>
      {['first_name', 'last_name', 'date_of_birth', 'gender', 'nin', 'matric_number'].map((f) => (
        <div key={f} className="text-sm py-1 border-b"><span className="text-slate-500 capitalize">{f.replaceAll('_', ' ')}: </span>{s[f]}</div>
      ))}
    </Card>
  );
}

export function WalletPage() {
  const [w, setW] = useState<any>(null);
  const [amount, setAmount] = useState('5000');
  const { auth } = useAuth();
  const load = () => api.get('/api/wallet').then((r) => setW(r.data)).catch(() => setW(null));
  useEffect(() => { if (auth?.is_student) load(); }, [auth?.is_student]);
  if (!auth?.is_student) return <Navigate to="/" replace />;
  if (!w) return <p className="text-slate-600">Wallet opens after student creation.</p>;
  const fund = async () => {
    const { data } = await api.post('/api/wallet/topup', { amount: Number(amount) });
    if (data.demo) { await api.get(`/api/payments/paystack/verify/${data.reference}`); load(); }
    else if (data.authorization_url) window.location.href = data.authorization_url;
  };
  return (
    <Card>
      <h1 className="text-xl font-semibold mb-4">Campus wallet</h1>
      <div className="text-3xl font-semibold text-sky-600 mb-4">₦{w.balance}</div>
      <div className="flex gap-2 mb-4">
        <input className="border rounded-lg px-3 py-2" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <button onClick={fund} className="bg-sky-500 text-white px-4 rounded-lg">Fund with Paystack</button>
      </div>
      <h2 className="font-medium text-sm">Recent transactions</h2>
      <ul className="text-sm mt-2">{w.transactions?.map((t: any) => <li key={t.id}>{t.type} ₦{t.amount}</li>)}</ul>
    </Card>
  );
}

export function Invoices() {
  const [rows, setRows] = useState<any[]>([]);
  const load = () => api.get('/api/invoices').then((r) => setRows(r.data.data || r.data));
  useEffect(() => { load(); }, []);
  const paystack = async (id: number) => {
    const { data } = await api.post('/api/payments/paystack/initialize', { invoice_id: id });
    if (data.demo) { await api.get(`/api/payments/paystack/verify/${data.reference}`); load(); }
    else if (data.authorization_url) window.location.href = data.authorization_url;
  };
  return (
    <Card>
      <h1 className="text-xl font-semibold mb-4">Invoices</h1>
      {rows.map((i) => (
        <div key={i.id} className="border rounded-lg p-3 mb-2 flex justify-between text-sm items-center">
          <div>{i.number} · {i.category} · ₦{i.balance} · {i.status}</div>
          {i.status !== 'paid' && <button className="text-green-700 font-medium" onClick={() => paystack(i.id)}>Paystack</button>}
        </div>
      ))}
    </Card>
  );
}

export function Documents() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { api.get('/api/documents').then((r) => setRows(r.data.data || r.data)); }, []);
  return (
    <Card>
      <h1 className="text-xl font-semibold mb-4">Documents</h1>
      {rows.map((d) => <div key={d.id} className="border-b py-3"><div className="font-medium">{d.title}</div></div>)}
    </Card>
  );
}

export function Academic() {
  const { auth } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [tr, setTr] = useState<any>(null);
  useEffect(() => {
    if (!auth?.is_student) return;
    api.get('/api/academic/my-enrollments').then((r) => setRows(r.data)).catch(() => {});
    api.get('/api/academic/transcript').then((r) => setTr(r.data)).catch(() => {});
  }, [auth?.is_student]);
  if (!auth?.is_student) return <Navigate to="/" replace />;
  return (
    <Card>
      <h1 className="text-xl font-semibold mb-4">Academic</h1>
      {tr && <p className="mb-2">GPA: {tr.gpa}</p>}
      {rows.map((e) => <div key={e.id} className="text-sm py-1">{e.offering?.course?.code} {e.grade?.letter}</div>)}
    </Card>
  );
}
