import type { Playground } from '@/lib/playgrounds';

export default {
  title: 'useMemo: skip slow work',
  goal: 'The slow calculation only re-runs when `n` changes. Switching the theme re-renders the screen but **reuses** the cached result (watch the console). **Try:** remove `useMemo` and switch the theme again.',
  files: {
    'App.tsx': `import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

function slowSum(n: number) {
  console.log('computing… (slow!)');
  let total = 0;
  for (let i = 0; i < n * 1_000_000; i++) total += 1;
  return total;
}

export default function App() {
  const [n, setN] = useState(5);
  const [dark, setDark] = useState(false);

  const total = useMemo(() => slowSum(n), [n]);

  return (
    <View style={[styles.screen, dark && styles.screenDark]}>
      <View style={[styles.card, dark && styles.cardDark]}>
        <Text style={styles.label}>RESULT FOR n = {n}</Text>
        <Text style={[styles.big, dark && styles.light]}>{total.toLocaleString()}</Text>
      </View>
      <Pressable style={[styles.btn, styles.primary]} onPress={() => setN(n + 1)}>
        <Text style={styles.btnText}>n + 1 · recomputes</Text>
      </Pressable>
      <Pressable style={[styles.btn, dark ? styles.lightBtn : styles.darkBtn]} onPress={() => setDark(!dark)}>
        <Text style={[styles.btnText, dark && styles.darkText]}>{dark ? '☀️ Light' : '🌙 Dark'} theme · uses the cache</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', gap: 12, padding: 20, backgroundColor: '#F1F5F9' },
  screenDark: { backgroundColor: '#020617' },
  card: { alignItems: 'center', gap: 4, paddingVertical: 26, borderRadius: 24, backgroundColor: '#FFFFFF', marginBottom: 8 },
  cardDark: { backgroundColor: '#0F172A' },
  label: { fontSize: 12, fontWeight: '800', letterSpacing: 1.2, color: '#64748B' },
  big: { fontSize: 32, fontWeight: '800', color: '#0F172A' },
  light: { color: '#F8FAFC' },
  btn: { alignItems: 'center', paddingVertical: 15, borderRadius: 16 },
  primary: { backgroundColor: '#2563EB' },
  darkBtn: { backgroundColor: '#0F172A' },
  lightBtn: { backgroundColor: '#E2E8F0' },
  btnText: { color: '#FFFFFF', fontWeight: '800' },
  darkText: { color: '#0F172A' },
});
`,
  },
} satisfies Playground;
