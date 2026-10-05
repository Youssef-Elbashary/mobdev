import type { Playground } from '@/lib/playgrounds';

export default {
  title: 'FlatList: lists that scroll',
  goal: '`FlatList` takes the **data**, how to draw one item (**renderItem**) and a unique **key** per item. **Try:** add a lab to the array.',
  files: {
    'App.tsx': `import { View, Text, FlatList, StyleSheet } from 'react-native';

const labs = [
  { id: '1', title: 'Tools & Git', emoji: '🧰' },
  { id: '2', title: 'React & Hooks', emoji: '⚛️' },
  { id: '3', title: 'Navigation', emoji: '🧭' },
  { id: '4', title: 'APIs', emoji: '🌐' },
  { id: '5', title: 'Storage', emoji: '💾' },
];

export default function App() {
  return (
    <FlatList
      data={labs}
      keyExtractor={(item) => item.id}
      renderItem={({ item, index }) => (
        <View style={styles.row}>
          <Text style={styles.emoji}>{item.emoji}</Text>
          <Text style={styles.title}>Lab {index + 1}: {item.title}</Text>
        </View>
      )}
      ItemSeparatorComponent={() => <View style={styles.line} />}
      ListHeaderComponent={<Text style={styles.header}>Labs</Text>}
    />
  );
}

const styles = StyleSheet.create({
  header: { fontSize: 28, fontWeight: '800', padding: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  emoji: { fontSize: 24 },
  title: { fontSize: 16 },
  line: { height: 1, backgroundColor: '#e5e7eb', marginLeft: 16 },
});
`,
  },
} satisfies Playground;
