import type { Playground } from '@/lib/playgrounds';

const start = `import { useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, StyleSheet } from 'react-native';

type Todo = { id: string; text: string; done: boolean };

export default function App() {
  const [todos, setTodos] = useState<Todo[]>([
    { id: '1', text: 'Learn JSX', done: false },
    { id: '2', text: 'Read the docs', done: false },
  ]);
  const [text, setText] = useState('');
  const inputRef = useRef<TextInput>(null);
  const doneCount = todos.filter((t) => t.done).length;

  function addTodo() {
    if (!text.trim()) return;
    setTodos([...todos, { id: Date.now().toString(), text: text.trim(), done: false }]);
    setText('');
    inputRef.current?.focus();
  }

  function toggle(id: string) {
    // TODO 1: flip "done" for the todo with this id (use todos.map)
  }

  function remove(id: string) {
    // TODO 2: remove the todo with this id (use todos.filter)
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.eyebrow}>TODAY</Text>
      <Text style={styles.title}>To-Do</Text>
      <View style={styles.progress}>
        <View style={[styles.bar, { width: todos.length ? \`\${(doneCount / todos.length) * 100}%\` : 0 }]} />
      </View>
      <Text style={styles.count}>{doneCount} of {todos.length} done</Text>
      <View style={styles.row}>
        <TextInput ref={inputRef} style={styles.input} placeholder="New task" value={text} onChangeText={setText} />
        <Pressable style={styles.add} onPress={addTodo}>
          <Text style={styles.addText}>Add</Text>
        </Pressable>
      </View>
      <FlatList
        data={todos}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <Pressable style={styles.grow} onPress={() => toggle(item.id)}>
              <View style={[styles.circle, item.done && styles.circleOn]}>
                {item.done && <Text style={styles.tick}>✓</Text>}
              </View>
              {/* TODO 3: when item.done, also apply styles.done (line-through) */}
              <Text style={styles.text}>{item.text}</Text>
            </Pressable>
            <Pressable testID={'delete-' + item.id} style={styles.trashBtn} onPress={() => remove(item.id)}>
              <Text style={styles.trash}>🗑</Text>
            </Pressable>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 18, paddingTop: 26, backgroundColor: '#F5F7FF' },
  eyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 1.5, color: '#6366F1' },
  title: { fontSize: 30, fontWeight: '800', color: '#1E1B4B' },
  progress: { height: 6, borderRadius: 3, backgroundColor: '#E0E7FF', marginTop: 12, overflow: 'hidden' },
  bar: { height: 6, borderRadius: 3, backgroundColor: '#4F46E5' },
  count: { color: '#6366F1', fontWeight: '700', fontSize: 12, marginTop: 6, marginBottom: 12 },
  row: {
    flexDirection: 'row', gap: 8, padding: 6, borderRadius: 16,
    backgroundColor: '#FFFFFF', boxShadow: '0 6px 18px rgba(49, 46, 129, 0.1)',
  },
  input: { flex: 1, paddingHorizontal: 10, fontSize: 16 },
  add: { paddingHorizontal: 18, paddingVertical: 11, borderRadius: 12, backgroundColor: '#4F46E5' },
  addText: { color: '#FFFFFF', fontWeight: '800' },
  list: { gap: 8, paddingTop: 16 },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingLeft: 14, paddingRight: 6, borderRadius: 14, backgroundColor: '#FFFFFF' },
  grow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  circle: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#C7D2FE', alignItems: 'center', justifyContent: 'center' },
  circleOn: { backgroundColor: '#4F46E5', borderColor: '#4F46E5' },
  tick: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  text: { fontSize: 16, color: '#1E1B4B' },
  done: { textDecorationLine: 'line-through', color: '#A5B4FC' },
  trashBtn: { padding: 8 },
  trash: { fontSize: 17 },
});
`;

const solution = start
  .replace(
    `    // TODO 1: flip "done" for the todo with this id (use todos.map)`,
    `    setTodos(todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));`,
  )
  .replace(
    `    // TODO 2: remove the todo with this id (use todos.filter)`,
    `    setTodos(todos.filter((t) => t.id !== id));`,
  )
  .replace(
    `              {/* TODO 3: when item.done, also apply styles.done (line-through) */}
              <Text style={styles.text}>{item.text}</Text>`,
    `              <Text style={[styles.text, item.done && styles.done]}>{item.text}</Text>`,
  );

export default {
  title: 'To-Do, part 2: check and delete',
  goal: 'The slides’ challenge: tapping a task **checks** it (line-through), and 🗑 **deletes** it.',
  hint: 'Toggle: `todos.map((t) => t.id === id ? { ...t, done: !t.done } : t)`. Delete: `todos.filter((t) => t.id !== id)`. Several styles: `style={[styles.text, item.done && styles.done]}`.',
  files: { 'App.tsx': start },
  solution: { 'App.tsx': solution },
  checks: [
    { name: 'Tapping a task marks it done', steps: [{ press: 'Learn JSX' }, { expectText: '1 of 2 done', exact: true }] },
    { name: 'A done task is crossed out', steps: [{ press: 'Learn JSX' }, { expectStyle: { text: 'Learn JSX', prop: 'text-decoration-line', includes: 'line-through' } }] },
    { name: 'Tapping again un-checks it', steps: [{ press: 'Learn JSX' }, { press: 'Learn JSX' }, { expectText: '0 of 2 done', exact: true }] },
    { name: '🗑 deletes only that task', steps: [{ press: 'delete-2' }, { expectNoText: 'Read the docs' }, { expectText: 'Learn JSX', exact: true }, { expectText: '0 of 1 done', exact: true }] },
  ],
} satisfies Playground;
