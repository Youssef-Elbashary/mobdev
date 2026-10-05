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
      <Text style={styles.title}>Stopwatch</Text>
      <View style={[styles.ring, running && styles.ringOn]}>
        <Text style={styles.time}>{seconds}</Text>
        <Text style={styles.unit}>seconds</Text>
      </View>
      <View style={styles.row}>
        <Pressable style={[styles.btn, styles.start]} onPress={() => setRunning(true)}>
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
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 28, backgroundColor: '#0B1120' },
  title: { color: '#94A3B8', fontSize: 14, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' },
  ring: {
    width: 190, height: 190, borderRadius: 95, borderWidth: 8, borderColor: '#1E293B',
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F172A',
  },
  ringOn: { borderColor: '#22D3EE', boxShadow: '0 0 40px rgba(34, 211, 238, 0.35)' },
  time: { fontSize: 64, fontWeight: '800', color: '#F8FAFC', fontVariant: ['tabular-nums'] },
  unit: { color: '#64748B', fontSize: 13, marginTop: -4 },
  row: { flexDirection: 'row', gap: 12 },
  btn: { minWidth: 104, alignItems: 'center', paddingVertical: 13, borderRadius: 999 },
  start: { backgroundColor: '#10B981' },
  stop: { backgroundColor: '#F43F5E' },
  btnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
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
