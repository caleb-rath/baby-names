const BAD = new Set([
  'ASS', 'FAG', 'FUK', 'FUC', 'FUQ', 'DIE', 'DUM', 'PIG', 'RAT', 'STD', 'HIV', 'KKK', 'WTF',
  'POO', 'PEE', 'BUM', 'COK', 'COC', 'SEX', 'SLT', 'HOE', 'NIG', 'FAT',
  'CRY', 'GOD', 'HAG', 'JAP', 'KIL', 'LSD', 'MOB', 'NUT', 'PMS', 'SOB', 'SUX', 'TIT', 'VD', 'BS', 'PP', 'BJ', 'FU',
]);

/** Returns the initials and a warning when they spell something unfortunate. */
export function checkInitials(...parts: (string | undefined | null)[]): { initials: string; warning: string | null } {
  const initials = parts
    .filter((p): p is string => !!p && p.trim().length > 0)
    .map((p) => p.trim()[0].toUpperCase())
    .join('');
  return { initials, warning: BAD.has(initials) ? `Initials spell “${initials}”` : null };
}
