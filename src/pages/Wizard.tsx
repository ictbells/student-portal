import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../auth';
import { DocumentPreviewThumb } from '../components/DocumentPreviewThumb';
import { Breadcrumb, FormSection, PageHeader, StepIndicator } from '../components/portal';
import { useToast } from '../components/toast';
import { Alert, Button, Card, Input, Label, Spinner } from '../components/ui';
import { storageUrl } from '../lib/storage';
import { requiredDocumentsFor } from '../constants/requiredDocuments';

const OLEVEL_GRADES = ['A1', 'B2', 'B3', 'C4', 'C5', 'C6', 'D7', 'E8', 'F9'];

type OlevelResult = { subject_id: number; subject_name: string; grade: string };
type OlevelSubject = { id: number; name: string; code?: string };
type GeoState = { state_id: number; state_title: string };
type GeoLga = { lga_id: number; lga_title: string; state_id: number };

function apiErrorMessage(e: any, fallback: string) {
  const errors = e?.response?.data?.errors;
  if (errors && typeof errors === 'object') {
    const first = Object.values(errors).flat().find((v) => typeof v === 'string');
    if (typeof first === 'string') return first;
  }
  return e?.response?.data?.message || fallback;
}

function wizardSteps(entryMode?: string) {
  const list: { key: string; title: string }[] = [
    { key: 'biodata', title: 'NIN verification' },
    { key: 'personal_details', title: 'Personal details' },
    { key: 'health_information', title: 'Health information' },
    { key: 'next_of_kin', title: 'Next of kin' },
    { key: 'sponsor', title: 'Sponsor' },
    { key: 'application_form', title: 'Contact & declaration' },
  ];
  if (entryMode === 'utme') {
    list.push({ key: 'utme', title: 'JAMB / UTME' });
  }
  list.push({ key: 'academic_qualifications', title: "O'Level" });
  if (entryMode === 'de') {
    list.push({ key: 'direct_entry', title: 'Direct Entry' });
  }
  if (entryMode === 'transfer') {
    list.push({ key: 'transfer_background', title: 'Transfer background' });
  }
  if (entryMode === 'pg') {
    list.push({ key: 'pg_background', title: 'Prior qualifications' });
  }
  list.push({ key: 'programme_selection', title: 'Programme selection' });
  if (entryMode === 'pg') {
    list.push({ key: 'pg_research', title: 'Research & purpose' });
    list.push({ key: 'pg_referees', title: 'Referees' });
  }
  list.push({ key: 'required_documents', title: 'Required documents' });
  return list;
}

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const GENOTYPES = ['AA', 'AS', 'AC', 'SS', 'SC', 'CC'];
const MARITAL_STATUSES = ['Single', 'Married', 'Divorced', 'Widowed', 'Separated'];
const RELIGIONS = ['Christianity', 'Islam', 'Traditional', 'Other'];
const RELATIONSHIPS = ['Father', 'Mother', 'Guardian', 'Spouse', 'Sibling', 'Uncle', 'Aunt', 'Other'];
const OLEVEL_EXAM_TYPES = ['WAEC', 'NECO', 'GCE', 'NABTEB', 'Other'];
const OLEVEL_YEARS = Array.from({ length: 30 }, (_, i) => String(new Date().getFullYear() - i));

type OlevelSitting = {
  exam_type: string;
  exam_center: string;
  exam_year: string;
  exam_number: string;
  results: OlevelResult[];
};

function emptySitting(): OlevelSitting {
  return { exam_type: '', exam_center: '', exam_year: '', exam_number: '', results: [{ subject_id: 0, subject_name: '', grade: '' }] };
}

type UtmeChoice = { choice_order: number; institution_name: string; programme_name: string };
type UtmeRow = { subject: string; score: string };
type UtmeForm = {
  aggregate: string;
  course_choice: string;
  exam_year: string;
  subjects: UtmeRow[];
  institution_choices: UtmeChoice[];
};

function emptyUtmeChoices(): UtmeChoice[] {
  return [1, 2, 3, 4].map((order) => ({ choice_order: order, institution_name: '', programme_name: '' }));
}

function emptyUtme(): UtmeForm {
  return {
    aggregate: '',
    course_choice: '',
    exam_year: '',
    subjects: [
      { subject: '', score: '' },
      { subject: '', score: '' },
      { subject: '', score: '' },
      { subject: '', score: '' },
    ],
    institution_choices: emptyUtmeChoices(),
  };
}

function asUtme(raw: any, fallback?: any): UtmeForm {
  const source = raw && typeof raw === 'object' ? raw : (fallback && typeof fallback === 'object' ? fallback : null);
  const base = emptyUtme();
  if (!source) return base;
  const subjects: UtmeRow[] = Array.isArray(source.subjects) && source.subjects.length
    ? source.subjects.map((row: any) => ({
        subject: row.subject || '',
        score: row.score != null ? String(row.score) : '',
      }))
    : [...base.subjects];
  while (subjects.length < 4) subjects.push({ subject: '', score: '' });
  const choices: UtmeChoice[] = Array.isArray(source.institution_choices) && source.institution_choices.length
    ? source.institution_choices.map((row: any, index: number) => ({
        choice_order: Number(row.choice_order || index + 1),
        institution_name: row.institution_name || '',
        programme_name: row.programme_name || '',
      }))
    : emptyUtmeChoices();
  while (choices.length < 4) {
    choices.push({ choice_order: choices.length + 1, institution_name: '', programme_name: '' });
  }
  return {
    aggregate: source.aggregate != null && source.aggregate !== '' ? String(source.aggregate) : '',
    course_choice: source.course_choice || '',
    exam_year: source.exam_year != null && source.exam_year !== '' ? String(source.exam_year) : '',
    subjects,
    institution_choices: choices.slice(0, 4),
  };
}

function utmeForSave(utme: any) {
  if (!utme || typeof utme !== 'object') return null;
  const subjects = (utme.subjects || []).filter((row: any) => row.subject || row.score);
  const institution_choices = (utme.institution_choices || [])
    .map((row: any, index: number) => ({
      choice_order: Number(row.choice_order || index + 1),
      institution_name: row.institution_name || '',
      programme_name: row.programme_name || '',
    }))
    .filter((row: UtmeChoice) => row.institution_name || row.programme_name);
  if (!utme.aggregate && !utme.course_choice && !utme.exam_year && subjects.length === 0 && institution_choices.length === 0) return null;
  return { ...utme, subjects, institution_choices };
}

const DE_QUALIFICATION_TYPES = [
  { value: 'nd', label: 'ND' },
  { value: 'hnd', label: 'HND' },
  { value: 'nce', label: 'NCE' },
  { value: 'ijmb', label: 'IJMB' },
  { value: 'a_level', label: 'A-Level' },
  { value: 'first_degree', label: 'First degree' },
  { value: 'other', label: 'Other' },
];
const DE_CLASSIFICATIONS = [
  { value: 'distinction', label: 'Distinction' },
  { value: 'upper_credit', label: 'Upper Credit' },
  { value: 'lower_credit', label: 'Lower Credit' },
  { value: 'merit', label: 'Merit' },
  { value: 'first', label: 'First Class' },
  { value: 'second_upper', label: 'Second Class Upper' },
  { value: 'second_lower', label: 'Second Class Lower' },
  { value: 'third', label: 'Third Class' },
  { value: 'pass', label: 'Pass' },
  { value: 'other', label: 'Other' },
];
const DE_ENTRY_LEVELS = ['200', '300'];
const TRANSFER_ENTRY_LEVELS = ['200', '300', '400'];

function emptyDirectEntry(jamb?: string) {
  return {
    jamb_de_number: jamb || '',
    previous_institution: '',
    qualification_type: 'nd',
    qualification_title: '',
    qualification_class: 'upper_credit',
    qualification_year: '',
    programme: '',
    requested_entry_level: '200',
  };
}

function emptyTransferBackground() {
  return {
    previous_university: '',
    previous_programme: '',
    previous_student_id: '',
    credits_earned: '',
    cgpa: '',
    reason_for_transfer: '',
    requested_entry_level: '200',
    has_transfer_approval: false,
    approval_reference: '',
  };
}

function normalizeAcademicPayload(raw: any, fallbackUtme?: any) {
  const base = { ...(raw || {}) };
  let normalized;
  if (base.first_sitting || base.second_sitting) {
    normalized = {
      ...base,
      first_sitting: {
        ...emptySitting(),
        ...(base.first_sitting || {}),
        results: base.first_sitting?.results?.length ? base.first_sitting.results : emptySitting().results,
      },
      second_sitting: base.second_sitting
        ? {
            ...emptySitting(),
            ...base.second_sitting,
            results: base.second_sitting?.results?.length ? base.second_sitting.results : [],
          }
        : { ...emptySitting(), results: [] },
    };
  } else if (base.olevel_results?.length) {
    normalized = {
      ...base,
      first_sitting: {
        exam_type: base.exam_type || '',
        exam_center: base.exam_center || '',
        exam_year: base.exam_year || '',
        exam_number: base.exam_number || '',
        results: base.olevel_results,
      },
      second_sitting: { ...emptySitting(), results: [] },
    };
  } else {
    normalized = {
      ...base,
      first_sitting: emptySitting(),
      second_sitting: { ...emptySitting(), results: [] },
    };
  }
  return { ...normalized, utme: asUtme(normalized.utme, fallbackUtme) };
}

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

const selectClass = 'w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 transition';

function facultyIdOf(program: any): number | '' {
  const id = program?.department?.faculty_id ?? program?.department?.faculty?.id;
  return id ? Number(id) : '';
}

function departmentIdOf(program: any): number | '' {
  const id = program?.department_id ?? program?.department?.id;
  return id ? Number(id) : '';
}

function uniqueNamedOptions(items: { value: number; label: string }[]) {
  const map = new Map<number, string>();
  items.forEach(({ value, label }) => {
    if (value && label) map.set(value, label);
  });
  return [...map.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function withProgrammeChoiceIds(raw: any, programList: any[]) {
  const firstId = raw?.first_choice_program_id || raw?.program_id || '';
  const first = programList.find((p) => p.id === Number(firstId));
  const second = programList.find((p) => p.id === Number(raw?.second_choice_program_id));
  return {
    ...raw,
    first_choice_program_id: firstId,
    first_choice_college_id: raw?.first_choice_college_id || facultyIdOf(first) || '',
    first_choice_department_id: raw?.first_choice_department_id || departmentIdOf(first) || '',
    second_choice_program_id: raw?.second_choice_program_id || '',
    second_choice_college_id: raw?.second_choice_college_id || facultyIdOf(second) || '',
    second_choice_department_id: raw?.second_choice_department_id || departmentIdOf(second) || '',
  };
}

export default function Wizard() {
  const { auth, refresh } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [app, setApp] = useState<any>(null);
  const [idx, setIdx] = useState(0);
  const [payload, setPayload] = useState<any>({});
  const [nin, setNin] = useState('');
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [programs, setPrograms] = useState<any[]>([]);
  const [colleges, setColleges] = useState<any[]>([]);
  const [olevelSubjects, setOlevelSubjects] = useState<OlevelSubject[]>([]);
  const [candidateUtme, setCandidateUtme] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [printHtml, setPrintHtml] = useState<string | null>(null);
  const [printLoading, setPrintLoading] = useState(false);
  const [states, setStates] = useState<GeoState[]>([]);
  const [lgas, setLgas] = useState<GeoLga[]>([]);
  const [loadingLgas, setLoadingLgas] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [supervisors, setSupervisors] = useState<any[]>([]);
  const steps = wizardSteps(app?.entry_mode);

  const ninVerified = useMemo(() => !!biodataPayload(app).nin_locked, [app]);

  const load = async (id: number) => {
    const { data } = await api.get(`/api/applications/${id}`);
    setApp(data);
    const modeSteps = wizardSteps(data.entry_mode);
    const bio = biodataPayload(data);
    const verified = !!bio.nin_locked;
    const current = verified ? (data.current_step || 'biodata') : 'biodata';
    const found = modeSteps.findIndex((s) => s.key === current);
    const stepIndex = found >= 0 ? found : 0;
    setIdx(verified ? stepIndex : 0);
    const activeKey = modeSteps[verified ? stepIndex : 0]?.key;
    const step = data.steps?.find((s: any) => s.step_key === activeKey);
    let stepPayload = step?.payload || {};
    if (activeKey === 'academic_qualifications') {
      stepPayload = normalizeAcademicPayload(stepPayload);
    }
    if (activeKey === 'utme') {
      stepPayload = { utme: asUtme(stepPayload.utme, candidateUtme) };
    }
    if (activeKey === 'application_form' && !stepPayload.phone && auth?.user?.phone) {
      stepPayload = { ...stepPayload, phone: auth.user.phone };
    }
    if (activeKey === 'personal_details' && !stepPayload.country) {
      stepPayload = { ...stepPayload, country: 'Nigeria' };
    }
    if (activeKey === 'programme_selection') {
      stepPayload = withProgrammeChoiceIds(stepPayload, programs);
    }
    setPayload(stepPayload);
    setNin(bio.nin || '');
  };

  useEffect(() => {
    api.get('/api/olevel-subjects').then((r) => setOlevelSubjects(r.data));
    api.get('/api/states').then((r) => setStates(r.data)).catch(() => setStates([]));
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
    if (steps[idx]?.key !== 'utme' || !candidateUtme) return;
    setPayload((prev: any) => {
      const current = prev.utme;
      const filled = current?.aggregate || current?.course_choice || current?.exam_year
        || current?.subjects?.some((row: any) => row.subject || row.score)
        || current?.institution_choices?.some((row: any) => row.institution_name || row.programme_name);
      if (filled) return prev;
      return { ...prev, utme: asUtme(null, candidateUtme) };
    });
  }, [candidateUtme, idx]);

  useEffect(() => {
    api.get('/api/colleges')
      .then((r) => setColleges(Array.isArray(r.data) ? r.data : r.data?.data ?? []))
      .catch(() => setColleges([]));
  }, []);

  useEffect(() => {
    if (!app?.entry_mode) return;
    api.get('/api/programs', { params: { entry_mode: app.entry_mode } })
      .then((r) => setPrograms(Array.isArray(r.data) ? r.data : r.data?.data ?? []))
      .catch(() => setPrograms([]));
  }, [app?.entry_mode, app?.id, app?.steps]);

  useEffect(() => {
    const programId = Number(payload.first_choice_program_id || app?.program_id);
    if (!programId || app?.entry_mode !== 'pg') {
      setSupervisors([]);
      return;
    }
    api.get(`/api/programs/${programId}/supervisors`).then((r) => setSupervisors(r.data)).catch(() => setSupervisors([]));
  }, [payload.first_choice_program_id, app?.program_id, app?.entry_mode]);

  useEffect(() => {
    if (!programs.length || steps[idx]?.key !== 'programme_selection') return;
    setPayload((prev: any) => withProgrammeChoiceIds(prev, programs));
  }, [programs, idx]);

  useEffect(() => {
    const isNigeria = payload.country === 'Nigeria';
    const stateId = Number(payload.state_id || 0);
    if (!isNigeria || !stateId) {
      setLgas([]);
      return;
    }
    setLoadingLgas(true);
    api.get('/api/lgas', { params: { state_id: stateId } })
      .then((r) => setLgas(r.data))
      .catch(() => setLgas([]))
      .finally(() => setLoadingLgas(false));
  }, [payload.country, payload.state_id]);

  useEffect(() => {
    if (!printHtml) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPrintHtml(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [printHtml]);

  const collegeOptions = useMemo(
    () => uniqueNamedOptions([
      ...colleges.map((c) => ({
        value: Number(c.id || 0),
        label: c.name || '',
      })),
      ...programs.map((p) => ({
        value: Number(facultyIdOf(p) || 0),
        label: p.department?.faculty?.name || '',
      })),
    ]),
    [colleges, programs],
  );

  const applyStepPayload = (appData: any, stepIndex: number) => {
    let nextPayload = appData.steps?.find((x: any) => x.step_key === steps[stepIndex].key)?.payload || {};
    if (steps[stepIndex].key === 'academic_qualifications') {
      nextPayload = normalizeAcademicPayload(nextPayload, candidateUtme);
    }
    if (steps[stepIndex].key === 'utme') {
      const academicUtme = appData.steps?.find((x: any) => x.step_key === 'academic_qualifications')?.payload?.utme;
      nextPayload = { utme: asUtme(nextPayload.utme, academicUtme || candidateUtme) };
    }
    if (steps[stepIndex].key === 'application_form' && !nextPayload.phone && auth?.user?.phone) {
      nextPayload = { ...nextPayload, phone: auth.user.phone };
    }
    if (steps[stepIndex].key === 'personal_details' && !nextPayload.country) {
      nextPayload = { ...nextPayload, country: 'Nigeria' };
    }
    if (steps[stepIndex].key === 'programme_selection') {
      nextPayload = withProgrammeChoiceIds(nextPayload, programs);
    }
    if (steps[stepIndex].key === 'direct_entry') {
      nextPayload = {
        ...emptyDirectEntry(appData?.jamb_registration || auth?.user?.jamb_registration),
        ...nextPayload,
        jamb_de_number: nextPayload.jamb_de_number || appData?.jamb_registration || auth?.user?.jamb_registration || '',
      };
    }
    if (steps[stepIndex].key === 'transfer_background') {
      nextPayload = { ...emptyTransferBackground(), ...nextPayload };
    }
    if (steps[stepIndex].key === 'pg_background') {
      nextPayload = {
        nysc_status: 'completed',
        professional_qualifications: [],
        ...nextPayload,
        prior_degrees: nextPayload.prior_degrees?.length ? nextPayload.prior_degrees : [{ degree_title: '', institution: '', field_of_study: '', class: 'second_lower', award_level: 'bachelor', year_awarded: '', country: 'Nigeria' }],
      };
    }
    if (steps[stepIndex].key === 'pg_research') {
      nextPayload = {
        research_interest: '',
        proposed_area: '',
        statement_of_purpose: '',
        publications: [],
        supervisor_preferences: [],
        ...nextPayload,
      };
    }
    if (steps[stepIndex].key === 'pg_referees') {
      nextPayload = {
        referees: nextPayload.referees?.length ? nextPayload.referees : [
          { name: '', email: '', institution: '', position: '', phone: '' },
          { name: '', email: '', institution: '', position: '', phone: '' },
        ],
      };
    }
    setPayload(nextPayload);
  };

  const goToStep = (stepIndex: number) => {
    if (!ninVerified && stepIndex > 0) {
      toast.warning('Verify your NIN before continuing to the rest of the form.');
      setIdx(0);
      return;
    }
    setIdx(stepIndex);
    applyStepPayload(app, stepIndex);
  };

  const save = async () => {
    setSaving(true);
    try {
      let body = payload;
      if (steps[idx].key === 'utme') {
        body = { utme: utmeForSave(payload.utme) };
      }
      if (steps[idx].key === 'academic_qualifications') {
        const cleanSitting = (sitting: any) => {
          if (!sitting) return null;
          const results = (sitting.results || []).filter((r: any) => Number(r.subject_id) > 0 && r.grade);
          return { ...sitting, results };
        };
        body = {
          first_sitting: cleanSitting(payload.first_sitting),
          second_sitting: cleanSitting(payload.second_sitting),
          other_qualifications: payload.other_qualifications || '',
        };
      }
      if (steps[idx].key === 'programme_selection') {
        const second = Number(payload.second_choice_program_id);
        body = {
          ...payload,
          first_choice_program_id: Number(payload.first_choice_program_id),
          second_choice_program_id: second || null,
          program_id: Number(payload.first_choice_program_id),
        };
      }
      if (steps[idx].key === 'transfer_background') {
        body = {
          ...payload,
          has_transfer_approval: !!payload.has_transfer_approval,
          credits_earned: payload.credits_earned === '' || payload.credits_earned == null ? null : Number(payload.credits_earned),
          cgpa: payload.cgpa === '' || payload.cgpa == null ? null : Number(payload.cgpa),
        };
      }
      const { data } = await api.post(`/api/applications/${app.id}/steps`, { step_key: steps[idx].key, payload: body });
      setApp(data);
      toast.success('Progress saved');
      const nextIndex = idx + 1;
      if (nextIndex < steps.length && (ninVerified || steps[nextIndex].key === 'biodata')) {
        setIdx(nextIndex);
        applyStepPayload(data, nextIndex);
      }
    } catch (e: any) {
      toast.error(apiErrorMessage(e, 'Could not save'));
    } finally {
      setSaving(false);
    }
  };

  const verifyNin = async (e?: FormEvent) => {
    e?.preventDefault();
    if (verifying || nin.length !== 11) return;
    setVerifying(true);
    try {
      const { data } = await api.post(`/api/applications/${app.id}/nin`, { nin: nin.trim() });
      toast.success(data?.live === false
        ? 'NIN accepted in demo mode. Identity is locked, but this was not a live Prembly check.'
        : 'NIN verified. Your identity details are now locked.');
      await load(app.id);
      await refresh();
    } catch (e: any) {
      toast.error(apiErrorMessage(e, 'NIN verification failed'));
    } finally {
      setVerifying(false);
    }
  };

  const submit = async () => {
    setSaving(true);
    try {
      await api.post(`/api/applications/${app.id}/steps`, { step_key: steps[idx].key, payload });
      const { data } = await api.post(`/api/applications/${app.id}/submit`);
      setApp(data);
      await refresh();
      toast.success('Application submitted for screening');
      navigate('/status', { replace: true });
    } catch (e: any) {
      toast.error(apiErrorMessage(e, 'Submit failed'));
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
  if (!['fee_paid', 'form_in_progress'].includes(app.stage)) return <Navigate to="/status" replace />;
  if (app.application_fee_invoice && app.application_fee_invoice.status !== 'paid') {
    return <Navigate to="/apply" replace />;
  }

  const step = steps[idx] ?? steps[0];
  if (!step) {
    return <Alert tone="error">Could not load application steps. <Link to="/apply" className="text-sky-600 underline">Back to apply</Link></Alert>;
  }
  const firstSitting: OlevelSitting = payload.first_sitting || emptySitting();
  const secondSitting: OlevelSitting = payload.second_sitting || { ...emptySitting(), results: [] };
  const bio = biodataPayload(app);
  const passportUrl = storageUrl(bio.photo_path || payload.photo_path) || auth?.nin_identity?.photo_url || null;
  const nyscStatus = app?.steps?.find((s: any) => s.step_key === 'pg_background')?.payload?.nysc_status;
  const requiredDocs = requiredDocumentsFor(app?.entry_mode, nyscStatus);
  const eligibility = app?.eligibility;
  const firstChoiceProgram = programs.find((p: any) => p.id === Number(payload.first_choice_program_id || app.program_id));
  const uploadedDocTypes = new Set((app?.documents || []).map((d: any) => d.doc_type));
  const docByType = (key: string) => (app?.documents || []).find((d: any) => d.doc_type === key);

  const isStepComplete = (index: number) => {
    const key = steps[index].key;
    const status = app.steps?.find((x: any) => x.step_key === key)?.status;
    return status && status !== 'pending';
  };

  const setField = (key: string, value: string | boolean) => {
    setPayload((prev: any) => ({ ...prev, [key]: value }));
  };

  const departmentsFor = (collegeId: number | string) => {
    const id = Number(collegeId);
    if (!id) return [];
    const college = colleges.find((c) => Number(c.id) === id);
    const fromCollege = uniqueNamedOptions(
      (college?.departments || []).map((d: any) => ({
        value: Number(d.id || 0),
        label: d.name || '',
      })),
    );
    if (fromCollege.length) return fromCollege;
    return uniqueNamedOptions(
      programs
        .filter((p) => facultyIdOf(p) === id)
        .map((p) => ({
          value: Number(departmentIdOf(p) || 0),
          label: p.department?.name || '',
        })),
    );
  };

  const programsFor = (departmentId: number | string, excludeId?: number) => {
    const id = Number(departmentId);
    if (!id) return [];
    return programs.filter((p) => departmentIdOf(p) === id && p.id !== excludeId);
  };

  const programOptionLabel = (p: any) => `${p.name}${p.duration_years ? ` (${p.duration_years} years)` : ''}`;
  const eligibilityBlock = (p: any) => {
    if (!p?.eligibility) return null;
    const failed = p.eligibility.failed || [];
    const note = p.eligibility.requirements?.qualifying_note || p.eligibility.requirements?.notes;
    return (
      <div className={`mt-2 text-sm ${p.eligibility.meets ? 'text-emerald-700' : 'text-amber-700'}`}>
        <p className="font-medium">{p.eligibility.meets ? 'Meets eligibility' : 'Does not meet eligibility'}</p>
        {note && <p className="text-slate-600">{note}</p>}
        {!p.eligibility.meets && failed.length > 0 && (
          <ul className="mt-1 list-disc pl-5">
            {failed.map((item: any) => <li key={item.rule}>{item.message}</li>)}
          </ul>
        )}
        <p className="text-xs text-slate-500 mt-1">You can still select this programme and submit.</p>
      </div>
    );
  };

  const updateSittingMeta = (sitting: 'first_sitting' | 'second_sitting', field: keyof OlevelSitting, value: string) => {
    setPayload((prev: any) => ({
      ...prev,
      [sitting]: {
        ...(prev[sitting] || emptySitting()),
        [field]: value,
      },
    }));
  };

  const addOlevelRow = (sitting: 'first_sitting' | 'second_sitting') => {
    setPayload((prev: any) => {
      const current = prev[sitting] || emptySitting();
      return {
        ...prev,
        [sitting]: {
          ...current,
          results: [...(current.results || []), { subject_id: 0, subject_name: '', grade: '' }],
        },
      };
    });
  };

  const updateOlevelRow = (sitting: 'first_sitting' | 'second_sitting', index: number, field: keyof OlevelResult, value: string | number) => {
    setPayload((prev: any) => {
      const current = prev[sitting] || emptySitting();
      const results = (current.results || []).map((row: OlevelResult, i: number) => {
        if (i !== index) return row;
        if (field === 'subject_id') {
          const subject = olevelSubjects.find((s) => s.id === Number(value));
          return { ...row, subject_id: Number(value), subject_name: subject?.name || '' };
        }
        return { ...row, [field]: value };
      });
      return { ...prev, [sitting]: { ...current, results } };
    });
  };

  const removeOlevelRow = (sitting: 'first_sitting' | 'second_sitting', index: number) => {
    setPayload((prev: any) => {
      const current = prev[sitting] || emptySitting();
      return {
        ...prev,
        [sitting]: {
          ...current,
          results: (current.results || []).filter((_: OlevelResult, i: number) => i !== index),
        },
      };
    });
  };

  const enableSecondSitting = () => {
    setPayload((prev: any) => ({
      ...prev,
      second_sitting: emptySitting(),
    }));
  };

  const clearSecondSitting = () => {
    setPayload((prev: any) => ({
      ...prev,
      second_sitting: { ...emptySitting(), results: [] },
    }));
  };

  const updateUtme = (field: 'aggregate' | 'course_choice' | 'exam_year', value: string) => {
    setPayload((prev: any) => ({
      ...prev,
      utme: { ...asUtme(prev.utme), [field]: value },
    }));
  };

  const updateUtmeChoice = (index: number, field: 'institution_name' | 'programme_name', value: string) => {
    setPayload((prev: any) => {
      const utme = asUtme(prev.utme);
      const institution_choices = utme.institution_choices.map((row, i) => i === index ? { ...row, [field]: value } : row);
      return { ...prev, utme: { ...utme, institution_choices } };
    });
  };

  const updateUtmeSubject = (index: number, field: 'subject' | 'score', value: string) => {
    setPayload((prev: any) => {
      const utme = asUtme(prev.utme);
      const subjects = utme.subjects.map((row, i) => i === index ? { ...row, [field]: value } : row);
      return { ...prev, utme: { ...utme, subjects } };
    });
  };

  const addUtmeSubject = () => {
    setPayload((prev: any) => {
      const utme = asUtme(prev.utme);
      return { ...prev, utme: { ...utme, subjects: [...utme.subjects, { subject: '', score: '' }] } };
    });
  };

  const removeUtmeSubject = (index: number) => {
    setPayload((prev: any) => {
      const utme = asUtme(prev.utme);
      return { ...prev, utme: { ...utme, subjects: utme.subjects.filter((_, i) => i !== index) } };
    });
  };

  const renderSitting = (key: 'first_sitting' | 'second_sitting', title: string, sitting: OlevelSitting, optional = false) => (
    <FormSection title={title} description={optional ? 'Optional — add only if you have a second sitting.' : "Enter your O'Level exam details and subject grades."}>
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor={`${key}_exam_type`}>Exam type</Label>
            <select id={`${key}_exam_type`} className={selectClass} value={sitting.exam_type || ''} onChange={(e) => updateSittingMeta(key, 'exam_type', e.target.value)}>
              <option value="">Select</option>
              {OLEVEL_EXAM_TYPES.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor={`${key}_exam_year`}>Exam year</Label>
            <select id={`${key}_exam_year`} className={selectClass} value={sitting.exam_year || ''} onChange={(e) => updateSittingMeta(key, 'exam_year', e.target.value)}>
              <option value="">Select year</option>
              {OLEVEL_YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor={`${key}_exam_number`}>Exam number</Label>
            <Input id={`${key}_exam_number`} value={sitting.exam_number || ''} onChange={(e) => updateSittingMeta(key, 'exam_number', e.target.value)} placeholder="e.g. 1234567890" />
          </div>
          <div>
            <Label htmlFor={`${key}_exam_center`}>Exam centre</Label>
            <Input id={`${key}_exam_center`} value={sitting.exam_center || ''} onChange={(e) => updateSittingMeta(key, 'exam_center', e.target.value)} placeholder="Centre name / town" />
          </div>
        </div>
        {(sitting.results || []).map((row, index) => (
          <div key={index} className="flex flex-col sm:flex-row gap-2 items-start sm:items-center p-3 rounded-xl border border-slate-100 bg-slate-50/50">
            <select className={`${selectClass} flex-1`} value={row.subject_id || ''} onChange={(e) => updateOlevelRow(key, index, 'subject_id', e.target.value)}>
              <option value="">Select subject</option>
              {olevelSubjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select className={`${selectClass} w-full sm:w-28`} value={row.grade} onChange={(e) => updateOlevelRow(key, index, 'grade', e.target.value)}>
              <option value="">Grade</option>
              {OLEVEL_GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
            <Button type="button" onClick={() => removeOlevelRow(key, index)} className="text-rose-700 hover:bg-rose-50 shrink-0">Remove</Button>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => addOlevelRow(key)} className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm">Add subject</Button>
          {optional && (
            <Button type="button" onClick={clearSecondSitting} className="text-slate-600 hover:bg-slate-50">Clear second sitting</Button>
          )}
        </div>
      </div>
    </FormSection>
  );

  const uploadRequiredDoc = async (docType: string, file: File) => {
    setUploadingDoc(docType);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('doc_type', docType);
      await api.post(`/api/applications/${app.id}/documents`, fd);
      const docsIdx = steps.findIndex((s) => s.key === 'required_documents');
      const { data } = await api.get(`/api/applications/${app.id}`);
      setApp(data);
      if (docsIdx >= 0) {
        setIdx(docsIdx);
        applyStepPayload(data, docsIdx);
      }
      toast.success('Document uploaded');
    } catch (e: any) {
      toast.error(apiErrorMessage(e, 'Could not upload document'));
    } finally {
      setUploadingDoc(null);
    }
  };

  const openFormPrint = async () => {
    setPrintLoading(true);
    try {
      const { data } = await api.get(`/api/applications/${app.id}/form-print`, { responseType: 'text' });
      setPrintHtml(data);
    } catch (e: any) {
      toast.error(apiErrorMessage(e, 'Could not open application form printout.'));
    } finally {
      setPrintLoading(false);
    }
  };

  const printFormFrame = () => {
    const frame = document.getElementById('wizard-form-frame') as HTMLIFrameElement | null;
    frame?.contentWindow?.focus();
    frame?.contentWindow?.print();
  };

  const downloadFormPrint = () => {
    if (!printHtml) return;
    const blob = new Blob([printHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'application-form.html';
    a.click();
    URL.revokeObjectURL(url);
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
        {eligibility && app.entry_mode === 'pg' && app.program_id && (
          <Alert tone={eligibility.meets ? 'success' : 'warning'}>
            <p className="font-medium">{eligibility.meets ? 'Meets eligibility' : 'Does not meet eligibility'}</p>
            {!eligibility.meets && (
              <ul className="mt-2 list-disc pl-5 text-sm">
                {(eligibility.failed || []).map((item: any) => (
                  <li key={item.rule}>{item.message}</li>
                ))}
              </ul>
            )}
          </Alert>
        )}
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
                <FormSection title="Identity details" description="Retrieved from NIMC and cannot be edited. Continue to personal details next.">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {IDENTITY_FIELDS.map((field) => (
                      <div key={field.key}>
                        <Label htmlFor={field.key}>{field.label}</Label>
                        <Input
                          id={field.key}
                          readOnly
                          className="bg-slate-50 text-slate-700"
                          value={field.key === 'date_of_birth' ? formatDate(payload[field.key] || bio[field.key]) : (payload[field.key] || bio[field.key] || '')}
                        />
                      </div>
                    ))}
                  </div>
                </FormSection>
              </>
            )}
          </>
        )}

        {step.key === 'personal_details' && (
          <FormSection title="Personal details" description="Additional biodata required for your application file.">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="marital_status">Marital status</Label>
                <select id="marital_status" className={selectClass} value={payload.marital_status || ''} onChange={(e) => setField('marital_status', e.target.value)}>
                  <option value="">Select</option>
                  {MARITAL_STATUSES.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <Label htmlFor="religion">Religion</Label>
                <select id="religion" className={selectClass} value={payload.religion || ''} onChange={(e) => setField('religion', e.target.value)}>
                  <option value="">Select</option>
                  {RELIGIONS.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <Label htmlFor="country">Country</Label>
                <select
                  id="country"
                  className={selectClass}
                  value={payload.country || ''}
                  onChange={(e) => {
                    const country = e.target.value;
                    setPayload((prev: any) => ({
                      ...prev,
                      country,
                      state: '',
                      state_id: null,
                      lga: '',
                      lga_id: null,
                    }));
                  }}
                >
                  <option value="">Select</option>
                  <option value="Nigeria">Nigeria</option>
                  <option value="Non-Nigeria">Non-Nigeria</option>
                </select>
              </div>
              <div>
                <Label htmlFor="state">{payload.country === 'Non-Nigeria' ? 'State / Province' : 'State of origin'}</Label>
                {payload.country === 'Nigeria' ? (
                  <select
                    id="state"
                    className={selectClass}
                    value={payload.state_id || ''}
                    onChange={(e) => {
                      const stateId = Number(e.target.value) || null;
                      const selected = states.find((s) => s.state_id === stateId);
                      setPayload((prev: any) => ({
                        ...prev,
                        state_id: stateId,
                        state: selected?.state_title || '',
                        lga: '',
                        lga_id: null,
                      }));
                    }}
                  >
                    <option value="">Select state</option>
                    {states.map((s) => (
                      <option key={s.state_id} value={s.state_id}>{s.state_title}</option>
                    ))}
                  </select>
                ) : (
                  <Input
                    id="state"
                    value={payload.state || ''}
                    onChange={(e) => setPayload((prev: any) => ({ ...prev, state: e.target.value, state_id: null }))}
                    placeholder="Enter state or province"
                    disabled={payload.country !== 'Non-Nigeria'}
                  />
                )}
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="lga">{payload.country === 'Non-Nigeria' ? 'City / Area' : 'LGA'}</Label>
                {payload.country === 'Nigeria' ? (
                  <select
                    id="lga"
                    className={selectClass}
                    value={payload.lga_id || ''}
                    disabled={!payload.state_id || loadingLgas}
                    onChange={(e) => {
                      const lgaId = Number(e.target.value) || null;
                      const selected = lgas.find((l) => l.lga_id === lgaId);
                      setPayload((prev: any) => ({
                        ...prev,
                        lga_id: lgaId,
                        lga: selected?.lga_title || '',
                      }));
                    }}
                  >
                    <option value="">{loadingLgas ? 'Loading LGAs…' : !payload.state_id ? 'Select a state first' : 'Select LGA'}</option>
                    {lgas.map((l) => (
                      <option key={l.lga_id} value={l.lga_id}>{l.lga_title}</option>
                    ))}
                  </select>
                ) : (
                  <Input
                    id="lga"
                    value={payload.lga || ''}
                    onChange={(e) => setPayload((prev: any) => ({ ...prev, lga: e.target.value, lga_id: null }))}
                    placeholder="Enter city or area"
                    disabled={payload.country !== 'Non-Nigeria'}
                  />
                )}
              </div>
            </div>
          </FormSection>
        )}

        {step.key === 'health_information' && (
          <FormSection title="Health information" description="Medical details used for campus clinic records.">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="blood_group">Blood group</Label>
                <select id="blood_group" className={selectClass} value={payload.blood_group || ''} onChange={(e) => setField('blood_group', e.target.value)}>
                  <option value="">Select</option>
                  {BLOOD_GROUPS.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <Label htmlFor="genotype">Genotype</Label>
                <select id="genotype" className={selectClass} value={payload.genotype || ''} onChange={(e) => setField('genotype', e.target.value)}>
                  <option value="">Select</option>
                  {GENOTYPES.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <Label>Medical condition / disabilities</Label>
                <div className="mt-2 flex gap-4 text-sm">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="has_medical_condition" checked={payload.has_medical_condition === true} onChange={() => setField('has_medical_condition', true)} />
                    Yes
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="has_medical_condition" checked={payload.has_medical_condition === false} onChange={() => setField('has_medical_condition', false)} />
                    No
                  </label>
                </div>
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="medical_condition_details">Health condition details</Label>
                <textarea
                  id="medical_condition_details"
                  className={selectClass}
                  rows={3}
                  placeholder={payload.has_medical_condition ? 'Describe the condition or disability' : 'Optional — leave blank if none'}
                  value={payload.medical_condition_details || ''}
                  onChange={(e) => setField('medical_condition_details', e.target.value)}
                />
              </div>
            </div>
          </FormSection>
        )}

        {step.key === 'next_of_kin' && (
          <FormSection title="Next of kin" description="Primary emergency contact for admissions and campus emergencies.">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="next_of_kin">Name</Label>
                <Input id="next_of_kin" value={payload.next_of_kin || ''} onChange={(e) => setField('next_of_kin', e.target.value)} />
              </div>
              <div>
                <Label htmlFor="next_of_kin_relationship">Relationship</Label>
                <select id="next_of_kin_relationship" className={selectClass} value={payload.next_of_kin_relationship || ''} onChange={(e) => setField('next_of_kin_relationship', e.target.value)}>
                  <option value="">Select</option>
                  {RELATIONSHIPS.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <Label htmlFor="next_of_kin_phone">Phone number</Label>
                <Input id="next_of_kin_phone" type="tel" value={payload.next_of_kin_phone || ''} onChange={(e) => setField('next_of_kin_phone', e.target.value)} />
              </div>
              <div>
                <Label htmlFor="next_of_kin_email">Email</Label>
                <Input id="next_of_kin_email" type="email" value={payload.next_of_kin_email || ''} onChange={(e) => setField('next_of_kin_email', e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="next_of_kin_address">Address</Label>
                <textarea id="next_of_kin_address" className={selectClass} rows={3} value={payload.next_of_kin_address || ''} onChange={(e) => setField('next_of_kin_address', e.target.value)} />
              </div>
            </div>
          </FormSection>
        )}

        {step.key === 'sponsor' && (
          <FormSection title="Sponsor" description="Person responsible for funding your studies.">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="sponsor_name">Name</Label>
                <Input id="sponsor_name" value={payload.sponsor_name || ''} onChange={(e) => setField('sponsor_name', e.target.value)} />
              </div>
              <div>
                <Label htmlFor="sponsor_relationship">Relationship</Label>
                <select id="sponsor_relationship" className={selectClass} value={payload.sponsor_relationship || ''} onChange={(e) => setField('sponsor_relationship', e.target.value)}>
                  <option value="">Select</option>
                  {RELATIONSHIPS.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <Label htmlFor="sponsor_phone">Phone number</Label>
                <Input id="sponsor_phone" type="tel" value={payload.sponsor_phone || ''} onChange={(e) => setField('sponsor_phone', e.target.value)} />
              </div>
              <div>
                <Label htmlFor="sponsor_email">Email</Label>
                <Input id="sponsor_email" type="email" value={payload.sponsor_email || ''} onChange={(e) => setField('sponsor_email', e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="sponsor_address">Address</Label>
                <textarea id="sponsor_address" className={selectClass} rows={3} value={payload.sponsor_address || ''} onChange={(e) => setField('sponsor_address', e.target.value)} />
              </div>
            </div>
          </FormSection>
        )}

        {step.key === 'application_form' && (
          <FormSection title="Contact & declaration" description="Confirm how we can reach you and accept the declaration.">
            <div className="grid grid-cols-1 gap-4 max-w-xl">
              <div>
                <Label htmlFor="email_display">Email</Label>
                <Input id="email_display" readOnly className="bg-slate-50 text-slate-700" value={auth?.user?.email || ''} />
              </div>
              <div>
                <Label htmlFor="jamb_display">{app?.entry_mode === 'de' ? 'JAMB Direct Entry no.' : 'JAMB registration no.'}</Label>
                <Input id="jamb_display" readOnly className="bg-slate-50 text-slate-700" value={app?.jamb_registration || auth?.user?.jamb_registration || '—'} />
              </div>
              <div>
                <Label htmlFor="phone">Phone number</Label>
                <Input id="phone" type="tel" value={payload.phone || auth?.user?.phone || ''} onChange={(e) => setField('phone', e.target.value)} />
              </div>
              <div>
                <Label htmlFor="address">Address</Label>
                <textarea id="address" className={selectClass} placeholder="Residential address" rows={3} value={payload.address || ''} onChange={(e) => setField('address', e.target.value)} />
              </div>
              <label className="flex gap-3 items-start rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-sm cursor-pointer">
                <input type="checkbox" className="mt-0.5" checked={!!payload.declaration} onChange={(e) => setField('declaration', e.target.checked)} />
                <span>I confirm that all information provided in this application is true and complete.</span>
              </label>
            </div>
          </FormSection>
        )}

        {step.key === 'academic_qualifications' && (
          <div className="space-y-6">
            {app.entry_mode === 'utme' && (
              <FormSection
                title="JAMB information"
                description="Enter your UTME year, aggregate, course choice, four subject scores, and JAMB institution choices. Values from the admission list are filled in when available."
              >
                <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="utme_exam_year">Examination year</Label>
                    <select
                      id="utme_exam_year"
                      className={selectClass}
                      value={payload.utme?.exam_year || ''}
                      onChange={(e) => updateUtme('exam_year', e.target.value)}
                    >
                      <option value="">Select year</option>
                      {OLEVEL_YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="utme_aggregate">Aggregate</Label>
                    <Input
                      id="utme_aggregate"
                      value={payload.utme?.aggregate || ''}
                      onChange={(e) => updateUtme('aggregate', e.target.value)}
                      placeholder="e.g. 248.12"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor="utme_course_choice">Programme choice (JAMB)</Label>
                    <Input
                      id="utme_course_choice"
                      value={payload.utme?.course_choice || ''}
                      onChange={(e) => updateUtme('course_choice', e.target.value)}
                      placeholder="Programme chosen in JAMB"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-800">Subject scores</p>
                  {(payload.utme?.subjects || emptyUtme().subjects).map((row: any, index: number) => (
                    <div key={index} className="grid grid-cols-[minmax(0,1fr)_5.75rem_auto] gap-2 items-center">
                      <select
                        className={`${selectClass} min-w-0`}
                        value={row.subject || ''}
                        onChange={(e) => updateUtmeSubject(index, 'subject', e.target.value)}
                      >
                        <option value="">Select subject</option>
                        {olevelSubjects.map((s) => (
                          <option key={s.id} value={s.name}>{s.name}</option>
                        ))}
                        {row.subject && !olevelSubjects.some((s) => s.name === row.subject) && (
                          <option value={row.subject}>{row.subject}</option>
                        )}
                      </select>
                      <Input
                        placeholder="Score"
                        value={row.score || ''}
                        onChange={(e) => updateUtmeSubject(index, 'score', e.target.value)}
                      />
                      <Button type="button" onClick={() => removeUtmeSubject(index)} className="text-rose-700 hover:bg-rose-50 shrink-0">
                        Remove
                      </Button>
                    </div>
                  ))}
                  <Button type="button" onClick={addUtmeSubject} className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm">
                    Add subject
                  </Button>
                </div>
                <div className="space-y-3">
                  <p className="text-sm font-medium text-slate-800">JAMB institution choices</p>
                  {(payload.utme?.institution_choices || emptyUtmeChoices()).map((row: UtmeChoice, index: number) => (
                    <div key={index} className="grid grid-cols-1 sm:grid-cols-[4.5rem_minmax(0,1fr)_minmax(0,1fr)] gap-2 items-end">
                      <div>
                        <Label>{index === 0 ? 'Choice' : ' '}</Label>
                        <Input value={String(row.choice_order)} disabled className="bg-slate-50" />
                      </div>
                      <div>
                        {index === 0 && <Label>Institution</Label>}
                        {index > 0 && <span className="sr-only">Institution</span>}
                        <Input
                          value={row.institution_name}
                          onChange={(e) => updateUtmeChoice(index, 'institution_name', e.target.value)}
                          placeholder={index === 0 ? 'First choice university' : `${index + 1}${index === 1 ? 'nd' : index === 2 ? 'rd' : 'th'} choice`}
                        />
                      </div>
                      <div>
                        {index === 0 && <Label>Programme</Label>}
                        {index > 0 && <span className="sr-only">Programme</span>}
                        <Input
                          value={row.programme_name}
                          onChange={(e) => updateUtmeChoice(index, 'programme_name', e.target.value)}
                          placeholder="Programme at this institution"
                        />
                      </div>
                    </div>
                  ))}
                </div>
                </div>
              </FormSection>
            )}

            {renderSitting('first_sitting', "O'Level — First sitting", firstSitting)}

            {(secondSitting.results?.length || secondSitting.exam_type || secondSitting.exam_number) ? (
              renderSitting('second_sitting', "O'Level — Second sitting", secondSitting, true)
            ) : (
              <Button type="button" onClick={enableSecondSitting} className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm">
                Add second sitting
              </Button>
            )}

            <div>
              <Label htmlFor="other_qualifications">Other qualifications (optional)</Label>
              <textarea
                id="other_qualifications"
                className={selectClass}
                rows={3}
                placeholder="Any other academic qualifications"
                value={payload.other_qualifications || ''}
                onChange={(e) => setPayload({ ...payload, other_qualifications: e.target.value })}
              />
            </div>
          </div>
        )}

        {step.key === 'direct_entry' && (
          <FormSection title="Direct Entry qualification" description="Provide the award you are using for Direct Entry and the level you want to enter.">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="jamb_de_number">JAMB DE number</Label>
                <Input
                  id="jamb_de_number"
                  value={payload.jamb_de_number || app?.jamb_registration || ''}
                  onChange={(e) => setField('jamb_de_number', e.target.value.toUpperCase())}
                  placeholder="e.g. 20261234AB"
                />
              </div>
              <div>
                <Label htmlFor="previous_institution">Previous institution</Label>
                <Input id="previous_institution" value={payload.previous_institution || ''} onChange={(e) => setField('previous_institution', e.target.value)} />
              </div>
              <div>
                <Label htmlFor="qualification_type">Qualification</Label>
                <select id="qualification_type" className={selectClass} value={payload.qualification_type || 'nd'} onChange={(e) => setField('qualification_type', e.target.value)}>
                  {DE_QUALIFICATION_TYPES.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>
              <div>
                <Label htmlFor="qualification_title">Qualification title</Label>
                <Input id="qualification_title" value={payload.qualification_title || ''} onChange={(e) => setField('qualification_title', e.target.value)} placeholder="e.g. ND Computer Science" />
              </div>
              <div>
                <Label htmlFor="qualification_class">Class / grade</Label>
                <select id="qualification_class" className={selectClass} value={payload.qualification_class || 'upper_credit'} onChange={(e) => setField('qualification_class', e.target.value)}>
                  {DE_CLASSIFICATIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>
              <div>
                <Label htmlFor="qualification_year">Year awarded</Label>
                <select id="qualification_year" className={selectClass} value={payload.qualification_year || ''} onChange={(e) => setField('qualification_year', e.target.value)}>
                  <option value="">Select year</option>
                  {OLEVEL_YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div>
                <Label htmlFor="de_programme">Qualifying programme</Label>
                <Input id="de_programme" value={payload.programme || ''} onChange={(e) => setField('programme', e.target.value)} />
              </div>
              <div>
                <Label htmlFor="requested_entry_level">Requested entry level</Label>
                <select id="requested_entry_level" className={selectClass} value={payload.requested_entry_level || '200'} onChange={(e) => setField('requested_entry_level', e.target.value)}>
                  {DE_ENTRY_LEVELS.map((level) => <option key={level} value={level}>{level} Level</option>)}
                </select>
              </div>
            </div>
          </FormSection>
        )}

        {step.key === 'transfer_background' && (
          <FormSection title="Transfer details" description="This information is used for credit and academic evaluation before admission.">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="previous_university">Previous university</Label>
                <Input id="previous_university" value={payload.previous_university || ''} onChange={(e) => setField('previous_university', e.target.value)} />
              </div>
              <div>
                <Label htmlFor="previous_programme">Previous programme</Label>
                <Input id="previous_programme" value={payload.previous_programme || ''} onChange={(e) => setField('previous_programme', e.target.value)} />
              </div>
              <div>
                <Label htmlFor="previous_student_id">Previous student ID</Label>
                <Input id="previous_student_id" value={payload.previous_student_id || ''} onChange={(e) => setField('previous_student_id', e.target.value)} />
              </div>
              <div>
                <Label htmlFor="credits_earned">Credits earned</Label>
                <Input id="credits_earned" type="number" min="0" value={payload.credits_earned || ''} onChange={(e) => setField('credits_earned', e.target.value)} />
              </div>
              <div>
                <Label htmlFor="cgpa">CGPA</Label>
                <Input id="cgpa" type="number" min="0" max="5" step="0.01" value={payload.cgpa || ''} onChange={(e) => setField('cgpa', e.target.value)} />
              </div>
              <div>
                <Label htmlFor="transfer_entry_level">Requested entry level</Label>
                <select id="transfer_entry_level" className={selectClass} value={payload.requested_entry_level || '200'} onChange={(e) => setField('requested_entry_level', e.target.value)}>
                  {TRANSFER_ENTRY_LEVELS.map((level) => <option key={level} value={level}>{level} Level</option>)}
                </select>
              </div>
              <div>
                <Label htmlFor="has_transfer_approval">Transfer approval</Label>
                <select
                  id="has_transfer_approval"
                  className={selectClass}
                  value={payload.has_transfer_approval ? 'yes' : 'no'}
                  onChange={(e) => setPayload((prev: any) => ({ ...prev, has_transfer_approval: e.target.value === 'yes' }))}
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </div>
              <div>
                <Label htmlFor="approval_reference">Approval reference (optional)</Label>
                <Input id="approval_reference" value={payload.approval_reference || ''} onChange={(e) => setField('approval_reference', e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="reason_for_transfer">Reason for transfer</Label>
                <textarea id="reason_for_transfer" className={selectClass} rows={4} value={payload.reason_for_transfer || ''} onChange={(e) => setField('reason_for_transfer', e.target.value)} />
              </div>
            </div>
          </FormSection>
        )}

        {step.key === 'pg_background' && (
          <div className="space-y-6">
            <FormSection title="First degree" description="List your qualifying degree. Add another row for a second award (e.g. Masters).">
              {(payload.prior_degrees || []).map((row: any, index: number) => (
                <div key={index} className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-slate-200 p-4">
                  <div>
                    <Label>Degree title</Label>
                    <Input value={row.degree_title || ''} onChange={(e) => {
                      const prior_degrees = [...payload.prior_degrees];
                      prior_degrees[index] = { ...row, degree_title: e.target.value };
                      setPayload({ ...payload, prior_degrees });
                    }} />
                  </div>
                  <div>
                    <Label>Institution</Label>
                    <Input value={row.institution || ''} onChange={(e) => {
                      const prior_degrees = [...payload.prior_degrees];
                      prior_degrees[index] = { ...row, institution: e.target.value };
                      setPayload({ ...payload, prior_degrees });
                    }} />
                  </div>
                  <div>
                    <Label>Field of study</Label>
                    <Input value={row.field_of_study || ''} onChange={(e) => {
                      const prior_degrees = [...payload.prior_degrees];
                      prior_degrees[index] = { ...row, field_of_study: e.target.value };
                      setPayload({ ...payload, prior_degrees });
                    }} />
                  </div>
                  <div>
                    <Label>Classification</Label>
                    <select className={selectClass} value={row.class || 'second_lower'} onChange={(e) => {
                      const prior_degrees = [...payload.prior_degrees];
                      prior_degrees[index] = { ...row, class: e.target.value };
                      setPayload({ ...payload, prior_degrees });
                    }}>
                      <option value="first">First Class</option>
                      <option value="second_upper">Second Class Upper</option>
                      <option value="second_lower">Second Class Lower</option>
                      <option value="third">Third Class</option>
                      <option value="pass">Pass</option>
                      <option value="distinction">Distinction</option>
                      <option value="merit">Merit</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <Label>Award level</Label>
                    <select className={selectClass} value={row.award_level || 'bachelor'} onChange={(e) => {
                      const prior_degrees = [...payload.prior_degrees];
                      prior_degrees[index] = { ...row, award_level: e.target.value };
                      setPayload({ ...payload, prior_degrees });
                    }}>
                      <option value="bachelor">Bachelor</option>
                      <option value="pgd">Postgraduate diploma</option>
                      <option value="masters">Masters</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <Label>Year awarded</Label>
                    <Input value={row.year_awarded || ''} onChange={(e) => {
                      const prior_degrees = [...payload.prior_degrees];
                      prior_degrees[index] = { ...row, year_awarded: e.target.value };
                      setPayload({ ...payload, prior_degrees });
                    }} />
                  </div>
                </div>
              ))}
              <Button type="button" onClick={() => setPayload({ ...payload, prior_degrees: [...(payload.prior_degrees || []), { degree_title: '', institution: '', class: 'second_lower', award_level: 'bachelor', year_awarded: '' }] })} className="bg-white border border-slate-200">
                Add another degree
              </Button>
            </FormSection>
            <FormSection title="NYSC" description="Required unless it does not apply to you.">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Status</Label>
                  <select className={selectClass} value={payload.nysc_status || 'completed'} onChange={(e) => setPayload({ ...payload, nysc_status: e.target.value })}>
                    <option value="completed">Completed (discharge)</option>
                    <option value="exempted">Exempted</option>
                    <option value="not_applicable">Not applicable</option>
                  </select>
                </div>
                <div>
                  <Label>Certificate / exemption number</Label>
                  <Input value={payload.nysc_number || ''} onChange={(e) => setPayload({ ...payload, nysc_number: e.target.value })} />
                </div>
                <div>
                  <Label>Year</Label>
                  <Input value={payload.nysc_year || ''} onChange={(e) => setPayload({ ...payload, nysc_year: e.target.value })} />
                </div>
                <div>
                  <Label>Exemption / N/A reason</Label>
                  <Input value={payload.nysc_exemption_reason || ''} onChange={(e) => setPayload({ ...payload, nysc_exemption_reason: e.target.value })} />
                </div>
              </div>
            </FormSection>
            <div>
              <Label>Other notes (optional)</Label>
              <textarea className={selectClass} rows={3} value={payload.other_qualifications || ''} onChange={(e) => setPayload({ ...payload, other_qualifications: e.target.value })} />
            </div>
          </div>
        )}

        {step.key === 'pg_research' && (
          <FormSection title="Research and statement of purpose">
            <div className="space-y-4">
              <div>
                <Label>Research interest</Label>
                <textarea className={selectClass} rows={3} value={payload.research_interest || ''} onChange={(e) => setPayload({ ...payload, research_interest: e.target.value })} />
              </div>
              <div>
                <Label>Proposed research area</Label>
                <Input value={payload.proposed_area || ''} onChange={(e) => setPayload({ ...payload, proposed_area: e.target.value })} />
              </div>
              <div>
                <Label>Statement of purpose</Label>
                <textarea className={selectClass} rows={6} value={payload.statement_of_purpose || ''} onChange={(e) => setPayload({ ...payload, statement_of_purpose: e.target.value })} />
              </div>
              {firstChoiceProgram?.is_research_degree && (
                <div>
                  <Label>Preferred supervisors</Label>
                  <select
                    multiple
                    className={selectClass}
                    value={(payload.supervisor_preferences || []).map(String)}
                    onChange={(e) => {
                      const selected = Array.from(e.target.selectedOptions).map((o) => Number(o.value));
                      setPayload({ ...payload, supervisor_preferences: selected });
                    }}
                  >
                    {supervisors.map((s) => (
                      <option key={s.id} value={s.id}>{s.title ? `${s.title} ` : ''}{s.user?.name || `Staff #${s.id}`}</option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 mt-1">Hold Ctrl to select more than one. Required for research degrees.</p>
                </div>
              )}
            </div>
          </FormSection>
        )}

        {step.key === 'pg_referees' && (
          <FormSection title="Referees" description="We will email each referee a private link to upload a recommendation letter. You can submit while letters are still pending.">
            <div className="space-y-4">
              {(payload.referees || []).map((row: any, index: number) => (
                <div key={index} className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-slate-200 p-4">
                  <div>
                    <Label>Name</Label>
                    <Input value={row.name || ''} onChange={(e) => {
                      const referees = [...payload.referees];
                      referees[index] = { ...row, name: e.target.value };
                      setPayload({ ...payload, referees });
                    }} />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input type="email" value={row.email || ''} onChange={(e) => {
                      const referees = [...payload.referees];
                      referees[index] = { ...row, email: e.target.value };
                      setPayload({ ...payload, referees });
                    }} />
                  </div>
                  <div>
                    <Label>Institution</Label>
                    <Input value={row.institution || ''} onChange={(e) => {
                      const referees = [...payload.referees];
                      referees[index] = { ...row, institution: e.target.value };
                      setPayload({ ...payload, referees });
                    }} />
                  </div>
                  <div>
                    <Label>Position</Label>
                    <Input value={row.position || ''} onChange={(e) => {
                      const referees = [...payload.referees];
                      referees[index] = { ...row, position: e.target.value };
                      setPayload({ ...payload, referees });
                    }} />
                  </div>
                </div>
              ))}
              {(app.referee_invites || []).length > 0 && (
                <ul className="text-sm text-slate-600 space-y-1">
                  {app.referee_invites.map((invite: any) => (
                    <li key={invite.id}>{invite.name} — {invite.status}</li>
                  ))}
                </ul>
              )}
            </div>
          </FormSection>
        )}

        {step.key === 'programme_selection' && (
          <FormSection title="Programme selection" description="Choose college, then department, then programme. Second choice is optional.">
            <div className="grid grid-cols-1 gap-8 max-w-xl">
              <div className="space-y-4">
                <p className="text-sm font-semibold text-slate-800">First choice</p>
                <div>
                  <Label htmlFor="first_choice_college_id">College</Label>
                  <select
                    id="first_choice_college_id"
                    className={selectClass}
                    value={payload.first_choice_college_id || ''}
                    onChange={(e) => {
                      const collegeId = Number(e.target.value) || '';
                      setPayload((prev: any) => ({
                        ...prev,
                        first_choice_college_id: collegeId,
                        first_choice_department_id: '',
                        first_choice_program_id: '',
                        program_id: '',
                      }));
                    }}
                  >
                    <option value="">Select college</option>
                    {collegeOptions.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="first_choice_department_id">Department</Label>
                  <select
                    id="first_choice_department_id"
                    className={selectClass}
                    value={payload.first_choice_department_id || ''}
                    disabled={!payload.first_choice_college_id}
                    onChange={(e) => {
                      const departmentId = Number(e.target.value) || '';
                      setPayload((prev: any) => ({
                        ...prev,
                        first_choice_department_id: departmentId,
                        first_choice_program_id: '',
                        program_id: '',
                      }));
                    }}
                  >
                    <option value="">
                      {!payload.first_choice_college_id
                        ? 'Select a college first'
                        : departmentsFor(payload.first_choice_college_id).length
                          ? 'Select department'
                          : 'No departments in this college yet'}
                    </option>
                    {departmentsFor(payload.first_choice_college_id).map((d) => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="first_choice_program_id">Programme</Label>
                  <select
                    id="first_choice_program_id"
                    className={selectClass}
                    value={payload.first_choice_program_id || ''}
                    disabled={!payload.first_choice_department_id}
                    onChange={(e) => {
                      const id = Number(e.target.value) || '';
                      setPayload((prev: any) => ({
                        ...prev,
                        first_choice_program_id: id,
                        program_id: id,
                        second_choice_program_id:
                          Number(prev.second_choice_program_id) === Number(id) ? '' : prev.second_choice_program_id,
                      }));
                    }}
                  >
                    <option value="">
                      {!payload.first_choice_department_id
                        ? 'Select a department first'
                        : programsFor(payload.first_choice_department_id).length
                          ? 'Select programme'
                          : 'No programmes for this admission category yet'}
                    </option>
                    {programsFor(payload.first_choice_department_id).map((p) => (
                      <option key={p.id} value={p.id}>{programOptionLabel(p)}</option>
                    ))}
                  </select>
                  {firstChoiceProgram && app.entry_mode === 'pg' && eligibilityBlock(firstChoiceProgram)}
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-sm font-semibold text-slate-800">Second choice <span className="font-normal text-slate-500">(optional)</span></p>
                <div>
                  <Label htmlFor="second_choice_college_id">College</Label>
                  <select
                    id="second_choice_college_id"
                    className={selectClass}
                    value={payload.second_choice_college_id || ''}
                    onChange={(e) => {
                      const collegeId = Number(e.target.value) || '';
                      setPayload((prev: any) => ({
                        ...prev,
                        second_choice_college_id: collegeId,
                        second_choice_department_id: '',
                        second_choice_program_id: '',
                      }));
                    }}
                  >
                    <option value="">Select college</option>
                    {collegeOptions.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="second_choice_department_id">Department</Label>
                  <select
                    id="second_choice_department_id"
                    className={selectClass}
                    value={payload.second_choice_department_id || ''}
                    disabled={!payload.second_choice_college_id}
                    onChange={(e) => {
                      const departmentId = Number(e.target.value) || '';
                      setPayload((prev: any) => ({
                        ...prev,
                        second_choice_department_id: departmentId,
                        second_choice_program_id: '',
                      }));
                    }}
                  >
                    <option value="">
                      {!payload.second_choice_college_id
                        ? 'Select a college first'
                        : departmentsFor(payload.second_choice_college_id).length
                          ? 'Select department'
                          : 'No departments in this college yet'}
                    </option>
                    {departmentsFor(payload.second_choice_college_id).map((d) => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="second_choice_program_id">Programme</Label>
                  <select
                    id="second_choice_program_id"
                    className={selectClass}
                    value={payload.second_choice_program_id || ''}
                    disabled={!payload.second_choice_department_id}
                    onChange={(e) => setPayload((prev: any) => ({
                      ...prev,
                      second_choice_program_id: Number(e.target.value) || '',
                    }))}
                  >
                    <option value="">
                      {!payload.second_choice_department_id
                        ? 'Select a department first'
                        : programsFor(payload.second_choice_department_id, Number(payload.first_choice_program_id) || undefined).length
                          ? 'None'
                          : 'No programmes for this admission category yet'}
                    </option>
                    {programsFor(payload.second_choice_department_id, Number(payload.first_choice_program_id) || undefined).map((p) => (
                      <option key={p.id} value={p.id}>{programOptionLabel(p)}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </FormSection>
        )}

        {step.key === 'required_documents' && (
          <FormSection
            title="Required documents"
            description={
              ['utme', 'jupeb'].includes(app.entry_mode)
                ? 'Upload Passport, Birth Certificate, JAMB Result, and O\'Level Result (1st sitting required; 2nd sitting optional).'
                : 'Upload the documents listed for your admission category.'
            }
          >
            <div className="space-y-4 max-w-2xl">
              {requiredDocs.map((doc) => {
                const file = docByType(doc.key);
                const isPassportFromNin = doc.key === 'passport' && (!!passportUrl || uploadedDocTypes.has('passport'));
                const uploaded = doc.key === 'passport' ? isPassportFromNin : uploadedDocTypes.has(doc.key);
                return (
                  <div
                    key={doc.key}
                    className={`rounded-xl border p-4 ${
                      uploaded
                        ? 'border-emerald-100 bg-emerald-50/40'
                        : doc.required
                          ? 'border-amber-100 bg-amber-50/30'
                          : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:justify-between">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className="shrink-0">
                          <DocumentPreviewThumb
                            applicationId={app.id}
                            documentId={file?.id}
                            sourceUrl={doc.key === 'passport' ? `/api/applications/${app.id}/passport` : null}
                            fallbackUrl={doc.key === 'passport' ? passportUrl : null}
                            label={doc.label}
                            originalName={file?.original_name}
                            path={file?.path}
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium text-slate-900">{doc.label}</p>
                            <span className={`text-xs rounded-full px-2 py-0.5 ${doc.required ? 'bg-sky-100 text-sky-800' : 'bg-slate-100 text-slate-600'}`}>
                              {doc.required ? 'Required' : 'Optional'}
                            </span>
                            {uploaded && (
                              <span className="text-xs rounded-full px-2 py-0.5 bg-emerald-100 text-emerald-800">Uploaded</span>
                            )}
                          </div>
                          {doc.description && <p className="text-sm text-slate-500 mt-1">{doc.description}</p>}
                          {file?.original_name && (
                            <p className="text-xs text-slate-600 mt-1 truncate">File: {file.original_name}</p>
                          )}
                          {doc.key === 'passport' && passportUrl && !file?.path && (
                            <p className="text-sm text-emerald-700 mt-1">Passport from NIN is on file. You may replace it below.</p>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0">
                        <label htmlFor={`doc-${doc.key}`} className="sr-only">{doc.label}</label>
                        <input
                          id={`doc-${doc.key}`}
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          disabled={uploadingDoc === doc.key}
                          className="block w-full max-w-[16rem] text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-sky-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-sky-700 hover:file:bg-sky-100"
                          onChange={async (e) => {
                            const selected = e.target.files?.[0];
                            e.target.value = '';
                            if (!selected) return;
                            await uploadRequiredDoc(doc.key, selected);
                          }}
                        />
                        {uploadingDoc === doc.key && (
                          <p className="text-xs text-slate-500 mt-1">Uploading…</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </FormSection>
        )}

        {(ninVerified || step.key !== 'biodata') && (
          <div className="flex flex-wrap gap-3 pt-4 border-t border-slate-100">
            <Button onClick={save} disabled={saving || (step.key === 'biodata' && !ninVerified)} className="bg-sky-600 hover:bg-sky-700 text-white shadow-sm">
              {saving ? <Spinner label="Saving…" /> : idx < steps.length - 1 ? 'Save & continue' : 'Save progress'}
            </Button>
            {ninVerified && (
              <Button
                type="button"
                onClick={openFormPrint}
                disabled={printLoading}
                className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm"
              >
                {printLoading ? <Spinner label="Opening…" /> : 'Print form'}
              </Button>
            )}
            {idx === steps.length - 1 && ['fee_paid', 'form_in_progress'].includes(app.stage) && (
              <Button onClick={submit} disabled={saving || !ninVerified} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm">
                {saving ? <Spinner label="Submitting…" /> : 'Submit application'}
              </Button>
            )}
          </div>
        )}
      </Card>

      {(printLoading || printHtml) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[1px]"
          onClick={() => !printLoading && setPrintHtml(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Application form"
        >
          <div
            className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 bg-slate-50">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Application form printout</p>
                <h3 className="font-semibold text-slate-900 truncate">Application form</h3>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {printHtml && (
                  <>
                    <button type="button" onClick={printFormFrame} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                      Print
                    </button>
                    <button type="button" onClick={downloadFormPrint} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                      Download
                    </button>
                  </>
                )}
                <button type="button" onClick={() => setPrintHtml(null)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                  Close
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0 bg-slate-100">
              {printLoading || !printHtml ? (
                <div className="flex items-center justify-center py-24 text-slate-500">
                  <Spinner label="Loading form…" />
                </div>
              ) : (
                <iframe
                  id="wizard-form-frame"
                  title="Application form"
                  srcDoc={printHtml}
                  className="w-full h-[min(70vh,720px)] border-0 bg-white"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
