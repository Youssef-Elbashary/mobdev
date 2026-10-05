import type { Playground } from '@/lib/playgrounds';

const start = `import { View, Text, StyleSheet } from 'react-native';

// This screen has 3 JSX mistakes. Press Run to see the first error,
// fix it, run again… until the card shows all three lines.
export default function App() {
  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.emoji}>👋</Text>
        <Text class="title">Hello</Text>
        Mobile Dev
      </View>
    </View>
    <Text style={styles.badge}>Lab 02</Text>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#F5F3FF' },
  card: {
    alignSelf: 'stretch', alignItems: 'center', gap: 6, paddingVertical: 32, paddingHorizontal: 24,
    borderRadius: 28, backgroundColor: '#FFFFFF', boxShadow: '0 12px 32px rgba(76, 29, 149, 0.12)',
  },
  emoji: { fontSize: 44, marginBottom: 6 },
  title: { fontSize: 36, fontWeight: '800', color: '#1E1B4B', letterSpacing: -0.5 },
  subtitle: { fontSize: 17, color: '#6B7280' },
  badge: {
    marginTop: 14, paddingVertical: 5, paddingHorizontal: 14, borderRadius: 999, overflow: 'hidden',
    backgroundColor: '#EDE9FE', color: '#6D28D9', fontWeight: '700', fontSize: 13,
  },
});
`;

const solution = `import { View, Text, StyleSheet } from 'react-native';

export default function App() {
  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.emoji}>👋</Text>
        <Text style={styles.title}>Hello</Text>
        <Text style={styles.subtitle}>Mobile Dev</Text>
        <Text style={styles.badge}>Lab 02</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#F5F3FF' },
  card: {
    alignSelf: 'stretch', alignItems: 'center', gap: 6, paddingVertical: 32, paddingHorizontal: 24,
    borderRadius: 28, backgroundColor: '#FFFFFF', boxShadow: '0 12px 32px rgba(76, 29, 149, 0.12)',
  },
  emoji: { fontSize: 44, marginBottom: 6 },
  title: { fontSize: 36, fontWeight: '800', color: '#1E1B4B', letterSpacing: -0.5 },
  subtitle: { fontSize: 17, color: '#6B7280' },
  badge: {
    marginTop: 14, paddingVertical: 5, paddingHorizontal: 14, borderRadius: 999, overflow: 'hidden',
    backgroundColor: '#EDE9FE', color: '#6D28D9', fontWeight: '700', fontSize: 13,
  },
});
`;

export default {
  title: 'Fix the JSX',
  goal: 'Fix the **3 mistakes**: two elements at the top level, text outside `<Text>`, and `class` instead of `style`.',
  hint: 'Move `<Text style={styles.badge}>Lab 02</Text>` **inside** the card. Wrap "Mobile Dev" in `<Text style={styles.subtitle}>`. Replace `class="title"` with `style={styles.title}`.',
  files: { 'App.tsx': start },
  solution: { 'App.tsx': solution },
  checks: [
    { name: 'The app runs without errors', steps: [{ expectText: 'Hello' }] },
    { name: 'Shows "Mobile Dev" inside a <Text>', steps: [{ expectText: 'Mobile Dev', exact: true }] },
    { name: 'Shows "Lab 02"', steps: [{ expectText: 'Lab 02', exact: true }] },
    { name: 'Uses style, not class', steps: [{ expectCode: '^(?![\\s\\S]*\\bclass=)', message: 'React Native has no class attribute: use style={styles.title}.' }] },
  ],
} satisfies Playground;
