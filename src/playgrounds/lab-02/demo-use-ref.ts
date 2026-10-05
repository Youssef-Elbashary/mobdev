import type { Playground } from '@/lib/playgrounds';

export default {
  title: 'useRef vs useState',
  goal: 'Both buttons add 1. Changing **state** redraws the screen; changing a **ref** keeps the value but does **not** redraw. **Try:** tap the ref button a few times, then the state button.',
  files: {
    'App.tsx': `import { useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

export default function App() {
  const [stateCount, setStateCount] = useState(0);
  const refCount = useRef(0);

  return (
    <View style={styles.screen}>
      <Text style={styles.line}>state: {stateCount}</Text>
      <Text style={styles.line}>ref: {refCount.current}</Text>

      <Pressable style={styles.btn} onPress={() => setStateCount(stateCount + 1)}>
        <Text style={styles.btnText}>state + 1 (redraws)</Text>
      </Pressable>
      <Pressable
        style={[styles.btn, styles.alt]}
        onPress={() => {
          refCount.current += 1;
          console.log('ref is now', refCount.current, '(but the screen did not redraw)');
        }}>
        <Text style={styles.btnText}>ref + 1 (silent)</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  line: { fontSize: 22, fontWeight: '700' },
  btn: { backgroundColor: '#111', padding: 14, borderRadius: 10, alignItems: 'center' },
  alt: { backgroundColor: '#7c3aed' },
  btnText: { color: '#fff', fontWeight: '600' },
});
`,
  },
} satisfies Playground;
