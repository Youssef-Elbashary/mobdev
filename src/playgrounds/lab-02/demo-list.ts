import type { Playground } from '@/lib/playgrounds';

export default {
  title: 'FlatList: lists that scroll',
  goal: '`FlatList` takes the **data**, how to draw one item (**renderItem**) and a unique **key** per item. **Try:** add a lab to the array and scroll.',
  files: {
    'App.tsx': `import { View, Text, FlatList, StyleSheet } from 'react-native';

const labs = [
  { id: '1', title: 'Tools & Git', emoji: '🧰', color: '#F59E0B', done: true },
  { id: '2', title: 'React & Hooks', emoji: '⚛️', color: '#0EA5E9', done: false },
  { id: '3', title: 'Navigation', emoji: '🧭', color: '#8B5CF6', done: false },
  { id: '4', title: 'APIs', emoji: '🌐', color: '#10B981', done: false },
  { id: '5', title: 'Storage', emoji: '💾', color: '#F43F5E', done: false },
  { id: '6', title: 'Device features', emoji: '📷', color: '#6366F1', done: false },
];

export default function App() {
  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={labs}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.eyebrow}>THIS TERM</Text>
          <Text style={styles.title}>Labs</Text>
        </View>
      }
      renderItem={({ item, index }) => (
        <View style={styles.row}>
          <View style={[styles.icon, { backgroundColor: item.color + '22' }]}>
            <Text style={styles.emoji}>{item.emoji}</Text>
          </View>
          <View style={styles.body}>
            <Text style={styles.number}>LAB {index + 1}</Text>
            <Text style={styles.name}>{item.title}</Text>
          </View>
          <Text style={item.done ? styles.done : styles.todo}>{item.done ? '✓' : '›'}</Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 16, gap: 10 },
  header: { marginBottom: 6, marginTop: 8 },
  eyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 1.5, color: '#94A3B8' },
  title: { fontSize: 30, fontWeight: '800', color: '#0F172A' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 18, backgroundColor: '#FFFFFF', boxShadow: '0 4px 14px rgba(15, 23, 42, 0.06)' },
  icon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 22 },
  body: { flex: 1 },
  number: { fontSize: 11, fontWeight: '800', color: '#94A3B8', letterSpacing: 1 },
  name: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  done: { color: '#10B981', fontSize: 18, fontWeight: '900' },
  todo: { color: '#CBD5E1', fontSize: 24 },
});
`,
  },
} satisfies Playground;
