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
    // TODO 1: ignore empty text (spaces only too): if (!text.trim()) return;
    // TODO 2: add a new todo to the END of the list (do not change the old array!)
    // TODO 3: clear the input and put the cursor back in it
  }

  return (
    <View style={styles.screen}>
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
        renderItem={({ item }) => <Text style={styles.item}>{item.text}</Text>}
      />
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
  item: { padding: 14, borderRadius: 10, backgroundColor: '#f1f5f9', marginBottom: 8, fontSize: 16 },
});
`;

const solution = start.replace(
  `    // TODO 1: ignore empty text (spaces only too): if (!text.trim()) return;
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
  hint: 'Never push into state. Make a new array: `setTodos([...todos, { id: Date.now().toString(), text, done: false }])`. Then `setText(\'\')`.',
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
