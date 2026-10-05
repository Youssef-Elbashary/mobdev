import type { Playground } from '@/lib/playgrounds';

const start = `import { View, Text, StyleSheet } from 'react-native';

// This screen has 3 JSX mistakes. Press Run to see the first error,
// fix it, run again… until the screen shows both lines.
export default function App() {
  return (
    <View style={styles.screen}>
      <Text class="title">Hello</Text>
      Mobile Dev
    </View>
    <Text>Lab 02</Text>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  title: { fontSize: 32, fontWeight: '700' },
  subtitle: { fontSize: 18, color: '#666' },
});
`;

const solution = `import { View, Text, StyleSheet } from 'react-native';

export default function App() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Hello</Text>
      <Text style={styles.subtitle}>Mobile Dev</Text>
      <Text>Lab 02</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  title: { fontSize: 32, fontWeight: '700' },
  subtitle: { fontSize: 18, color: '#666' },
});
`;

export default {
  title: 'Fix the JSX',
  goal: 'Fix the **3 mistakes**: two elements at the top level, text outside `<Text>`, and `class` instead of `style`.',
  hint: 'Move `<Text>Lab 02</Text>` **inside** the `View`. Wrap "Mobile Dev" in `<Text style={styles.subtitle}>`. Replace `class="title"` with `style={styles.title}`.',
  files: { 'App.tsx': start },
  solution: { 'App.tsx': solution },
  checks: [
    { name: 'The app runs without errors', steps: [{ expectText: 'Hello' }] },
    { name: 'Shows "Mobile Dev" inside a <Text>', steps: [{ expectText: 'Mobile Dev', exact: true }] },
    { name: 'Shows "Lab 02"', steps: [{ expectText: 'Lab 02', exact: true }] },
    { name: 'Uses style, not class', steps: [{ expectCode: '^(?![\\s\\S]*\\bclass=)', message: 'React Native has no class attribute: use style={styles.title}.' }] },
  ],
} satisfies Playground;
