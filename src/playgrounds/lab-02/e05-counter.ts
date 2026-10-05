import type { Playground } from '@/lib/playgrounds';

const start = `import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

export default function App() {
  const [count, setCount] = useState(0);

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.label}>TAPS</Text>
        <Text style={styles.count}>{count}</Text>
        <View style={styles.row}>
          {/* TODO 1: a "−" button: subtract 1, but never go below 0 */}
          <Pressable style={styles.btn} onPress={() => setCount(count + 1)}>
            <Text style={styles.btnText}>+</Text>
          </Pressable>
        </View>
        {/* TODO 2: a "Reset" button that sets the count back to 0 */}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', padding: 22, backgroundColor: '#EEF2FF' },
  card: {
    alignItems: 'center', gap: 18, paddingVertical: 30, borderRadius: 28,
    backgroundColor: '#FFFFFF', boxShadow: '0 14px 36px rgba(67, 56, 202, 0.15)',
  },
  label: { fontSize: 12, fontWeight: '800', letterSpacing: 2, color: '#818CF8' },
  count: { fontSize: 76, fontWeight: '800', color: '#1E1B4B', fontVariant: ['tabular-nums'], marginVertical: -6 },
  row: { flexDirection: 'row', gap: 14 },
  btn: {
    width: 62, height: 62, borderRadius: 31, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#4F46E5', boxShadow: '0 8px 18px rgba(79, 70, 229, 0.35)',
  },
  btnText: { color: '#FFFFFF', fontSize: 28, fontWeight: '700', marginTop: -2 },
  reset: { paddingVertical: 8, paddingHorizontal: 18, borderRadius: 999, overflow: 'hidden', backgroundColor: '#EEF2FF', color: '#4338CA', fontWeight: '700' },
});
`;

const solution = start
  .replace(
    `          {/* TODO 1: a "−" button: subtract 1, but never go below 0 */}\n`,
    `          <Pressable style={styles.btn} onPress={() => setCount(Math.max(0, count - 1))}>\n            <Text style={styles.btnText}>−</Text>\n          </Pressable>\n`,
  )
  .replace(
    `        {/* TODO 2: a "Reset" button that sets the count back to 0 */}\n`,
    `        <Pressable onPress={() => setCount(0)}>\n          <Text style={styles.reset}>Reset</Text>\n        </Pressable>\n`,
  );

export default {
  title: 'Counter: +, − and Reset',
  goal: 'Add a **−** button (never below 0) and a **Reset** button. Use the `count` state that is already there.',
  hint: 'Never below 0: `setCount(Math.max(0, count - 1))`. Reset is just `setCount(0)`. Copy the `+` button and change it; `styles.reset` is ready for the Reset text.',
  files: { 'App.tsx': start },
  solution: { 'App.tsx': solution },
  checks: [
    { name: 'Starts at 0', steps: [{ expectText: '0', exact: true }] },
    { name: '+ adds 1', steps: [{ press: '+' }, { expectText: '1', exact: true }] },
    { name: '− subtracts 1', steps: [{ press: '+' }, { press: '+' }, { press: '−' }, { expectText: '1', exact: true }] },
    { name: '− never goes below 0', steps: [{ press: '−' }, { expectText: '0', exact: true }, { expectNoText: '-1' }] },
    { name: 'Reset goes back to 0', steps: [{ press: '+' }, { press: '+' }, { press: 'Reset' }, { expectText: '0', exact: true }] },
  ],
} satisfies Playground;
