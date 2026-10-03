/** Lab 02 live demos — editable, not graded. The instructor changes them live; students can too. */
import type { Demo } from '../types.ts';
import { AVATAR } from './part2.ts';

export const demos: Record<string, Demo> = {
  start: {
    id: 'start',
    title: 'How a React web app starts',
    frame: 'web',
    entry: 'main.tsx',
    readOnly: ['index.html'],
    files: {
      'main.tsx': `import { createRoot } from 'react-dom/client';
import App from './App';

// React takes over the empty <div id="root"> from index.html
createRoot(document.getElementById('root')).render(<App />);
`,
      'App.tsx': `function Header() {
  return <h1>🛒 Shop</h1>;
}

function ProductCard() {
  return <div style={{ border: '1px solid #ddd', borderRadius: 12, padding: 12, margin: '8px 0' }}>A product</div>;
}

export default function App() {
  return (
    <div>
      <Header />
      <ProductCard />
      <ProductCard />
    </div>
  );
}
`,
      'index.html': `<!doctype html>
<html>
  <body>
    <div id="root"></div>            <!-- empty: React fills it -->
    <script type="module" src="/main.tsx"></script>
  </body>
</html>
`,
    },
    tryThis: ['Add a third `<ProductCard />` in App.tsx', 'Change the text inside `Header`', 'Open main.tsx: what is the first component React renders?'],
  },

  expo: {
    id: 'expo',
    title: 'How an Expo app starts',
    frame: 'phone',
    entry: 'app/_layout.tsx',
    files: {
      'app/_layout.tsx': `import { Stack } from 'expo-router';

// The root layout wraps every screen of the app.
export default function RootLayout() {
  return <Stack />;
}
`,
      'app/index.tsx': `import { View, Text } from 'react-native';

// app/index.tsx is the FIRST screen users see.
export default function Index() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 22, fontWeight: '700' }}>Hello from app/index.tsx 👋</Text>
    </View>
  );
}
`,
    },
    tryThis: ['Change the text in app/index.tsx', 'Same idea as the web: entry → root (`_layout`) → first screen (`index`)'],
  },

  props: {
    id: 'props',
    title: 'Props: one component, different data',
    frame: 'web',
    entry: 'App.tsx',
    files: {
      'App.tsx': `function Badge({ label, color }) {
  return (
    <span style={{ background: color, color: 'white', padding: '4px 10px', borderRadius: 999, marginRight: 6 }}>
      {label}
    </span>
  );
}

export default function App() {
  return (
    <div>
      <h2>Skills</h2>
      <Badge label="React" color="#2563eb" />
      <Badge label="React Native" color="#7c3aed" />
      <Badge label="Expo" color="#111827" />
    </div>
  );
}
`,
    },
    tryThis: ['Add a fourth Badge with your own label and colour', 'Remove `color` from one Badge — what happens?'],
  },

  hooks: {
    id: 'hooks',
    title: 'useState & useEffect',
    frame: 'web',
    entry: 'App.tsx',
    files: {
      'App.tsx': `import { useState, useEffect } from 'react';

export default function App() {
  const [count, setCount] = useState(0);

  // runs once, after the first render
  useEffect(() => {
    console.log('mounted');
  }, []);

  // runs after the first render AND whenever count changes
  useEffect(() => {
    console.log('count is now', count);
  }, [count]);

  return (
    <div>
      <h1>Count: {count}</h1>
      <button onClick={() => setCount(count + 1)}>+1</button>
    </div>
  );
}
`,
    },
    tryThis: ['Click +1 and watch the console below the preview', 'Change `[count]` to `[]` — when does it log now?', 'Delete the array completely — what changes?'],
  },

  core: {
    id: 'core',
    title: 'The core React Native components',
    frame: 'phone',
    entry: 'App.tsx',
    files: {
      'App.tsx': `import { useState } from 'react';
import { SafeAreaView, ScrollView, View, Text, Image, Pressable } from 'react-native';

export default function App() {
  const [liked, setLiked] = useState(false);

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        <Text style={{ fontSize: 28, fontWeight: '800' }}>Hello, phone 👋</Text>
        <Image source={{ uri: '${AVATAR}' }} style={{ width: 120, height: 120, borderRadius: 60 }} />
        <View style={{ padding: 16, borderRadius: 12, backgroundColor: '#eef2ff' }}>
          <Text>A View is a box. Text must live inside Text.</Text>
        </View>
        <Pressable onPress={() => setLiked(!liked)} style={{ padding: 14, borderRadius: 12, backgroundColor: liked ? '#ef4444' : '#111827' }}>
          <Text style={{ color: 'white', textAlign: 'center', fontWeight: '700' }}>{liked ? '❤️ Liked' : '🤍 Like'}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
`,
    },
    tryThis: ['Change SafeAreaView to View — where does the title go?', 'Remove the Image’s width/height', 'Write some text directly inside a View (without Text)'],
  },

  input: {
    id: 'input',
    title: 'TextInput + state',
    frame: 'phone',
    entry: 'App.tsx',
    files: {
      'App.tsx': `import { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';

export default function App() {
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);

  return (
    <View style={{ flex: 1, padding: 24, paddingTop: 80, gap: 12 }}>
      <TextInput
        value={password}
        onChangeText={setPassword}
        secureTextEntry={!visible}
        placeholder="Password"
        style={{ borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 12 }}
      />
      <Text>{password.length} characters {password.length >= 8 ? '✅' : '(8 needed)'}</Text>
      <Pressable onPress={() => setVisible(!visible)}>
        <Text style={{ color: '#2563eb' }}>{visible ? 'Hide' : 'Show'} password</Text>
      </Pressable>
    </View>
  );
}
`,
    },
    tryThis: ['Type in the box and watch the counter', 'Remove `value={password}` — does Show/Hide still work?', 'Change 8 to 12'],
  },

  style: {
    id: 'style',
    title: 'Style objects vs NativeWind',
    frame: 'phone',
    entry: 'App.tsx',
    files: {
      'App.tsx': `import { View, Text, StyleSheet } from 'react-native';

export default function App() {
  return (
    <View style={{ flex: 1, padding: 24, paddingTop: 80, gap: 16, backgroundColor: '#f1f5f9' }}>
      {/* 1. StyleSheet (style objects) */}
      <View style={styles.card}>
        <Text style={styles.title}>StyleSheet</Text>
      </View>

      {/* 2. NativeWind (className) — the same design */}
      <View className="flex-row items-center bg-white rounded-2xl p-4 shadow-md">
        <Text className="text-lg font-bold">NativeWind</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', borderRadius: 16, padding: 16, elevation: 4 },
  title: { fontSize: 18, fontWeight: '700' },
});
`,
    },
    tryThis: ['Change `p-4` to `p-8`', 'Try `bg-indigo-500` and `text-white`', 'Make a typo like `bg-blu-500` — check the console'],
  },

  list: {
    id: 'list',
    title: 'FlatList renders only what you see',
    frame: 'phone',
    entry: 'App.tsx',
    files: {
      'App.tsx': `import { FlatList, View, Text } from 'react-native';

const STUDENTS = Array.from({ length: 40 }, (_, i) => ({ id: String(i + 1), name: 'Student ' + (i + 1) }));

function Row({ name }) {
  return (
    <View className="px-4 py-3 border-b border-slate-200">
      <Text className="text-base">{name}</Text>
    </View>
  );
}

export default function App() {
  return (
    <FlatList
      data={STUDENTS}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <Row name={item.name} />}
      contentContainerClassName="pt-12"
    />
  );
}
`,
    },
    tryThis: ['Scroll the list', 'Change 40 to 1000 — still smooth', 'Show the id too: pass it as another prop'],
  },
};
