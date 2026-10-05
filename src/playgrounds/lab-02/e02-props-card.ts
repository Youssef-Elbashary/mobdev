import type { Playground } from '@/lib/playgrounds';

const styles = `const styles = StyleSheet.create({
  screen: { flex: 1, padding: 20, paddingTop: 28, gap: 12, backgroundColor: '#F8FAFC' },
  eyebrow: { fontSize: 12, fontWeight: '700', color: '#94A3B8', letterSpacing: 1.2 },
  heading: { fontSize: 28, fontWeight: '800', color: '#0F172A', marginBottom: 8 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 18,
    backgroundColor: '#FFFFFF', boxShadow: '0 6px 20px rgba(15, 23, 42, 0.08)',
  },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E0E7FF' },
  initial: { fontSize: 20, fontWeight: '800', color: '#4338CA' },
  name: { fontSize: 17, fontWeight: '700', color: '#0F172A' },
  role: {
    alignSelf: 'flex-start', marginTop: 4, paddingVertical: 2, paddingHorizontal: 10, borderRadius: 999, overflow: 'hidden',
    backgroundColor: '#F1F5F9', color: '#475569', fontSize: 12, fontWeight: '600',
  },
});
`;

const start = `import { View, Text, StyleSheet } from 'react-native';

// TODO 1: receive the props: function Card({ name, role })
function Card() {
  return (
    <View style={styles.card}>
      <View style={styles.avatar}>
        <Text style={styles.initial}>?</Text>
      </View>
      <View>
        {/* TODO 2: show the name and the role instead of these */}
        <Text style={styles.name}>Name</Text>
        <Text style={styles.role}>Role</Text>
      </View>
    </View>
  );
}

export default function App() {
  return (
    <View style={styles.screen}>
      <Text style={styles.eyebrow}>MOBILE DEVELOPMENT</Text>
      <Text style={styles.heading}>Our team</Text>
      {/* TODO 3: two cards: Mariam / Student and Omar / TA */}
      <Card />
    </View>
  );
}

${styles}`;

const solution = `import { View, Text, StyleSheet } from 'react-native';

function Card({ name, role }: { name: string; role: string }) {
  return (
    <View style={styles.card}>
      <View style={styles.avatar}>
        <Text style={styles.initial}>{name[0]}</Text>
      </View>
      <View>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.role}>{role}</Text>
      </View>
    </View>
  );
}

export default function App() {
  return (
    <View style={styles.screen}>
      <Text style={styles.eyebrow}>MOBILE DEVELOPMENT</Text>
      <Text style={styles.heading}>Our team</Text>
      <Card name="Mariam" role="Student" />
      <Card name="Omar" role="TA" />
    </View>
  );
}

${styles}`;

export default {
  title: 'A reusable card with props',
  goal: 'Make `Card` show the `name` and `role` it receives, then use it **twice**: **Mariam / Student** and **Omar / TA**.',
  hint: 'Props are the component’s arguments: `function Card({ name, role })`. Inside JSX use `{name}`. Use it like `<Card name="Omar" role="TA" />`. Bonus: show the first letter with `{name[0]}`.',
  files: { 'App.tsx': start },
  solution: { 'App.tsx': solution },
  checks: [
    { name: 'Card receives props', steps: [{ expectCode: 'function Card\\s*\\(\\s*(\\{|props)', message: 'Receive the props: function Card({ name, role })' }] },
    { name: 'Shows Mariam / Student', steps: [{ expectText: 'Mariam', exact: true }, { expectText: 'Student', exact: true }] },
    { name: 'Shows Omar / TA', steps: [{ expectText: 'Omar', exact: true }, { expectText: 'TA', exact: true }] },
    { name: 'No placeholder text left', steps: [{ expectNoText: 'Name', exact: true }, { expectNoText: 'Role', exact: true }] },
  ],
} satisfies Playground;
