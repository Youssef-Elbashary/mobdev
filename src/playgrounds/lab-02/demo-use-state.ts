import type { Playground } from '@/lib/playgrounds';

export default {
  title: 'useState: the screen follows the data',
  goal: 'Tap the heart and watch the **console**: every `setLiked` re-runs the component, which draws the new UI. **Try:** add a like counter.',
  files: {
    'App.tsx': `import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

export default function App() {
  const [liked, setLiked] = useState(false);

  console.log('render, liked =', liked);

  return (
    <View style={styles.screen}>
      <Pressable onPress={() => setLiked(!liked)} style={[styles.btn, liked && styles.on]}>
        <Text style={styles.heart}>{liked ? '♥' : '♡'}</Text>
      </Pressable>
      <Text style={styles.label}>{liked ? 'You like this' : 'Tap to like'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  btn: { width: 96, height: 96, borderRadius: 48, borderWidth: 2, borderColor: '#e11d48', alignItems: 'center', justifyContent: 'center' },
  on: { backgroundColor: '#ffe4e6' },
  heart: { fontSize: 44, color: '#e11d48' },
  label: { fontSize: 16, color: '#475569' },
});
`,
  },
} satisfies Playground;
