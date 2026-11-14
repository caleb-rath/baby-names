import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { type, useTheme } from '../theme';
import { Button } from './ui';

/** One screen, using the same icons and colours as the real buttons. */
export default function Tutorial({ onDone }: { onDone: () => void }) {
  const t = useTheme();
  const rows: { icon: keyof typeof Ionicons.glyphMap; bg: string; fg: string; border?: string; title: string; text: string }[] = [
    { icon: 'heart', bg: t.sage, fg: t.onSage, title: 'Yes', text: 'Swipe right or tap the heart.' },
    { icon: 'close', bg: t.surface, fg: t.ink, border: t.ink, title: 'No', text: 'Swipe left or tap ✕. Your partner never sees your no’s.' },
    { icon: 'star', bg: t.butter, fg: t.goldInk, title: 'Love', text: 'Swipe up or tap the star for names you really love.' },
  ];
  return (
    <Modal transparent animationType="fade" onRequestClose={onDone}>
      <View style={[s.scrim, { backgroundColor: t.scrim }]}>
        <View style={[s.sheet, { backgroundColor: t.bg }]} accessibilityViewIsModal>
          <Text style={[type.title, { color: t.ink }]} accessibilityRole="header">How it works</Text>
          <Text style={[type.body, { color: t.muted, marginTop: 6 }]}>
            You each swipe on your own phone. When you both say yes to a name, it goes on your shared list.
          </Text>
          <View style={{ gap: 16, marginTop: 20 }}>
            {rows.map((r) => (
              <View key={r.title} style={s.row}>
                <View style={[s.dot, { backgroundColor: r.bg, borderColor: r.border ?? 'transparent' }]}>
                  <Ionicons name={r.icon} size={22} color={r.fg} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[type.button, { color: t.ink }]}>{r.title}</Text>
                  <Text style={[type.callout, { color: t.muted }]}>{r.text}</Text>
                </View>
              </View>
            ))}
          </View>
          <Text style={[type.callout, { color: t.muted, marginTop: 20 }]}>
            Use First, Middle and Together at the top. Together builds full names from the ones you both liked.
          </Text>
          <Button label="Got it" onPress={onDone} style={{ marginTop: 20 }} />
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  dot: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
