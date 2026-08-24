/** Full internal lifecycle (includes staff-side stages). */
export const LIFECYCLE_STEPS = [
  { key: 'started', label: 'Application started' },
  { key: 'awaiting_application_fee', label: 'Application fee payment' },
  { key: 'application_form', label: 'Application form' },
  { key: 'biodata', label: 'Biodata' },
  { key: 'academic_qualifications', label: "O'Level" },
  { key: 'programme_selection', label: 'Programme selection' },
  { key: 'required_documents', label: 'Required documents' },
  { key: 'screening', label: 'Screening' },
  { key: 'verification', label: 'Verification' },
  { key: 'shortlisting', label: 'Shortlisting' },
  { key: 'recommended', label: 'Admission recommendation' },
  { key: 'approved', label: 'Approval' },
  { key: 'awaiting_acceptance_fee', label: 'Admission offer & acceptance fee' },
  { key: 'acceptance_paid', label: 'Acceptance fee paid' },
  { key: 'student_created', label: 'Student creation' },
  { key: 'matriculated', label: 'Matriculation / student ID' },
] as const;

/** Steps 1–7 shown to applicants on the student portal home. */
export const STUDENT_JOURNEY_STEPS = LIFECYCLE_STEPS.slice(0, 7).map((step, index) => ({
  key: step.key,
  title: step.label,
  number: index + 1,
}));

export function lifecycleIndex(stage?: string, currentStep?: string, isStudent?: boolean): number {
  if (isStudent || stage === 'matriculated') return 15;
  if (stage === 'acceptance_paid') return 14;
  if (stage === 'awaiting_acceptance_fee' || stage === 'offer_issued' || stage === 'admission') return 12;
  if (stage === 'approved') return 11;
  if (stage === 'recommended') return 10;
  if (stage === 'shortlisting') return 9;
  if (stage === 'verification') return 8;
  if (stage === 'screening') return 7;
  if (stage === 'submitted') return 7;
  if (stage === 'form_in_progress' || stage === 'fee_paid') {
    const map: Record<string, number> = {
      biodata: 3,
      personal_details: 3,
      health_information: 3,
      next_of_kin: 3,
      sponsor: 3,
      application_form: 2,
      academic_qualifications: 4,
      pg_background: 4,
      programme_selection: 5,
      pg_research: 5,
      pg_referees: 5,
      required_documents: 6,
    };
    return map[currentStep || 'biodata'] ?? 2;
  }
  if (stage === 'awaiting_application_fee') return 1;
  return 0;
}

/** Current index within STUDENT_JOURNEY_STEPS (0–6). Returns 7 when past the student form phase. */
export function studentJourneyIndex(stage?: string, currentStep?: string, isStudent?: boolean): number {
  if (isStudent) return 7;
  const full = lifecycleIndex(stage, currentStep, false);
  if (full >= 7) return 7;
  return full;
}

export function formatStage(stage?: string) {
  if (!stage) return 'Not started';
  return stage.replaceAll('_', ' ');
}
