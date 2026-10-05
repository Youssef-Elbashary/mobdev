import type { Playground } from '@/lib/playgrounds';

export default {
  title: 'JSX: JavaScript inside your markup',
  goal: 'Everything inside `{ }` is JavaScript. **Try:** change `user.name`, the math, or the colour, then press **Run**.',
  files: {
    'App.tsx': `import { View, Text, StyleSheet } from 'react-native';

const user = { name: 'Mariam', year: 3 };

export default function App() {
  const today = new Date().toLocaleDateString('en-GB');

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Hello, {user.name} 👋</Text>
      <Text>Year {user.year} · {today}</Text>
      <Text>2 + 2 = {2 + 2}</Text>
      {/* a style written inline is an object, so: double braces */}
      <Text style={{ color: '#2563eb', fontWeight: '700' }}>Styled inline</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', padding: 24, gap: 10 },
  title: { fontSize: 26, fontWeight: '800' },
});
`,
  },
} satisfies Playground;
