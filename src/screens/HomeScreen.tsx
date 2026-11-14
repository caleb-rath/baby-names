import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useSessionStore } from '../store/useSessionStore';

type Mode = 'landing' | 'create' | 'join';

export default function HomeScreen() {
  const [mode, setMode] = useState<Mode>('landing');
  const [lastName, setLastName] = useState('');
  const [genderFilter, setGenderFilter] = useState<'all' | 'M' | 'F'>('all');
  const [joinCode, setJoinCode] = useState('');

  const { createNewSession, joinExistingSession, userId, isLoading, error, clearError } = useSessionStore();

  React.useEffect(() => {
    if (error) {
      Alert.alert('Error', error, [{ text: 'OK', onPress: clearError }]);
    }
  }, [error]);

  async function handleCreate() {
    if (!userId) return;
    try {
      await createNewSession(userId, lastName, genderFilter);
      // session is now set in store → navigator automatically transitions to Main
    } catch {}
  }

  async function handleJoin() {
    if (joinCode.length !== 6) {
      Alert.alert('Invalid Code', 'Enter the 6-digit code from your partner.');
      return;
    }
    try {
      await joinExistingSession(joinCode);
    } catch {}
  }

  if (mode === 'landing') {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.hero}>
          <Text style={s.emoji}>👶</Text>
          <Text style={s.title}>BabyNames</Text>
          <Text style={s.greeting}>Ready to find a name?</Text>
        </View>
        <View style={s.buttons}>
          <TouchableOpacity style={s.primaryBtn} onPress={() => setMode('create')}>
            <Text style={s.primaryBtnText}>Create Session</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.secondaryBtn} onPress={() => setMode('join')}>
            <Text style={s.secondaryBtnText}>Join Partner's Session</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (mode === 'create') {
    return (
      <SafeAreaView style={s.container}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.form}>
          <TouchableOpacity onPress={() => setMode('landing')} style={s.back}>
            <Text style={s.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={s.formTitle}>New Session</Text>

          <Text style={s.label}>Last Name (optional)</Text>
          <TextInput
            style={s.input}
            placeholder="e.g. Johnson"
            placeholderTextColor="#666"
            value={lastName}
            onChangeText={setLastName}
            autoCapitalize="words"
          />

          <Text style={s.label}>Show Names For</Text>
          <View style={s.toggleRow}>
            {(['all', 'F', 'M'] as const).map((g) => (
              <TouchableOpacity
                key={g}
                style={[s.toggle, genderFilter === g && s.toggleActive]}
                onPress={() => setGenderFilter(g)}
              >
                <Text style={[s.toggleText, genderFilter === g && s.toggleTextActive]}>
                  {g === 'all' ? 'All' : g === 'F' ? 'Girls' : 'Boys'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.hint}>
            You'll get a 6-digit code to share with your partner. You can both swipe at your own pace — matches show up automatically.
          </Text>

          <TouchableOpacity style={s.primaryBtn} onPress={handleCreate} disabled={isLoading}>
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.primaryBtnText}>Create {'&'} Start Swiping</Text>
            )}
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.form}>
        <TouchableOpacity onPress={() => setMode('landing')} style={s.back}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.formTitle}>Join Session</Text>
        <Text style={s.hint}>Enter the 6-digit code your partner got when they created the session.</Text>
        <TextInput
          style={[s.input, s.codeInput]}
          placeholder="123456"
          placeholderTextColor="#666"
          value={joinCode}
          onChangeText={(t) => setJoinCode(t.replace(/\D/g, '').slice(0, 6))}
          keyboardType="number-pad"
          maxLength={6}
        />
        <TouchableOpacity style={s.primaryBtn} onPress={handleJoin} disabled={isLoading}>
          {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>Join {'&'} Start Swiping</Text>}
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 72, marginBottom: 16 },
  title: { fontSize: 40, fontWeight: '800', color: '#fff', letterSpacing: 1 },
  greeting: { fontSize: 16, color: '#aaa', marginTop: 8 },
  buttons: { padding: 24, gap: 12 },
  primaryBtn: {
    backgroundColor: '#E91E8C', borderRadius: 16, padding: 18,
    alignItems: 'center', shadowColor: '#E91E8C', shadowOpacity: 0.4,
    shadowRadius: 12, elevation: 6,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 17 },
  secondaryBtn: {
    borderWidth: 2, borderColor: '#E91E8C', borderRadius: 16, padding: 18, alignItems: 'center',
  },
  secondaryBtnText: { color: '#E91E8C', fontWeight: '700', fontSize: 17 },
  form: { flex: 1, padding: 24 },
  back: { marginBottom: 24 },
  backText: { color: '#E91E8C', fontSize: 16 },
  formTitle: { fontSize: 28, fontWeight: '800', color: '#fff', marginBottom: 24 },
  label: { color: '#aaa', fontSize: 13, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  hint: { color: '#666', fontSize: 14, lineHeight: 20, marginBottom: 24 },
  input: {
    backgroundColor: '#16213e', borderRadius: 12, padding: 16, color: '#fff',
    fontSize: 16, marginBottom: 24, borderWidth: 1, borderColor: '#333',
  },
  codeInput: { fontSize: 32, textAlign: 'center', letterSpacing: 12 },
  toggleRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  toggle: {
    flex: 1, padding: 14, borderRadius: 12, borderWidth: 1,
    borderColor: '#444', alignItems: 'center',
  },
  toggleActive: { backgroundColor: '#E91E8C', borderColor: '#E91E8C' },
  toggleText: { color: '#aaa', fontWeight: '600' },
  toggleTextActive: { color: '#fff' },
});
