import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useStore } from '../store/useStore';
import { sendLoginCode, verifyLoginCode } from '../lib/supabase';
import { clearUrlParams, inviteCodeFromUrl } from '../lib/platform';
import { Button, Field, Screen, TopBar } from '../components/ui';
import { font, type, useTheme } from '../theme';

type Step = 'start' | 'create' | 'join' | 'email' | 'code' | 'recover';

export default function WelcomeScreen() {
  const t = useTheme();
  // An invite link (?code=ABC123) skips straight to joining.
  const [invite] = useState(() => inviteCodeFromUrl());
  const [step, setStep] = useState<Step>(invite ? 'join' : 'start');
  const [myName, setMyName] = useState('');
  const [lastName, setLastName] = useState('');
  const [code, setCode] = useState(invite?.toUpperCase() ?? '');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [recovery, setRecovery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setupError = useStore((s) => s.error);
  const createSession = useStore((s) => s.createSession);
  const joinSession = useStore((s) => s.joinSession);
  const signedInWithEmail = useStore((s) => s.signedInWithEmail);
  const recoverWithCode = useStore((s) => s.recoverWithCode);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e: any) {
      setError(friendly(e?.message));
    } finally {
      setBusy(false);
    }
  }
  const go = (s: Step) => {
    setError(null);
    setStep(s);
  };

  const err = (error || setupError) && (
    <Text accessibilityLiveRegion="polite" style={[type.callout, { color: t.coral }]}>
      {error || setupError}
    </Text>
  );
  const nameField = <Field label="Your first name" value={myName} onChangeText={setMyName} autoCapitalize="words" autoComplete="given-name" />;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {step === 'start' ? (
        <Screen edges={['top', 'bottom']} bg={t.hero}>
          <View style={s.hero}>
            <Text style={[type.nameHero, { color: t.ink, fontSize: 56, lineHeight: 60 }]} accessibilityRole="header">
              Find a name{'\n'}you both love.
            </Text>
          </View>
          <View style={{ gap: 12, paddingBottom: 16 }}>
            {err}
            <Button label="Start our list" variant="dark" onPress={() => go('create')} />
            <Button label="I have a code" variant="secondary" onPress={() => go('join')} />
            <Pressable onPress={() => go('email')} accessibilityRole="button" style={s.link}>
              <Text style={[type.callout, { color: t.ink, fontFamily: font.semibold, textDecorationLine: 'underline' }]}>I’ve used BabyNames before</Text>
            </Pressable>
          </View>
        </Screen>
      ) : (
        <Screen scroll edges={['top', 'bottom']}>
          <TopBar back="Back" onBack={() => go(step === 'code' || step === 'recover' ? 'email' : 'start')} />
          {step === 'create' && (
            <View style={s.form}>
              <Text style={[type.title, { color: t.ink }]} accessibilityRole="header">Your list</Text>
              {nameField}
              <Field label="Last name (optional)" value={lastName} onChangeText={setLastName} autoCapitalize="words" />
              {err}
              <Button label="Start" variant="dark" loading={busy} disabled={!myName.trim()} onPress={() => run(() => createSession(lastName, 'all', myName))} />
            </View>
          )}

          {step === 'join' && (
            <View style={s.form}>
              <Text style={[type.title, { color: t.ink }]} accessibilityRole="header">Join your partner</Text>
              {nameField}
              <Field
                label="Their 6-letter code"
                value={code}
                onChangeText={(v) => setCode(v.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                placeholder="ABC123"
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={6}
                style={{ fontFamily: font.bold, fontSize: 24, letterSpacing: 6 }}
              />
              {err}
              <Button
                label="Join"
                variant="dark"
                loading={busy}
                disabled={code.length < 6 || !myName.trim()}
                onPress={() =>
                  run(async () => {
                    await joinSession(code, myName);
                    clearUrlParams();
                  })
                }
              />
            </View>
          )}

          {step === 'email' && (
            <View style={s.form}>
              <Text style={[type.title, { color: t.ink }]} accessibilityRole="header">Welcome back</Text>
              <Text style={[type.body, { color: t.muted }]}>We’ll email you a code.</Text>
              <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
              {err}
              <Button label="Send code" variant="dark" loading={busy} disabled={!email.includes('@')} onPress={() => run(async () => {
                await sendLoginCode(email.trim());
                go('code');
              })} />
              <Pressable onPress={() => go('recover')} accessibilityRole="button" style={s.link}>
                <Text style={[type.callout, { color: t.ink, fontFamily: font.semibold, textDecorationLine: 'underline' }]}>I have a recovery code</Text>
              </Pressable>
              <Text style={[type.caption, { color: t.muted, fontFamily: font.regular }]}>
                Neither? Ask your partner to tap “Let them back in” in Settings, then join with their code. Your answers come back too.
              </Text>
            </View>
          )}

          {step === 'recover' && (
            <View style={s.form}>
              <Text style={[type.title, { color: t.ink }]} accessibilityRole="header">Recovery code</Text>
              <Text style={[type.body, { color: t.muted }]}>The 12-letter code you saved from Settings.</Text>
              <Field
                label="Code"
                value={recovery}
                onChangeText={(v) => setRecovery(v.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
                placeholder="XXXX-XXXX-XXXX"
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={14}
                style={{ fontFamily: font.bold, fontSize: 22, letterSpacing: 2 }}
              />
              {err}
              <Button
                label="Get my list back"
                variant="dark"
                loading={busy}
                disabled={recovery.replace(/-/g, '').length < 12}
                onPress={() => run(() => recoverWithCode(recovery))}
              />
            </View>
          )}

          {step === 'code' && (
            <View style={s.form}>
              <Text style={[type.title, { color: t.ink }]} accessibilityRole="header">Check your email</Text>
              <Text style={[type.body, { color: t.muted }]}>We emailed a code to {email.trim()}.</Text>
              <Field
                label="Code"
                value={otp}
                onChangeText={(v) => setOtp(v.replace(/\D/g, ''))}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                maxLength={10}
                style={{ fontFamily: font.bold, fontSize: 24, letterSpacing: 6 }}
              />
              {err}
              <Button
                label="Sign in"
                variant="dark"
                loading={busy}
                disabled={otp.length < 6}
                onPress={() =>
                  run(async () => {
                    const id = await verifyLoginCode(email.trim(), otp);
                    const found = await signedInWithEmail(id, email.trim());
                    if (!found) throw new Error('Signed in, but this account isn’t on a list. Ask your partner for the code.');
                  })
                }
              />
            </View>
          )}
        </Screen>
      )}
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  hero: { flex: 1, justifyContent: 'center', gap: 16 },
  link: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  form: { gap: 18, marginTop: 12 },
});

/** Supabase's own wording isn't meant for people. */
function friendly(msg?: string): string {
  if (!msg) return 'Something went wrong. Check your connection and try again.';
  if (/signups not allowed|user not found/i.test(msg)) return 'No list is saved under that email. Ask your partner to tap “Let them back in” in Settings, then join with their code.';
  if (/expired or is invalid/i.test(msg)) return 'That code didn’t work. Check the latest email and try again.';
  if (/recovery code didn.t work/i.test(msg)) return 'That code didn’t work. Check it against the one you saved. A code stops working once it’s used or a new one is made.';
  if (/failed to fetch|network/i.test(msg)) return 'You’re offline. Try again when you have signal.';
  return msg;
}
