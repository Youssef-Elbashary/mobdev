import type { Playground } from '@/lib/playgrounds';

export default {
  title: 'One component, many looks',
  goal: '`Badge` is written once and used three times with different **props**. **Try:** add a fourth badge, or a new prop like `size`.',
  files: {
    'App.tsx': `import { View, Text, StyleSheet } from 'react-native';

type BadgeProps = { label: string; color: string };

// a component is a function: props in → UI out
function Badge({ label, color }: BadgeProps) {
  return (
    <View style={[styles.badge, { backgroundColor: color }]}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

export default function App() {
  return (
    <View style={styles.screen}>
      <Badge label="React" color="#0ea5e9" />
      <Badge label="Expo" color="#111827" />
      <Badge label="Hooks" color="#16a34a" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  badge: { paddingVertical: 8, paddingHorizontal: 18, borderRadius: 999 },
  text: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
`,
  },
} satisfies Playground;
