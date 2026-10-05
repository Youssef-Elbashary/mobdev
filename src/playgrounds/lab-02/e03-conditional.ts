import type { Playground } from '@/lib/playgrounds';

const start = `import { View, Text, StyleSheet } from 'react-native';

function Status({ online }: { online: boolean }) {
  // TODO: show "Online 🟢" when online is true, otherwise "Offline 🔴"
  return <Text style={styles.status}>Online 🟢</Text>;
}

export default function App() {
  return (
    <View style={styles.screen}>
      <Text style={styles.label}>Mariam</Text>
      <Status online={true} />
      <Text style={styles.label}>Omar</Text>
      <Status online={false} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', padding: 24, gap: 6 },
  label: { fontSize: 18, fontWeight: '700', marginTop: 10 },
  status: { fontSize: 16 },
});
`;

const solution = start.replace(
  `  // TODO: show "Online 🟢" when online is true, otherwise "Offline 🔴"\n  return <Text style={styles.status}>Online 🟢</Text>;`,
  `  return <Text style={styles.status}>{online ? 'Online 🟢' : 'Offline 🔴'}</Text>;`,
);

export default {
  title: 'Online or offline?',
  goal: 'Use the `online` prop to show **Online 🟢** or **Offline 🔴**.',
  hint: 'A ternary picks one of two values: `{online ? \'Online 🟢\' : \'Offline 🔴\'}`.',
  files: { 'App.tsx': start },
  solution: { 'App.tsx': solution },
  checks: [
    { name: 'online={true} shows Online 🟢', steps: [{ expectText: 'Online 🟢', exact: true }] },
    { name: 'online={false} shows Offline 🔴', steps: [{ expectText: 'Offline 🔴', exact: true }] },
  ],
} satisfies Playground;
