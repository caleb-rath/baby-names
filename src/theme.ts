import { Platform, useColorScheme } from 'react-native';
import type { Gender } from './types';

// "Room": Figtree, warm off-white (warm charcoal at night), soft color washes, no outlines.
// Cards wash in their gender color and the deck screen takes a pale tint of the same hue.
const light = {
  bg: '#F8F6F2',
  surface: '#EFECE6',
  surfaceAlt: '#E7E3DC',
  ink: '#2D2926',
  muted: '#68615B',
  line: '#E6E1D9',
  /** Main accent (terracotta-peach). */
  coral: '#A9532F',
  onCoral: '#FFFFFF',
  /** Strong button: plum by day, peach at night so it doesn't glare. */
  strong: '#2D2926',
  onStrong: '#F8F6F2',
  sage: '#46612E',
  onSage: '#FFFFFF',
  plum: '#5B3A6E',
  onPlum: '#FFFFFF',
  /** Love. */
  butter: '#F3E0B5',
  goldInk: '#6E4A0E',
  amber: '#F3EDE2',
  amberInk: '#8A4220',
  hero: '#EFE6D8',
  hero2: '#F4EFE6',
  maybe: '#E6DDF0',
  maybeInk: '#5B3F86',
  /** The No button sits on a tinted room, so it's plain white by day. */
  noBtn: '#FFFFFF',
  /** Translucent chip that sits on a colored card. */
  chip: 'rgba(255,255,255,0.6)',
  /** Girl / Boy / Either. Card + Card2 are the two ends of the wash, Room is the screen behind the deck. */
  girlCard: '#F2C4CC',
  girlCard2: '#F8DDD3',
  girlRoom: '#FBEDEE',
  girlYes: '#8A2F4E',
  boyCard: '#BFD3EE',
  boyCard2: '#D9E6E8',
  boyRoom: '#EEF2F8',
  boyYes: '#2C4B78',
  eitherCard: '#CCDDB4',
  eitherCard2: '#EBE6C4',
  eitherRoom: '#F1F4E8',
  eitherYes: '#46612E',
  onYes: '#FFFFFF',
  girl: '#F8DDE2',
  girlInk: '#8A2F4E',
  boy: '#DCE6F4',
  boyInk: '#2C4B78',
  either: '#E4ECD8',
  eitherInk: '#46612E',
  /** Pack tiles alternate two warm neutrals so the grid reads calm, not like a mosaic. */
  packs: ['#F1EADF', '#EFECE6', '#EFECE6', '#F1EADF', '#F1EADF', '#EFECE6', '#EFECE6', '#F1EADF', '#F1EADF', '#EFECE6', '#EFECE6', '#F1EADF', '#F1EADF', '#EFECE6', '#EFECE6', '#F1EADF'],
  shadow: 'rgba(60,50,40,0.10)',
  scrim: 'rgba(30,25,20,0.45)',
};

const dark: typeof light = {
  bg: '#1A1918',
  surface: '#262422',
  surfaceAlt: '#302D2A',
  ink: '#F3EFEA',
  muted: '#B8AFA7',
  line: '#2E2B28',
  coral: '#F2A57E',
  onCoral: '#2A1A14',
  strong: '#F2A57E',
  onStrong: '#2A1A14',
  sage: '#A9CF8E',
  onSage: '#14210E',
  plum: '#C9A6DB',
  onPlum: '#24152C',
  butter: '#45391F',
  goldInk: '#F2D08A',
  amber: '#2C2925',
  amberInk: '#F2D08A',
  hero: '#36302A',
  hero2: '#2C2925',
  maybe: '#36314A',
  maybeInk: '#D2C2F0',
  noBtn: '#302D2A',
  chip: 'rgba(255,255,255,0.08)',
  girlCard: '#4C2834',
  girlCard2: '#3E2A2C',
  girlRoom: '#211C1C',
  girlYes: '#B9506F',
  boyCard: '#233552',
  boyCard2: '#22343A',
  boyRoom: '#1A1C1F',
  boyYes: '#4A6FA8',
  eitherCard: '#2F4127',
  eitherCard2: '#2A3D2A',
  eitherRoom: '#1B1D19',
  eitherYes: '#5E8A44',
  onYes: '#FFFFFF',
  girl: '#45272E',
  girlInk: '#F5BCCB',
  boy: '#22344A',
  boyInk: '#B5CDF0',
  either: '#2C3826',
  eitherInk: '#C9DFA9',
  packs: ['#302B25', '#262422', '#262422', '#302B25', '#302B25', '#262422', '#262422', '#302B25', '#302B25', '#262422', '#262422', '#302B25', '#302B25', '#262422', '#262422', '#302B25'],
  shadow: 'rgba(0,0,0,0)',
  scrim: 'rgba(0,0,0,0.6)',
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

/** Colors for one name's gender: card wash, room tint, ink, and the Yes button. */
export function genderColors(t: Theme, g: Gender | undefined) {
  if (g === 'F') return { card: t.girlCard, card2: t.girlCard2, room: t.girlRoom, ink: t.girlInk, yes: t.girlYes };
  if (g === 'M') return { card: t.boyCard, card2: t.boyCard2, room: t.boyRoom, ink: t.boyInk, yes: t.boyYes };
  return { card: t.eitherCard, card2: t.eitherCard2, room: t.eitherRoom, ink: t.eitherInk, yes: t.eitherYes };
}

/** Soft two-tone wash, like a gouache swatch. Native uses RN's gradient style, web uses CSS. */
export function wash(a: string, b: string): object {
  const css = `radial-gradient(120% 70% at 15% 10%, ${a} 0%, transparent 60%), radial-gradient(90% 80% at 90% 95%, ${b} 0%, transparent 65%)`;
  return Platform.OS === 'web'
    ? { backgroundColor: a, backgroundImage: css }
    : { backgroundColor: a, experimental_backgroundImage: `linear-gradient(160deg, ${a} 35%, ${b} 100%)` };
}

export const font = {
  regular: 'Figtree_400Regular',
  italic: 'Figtree_500Medium_Italic',
  medium: 'Figtree_500Medium',
  semibold: 'Figtree_600SemiBold',
  bold: 'Figtree_700Bold',
  heavy: 'Figtree_800ExtraBold',
};

// Names are set big and tight; meanings are always italic.
export const type = {
  nameHero: { fontFamily: font.heavy, fontSize: 62, lineHeight: 66, letterSpacing: -2.4 },
  nameLarge: { fontFamily: font.heavy, fontSize: 42, lineHeight: 48, letterSpacing: -1.4 },
  nameRow: { fontFamily: font.heavy, fontSize: 22, lineHeight: 28, letterSpacing: -0.4 },
  title: { fontFamily: font.heavy, fontSize: 30, lineHeight: 36, letterSpacing: -0.8 },
  section: { fontFamily: font.bold, fontSize: 18, lineHeight: 24 },
  meaning: { fontFamily: font.italic, fontSize: 22, lineHeight: 30 },
  meaningSmall: { fontFamily: font.italic, fontSize: 15, lineHeight: 20 },
  body: { fontFamily: font.regular, fontSize: 17, lineHeight: 24 },
  button: { fontFamily: font.bold, fontSize: 16, lineHeight: 22 },
  callout: { fontFamily: font.medium, fontSize: 15, lineHeight: 20 },
  caption: { fontFamily: font.bold, fontSize: 13, lineHeight: 18 },
  overline: { fontFamily: font.bold, fontSize: 12.5, lineHeight: 16, letterSpacing: 0.6 },
};
