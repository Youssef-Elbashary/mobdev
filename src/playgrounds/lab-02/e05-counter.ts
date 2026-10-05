import type { Playground } from '@/lib/playgrounds';

const start = `import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

export default function App() {
  const [count, setCount] = useState(0);

  return (
    <View style={styles.screen}>
      <Text style={styles.count}>{count}</Text>
      <View style={styles.row}>
        {/* TODO 1: a "−" button: subtract 1, but never go below 0 */}
        <Pressable style={styles.btn} onPress={() => setCount(count + 1)}>
          <Text style={styles.btnText}>+</Text>
        </Pressable>
      </View>
      {/* TODO 2: a "Reset" button that sets the count back to 0 */}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 },
  count: { fontSize: 64, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 12 },
  btn: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#fff', fontSize: 24, fontWeight: '700' },
  reset: { color: '#2563eb', fontSize: 16 },
});
`;

const solution = start
  .replace(
    `        {/* TODO 1: a "−" button: subtract 1, but never go below 0 */}\n`,
    `        <Pressable style={styles.btn} onPress={() => setCount(Math.max(0, count - 1))}>\n          <Text style={styles.btnText}>−</Text>\n        </Pressable>\n`,
  )
  .replace(
    `      {/* TODO 2: a "Reset" button that sets the count back to 0 */}\n`,
    `      <Pressable onPress={() => setCount(0)}>\n        <Text style={styles.reset}>Reset</Text>\n      </Pressable>\n`,
  );

export default {
  title: 'Counter: +, − and Reset',
  goal: 'Add a **−** button (never below 0) and a **Reset** button. Use the `count` state that is already there.',
  hint: 'Never below 0: `setCount(Math.max(0, count - 1))`. Reset is just `setCount(0)`. Copy the `+` button and change it.',
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
