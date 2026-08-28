/** Document checklist for the student application form. Keep in sync with AdmissionEntryRules::requiredDocuments. */
export type RequiredDoc = {
  key: string;
  label: string;
  required: boolean;
  description?: string;
};

export function requiredDocumentsFor(entryMode?: string, nyscStatus?: string): RequiredDoc[] {
  if (entryMode === 'jupeb') {
    return [
      { key: 'passport', label: 'Passport', required: true, description: 'Passport photograph (usually captured from NIN verification).' },
      { key: 'olevel_first_sitting', label: "O'Level Result (1st sitting)", required: true, description: "Scan or clear photo of your first sitting O'Level result." },
      { key: 'olevel_second_sitting', label: "O'Level Result (2nd sitting)", required: false, description: 'Optional — upload if you have a second sitting.' },
    ];
  }

  if (entryMode === 'utme') {
    return [
      { key: 'passport', label: 'Passport', required: true, description: 'Passport photograph (usually captured from NIN verification).' },
      { key: 'birth_certificate', label: 'Birth Certificate', required: true, description: 'Birth certificate or sworn age declaration.' },
      { key: 'jamb_result', label: 'JAMB Result', required: true, description: 'UTME / JAMB result slip.' },
      { key: 'olevel_first_sitting', label: "O'Level Result (1st sitting)", required: true, description: "Scan or clear photo of your first sitting O'Level result." },
      { key: 'olevel_second_sitting', label: "O'Level Result (2nd sitting)", required: false, description: 'Optional — upload if you have a second sitting.' },
    ];
  }

  if (entryMode === 'de') {
    return [
      { key: 'passport', label: 'Passport', required: true, description: 'Passport photograph (usually captured from NIN verification).' },
      { key: 'birth_certificate', label: 'Birth Certificate', required: true, description: 'Birth certificate or sworn age declaration.' },
      { key: 'olevel_first_sitting', label: "O'Level Result (1st sitting)", required: true, description: "Scan or clear photo of your first sitting O'Level result." },
      { key: 'de_qualification', label: 'Direct Entry qualification', required: true, description: 'A-Level, diploma, JUPEB, NCE, or equivalent certificate.' },
      { key: 'de_transcript', label: 'Direct Entry transcript', required: true, description: 'Official transcript or statement of result for the qualifying award.' },
      { key: 'supporting', label: 'Supporting document', required: false, description: 'Any additional supporting document.' },
    ];
  }

  if (entryMode === 'transfer') {
    return [
      { key: 'passport', label: 'Passport', required: true, description: 'Passport photograph (usually captured from NIN verification).' },
      { key: 'birth_certificate', label: 'Birth Certificate', required: true, description: 'Birth certificate or sworn age declaration.' },
      { key: 'olevel_first_sitting', label: "O'Level Result (1st sitting)", required: true, description: "Scan or clear photo of your first sitting O'Level result." },
      { key: 'previous_transcript', label: 'Previous institution transcript', required: true, description: 'Official transcript or result from the previous institution.' },
      { key: 'transfer_approval', label: 'Transfer approval letter', required: false, description: 'Optional approval or release letter from the previous institution.' },
      { key: 'supporting', label: 'Supporting document', required: false, description: 'Any additional supporting document.' },
    ];
  }

  if (entryMode === 'pg') {
    return [
      { key: 'passport', label: 'Passport', required: true, description: 'Passport photograph (usually captured from NIN verification).' },
      { key: 'degree_certificate', label: 'Degree certificate', required: true, description: 'First degree or equivalent certificate.' },
      { key: 'academic_transcript', label: 'Academic transcript', required: true, description: 'Official transcript of the qualifying degree.' },
      { key: 'nysc_certificate', label: 'NYSC certificate or exemption', required: nyscStatus !== 'not_applicable', description: 'NYSC discharge or exemption certificate. Not required if NYSC does not apply.' },
      { key: 'statement_of_purpose', label: 'Statement of purpose (optional file)', required: false, description: 'Optional extra copy of your statement of purpose.' },
      { key: 'olevel_first_sitting', label: "O'Level Result (1st sitting)", required: true, description: "Scan or clear photo of your first sitting O'Level result." },
      { key: 'olevel_second_sitting', label: "O'Level Result (2nd sitting)", required: false, description: 'Optional — upload if you have a second sitting.' },
      { key: 'supporting', label: 'Supporting document', required: false, description: 'Any additional supporting document.' },
    ];
  }

  return [
    { key: 'passport', label: 'Passport', required: true, description: 'Passport photograph (usually captured from NIN verification).' },
    { key: 'olevel_first_sitting', label: "O'Level Result (1st sitting)", required: true, description: "Scan or clear photo of your first sitting O'Level result." },
    { key: 'olevel_second_sitting', label: "O'Level Result (2nd sitting)", required: false, description: 'Optional — upload if you have a second sitting.' },
    { key: 'supporting', label: 'Supporting document', required: false, description: 'Any additional supporting document.' },
  ];
}
