import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
  Dimensions, Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

const STEPS = [
  {
    emoji: '👍',
    color: '#2ed573',
    title: 'Swipe right to like',
    body: 'Found a name you love? Swipe right or tap the thumbs up.',
    animDir: 'right',
  },
  {
    emoji: '👎',
    color: '#ff4757',
    title: 'Swipe left to pass',
    body: 'Not feeling it? Swipe left or tap the thumbs down.',
    animDir: 'left',
  },
  {
    emoji: '❤️',
    color: '#E91E8C',
    title: 'Swipe up to super like',
    body: 'Love it? Swipe up or tap the heart. Super likes stand out to your partner.',
    animDir: 'up',
  },
  {
    emoji: '⏭️',
    color: '#ffd700',
    title: 'Skip or undo',
    body: 'Skip moves to the next card without voting. Undo brings back the last card.',
    animDir: null,
  },
  {
    emoji: '💕',
    color: '#E91E8C',
    title: 'Match with your partner',
    body: 'Share your session code. When you both like the same name — it\'s a match! You can swipe at your own pace.',
    animDir: null,
  },
];

interface Props {
  onDismiss: () => void;
}

function MiniCard({ dir, color, emoji }: { dir: string | null; color: string; emoji: string }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!dir) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 400, useNativeDriver: true }),
        Animated.delay(600),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [dir]);

  const translateX = dir === 'right' ? anim.interpolate({ inputRange: [0, 1], outputRange: [0, 60] })
    : dir === 'left' ? anim.interpolate({ inputRange: [0, 1], outputRange: [0, -60] })
    : new Animated.Value(0);
  const translateY = dir === 'up' ? anim.interpolate({ inputRange: [0, 1], outputRange: [0, -60] })
    : new Animated.Value(0);
  const rotate = dir === 'right' ? anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '15deg'] })
    : dir === 'left' ? anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-15deg'] })
    : anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '0deg'] });
  const opacity = anim.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] });

  return (
    <Animated.View style={[
      styles.miniCard,
      { borderColor: color, transform: [{ translateX }, { translateY }, { rotate }], opacity },
    ]}>
      <Text style={[styles.miniCardName, { color }]}>Emma</Text>
      <Text style={styles.miniCardSub}>Germanic · 2 syllables</Text>
      {dir && (
        <View style={[styles.miniLabel, { backgroundColor: color }]}>
          <Text style={styles.miniLabelText}>{emoji}</Text>
        </View>
      )}
    </Animated.View>
  );
}

export default function TutorialOverlay({ onDismiss }: Props) {
  const [step, setStep] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  function advance() {
    if (step >= STEPS.length - 1) {
      onDismiss();
      return;
    }
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    setStep((s) => s + 1);
  }

  const current = STEPS[step];

  return (
    <Modal transparent animationType="fade">
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.skipBtn} onPress={onDismiss}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>

        <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
          <View style={styles.cardArea}>
            <MiniCard dir={current.animDir} color={current.color} emoji={current.emoji} />
          </View>

          <Text style={[styles.emoji]}>{current.emoji}</Text>
          <Text style={[styles.title, { color: current.color }]}>{current.title}</Text>
          <Text style={styles.body}>{current.body}</Text>

          <View style={styles.dots}>
            {STEPS.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i === step && { backgroundColor: current.color, width: 20 }]}
              />
            ))}
          </View>

          <TouchableOpacity style={[styles.nextBtn, { backgroundColor: current.color }]} onPress={advance}>
            <Text style={styles.nextBtnText}>
              {step === STEPS.length - 1 ? 'Let\'s go! 🎉' : 'Next'}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

export async function shouldShowTutorial(): Promise<boolean> {
  const seen = await AsyncStorage.getItem('tutorial_seen');
  return seen !== 'true';
}

export async function markTutorialSeen(): Promise<void> {
  await AsyncStorage.setItem('tutorial_seen', 'true');
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.88)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  skipBtn: { position: 'absolute', top: 56, right: 24 },
  skipText: { color: '#888', fontSize: 16, fontWeight: '600' },
  content: { alignItems: 'center', width: '100%' },
  cardArea: { height: 160, justifyContent: 'center', alignItems: 'center', marginBottom: 32 },
  miniCard: {
    width: 200, backgroundColor: '#16213e', borderRadius: 16,
    padding: 20, borderWidth: 1.5, alignItems: 'center',
  },
  miniCardName: { fontSize: 32, fontWeight: '900' },
  miniCardSub: { color: '#888', fontSize: 13, marginTop: 4 },
  miniLabel: {
    position: 'absolute', top: 12, right: 12,
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
  },
  miniLabelText: { fontSize: 18 },
  emoji: { fontSize: 48, marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '800', textAlign: 'center', marginBottom: 12 },
  body: { color: '#ccc', fontSize: 16, textAlign: 'center', lineHeight: 24, paddingHorizontal: 8, marginBottom: 32 },
  dots: { flexDirection: 'row', gap: 6, marginBottom: 32 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#444' },
  nextBtn: { borderRadius: 16, paddingHorizontal: 40, paddingVertical: 16, width: '100%', alignItems: 'center' },
  nextBtnText: { color: '#fff', fontWeight: '700', fontSize: 17 },
});
