import type { Playground } from '@/lib/playgrounds';

export default {
  title: 'useState: the screen follows the data',
  goal: 'Tap the heart and watch the **console**: every `setLiked` re-runs the component, which draws the new UI. **Try:** count the likes with a second `useState`.',
  files: {
    'App.tsx': `import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

export default function App() {
  const [liked, setLiked] = useState(false);

  console.log('render, liked =', liked);

  return (
    <View style={styles.screen}>
      <View style={styles.post}>
        <View style={styles.photo}>
          <Text style={styles.photoEmoji}>🏝️</Text>
        </View>
        <View style={styles.footer}>
          <View>
            <Text style={styles.place}>Dahab, Egypt</Text>
            <Text style={styles.meta}>{liked ? 'You and 41 others' : '41 likes'}</Text>
          </View>
          <Pressable onPress={() => setLiked(!liked)} style={[styles.heart, liked && styles.heartOn]}>
            <Text style={[styles.heartText, liked && styles.heartTextOn]}>{liked ? '♥' : '♡'}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#FFF1F2' },
  post: { borderRadius: 26, backgroundColor: '#FFFFFF', overflow: 'hidden', boxShadow: '0 14px 36px rgba(190, 18, 60, 0.14)' },
  photo: { height: 200, alignItems: 'center', justifyContent: 'center', backgroundColor: '#BAE6FD' },
  photoEmoji: { fontSize: 72 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  place: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  meta: { color: '#64748B', marginTop: 2 },
  heart: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FECDD3' },
  heartOn: { backgroundColor: '#E11D48', borderColor: '#E11D48' },
  heartText: { fontSize: 24, color: '#E11D48' },
  heartTextOn: { color: '#FFFFFF' },
});
`,
  },
} satisfies Playground;
