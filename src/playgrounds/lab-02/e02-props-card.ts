import type { Playground } from '@/lib/playgrounds';

const start = `import { View, Text, StyleSheet } from 'react-native';

// TODO 1: receive the props: function Card({ name, role })
function Card() {
  return (
    <View style={styles.card}>
      {/* TODO 2: show the name and the role instead of these */}
      <Text style={styles.name}>Name</Text>
      <Text style={styles.role}>Role</Text>
    </View>
  );
}

export default function App() {
  return (
    <View style={styles.screen}>
      {/* TODO 3: two cards: Mariam / Student and Omar / TA */}
      <Card />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', padding: 20, gap: 12 },
  card: { padding: 16, borderRadius: 14, backgroundColor: '#f1f5f9' },
  name: { fontSize: 18, fontWeight: '700' },
  role: { color: '#64748b', marginTop: 2 },
});
`;

const solution = `import { View, Text, StyleSheet } from 'react-native';

function Card({ name, role }: { name: string; role: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.name}>{name}</Text>
      <Text style={styles.role}>{role}</Text>
    </View>
  );
}

export default function App() {
  return (
    <View style={styles.screen}>
      <Card name="Mariam" role="Student" />
      <Card name="Omar" role="TA" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', padding: 20, gap: 12 },
  card: { padding: 16, borderRadius: 14, backgroundColor: '#f1f5f9' },
  name: { fontSize: 18, fontWeight: '700' },
  role: { color: '#64748b', marginTop: 2 },
});
`;

export default {
  title: 'A reusable card with props',
  goal: 'Make `Card` show the `name` and `role` it receives, then use it **twice**: **Mariam / Student** and **Omar / TA**.',
  hint: 'Props are the component’s arguments: `function Card({ name, role })`. Inside JSX use `{name}`. Use it like `<Card name="Omar" role="TA" />`.',
  files: { 'App.tsx': start },
  solution: { 'App.tsx': solution },
  checks: [
    { name: 'Card receives props', steps: [{ expectCode: 'function Card\\s*\\(\\s*(\\{|props)', message: 'Receive the props: function Card({ name, role })' }] },
    { name: 'Shows Mariam / Student', steps: [{ expectText: 'Mariam', exact: true }, { expectText: 'Student', exact: true }] },
    { name: 'Shows Omar / TA', steps: [{ expectText: 'Omar', exact: true }, { expectText: 'TA', exact: true }] },
    { name: 'No placeholder text left', steps: [{ expectNoText: 'Name', exact: true }, { expectNoText: 'Role', exact: true }] },
  ],
} satisfies Playground;
