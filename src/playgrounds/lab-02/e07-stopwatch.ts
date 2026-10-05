import type { Playground } from '@/lib/playgrounds';

const start = `import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

export default function App() {
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    // TODO: while running is true, add 1 to seconds every 1000 ms.
    //  1. if (!running) return;
    //  2. const id = setInterval(...)
    //  3. return a cleanup function that calls clearInterval(id)
  }, [running]);

  return (
    <View style={styles.screen}>
      <Text style={styles.time}>{seconds}</Text>
      <View style={styles.row}>
        <Pressable style={styles.btn} onPress={() => setRunning(true)}>
          <Text style={styles.btnText}>Start</Text>
        </Pressable>
        <Pressable style={[styles.btn, styles.stop]} onPress={() => setRunning(false)}>
          <Text style={styles.btnText}>Stop</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24 },
  time: { fontSize: 72, fontWeight: '700', fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', gap: 12 },
  btn: { paddingVertical: 12, paddingHorizontal: 22, borderRadius: 12, backgroundColor: '#16a34a' },
  stop: { backgroundColor: '#dc2626' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
`;

const solution = start.replace(
  `    // TODO: while running is true, add 1 to seconds every 1000 ms.
    //  1. if (!running) return;
    //  2. const id = setInterval(...)
    //  3. return a cleanup function that calls clearInterval(id)`,
  `    if (!running) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);`,
);

export default {
  title: 'Stopwatch with useEffect',
  goal: 'When **Start** is pressed, count up every second; **Stop** pauses it. Start the timer in `useEffect` and **clean it up**.',
  hint: 'Use the updater form so the interval always adds to the latest value: `setSeconds((s) => s + 1)`. The function you `return` from the effect runs when `running` changes, so that is where `clearInterval(id)` goes.',
  files: { 'App.tsx': start },
  solution: { 'App.tsx': solution },
  checks: [
    { name: 'Starts at 0', steps: [{ expectText: '0', exact: true }] },
    { name: 'Counts after Start', steps: [{ press: 'Start' }, { wait: 1250 }, { expectText: '1', exact: true }] },
    { name: 'Stop pauses the count', steps: [{ press: 'Start' }, { wait: 1250 }, { press: 'Stop' }, { wait: 1250 }, { expectText: '1', exact: true }] },
    { name: 'Cleans up the interval', steps: [{ expectCode: 'return\\s*\\(\\s*\\)\\s*=>\\s*\\{?\\s*clearInterval', message: 'Return a cleanup from the effect: return () => clearInterval(id);' }] },
  ],
} satisfies Playground;
