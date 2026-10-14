import type { Exam, ProfileName, Section } from './schema';
export type Profile = {
  label: string;
  short: string;
  description: string;
  accent: string;
  palettePosition: 'left' | 'right';
  showCandidate: boolean;
  compactOptions: boolean;
  allowPrevious: boolean;
  allowQuestionNavigation: boolean;
  allowReview: boolean;
};
const base = {
  palettePosition: 'right' as const,
  showCandidate: true,
  compactOptions: false,
  allowPrevious: true,
  allowQuestionNavigation: true,
  allowReview: true,
};
export const profiles: Record<ProfileName, Profile> = {
  'ncbt-style': {
    ...base,
    label: 'NCBT-style',
    short: 'NCBT',
    description: 'An editable starting point; configure rules for your examination.',
    accent: '#475569',
  },
  railway: {
    ...base,
    label: 'Railway CBT',
    short: 'RRB',
    description: 'Prominent timer, candidate panel and familiar question palette.',
    accent: '#1c638b',
    compactOptions: true,
  },
  'jee-style': {
    ...base,
    label: 'JEE-style',
    short: 'JEE',
    description: 'Section-led practice with objective and numerical questions.',
    accent: '#245b9c',
  },
  'gate-style': {
    ...base,
    label: 'GATE-style',
    short: 'GATE',
    description: 'Objective, multiple-select and numerical-answer practice.',
    accent: '#6554a0',
  },
  'nta-style': {
    ...base,
    label: 'NTA-style',
    short: 'NTA',
    description: 'A reusable section-based competitive CBT interface.',
    accent: '#176e78',
  },
  generic: {
    ...base,
    label: 'Generic CBT',
    short: 'CBT',
    description: 'A flexible, distraction-free examination workspace.',
    accent: '#21645d',
  },
  custom: {
    ...base,
    label: 'Custom profile',
    short: 'CUSTOM',
    description: 'Your layout and navigation rules, on the shared engine.',
    accent: '#946129',
    palettePosition: 'left',
  },
};
export function resolveProfile(exam: Exam, section?: Section): Profile {
  const p = profiles[exam.examProfile];
  return {
    ...p,
    ...exam.settings.presentation,
    allowPrevious:
      section?.settings?.allowPrevious ?? exam.settings.allowPrevious ?? p.allowPrevious,
    allowQuestionNavigation:
      section?.settings?.allowQuestionNavigation ??
      exam.settings.allowQuestionNavigation ??
      p.allowQuestionNavigation,
    allowReview: section?.settings?.allowReview ?? exam.settings.allowReview ?? p.allowReview,
  };
}
