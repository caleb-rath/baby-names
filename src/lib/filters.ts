import type { GenderFilter } from '../types';

export const FILTER_OPTIONS: { value: GenderFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'F', label: 'Girls' },
  { value: 'M', label: 'Boys' },
  { value: 'N', label: 'Neutral' },
];

export const FILTER_HINT: Record<GenderFilter, string> = {
  all: 'Every name. Good if you don’t know yet.',
  F: 'Girls’ names plus names used for any gender.',
  M: 'Boys’ names plus names used for any gender.',
  N: 'Only names used for any gender, like Quinn or River.',
};
