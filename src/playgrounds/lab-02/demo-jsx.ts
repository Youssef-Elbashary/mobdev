import type { Playground } from '@/lib/playgrounds';

export default {
  title: 'JSX: JavaScript inside your markup',
  goal: 'Everything inside `{ }` is JavaScript. **Try:** change `user.name`, the math, or the colour, then press **Run**.',
  files: {
    'App.tsx': `import { View, Text, StyleSheet } from 'react-native';

const user = { name: 'Mariam', year: 3, emoji: '👩‍💻' };

export default function App() {
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <View style={styles.screen}>
      <Text style={styles.date}>{today}</Text>
      <View style={styles.card}>
        <Text style={styles.avatar}>{user.emoji}</Text>
        <Text style={styles.title}>Hello, {user.name}</Text>
        <Text style={styles.sub}>Year {user.year} · Mobile Development</Text>
        <View style={styles.row}>
          <Text style={styles.stat}>{2 + 2}{'\\n'}<Text style={styles.statLabel}>labs</Text></Text>
          <Text style={styles.stat}>{user.year * 10}%{'\\n'}<Text style={styles.statLabel}>progress</Text></Text>
        </View>
        {/* an inline style is an object, so: double braces */}
        <Text style={{ color: '#7C3AED', fontWeight: '800' }}>Styled inline ✨</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', padding: 22, backgroundColor: '#F5F3FF' },
  date: { color: '#8B5CF6', fontWeight: '700', fontSize: 13, marginBottom: 10 },
  card: { alignItems: 'center', gap: 8, padding: 24, borderRadius: 26, backgroundColor: '#FFFFFF', boxShadow: '0 14px 36px rgba(91, 33, 182, 0.14)' },
  avatar: { fontSize: 44 },
  title: { fontSize: 26, fontWeight: '800', color: '#2E1065' },
  sub: { color: '#6B7280' },
  row: { flexDirection: 'row', gap: 10, marginVertical: 8 },
  stat: { minWidth: 92, textAlign: 'center', paddingVertical: 10, borderRadius: 16, overflow: 'hidden', backgroundColor: '#F5F3FF', color: '#4C1D95', fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 11, fontWeight: '600', color: '#8B5CF6' },
});
`,
  },
} satisfies Playground;
