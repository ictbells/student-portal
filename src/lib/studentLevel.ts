type StudentLike = {
  level_label?: string | null;
  current_level?: string | number | null;
  study_level?: string | null;
  application?: { entry_mode?: string | null } | null;
} | null | undefined;

function isJupeb(student: StudentLike): boolean {
  const track = String(student?.study_level || student?.application?.entry_mode || '').toLowerCase();
  return track === 'jupeb';
}

function isNumericBand(value: string): boolean {
  return /^\d{2,3}(\s*L(evel)?)?$/i.test(value.trim());
}

/** Display label for a student's academic level. JUPEB is not "100" / "100L". */
export function studentLevelLabel(student: StudentLike, fallback = '—'): string {
  if (isJupeb(student)) {
    const catalog = String(student?.level_label || '').trim();
    if (catalog && !isNumericBand(catalog)) {
      return catalog;
    }
    return 'JUPEB';
  }

  const catalog = String(student?.level_label || '').trim();
  if (catalog) {
    return catalog;
  }

  const raw = student?.current_level;
  if (raw == null || raw === '') {
    return fallback;
  }

  const text = String(raw).trim();
  if (/^\d+$/.test(text) && Number(text) >= 100) {
    return `${text} Level`;
  }

  return text || fallback;
}
