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
      <Text style={styles.title}>To-Do</Text>
      <View style={styles.row}>
        <TextInput ref={inputRef} style={styles.input} placeholder="New task" value={text} onChangeText={setText} />
        <Pressable style={styles.add} onPress={addTodo}>
          <Text style={styles.addText}>Add</Text>
        </Pressable>
      </View>
      <FlatList
        data={todos}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <Pressable style={styles.grow} onPress={() => toggle(item.id)}>
              {/* TODO 3: when item.done, also apply styles.done (line-through) */}
              <Text style={styles.text}>{item.text}</Text>
            </Pressable>
            <Pressable testID={'delete-' + item.id} onPress={() => remove(item.id)}>
              <Text style={styles.trash}>🗑</Text>
            </Pressable>
          </View>
        )}
      />
      <Text style={styles.count}>{todos.filter((t) => t.done).length} of {todos.length} done</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 20, gap: 12 },
  title: { fontSize: 28, fontWeight: '800' },
  row: { flexDirection: 'row', gap: 8 },
  input: { flex: 1, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 12, fontSize: 16 },
  add: { backgroundColor: '#2563eb', paddingHorizontal: 16, justifyContent: 'center', borderRadius: 10 },
  addText: { color: '#fff', fontWeight: '700' },
  item: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 10, backgroundColor: '#f1f5f9', marginBottom: 8 },
  grow: { flex: 1 },
  text: { fontSize: 16 },
  done: { textDecorationLine: 'line-through', color: '#94a3b8' },
  trash: { fontSize: 18 },
  count: { color: '#64748b' },
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
