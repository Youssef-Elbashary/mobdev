import type { Playground } from '@/lib/playgrounds';

export default {
  title: 'useEffect: when does it run?',
  goal: 'Watch the **console**: `[]` runs once after the first render, `[count]` runs every time `count` changes, and the returned function is the **cleanup**. **Try:** tap +1, then Hide.',
  files: {
    'App.tsx': `import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

function Counter() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    console.log('① mounted: runs once ([])');
    return () => console.log('③ cleanup: the component left the screen');
  }, []);

  useEffect(() => {
    console.log('② count changed to', count, '([count])');
  }, [count]);

  return (
    <Pressable style={styles.btn} onPress={() => setCount(count + 1)}>
      <Text style={styles.btnText}>+1 (count: {count})</Text>
    </Pressable>
  );
}

export default function App() {
  const [show, setShow] = useState(true);
  return (
    <View style={styles.screen}>
      {show && <Counter />}
      <Pressable onPress={() => setShow(!show)}>
        <Text style={styles.link}>{show ? 'Hide the counter' : 'Show the counter'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 },
  btn: { backgroundColor: '#111', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10 },
  btnText: { color: '#fff', fontWeight: '600' },
  link: { color: '#2563eb', fontSize: 15 },
});
`,
  },
} satisfies Playground;
