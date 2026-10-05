import type { Playground } from '@/lib/playgrounds';

const start = `import { useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';

const fruits = ['Apple', 'Banana', 'Cherry', 'Grape', 'Orange', 'Pear'];
const emoji: Record<string, string> = { Apple: '🍎', Banana: '🍌', Cherry: '🍒', Grape: '🍇', Orange: '🍊', Pear: '🍐' };

export default function App() {
  const [query, setQuery] = useState('');

  // TODO: keep only the fruits whose name contains the query (ignore upper/lower case),
  // and cache the result with useMemo so it only re-runs when query changes.
  const visible = fruits;

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Fruit market</Text>
      <View style={styles.search}>
        <Text style={styles.icon}>🔍</Text>
        <TextInput style={styles.input} placeholder="Search" value={query} onChangeText={setQuery} />
      </View>
      <Text style={styles.count}>{visible.length} of {fruits.length}</Text>
      <View style={styles.grid}>
        {visible.map((fruit) => (
          <View key={fruit} style={styles.tile}>
            <Text style={styles.emoji}>{emoji[fruit]}</Text>
            <Text style={styles.name}>{fruit}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 18, paddingTop: 26, backgroundColor: '#F7FEE7' },
  title: { fontSize: 28, fontWeight: '800', color: '#1A2E05', marginBottom: 14 },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, borderRadius: 999,
    backgroundColor: '#FFFFFF', boxShadow: '0 4px 14px rgba(54, 83, 20, 0.1)',
  },
  icon: { fontSize: 14 },
  input: { flex: 1, paddingVertical: 12, fontSize: 16 },
  count: { color: '#4D7C0F', fontWeight: '700', fontSize: 12, marginTop: 14, marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '47%', alignItems: 'center', gap: 4, paddingVertical: 14, borderRadius: 18, backgroundColor: '#FFFFFF' },
  emoji: { fontSize: 30 },
  name: { fontWeight: '700', color: '#365314' },
});
`;

const solution = start.replace(
  `  // TODO: keep only the fruits whose name contains the query (ignore upper/lower case),
  // and cache the result with useMemo so it only re-runs when query changes.
  const visible = fruits;`,
  `  const visible = useMemo(
    () => fruits.filter((fruit) => fruit.toLowerCase().includes(query.toLowerCase())),
    [query],
  );`,
);

export default {
  title: 'Search with useMemo',
  goal: 'Filter the list as the user types (**"an"** leaves Banana and Orange). Wrap the filtering in `useMemo`.',
  hint: '`useMemo(() => fruits.filter((f) => f.toLowerCase().includes(query.toLowerCase())), [query])`. The `[query]` part means it only recomputes when the query changes.',
  files: { 'App.tsx': start },
  solution: { 'App.tsx': solution },
  checks: [
    { name: 'Shows all 6 fruits at first', steps: [{ expectText: '6 of 6', exact: true }] },
    { name: '"an" keeps only the matches', steps: [{ type: 'an', into: 'Search' }, { expectText: 'Banana', exact: true }, { expectText: 'Orange', exact: true }, { expectNoText: 'Apple', exact: true }, { expectNoText: 'Cherry', exact: true }, { expectNoText: 'Grape', exact: true }, { expectNoText: 'Pear', exact: true }, { expectText: '2 of 6', exact: true }] },
    { name: 'Ignores upper/lower case', steps: [{ type: 'APP', into: 'Search' }, { expectText: 'Apple', exact: true }, { expectText: '1 of 6', exact: true }] },
    { name: 'Uses useMemo', steps: [{ expectCode: 'useMemo\\s*\\(', message: 'Cache the filtered list with useMemo(() => …, [query])' }] },
  ],
} satisfies Playground;
