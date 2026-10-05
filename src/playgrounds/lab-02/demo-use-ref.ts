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
      <View style={styles.row}>
        <View style={[styles.tile, styles.stateTile]}>
          <Text style={styles.tag}>useState</Text>
          <Text style={styles.value}>{stateCount}</Text>
        </View>
        <View style={[styles.tile, styles.refTile]}>
          <Text style={styles.tag}>useRef</Text>
          <Text style={styles.value}>{refCount.current}</Text>
        </View>
      </View>

      <Pressable style={[styles.btn, styles.stateBtn]} onPress={() => setStateCount(stateCount + 1)}>
        <Text style={styles.btnText}>state + 1 · redraws</Text>
      </Pressable>
      <Pressable
        style={[styles.btn, styles.refBtn]}
        onPress={() => {
          refCount.current += 1;
          console.log('ref is now', refCount.current, '(the screen did not redraw)');
        }}>
        <Text style={styles.btnText}>ref + 1 · silent</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', gap: 12, padding: 20, backgroundColor: '#F8FAFC' },
  row: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  tile: { flex: 1, alignItems: 'center', paddingVertical: 22, borderRadius: 22 },
  stateTile: { backgroundColor: '#DBEAFE' },
  refTile: { backgroundColor: '#EDE9FE' },
  tag: { fontSize: 12, fontWeight: '800', color: '#475569', letterSpacing: 0.5 },
  value: { fontSize: 46, fontWeight: '800', color: '#0F172A' },
  btn: { alignItems: 'center', paddingVertical: 15, borderRadius: 16 },
  stateBtn: { backgroundColor: '#2563EB' },
  refBtn: { backgroundColor: '#7C3AED' },
  btnText: { color: '#FFFFFF', fontWeight: '800' },
});
`,
  },
} satisfies Playground;
