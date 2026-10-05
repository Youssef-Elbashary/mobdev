import type { Playground } from '@/lib/playgrounds';

export default {
  title: 'useMemo: skip slow work',
  goal: 'The slow calculation only re-runs when `n` changes. Toggling the theme re-renders the screen but **reuses** the cached result (watch the console). **Try:** remove `useMemo` and toggle again.',
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
    <View style={[styles.screen, dark && styles.dark]}>
      <Text style={[styles.big, dark && styles.light]}>{total.toLocaleString()}</Text>
      <Pressable style={styles.btn} onPress={() => setN(n + 1)}>
        <Text style={styles.btnText}>n + 1 (recomputes)</Text>
      </Pressable>
      <Pressable style={[styles.btn, styles.alt]} onPress={() => setDark(!dark)}>
        <Text style={styles.btnText}>toggle theme (uses the cache)</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  dark: { backgroundColor: '#0f172a' },
  big: { fontSize: 28, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  light: { color: '#fff' },
  btn: { backgroundColor: '#2563eb', padding: 14, borderRadius: 10, alignItems: 'center' },
  alt: { backgroundColor: '#64748b' },
  btnText: { color: '#fff', fontWeight: '600' },
});
`,
  },
} satisfies Playground;
