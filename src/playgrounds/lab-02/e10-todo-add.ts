import type { Playground } from '@/lib/playgrounds';

const start = `import { useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, StyleSheet } from 'react-native';

type Todo = { id: string; text: string; done: boolean };

export default function App() {
  // Step 3: a state that holds all the todos
  const [todos, setTodos] = useState<Todo[]>([{ id: '1', text: 'Learn JSX', done: false }]);
  // Step 5: the text being typed + a ref to the input
  const [text, setText] = useState('');
  const inputRef = useRef<TextInput>(null);

  // Step 7: the logic of the Add button
  function addTodo() {
    // TODO 1: ignore empty text (spaces only too)
    // TODO 2: add a new todo to the END of the list (do not change the old array!)
    // TODO 3: clear the input and put the cursor back in it
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.eyebrow}>TODAY</Text>
      <Text style={styles.title}>To-Do</Text>
      <View style={styles.row}>
        <TextInput ref={inputRef} style={styles.input} placeholder="New task" value={text} onChangeText={setText} />
        {/* Step 6: the button and its handler */}
        <Pressable style={styles.add} onPress={addTodo}>
          <Text style={styles.addText}>Add</Text>
        </Pressable>
      </View>
      {/* Step 4: the list */}
      <FlatList
        data={todos}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <View style={styles.dot} />
            <Text style={styles.text}>{item.text}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 18, paddingTop: 26, backgroundColor: '#F5F7FF' },
  eyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 1.5, color: '#6366F1' },
  title: { fontSize: 30, fontWeight: '800', color: '#1E1B4B', marginBottom: 14 },
  row: {
    flexDirection: 'row', gap: 8, padding: 6, borderRadius: 16,
    backgroundColor: '#FFFFFF', boxShadow: '0 6px 18px rgba(49, 46, 129, 0.1)',
  },
  input: { flex: 1, paddingHorizontal: 10, fontSize: 16 },
  add: { paddingHorizontal: 18, paddingVertical: 11, borderRadius: 12, backgroundColor: '#4F46E5' },
  addText: { color: '#FFFFFF', fontWeight: '800' },
  list: { gap: 8, paddingTop: 16 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 15, borderRadius: 14, backgroundColor: '#FFFFFF' },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#A5B4FC' },
  text: { fontSize: 16, color: '#1E1B4B' },
});
`;

const solution = start.replace(
  `    // TODO 1: ignore empty text (spaces only too)
    // TODO 2: add a new todo to the END of the list (do not change the old array!)
    // TODO 3: clear the input and put the cursor back in it`,
  `    if (!text.trim()) return;
    setTodos([...todos, { id: Date.now().toString(), text: text.trim(), done: false }]);
    setText('');
    inputRef.current?.focus();`,
);

export default {
  title: 'To-Do, part 1: add a task',
  goal: 'Finish `addTodo`: ignore empty text, **add** the new task to the list, then **clear** the input.',
  hint: 'Ignore empty text: `if (!text.trim()) return;`. Never push into state; make a new array: `setTodos([...todos, { id: Date.now().toString(), text, done: false }])`. Then `setText(\'\')`.',
  files: { 'App.tsx': start },
  solution: { 'App.tsx': solution },
  checks: [
    { name: 'Adds a task', steps: [{ type: 'Milk', into: 'New task' }, { press: 'Add' }, { expectText: 'Milk', exact: true }] },
    { name: 'Keeps the old tasks', steps: [{ type: 'Milk', into: 'New task' }, { press: 'Add' }, { expectText: 'Learn JSX', exact: true }] },
    { name: 'Adds more than one', steps: [{ type: 'Milk', into: 'New task' }, { press: 'Add' }, { type: 'Eggs', into: 'New task' }, { press: 'Add' }, { expectText: 'Milk', exact: true }, { expectText: 'Eggs', exact: true }] },
    { name: 'Clears the input after adding', steps: [{ expectCode: "setText\\(\\s*(''|\"\")\\s*\\)", message: "Clear the input after adding: setText('')" }] },
    { name: 'Ignores empty tasks', steps: [{ expectCode: '\\.trim\\(\\)', message: 'Ignore empty tasks: if (!text.trim()) return;' }] },
  ],
} satisfies Playground;
