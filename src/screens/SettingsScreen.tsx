import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useStore } from '../store/useStore';
import { usePartnerName } from '../store/hooks';
import { confirmLinkEmail, linkEmail } from '../lib/supabase';
import { appUrl, canInstall, copy, install, isInstalled, onInstallAvailable, shareText } from '../lib/platform';
import { FILTER_OPTIONS } from '../lib/filters';
import { Button, Field, Screen, Segmented, Sheet, TopBar } from '../components/ui';
import { font, type, useTheme } from '../theme';

export default function SettingsScreen() {
  const t = useTheme();
  const invite = (useRoute<any>().params as { code?: string } | undefined)?.code;
  const session = useStore((s) => s.session);
  const email = useStore((s) => s.email);
  const updateSettings = useStore((s) => s.updateSettings);
  const partnerName = usePartnerName();
  const [myName, setMyName] = useState(session?.myName ?? '');
  const [lastName, setLastName] = useState(session?.lastName ?? '');
  const [confirm, setConfirm] = useState<null | 'reset' | 'leave'>(null);
  const [error, setError] = useState<string | null>(null);
  const [installable, setInstallable] = useState(canInstall());
  useEffect(() => onInstallAvailable(() => setInstallable(true)), []);

  if (!session) return null;

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <TopBar back="Done" title="Settings" />

      <View style={s.section}>
        <Field
          label="Your first name"
          value={myName}
          onChangeText={setMyName}
          // An empty name would leave your partner reading "Waiting on  today".
          onBlur={() => (myName.trim() ? myName.trim() !== session.myName && updateSettings({ myName: myName.trim() }) : setMyName(session.myName))}
          autoCapitalize="words"
        />
        <Field label="Last name (optional)" value={lastName} onChangeText={setLastName} onBlur={() => lastName.trim() !== session.lastName && updateSettings({ lastName: lastName.trim() })} autoCapitalize="words" />
        <View style={{ gap: 6 }}>
          <Text style={[type.caption, { color: t.muted }]}>Show us</Text>
          <Segmented label="Show us" options={FILTER_OPTIONS} value={session.genderFilter} onChange={(v) => updateSettings({ genderFilter: v })} />
          <Text style={[type.caption, { color: t.muted }]}>Changes it for both of you.</Text>
        </View>
      </View>

      {!session.partner ? (
        <Section title="Invite your partner">
          <Button small variant="secondary" icon="share-outline" label={`Share code ${session.code}`} onPress={() => shareText('Pick baby names with me:', appUrl({ code: session.code }))} style={{ alignSelf: 'flex-start' }} />
          <JoinPartner initial={invite} />
        </Section>
      ) : (
        <Section title={`${partnerName} got a new phone?`}>
          <LetBackIn />
        </Section>
      )}

      <Section title="If you lose this phone">
        <SaveEmail email={email} />
        {!email && <RecoveryCode />}
      </Section>

      {Platform.OS === 'web' && !isInstalled() && (
        <Section title="Home screen">
          {installable ? (
            <Button small variant="dark" icon="download-outline" label="Install BabyNames" onPress={() => install().then((ok) => ok && setInstallable(false))} style={{ alignSelf: 'flex-start' }} />
          ) : (
            <Text style={[type.callout, { color: t.muted }]}>Chrome ⋮ menu → Install app.</Text>
          )}
        </Section>
      )}

      <Section title="Start over">
        <Button variant="secondary" label="Clear my answers" onPress={() => setConfirm('reset')} />
        <Button variant="danger" label="Leave this list" onPress={() => setConfirm('leave')} />
        {error && <Text style={[type.callout, { color: t.coral }]}>{error}</Text>}
      </Section>

      {/* Bump with each deploy, so you can tell which version a phone is running. */}
      <Text style={[type.caption, { color: t.muted, textAlign: 'center', marginTop: 24 }]}>Build 2026-11-14 · card fix</Text>

      <Sheet visible={!!confirm} onClose={() => setConfirm(null)}>
        <Text style={[type.title, { color: t.ink }]}>{confirm === 'reset' ? 'Clear your answers?' : 'Leave this list?'}</Text>
        <Text style={[type.body, { color: t.muted }]}>
          {confirm === 'reset' ? `Every name goes back in the packs. ${partnerName}’s answers stay.` : `Your answers are deleted. ${partnerName} keeps theirs.`}
        </Text>
        <Button
          label={confirm === 'reset' ? 'Clear my answers' : 'Leave'}
          onPress={async () => {
            const what = confirm;
            setConfirm(null);
            setError(null);
            try {
              if (what === 'reset') await useStore.getState().resetMyAnswers();
              else await useStore.getState().leaveSession();
            } catch (e: any) {
              setError(e?.message ?? 'That didn’t work. Try again.');
            }
          }}
        />
        <Button label="Cancel" variant="secondary" onPress={() => setConfirm(null)} />
      </Sheet>
    </Screen>
  );
}

/** For when you both started a list: join the other one and bring your answers. */
function JoinPartner({ initial }: { initial?: string }) {
  const t = useTheme();
  const [code, setCode] = useState(initial ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <View style={{ gap: 10, marginTop: 8 }}>
      <Field
        label="Or join theirs with their code"
        value={code}
        onChangeText={(v) => setCode(v.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
        placeholder="ABC123"
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={6}
        hint="Your answers come with you."
      />
      {error && <Text style={[type.callout, { color: t.coral }]}>{error}</Text>}
      <Button
        small
        variant="dark"
        label="Join their list"
        loading={busy}
        disabled={code.length < 6}
        style={{ alignSelf: 'flex-start' }}
        onPress={async () => {
          setBusy(true);
          setError(null);
          try {
            await useStore.getState().joinPartnerList(code);
          } catch (e: any) {
            setError(e?.message ?? 'That code didn’t work.');
          } finally {
            setBusy(false);
          }
        }}
      />
    </View>
  );
}

/** Partner lost their phone and never saved an email: open a short window for them to rejoin with the code. */
function LetBackIn() {
  const t = useTheme();
  const code = useStore((s) => s.session?.code ?? '');
  const [state, setState] = useState<'idle' | 'busy' | 'open' | 'error'>('idle');
  if (state === 'open') {
    return (
      <Text style={[type.callout, { color: t.ink }]}>
        For the next 15 minutes they can tap “I have a code” and enter <Text style={{ fontWeight: '700' }}>{code}</Text>. Their answers come back with them.
      </Text>
    );
  }
  return (
    <View style={{ gap: 8 }}>
      <Button
        small
        variant="secondary"
        label="Let them back in"
        loading={state === 'busy'}
        style={{ alignSelf: 'flex-start' }}
        onPress={async () => {
          setState('busy');
          try {
            await useStore.getState().allowRejoin();
            setState('open');
            shareText('Open this to get back into our list:', appUrl({ code })).catch(() => {});
          } catch {
            setState('error');
          }
        }}
      />
      {state === 'error' && <Text style={[type.callout, { color: t.coral }]}>That didn’t work. Check your signal and try again.</Text>}
    </View>
  );
}

/** Links an email so a new phone (or a cleared browser) can get back into the same list. */
function SaveEmail({ email }: { email: string | null }) {
  const t = useTheme();
  const [value, setValue] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (email) {
    return <Text style={[type.body, { color: t.ink }]}>Saved to {email}. On a new phone, tap “I’ve used BabyNames before”.</Text>;
  }
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e: any) {
      setError(e?.message ?? 'That didn’t work. Try again.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={{ gap: 12 }}>
      <Text style={[type.callout, { color: t.muted }]}>Save an email, or make a recovery code below. Either gets your answers back on a new phone.</Text>
      {!sent ? (
        <>
          <Field label="Email" value={value} onChangeText={setValue} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
          <Button small variant="dark" label="Send code" loading={busy} disabled={!value.includes('@')} style={{ alignSelf: 'flex-start' }} onPress={() => run(async () => {
            await linkEmail(value.trim());
            setSent(true);
          })} />
        </>
      ) : (
        <>
          <Field label={`Code sent to ${value.trim()}`} value={code} onChangeText={(v) => setCode(v.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={10} autoComplete="one-time-code" />
          <Button small variant="dark" label="Save email" loading={busy} disabled={code.length < 6} style={{ alignSelf: 'flex-start' }} onPress={() => run(async () => {
            await confirmLinkEmail(value.trim(), code);
            useStore.getState().setEmail(value.trim());
          })} />
        </>
      )}
      {error && <Text style={[type.callout, { color: t.coral }]}>{error}</Text>}
    </View>
  );
}

/** For no email: a code only you see. It's shown once; the server keeps just a hash. */
function RecoveryCode() {
  const t = useTheme();
  const savedAt = useStore((s) => s.recoveryCodeAt);
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const make = async () => {
    setBusy(true);
    setError(null);
    try {
      setCode(await useStore.getState().makeRecoveryCode());
      setCopied(false);
    } catch (e: any) {
      setError(/fetch|network/i.test(e?.message ?? '') ? 'You’re offline. Try again when you have signal.' : e?.message ?? 'That didn’t work. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: 10, marginTop: 8 }}>
      <Text style={[type.callout, { color: t.ink, fontFamily: font.semibold }]}>Recovery code</Text>
      {code ? (
        <>
          <Text selectable style={[type.title, { color: t.ink, letterSpacing: 2 }]}>{code}</Text>
          <Text style={[type.callout, { color: t.muted }]}>
            Save it somewhere that isn’t this phone, like your password manager or Google Keep. This is the only time it’s shown. On a new phone, tap “I’ve used BabyNames before”, then “I have a recovery code”.
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button small variant="dark" icon="copy-outline" label={copied ? 'Copied' : 'Copy'} onPress={() => copy(code).then(() => setCopied(true)).catch(() => {})} />
            <Button small variant="secondary" icon="share-outline" label="Save to…" onPress={() => shareText(`BabyNames recovery code: ${code}`).catch(() => {})} />
          </View>
        </>
      ) : (
        <>
          <Text style={[type.callout, { color: t.muted }]}>
            {savedAt
              ? `You made one on ${new Date(savedAt).toLocaleDateString()}. Lost it? Make a new one; the old one stops working.`
              : 'No email? A code works too. Only you see it.'}
          </Text>
          <Button small variant={savedAt ? 'secondary' : 'dark'} label={savedAt ? 'Make a new code' : 'Make a recovery code'} loading={busy} onPress={make} style={{ alignSelf: 'flex-start' }} />
        </>
      )}
      {error && <Text style={[type.callout, { color: t.coral }]}>{error}</Text>}
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={s.section}>
      <Text style={[type.section, { color: t.ink }]} accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  section: { gap: 12, marginTop: 28 },
});
