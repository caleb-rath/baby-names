import { Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';

export function shareCode(code: string) {
  return Share.share({
    message: `Let's pick a baby name together. Open BabyNames, tap "I have a code" and type ${code}`,
  }).catch(() => {});
}

export function copyCode(code: string) {
  return Clipboard.setStringAsync(code);
}
