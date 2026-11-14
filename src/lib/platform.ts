import { Platform, Share } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';

const web = Platform.OS === 'web';

/** A short buzz. Android Chrome supports navigator.vibrate; iPhones ignore it. */
export function buzz(kind: 'tick' | 'tap' | 'thump' = 'tap') {
  if (web) {
    const ms = kind === 'tick' ? 8 : kind === 'tap' ? 15 : [20, 40, 30];
    try {
      (navigator as any).vibrate?.(ms);
    } catch {}
    return;
  }
  if (kind === 'tick') Haptics.selectionAsync().catch(() => {});
  else Haptics.impactAsync(kind === 'thump' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** The app's own address, so invite links open it with the code filled in. */
export function appUrl(params?: Record<string, string>): string {
  const base = web && typeof location !== 'undefined' ? `${location.origin}${location.pathname}` : 'https://babynames.app/';
  const q = params ? `?${new URLSearchParams(params)}` : '';
  return base + q;
}

/** Opens the phone's share sheet; falls back to copying the text. Returns 'copied' when it copied. */
export async function shareText(text: string, url?: string): Promise<'shared' | 'copied'> {
  if (web) {
    const nav = navigator as any;
    if (nav.share) {
      try {
        await nav.share({ text, url });
        return 'shared';
      } catch (e: any) {
        if (e?.name === 'AbortError') return 'shared';
      }
    }
    await Clipboard.setStringAsync(url ? `${text} ${url}` : text);
    return 'copied';
  }
  await Share.share({ message: url ? `${text} ${url}` : text }).catch(() => {});
  return 'shared';
}

export function copy(text: string) {
  return Clipboard.setStringAsync(text);
}

/** Reads ?code=ABC123 from an invite link. */
export function inviteCodeFromUrl(): string | null {
  if (!web || typeof location === 'undefined') return null;
  return new URLSearchParams(location.search).get('code');
}

export function clearUrlParams() {
  if (web && typeof history !== 'undefined') history.replaceState(null, '', location.pathname);
}

/** True when opened from the home-screen icon rather than a browser tab. */
export function isInstalled(): boolean {
  if (!web || typeof window === 'undefined') return true;
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true;
}

// Chrome fires beforeinstallprompt when the app can be installed; we keep it so Settings can offer an Install button.
let installEvent: any = null;
const installListeners = new Set<() => void>();
if (web && typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installEvent = e;
    installListeners.forEach((f) => f());
  });
}
export function canInstall() {
  return !!installEvent;
}
export function onInstallAvailable(f: () => void) {
  installListeners.add(f);
  return () => {
    installListeners.delete(f);
  };
}
export async function install() {
  if (!installEvent) return false;
  installEvent.prompt();
  const { outcome } = await installEvent.userChoice;
  installEvent = null;
  return outcome === 'accepted';
}

/** Calls f when the tab or app comes back into view. */
export function onResume(f: () => void): () => void {
  if (web && typeof document !== 'undefined') {
    const h = () => document.visibilityState === 'visible' && f();
    document.addEventListener('visibilitychange', h);
    window.addEventListener('online', f);
    return () => {
      document.removeEventListener('visibilitychange', h);
      window.removeEventListener('online', f);
    };
  }
  const { AppState } = require('react-native');
  const sub = AppState.addEventListener('change', (s: string) => s === 'active' && f());
  return () => sub.remove();
}
