import React, { forwardRef, useImperativeHandle, useLayoutEffect } from 'react';
import { Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { SwipeType } from '../types';
import Ionicons from '@expo/vector-icons/Ionicons';
import { font, useTheme } from '../theme';
import { buzz } from '../lib/platform';

export interface CardStackHandle {
  swipe: (type: SwipeType) => void;
}


/**
 * Paper deck: the top card follows your finger, the next one waits underneath, and a third sheet peeks out
 * when more are left. Right = Yes, left = No, up = Love, down = Maybe.
 */
const CardStack = forwardRef<
  CardStackHandle,
  { topKey: string; top: React.ReactNode; next?: React.ReactNode; more?: boolean; onSwiped: (type: SwipeType) => void; onDoubleTap?: () => void; yesColor?: string }
>(function CardStack({ topKey, top, next, more, onSwiped, onDoubleTap, yesColor }, ref) {
  const t = useTheme();
  const { width, height } = useWindowDimensions();
  // How far you have to drag before letting go counts: about 40% of the screen width.
  // Measured against the card, not the window, so the unfolded Fold doesn't need a 280px drag.
  const THRESHOLD = Math.max(140, Math.min(width, 520) * 0.4);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const passedThreshold = useSharedValue(false);
  const fade = useSharedValue(1);
  // A card is on its way out: ignore taps, keys and drags until the next one is on top,
  // so a quick double tap can't answer a card you never saw.
  const busy = useSharedValue(false);

  // New top card: reset position without animating. Ignore input for a moment, so the second half of a
  // double tap doesn't land on the card that just appeared (matters when animations are reduced or skipped).
  useLayoutEffect(() => {
    x.value = 0;
    y.value = 0;
    fade.value = 1;
    busy.value = true;
    const timer = setTimeout(() => (busy.value = false), 220);
    return () => clearTimeout(timer);
  }, [topKey]);

  const haptic = () => buzz('tick');
  const done = (type: SwipeType) => {
    buzz(type === 'super' ? 'thump' : 'tap');
    onSwiped(type);
  };

  function flyOut(type: SwipeType) {
    'worklet';
    if (busy.value) return;
    busy.value = true;
    const tx = type === 'like' ? width * 1.5 : type === 'pass' ? -width * 1.5 : 0;
    const ty = type === 'super' ? -height : type === 'maybe' ? height : y.value;
    fade.value = withTiming(0, { duration: 260 });
    x.value = withTiming(tx, { duration: 260 });
    y.value = withTiming(ty, { duration: 260 }, (finished) => {
      if (finished) runOnJS(done)(type);
    });
  }

  useImperativeHandle(ref, () => ({ swipe: (type) => flyOut(type) }), [width, height, onSwiped]);

  const pan = Gesture.Pan()
    .onChange((e) => {
      if (busy.value) return;
      x.value = e.translationX;
      y.value = e.translationY;
      const over = Math.abs(e.translationX) > THRESHOLD || Math.abs(e.translationY) > THRESHOLD;
      if (over !== passedThreshold.value) {
        passedThreshold.value = over;
        if (over) runOnJS(haptic)();
      }
    })
    .onEnd((e) => {
      passedThreshold.value = false;
      if (busy.value) return;
      if (e.translationY < -THRESHOLD && Math.abs(e.translationX) < THRESHOLD) flyOut('super');
      else if (e.translationY > THRESHOLD && Math.abs(e.translationX) < THRESHOLD) flyOut('maybe');
      else if (e.translationX > THRESHOLD || (e.velocityX > 1500 && e.translationX > THRESHOLD * 0.5)) flyOut('like');
      else if (e.translationX < -THRESHOLD || (e.velocityX < -1500 && e.translationX < -THRESHOLD * 0.5)) flyOut('pass');
      else {
        x.value = withSpring(0, { damping: 18 });
        y.value = withSpring(0, { damping: 18 });
      }
    });

  const tapTwice = () => onDoubleTap?.();
  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDelay(300)
    .onEnd(() => runOnJS(tapTwice)());
  const gesture = Gesture.Race(pan, doubleTap);

  const topStyle = useAnimatedStyle(() => ({
    // Fades out as it flies off, so the next card shows through.
    opacity: fade.value,
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { rotate: `${interpolate(x.value, [-width, 0, width], [-9, -0.8, 7], Extrapolation.CLAMP)}deg` },
    ],
  }));
  const nextStyle = useAnimatedStyle(() => {
    const p = Math.min(1, (Math.abs(x.value) + Math.abs(y.value)) / THRESHOLD);
    return { transform: [{ rotate: `${1.6 - 2.4 * p}deg` }, { scale: 0.97 + 0.03 * p }] };
  });
  // Colour wash over the card: fills in as you drag, solid by the time letting go would count.
  const wash = (v: number) => interpolate(v, [THRESHOLD * 0.15, THRESHOLD * 0.8], [0, 1], Extrapolation.CLAMP);
  const yesStyle = useAnimatedStyle(() => ({ opacity: wash(x.value) }));
  const noStyle = useAnimatedStyle(() => ({ opacity: wash(-x.value) }));
  const loveStyle = useAnimatedStyle(() => ({ opacity: Math.abs(x.value) < THRESHOLD * 0.5 ? wash(-y.value) : 0 }));
  const maybeStyle = useAnimatedStyle(() => ({ opacity: Math.abs(x.value) < THRESHOLD * 0.5 ? wash(y.value) : 0 }));

  return (
    <View style={s.wrap}>
      {more && <View style={[StyleSheet.absoluteFill, s.sheet, { backgroundColor: t.surfaceAlt, transform: [{ rotate: '-2.6deg' }, { scale: 0.95 }] }]} />}
      {next && <Animated.View style={[StyleSheet.absoluteFill, nextStyle]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>{next}</Animated.View>}
      <GestureDetector gesture={gesture}>
        <Animated.View style={[StyleSheet.absoluteFill, topStyle, Platform.OS === 'web' && ({ touchAction: 'none', cursor: 'grab' } as any)]}>
          {top}
          <Wash style={yesStyle} bg={yesColor ?? t.sage} fg={t.onYes} icon="checkmark" label="Yes" />
          <Wash style={noStyle} bg={t.surfaceAlt} fg={t.ink} icon="close" label="No" />
          <Wash style={loveStyle} bg={t.butter} fg={t.goldInk} icon="heart" label="Love" />
          <Wash style={maybeStyle} bg={t.maybe} fg={t.maybeInk} icon="~" label="Maybe" />
        </Animated.View>
      </GestureDetector>
    </View>
  );
});

export default CardStack;

function Wash({ style, bg, fg, icon, label }: { style: object; bg: string; fg: string; icon: 'heart' | 'close' | 'checkmark' | '~'; label: string }) {
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, s.wash, { backgroundColor: bg }, style]}>
      {icon === '~' ? <Text style={[s.tilde, { color: fg }]}>~</Text> : <Ionicons name={icon} size={72} color={fg} />}
      <Text style={[s.washText, { color: fg }]}>{label}</Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1 },
  wash: { borderRadius: 34, alignItems: 'center', justifyContent: 'center', gap: 4 },
  washText: { fontFamily: font.heavy, fontSize: 34, letterSpacing: 1 },
  sheet: { borderRadius: 34 },
  tilde: { fontFamily: font.heavy, fontSize: 96, lineHeight: 96, marginTop: -20 },
});
