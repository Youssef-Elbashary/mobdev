import type { Playground } from '@/lib/playgrounds';

const start = `import { View, Text, StyleSheet } from 'react-native';

function Status({ online }: { online: boolean }) {
  // TODO: show "Online 🟢" when online is true, otherwise "Offline 🔴"
  return <Text style={styles.status}>Online 🟢</Text>;
}

function Person({ name, online }: { name: string; online: boolean }) {
  return (
    <View style={styles.row}>
      <View style={styles.avatar}><Text style={styles.initial}>{name[0]}</Text></View>
      <Text style={styles.name}>{name}</Text>
      <Status online={online} />
    </View>
  );
}

export default function App() {
  return (
    <View style={styles.screen}>
      <Text style={styles.heading}>Study group</Text>
      <View style={styles.list}>
        <Person name="Mariam" online={true} />
        <Person name="Omar" online={false} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 20, paddingTop: 28, backgroundColor: '#F0FDF4' },
  heading: { fontSize: 28, fontWeight: '800', color: '#052E16', marginBottom: 16 },
  list: { borderRadius: 18, backgroundColor: '#FFFFFF', boxShadow: '0 6px 20px rgba(5, 46, 22, 0.08)', overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#DCFCE7' },
  initial: { fontWeight: '800', color: '#15803D' },
  name: { flex: 1, fontSize: 16, fontWeight: '600', color: '#0F172A' },
  status: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, overflow: 'hidden', fontSize: 12, fontWeight: '700', backgroundColor: '#F1F5F9', color: '#475569' },
  // bonus: use these to colour the pill
  online: { backgroundColor: '#DCFCE7', color: '#15803D' },
  offline: { backgroundColor: '#FEE2E2', color: '#B91C1C' },
});
`;

const solution = start.replace(
  `  // TODO: show "Online 🟢" when online is true, otherwise "Offline 🔴"\n  return <Text style={styles.status}>Online 🟢</Text>;`,
  `  return (\n    <Text style={[styles.status, online ? styles.online : styles.offline]}>\n      {online ? 'Online 🟢' : 'Offline 🔴'}\n    </Text>\n  );`,
);

export default {
  title: 'Online or offline?',
  goal: 'Use the `online` prop to show **Online 🟢** or **Offline 🔴**. Bonus: colour the pill with `styles.online` / `styles.offline`.',
  hint: 'A ternary picks one of two values: `{online ? \'Online 🟢\' : \'Offline 🔴\'}`. Styles can be a list: `style={[styles.status, online ? styles.online : styles.offline]}`.',
  files: { 'App.tsx': start },
  solution: { 'App.tsx': solution },
  checks: [
    { name: 'online={true} shows Online 🟢', steps: [{ expectText: 'Online 🟢', exact: true }] },
    { name: 'online={false} shows Offline 🔴', steps: [{ expectText: 'Offline 🔴', exact: true }] },
  ],
} satisfies Playground;
