export const LIFECYCLE_STEPS = [
  { key: 'started', label: 'Application started' },
  { key: 'awaiting_application_fee', label: 'Application fee payment' },
  { key: 'application_form', label: 'Application form' },
  { key: 'biodata', label: 'Biodata' },
  { key: 'academic_qualifications', label: 'Academic qualifications' },
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

export function lifecycleIndex(stage?: string, currentStep?: string, isStudent?: boolean): number {
  if (isStudent || stage === 'matriculated') return 15;
  if (stage === 'acceptance_paid') return 14;
  if (stage === 'awaiting_acceptance_fee' || stage === 'offer_issued') return 12;
  if (stage === 'approved') return 11;
  if (stage === 'recommended') return 10;
  if (stage === 'shortlisting') return 9;
  if (stage === 'verification') return 8;
  if (stage === 'screening') return 7;
  if (stage === 'submitted') return 7;
  if (stage === 'form_in_progress' || stage === 'fee_paid') {
    const map: Record<string, number> = {
      application_form: 2,
      biodata: 3,
      academic_qualifications: 4,
      programme_selection: 5,
      required_documents: 6,
    };
    return map[currentStep || 'application_form'] ?? 2;
  }
  if (stage === 'awaiting_application_fee') return 1;
  return 0;
}
