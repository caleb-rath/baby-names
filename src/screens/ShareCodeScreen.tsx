import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useStore } from '../store/useStore';
import { appUrl, copy, shareText } from '../lib/platform';
import { Button, Screen } from '../components/ui';
import { type, useTheme } from '../theme';

/** Right after creating a list: send the invite, then start swiping. */
export default function ShareCodeScreen() {
  const t = useTheme();
  const code = useStore((s) => s.session?.code ?? '');
  const clearJustCreated = useStore((s) => s.clearJustCreated);
  const [note, setNote] = useState<string | null>(null);

  const share = async () => {
    const r = await shareText('Pick baby names with me. Open this link:', appUrl({ code }));
    if (r === 'copied') setNote('Link copied. Paste it in a text.');
  };

  return (
    <Screen edges={['top', 'bottom']} bg={t.hero} footer={<Button label="Start swiping" variant="dark" onPress={clearJustCreated} />}>
      <View style={s.center}>
        <Text style={[type.title, { color: t.ink }]}>Invite your partner</Text>
        <View style={[s.codeBox, { backgroundColor: t.surface, borderColor: t.line }]} accessible accessibilityLabel={`Your code is ${code.split('').join(' ')}`}>
          <Text style={[type.nameLarge, { color: t.ink, letterSpacing: 8 }]}>{code || '······'}</Text>
        </View>
        <Button label="Send link" icon="share-outline" onPress={share} />
        <Button
          label="Copy code"
          variant="ghost"
          onPress={() => {
            copy(code);
            setNote('Code copied');
          }}
        />
        {note && (
          <Text style={[type.callout, { color: t.muted, textAlign: 'center' }]} accessibilityLiveRegion="polite">
            {note}
          </Text>
        )}
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', gap: 14 },
  codeBox: { borderRadius: 24, borderWidth: 1, paddingVertical: 24, alignItems: 'center', marginVertical: 8 },
});
