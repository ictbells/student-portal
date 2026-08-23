import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../auth';
import { Breadcrumb, FormSection, IdentityCard, PageHeader, StepIndicator } from '../components/portal';
import { Alert, Button, Card, Input, Label, Spinner } from '../components/ui';
import { storageUrl } from '../lib/storage';

const OLEVEL_GRADES = ['A1', 'B2', 'B3', 'C4', 'C5', 'C6', 'D7', 'E8', 'F9'];

type OlevelResult = { subject_id: number; subject_name: string; grade: string };
type OlevelSubject = { id: number; name: string; code?: string };

const steps = [
  { key: 'biodata', title: 'NIN verification' },
  { key: 'application_form', title: 'Application form' },
  { key: 'academic_qualifications', title: 'Academic qualifications' },
  { key: 'programme_selection', title: 'Programme selection' },
  { key: 'required_documents', title: 'Required documents' },
] as const;

const IDENTITY_FIELDS = [
  { key: 'nin', label: 'NIN' },
  { key: 'first_name', label: 'First name' },
  { key: 'middle_name', label: 'Middle name' },
  { key: 'last_name', label: 'Surname' },
  { key: 'date_of_birth', label: 'Date of birth' },
  { key: 'gender', label: 'Gender' },
] as const;

function formatDate(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function biodataPayload(app: any) {
  return app?.steps?.find((s: any) => s.step_key === 'biodata')?.payload || {};
}

function identityName(payload: any, auth: ReturnType<typeof useAuth>['auth']) {
  const fromPayload = [payload.first_name, payload.middle_name, payload.last_name].filter(Boolean).join(' ');
  if (fromPayload) return fromPayload;
  const fromAuth = [auth?.nin_identity?.first_name, auth?.nin_identity?.middle_name, auth?.nin_identity?.last_name]
    .filter(Boolean)
    .join(' ');
  return fromAuth || auth?.user?.name || '';
}

const selectClass = 'w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 transition';

export default function Wizard() {
  const { auth, refresh } = useAuth();
  const [app, setApp] = useState<any>(null);
  const [idx, setIdx] = useState(0);
  const [payload, setPayload] = useState<any>({});
  const [nin, setNin] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [programs, setPrograms] = useState<any[]>([]);
  const [olevelSubjects, setOlevelSubjects] = useState<OlevelSubject[]>([]);
  const [candidateUtme, setCandidateUtme] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const ninVerified = useMemo(() => !!biodataPayload(app).nin_locked, [app]);

  const load = async (id: number) => {
    const { data } = await api.get(`/api/applications/${id}`);
    setApp(data);
    const bio = biodataPayload(data);
    const verified = !!bio.nin_locked;
    const current = verified ? (data.current_step || 'biodata') : 'biodata';
    const stepIndex = Math.max(0, steps.findIndex((s) => s.key === current));
    setIdx(verified ? stepIndex : 0);
    const step = data.steps?.find((s: any) => s.step_key === steps[verified ? stepIndex : 0].key);
    setPayload(step?.payload || {});
    setNin(bio.nin || '');
  };

  useEffect(() => {
    api.get('/api/olevel-subjects').then((r) => setOlevelSubjects(r.data));
    const id = auth?.application_id;
    const run = async () => {
      try {
        if (id) await load(id);
        else {
          const r = await api.get('/api/applications');
          const first = r.data.data?.[0];
          if (first) await load(first.id);
        }
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [auth?.application_id]);

  useEffect(() => {
    const jamb = app?.jamb_registration || auth?.user?.jamb_registration;
    if (!jamb) return;
    const academicYear = app?.intake?.term?.session_label;
    api.get(`/api/candidate-data/${encodeURIComponent(jamb)}`, {
      params: academicYear ? { academic_year: academicYear } : undefined,
    })
      .then(({ data }) => setCandidateUtme(data.suggested?.utme ?? null))
      .catch(() => setCandidateUtme(null));
  }, [app?.jamb_registration, auth?.user?.jamb_registration, app?.intake?.term?.session_label]);

  useEffect(() => {
    if (!app?.entry_mode) return;
    api.get('/api/programs', { params: { entry_mode: app.entry_mode } }).then((r) => setPrograms(r.data));
  }, [app?.entry_mode]);

  const goToStep = (stepIndex: number) => {
    if (!ninVerified && stepIndex > 0) {
      setErr('Verify your NIN before continuing to the rest of the form.');
      setIdx(0);
      return;
    }
    setIdx(stepIndex);
    let nextPayload = app.steps?.find((x: any) => x.step_key === steps[stepIndex].key)?.payload || {};
    if (steps[stepIndex].key === 'academic_qualifications' && !nextPayload.utme && candidateUtme) {
      nextPayload = { ...nextPayload, utme: candidateUtme };
    }
    setPayload(nextPayload);
    setMsg('');
    setErr('');
  };

  const save = async () => {
    setSaving(true);
    setErr('');
    try {
      await api.post(`/api/applications/${app.id}/steps`, { step_key: steps[idx].key, payload });
      setMsg('Progress saved');
      await load(app.id);
    } catch (e: any) {
      setErr(e.response?.data?.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const verifyNin = async (e?: FormEvent) => {
    e?.preventDefault();
    if (verifying || nin.length !== 11) return;
    setErr('');
    setVerifying(true);
    try {
      await api.post(`/api/applications/${app.id}/nin`, { nin: nin.trim() });
      setMsg('NIN verified. Your identity details are now locked.');
      await load(app.id);
      await refresh();
    } catch (e: any) {
      setErr(e.response?.data?.message || 'NIN verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const submit = async () => {
    setSaving(true);
    setErr('');
    try {
      await api.post(`/api/applications/${app.id}/steps`, { step_key: steps[idx].key, payload });
      await api.post(`/api/applications/${app.id}/submit`);
      await refresh();
      setMsg('Submitted for screening');
    } catch (e: any) {
      setErr(e.response?.data?.message || 'Submit failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500">
        <Spinner label="Loading application form…" />
      </div>
    );
  }
  if (!app) return <Alert tone="info">No application found. <Link to="/apply" className="text-sky-600 underline">Start application</Link></Alert>;
  if (app.application_fee_invoice?.status !== 'paid') return <Navigate to="/apply" replace />;
  if (!['fee_paid', 'form_in_progress'].includes(app.stage)) return <Navigate to="/status" replace />;

  const step = steps[idx];
  const olevelResults: OlevelResult[] = payload.olevel_results || [];
  const passportUrl = storageUrl(payload.photo_path) || auth?.nin_identity?.photo_url || null;
  const displayName = identityName(payload, auth);

  const isStepComplete = (index: number) => {
    const key = steps[index].key;
    const status = app.steps?.find((x: any) => x.step_key === key)?.status;
    return status && status !== 'pending';
  };

  const addOlevelRow = () => {
    setPayload({
      ...payload,
      olevel_results: [...olevelResults, { subject_id: 0, subject_name: '', grade: '' }],
    });
  };

  const updateOlevelRow = (index: number, field: keyof OlevelResult, value: string | number) => {
    const next = olevelResults.map((row, i) => {
      if (i !== index) return row;
      if (field === 'subject_id') {
        const subject = olevelSubjects.find((s) => s.id === Number(value));
        return { ...row, subject_id: Number(value), subject_name: subject?.name || '' };
      }
      return { ...row, [field]: value };
    });
    setPayload({ ...payload, olevel_results: next });
  };

  const removeOlevelRow = (index: number) => {
    setPayload({
      ...payload,
      olevel_results: olevelResults.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <Breadcrumb items={[{ label: 'Home', to: '/' }, { label: 'Application form' }]} />
        <PageHeader
          eyebrow={app.application_number ? `Ref ${app.application_number}` : 'Admissions'}
          title="Application form"
          description="Complete each section below. Your NIN identity is verified once and locked for the rest of the process."
        />
      </div>

      <Card className="!p-4 sm:!p-5 bg-slate-50/50">
        <StepIndicator
          steps={steps.map((s) => ({ key: s.key, title: s.title }))}
          currentIndex={idx}
          onStepClick={goToStep}
          isStepLocked={(index) => !ninVerified && index > 0}
          isStepComplete={isStepComplete}
        />
      </Card>

      <Card className="space-y-6">
        {msg && <Alert tone="success">{msg}</Alert>}
        {err && <Alert tone="error">{err}</Alert>}

        {step.key === 'biodata' && (
          <>
            {!ninVerified ? (
              <FormSection title="Verify your NIN" description="Enter your 11-digit National Identification Number to retrieve your legal identity.">
                <form onSubmit={verifyNin} className="space-y-4 max-w-md">
                  <div>
                    <Label htmlFor="nin">National Identification Number (NIN)</Label>
                    <Input
                      id="nin"
                      inputMode="numeric"
                      maxLength={11}
                      placeholder="11-digit NIN"
                      value={nin}
                      onChange={(e) => setNin(e.target.value.replace(/\D/g, '').slice(0, 11))}
                    />
                  </div>
                  <Button type="submit" disabled={verifying || nin.length !== 11} className="bg-sky-600 hover:bg-sky-700 text-white shadow-sm">
                    {verifying ? <Spinner label="Verifying…" /> : 'Verify NIN'}
                  </Button>
                </form>
              </FormSection>
            ) : (
              <>
                <IdentityCard
                  photoUrl={passportUrl}
                  name={displayName}
                  nin={payload.nin}
                  gender={payload.gender}
                  dateOfBirth={formatDate(payload.date_of_birth)}
                  verified
                />
                <FormSection title="Identity details" description="Retrieved from NIMC and cannot be edited.">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {IDENTITY_FIELDS.map((field) => (
                      <div key={field.key}>
                        <Label htmlFor={field.key}>{field.label}</Label>
                        <Input
                          id={field.key}
                          readOnly
                          className="bg-slate-50 text-slate-700"
                          value={field.key === 'date_of_birth' ? formatDate(payload[field.key]) : payload[field.key] || ''}
                        />
                      </div>
                    ))}
                  </div>
                </FormSection>
                <FormSection title="Emergency contact" description="Provide a next of kin we can reach during admissions.">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="next_of_kin">Next of kin</Label>
                      <Input id="next_of_kin" value={payload.next_of_kin || ''} onChange={(e) => setPayload({ ...payload, next_of_kin: e.target.value })} />
                    </div>
                    <div>
                      <Label htmlFor="next_of_kin_phone">Next of kin phone</Label>
                      <Input id="next_of_kin_phone" type="tel" value={payload.next_of_kin_phone || ''} onChange={(e) => setPayload({ ...payload, next_of_kin_phone: e.target.value })} />
                    </div>
                  </div>
                </FormSection>
              </>
            )}
          </>
        )}

        {step.key === 'application_form' && (
          <FormSection title="Contact & declaration" description="Confirm how we can reach you and accept the declaration.">
            <div className="grid grid-cols-1 gap-4 max-w-xl">
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={payload.phone || ''} onChange={(e) => setPayload({ ...payload, phone: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="address">Address</Label>
                <textarea id="address" className={selectClass} placeholder="Residential address" rows={3} value={payload.address || ''} onChange={(e) => setPayload({ ...payload, address: e.target.value })} />
              </div>
              <label className="flex gap-3 items-start rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-sm cursor-pointer">
                <input type="checkbox" className="mt-0.5" checked={!!payload.declaration} onChange={(e) => setPayload({ ...payload, declaration: e.target.checked })} />
                <span>I confirm that all information provided in this application is true and complete.</span>
              </label>
            </div>
          </FormSection>
        )}

        {step.key === 'academic_qualifications' && (
          <FormSection title="Academic qualifications" description="Add your O'level results and any other qualifications.">
            <div className="space-y-4">
              {(payload.utme?.subjects?.length || candidateUtme?.subjects?.length) ? (
                <div className="rounded-xl border border-sky-100 bg-sky-50/80 p-4 space-y-3">
                  <p className="text-sm font-semibold text-sky-900">UTME details from admission list</p>
                  <div className="grid gap-2 sm:grid-cols-2 text-sm">
                    {(payload.utme?.aggregate ?? candidateUtme?.aggregate) != null && (
                      <div><span className="text-slate-500">Aggregate:</span> <span className="font-medium">{payload.utme?.aggregate ?? candidateUtme?.aggregate}</span></div>
                    )}
                    {(payload.utme?.course_choice ?? candidateUtme?.course_choice) && (
                      <div><span className="text-slate-500">Course choice:</span> <span className="font-medium">{payload.utme?.course_choice ?? candidateUtme?.course_choice}</span></div>
                    )}
                  </div>
                  <div className="space-y-1 text-sm divide-y divide-sky-100">
                    {(payload.utme?.subjects ?? candidateUtme?.subjects ?? []).map((row: any, index: number) => (
                      <div key={`${row.subject}-${index}`} className="flex justify-between gap-3 py-2 first:pt-0">
                        <span>{row.subject}</span>
                        <span className="font-medium">{row.score ?? '—'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {olevelResults.map((row, index) => (
                <div key={index} className="flex flex-col sm:flex-row gap-2 items-start sm:items-center p-3 rounded-xl border border-slate-100 bg-slate-50/50">
                  <select className={`${selectClass} flex-1`} value={row.subject_id || ''} onChange={(e) => updateOlevelRow(index, 'subject_id', e.target.value)}>
                    <option value="">Select subject</option>
                    {olevelSubjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <select className={`${selectClass} w-full sm:w-28`} value={row.grade} onChange={(e) => updateOlevelRow(index, 'grade', e.target.value)}>
                    <option value="">Grade</option>
                    {OLEVEL_GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                  <Button type="button" onClick={() => removeOlevelRow(index)} className="text-rose-700 hover:bg-rose-50 shrink-0">Remove</Button>
                </div>
              ))}
              <Button type="button" onClick={addOlevelRow} className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm">Add subject</Button>
              <textarea className={selectClass} rows={4} placeholder="Other qualifications (optional)" value={payload.other_qualifications || ''} onChange={(e) => setPayload({ ...payload, other_qualifications: e.target.value })} />
            </div>
          </FormSection>
        )}

        {step.key === 'programme_selection' && (
          <FormSection title="Programme selection" description="Choose the programme you are applying for.">
            <div className="max-w-xl">
              <Label htmlFor="program_id">Programme</Label>
              <select id="program_id" className={selectClass} value={payload.program_id || ''} onChange={(e) => setPayload({ ...payload, program_id: Number(e.target.value) })}>
                <option value="">Select programme</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}{p.duration_years ? ` (${p.duration_years} years)` : ''}</option>
                ))}
              </select>
            </div>
          </FormSection>
        )}

        {step.key === 'required_documents' && (
          <FormSection title="Required documents" description="Upload supporting documents. Your NIN passport photo is saved automatically.">
            <div className="max-w-xl space-y-4">
              {passportUrl && (
                <div className="flex items-center gap-4 rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
                  <img src={passportUrl} alt="Passport" className="h-16 w-14 rounded-lg object-cover border border-white shadow-sm" />
                  <div className="text-sm">
                    <p className="font-medium text-emerald-900">Passport from NIN</p>
                    <p className="text-emerald-700">Already saved to your application file.</p>
                  </div>
                </div>
              )}
              <div>
                <Label htmlFor="document">Supporting document</Label>
                <input
                  id="document"
                  type="file"
                  className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-sky-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-sky-700 hover:file:bg-sky-100"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const fd = new FormData();
                    fd.append('file', file);
                    fd.append('doc_type', 'supporting');
                    await api.post(`/api/applications/${app.id}/documents`, fd);
                    setMsg('Document uploaded');
                  }}
                />
              </div>
            </div>
          </FormSection>
        )}

        {(ninVerified || step.key !== 'biodata') && (
          <div className="flex flex-wrap gap-3 pt-4 border-t border-slate-100">
            <Button onClick={save} disabled={saving || (step.key === 'biodata' && !ninVerified)} className="bg-sky-600 hover:bg-sky-700 text-white shadow-sm">
              {saving ? <Spinner label="Saving…" /> : 'Save progress'}
            </Button>
            {idx === steps.length - 1 && (
              <Button onClick={submit} disabled={saving || !ninVerified} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm">
                {saving ? <Spinner label="Submitting…" /> : 'Submit application'}
              </Button>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
