import type { Playground } from '@/lib/playgrounds';

const start = `import { useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';

const fruits = ['Apple', 'Banana', 'Cherry', 'Grape', 'Orange', 'Pear'];

export default function App() {
  const [query, setQuery] = useState('');

  // TODO: keep only the fruits whose name contains the query (ignore upper/lower case),
  // and cache the result with useMemo so it only re-runs when query changes.
  const visible = fruits;

  return (
    <View style={styles.screen}>
      <TextInput style={styles.input} placeholder="Search" value={query} onChangeText={setQuery} />
      {visible.map((fruit) => (
        <Text key={fruit} style={styles.row}>{fruit}</Text>
      ))}
      <Text style={styles.count}>{visible.length} of {fruits.length}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 20, gap: 8 },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 12, fontSize: 16, marginBottom: 6 },
  row: { padding: 12, borderRadius: 10, backgroundColor: '#f1f5f9', fontSize: 16 },
  count: { color: '#64748b', marginTop: 6 },
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
