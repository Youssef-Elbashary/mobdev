import type { Playground } from '@/lib/playgrounds';

export default {
  title: 'useEffect: when does it run?',
  goal: 'Watch the **console**: `[]` runs once after the first render, `[count]` runs every time `count` changes, and the returned function is the **cleanup**. **Try:** tap +1 a few times, then Hide.',
  files: {
    'App.tsx': `import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

function Counter() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    console.log('① mounted: runs once ([])');
    return () => console.log('③ cleanup: the component left the screen');
  }, []);

  useEffect(() => {
    console.log('② count changed to', count, '([count])');
  }, [count]);

  return (
    <View style={styles.card}>
      <Text style={styles.label}>COUNT</Text>
      <Text style={styles.count}>{count}</Text>
      <Pressable style={styles.btn} onPress={() => setCount(count + 1)}>
        <Text style={styles.btnText}>+1</Text>
      </Pressable>
    </View>
  );
}

export default function App() {
  const [show, setShow] = useState(true);
  return (
    <View style={styles.screen}>
      {show ? <Counter /> : <Text style={styles.gone}>The counter left the screen 👋</Text>}
      <Pressable style={styles.toggle} onPress={() => setShow(!show)}>
        <Text style={styles.toggleText}>{show ? 'Hide the counter' : 'Show the counter'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 22, padding: 22, backgroundColor: '#ECFEFF' },
  card: { alignSelf: 'stretch', alignItems: 'center', gap: 6, paddingVertical: 26, borderRadius: 26, backgroundColor: '#FFFFFF', boxShadow: '0 14px 36px rgba(14, 116, 144, 0.14)' },
  label: { fontSize: 12, fontWeight: '800', letterSpacing: 2, color: '#06B6D4' },
  count: { fontSize: 64, fontWeight: '800', color: '#164E63' },
  btn: { marginTop: 6, paddingVertical: 12, paddingHorizontal: 34, borderRadius: 999, backgroundColor: '#0891B2' },
  btnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
  gone: { color: '#0E7490', fontSize: 16 },
  toggle: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 999, borderWidth: 1.5, borderColor: '#A5F3FC' },
  toggleText: { color: '#0E7490', fontWeight: '700' },
});
`,
  },
} satisfies Playground;
