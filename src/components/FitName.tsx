import React, { useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, View, type StyleProp, type TextProps, type TextStyle } from 'react-native';

/**
 * A name in big type that shrinks to fit instead of breaking mid-word. A single word always stays on one line
 * ("Mohammed", never "Mohamme / d"); names with spaces or hyphens may wrap between parts, up to `lines` lines.
 * adjustsFontSizeToFit does nothing on the web, so there the size is measured with a canvas.
 */
export default function FitName({
  children,
  size,
  min = 20,
  lines = 1,
  style,
  ...rest
}: Omit<TextProps, 'style' | 'children' | 'numberOfLines'> & { children: string; size: number; min?: number; lines?: number; style?: StyleProp<TextStyle> }) {
  const [width, setWidth] = useState(0);
  const fontsReady = useFontsReady();
  const flat = StyleSheet.flatten(style) ?? {};
  const ratio = flat.lineHeight && flat.fontSize ? flat.lineHeight / flat.fontSize : 1.08;
  const fit = useMemo(
    () => (Platform.OS === 'web' && width ? fitSize(children, flat, size, min, width, lines) : size),
    [children, flat.fontFamily, flat.fontWeight, flat.letterSpacing, size, min, width, lines, fontsReady]
  );

  if (Platform.OS !== 'web') {
    return (
      <Text {...rest} style={[style, { fontSize: size, lineHeight: size * ratio }]} numberOfLines={lines} adjustsFontSizeToFit minimumFontScale={min / size}>
        {children}
      </Text>
    );
  }
  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={s.wrap}>
      <Text {...rest} style={[style, { fontSize: fit, lineHeight: fit * ratio }, s.noBreak]} numberOfLines={lines}>
        {children}
      </Text>
    </View>
  );
}

let canvas: HTMLCanvasElement | null = null;

function fitSize(text: string, style: TextStyle, max: number, min: number, width: number, lines: number) {
  canvas ??= document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return max;
  // Split after spaces and hyphens, keeping them, since that's where the browser may wrap.
  const parts = text.split(/(?<=[\s-])/);
  const room = width - 2;
  for (let size = max; size > min; size -= 1) {
    ctx.font = `${style.fontWeight ?? 'normal'} ${size}px "${style.fontFamily ?? 'sans-serif'}"`;
    (ctx as any).letterSpacing = `${style.letterSpacing ?? 0}px`;
    if (linesNeeded(parts, (t) => ctx.measureText(t.trimEnd()).width, room) <= lines) return size;
  }
  return min;
}

/** Greedy line filling, the way the browser wraps. Infinity when one part alone is wider than the line. */
function linesNeeded(parts: string[], measure: (t: string) => number, room: number) {
  let count = 1;
  let line = '';
  for (const p of parts) {
    if (measure(line + p) <= room) line += p;
    else if (!line || measure(p) > room) return Infinity;
    else {
      count++;
      line = p;
    }
  }
  return count;
}

/** Re-measure once web fonts finish loading; until then the canvas measures a fallback font. */
function useFontsReady() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const fonts = Platform.OS === 'web' ? (document as any).fonts : null;
    if (!fonts) return;
    let live = true;
    const bump = () => live && setN((x) => x + 1);
    fonts.ready.then(bump);
    fonts.addEventListener?.('loadingdone', bump);
    return () => {
      live = false;
      fonts.removeEventListener?.('loadingdone', bump);
    };
  }, []);
  return n;
}

const s = StyleSheet.create({
  wrap: { alignSelf: 'stretch' },
  noBreak: { overflowWrap: 'normal', wordBreak: 'keep-all' } as any,
});
