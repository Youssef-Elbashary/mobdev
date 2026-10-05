// Reference solutions and typical mistakes for Lab 02 code exercises.
// Lives with the tests (never imported by the site), so students can't find answers in the page's JavaScript.
import { AVATAR } from '../../src/lab/exercises/lab-02/part2.ts';

type Files = Record<string, string>;

export const solutions: Record<string, Files> = {
  ex03: {
    'App.tsx': `function Greeting() {
  return <h2>Hello, React!</h2>;
}

export default function App() {
  return (
    <div>
      <h1>My first components</h1>
      <Greeting />
      <Greeting />
    </div>
  );
}`,
  },
  ex04: {
    'App.tsx': `function ProfileCard({ name, role }) {
  return (
    <div style={{ border: '1px solid #ddd', borderRadius: 12, padding: 12, marginBottom: 8 }}>
      <h3>{name}</h3>
      <p>{role}</p>
    </div>
  );
}

export default function App() {
  return (
    <div>
      <ProfileCard name="Mariam" role="Student" />
      <ProfileCard name="Ali" role="Teaching assistant" />
      <ProfileCard name="Youssef" role="Instructor" />
    </div>
  );
}`,
  },
  ex05: {
    'App.tsx': `import { useState } from 'react';

export default function App() {
  const [count, setCount] = useState(0);
  return (
    <div>
      <h1>Count: {count}</h1>
      <button onClick={() => setCount(count + 1)}>+1</button>
    </div>
  );
}`,
  },
  ex08: {
    'App.tsx': `import { View, Text, Image, Pressable } from 'react-native';

const AVATAR = '${AVATAR}';

export default function App() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
      <Image source={{ uri: AVATAR }} style={{ width: 96, height: 96, borderRadius: 48 }} />
      <Text style={{ fontSize: 20, fontWeight: '700' }}>Mariam Ahmed</Text>
      <Pressable onPress={() => {}} style={{ backgroundColor: '#111827', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 999 }}>
        <Text style={{ color: 'white' }}>Follow</Text>
      </Pressable>
    </View>
  );
}`,
  },
  ex09: {
    'App.tsx': `import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';

export default function App() {
  const [likes, setLikes] = useState(0);
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <Text>Likes: {likes}</Text>
      <Pressable onPress={() => setLikes(likes + 1)}>
        <Text style={{ fontSize: 20 }}>❤️ Like</Text>
      </Pressable>
      <View style={{ marginTop: 8 }}>
        <Text>Tap the heart!</Text>
      </View>
    </View>
  );
}`,
  },
  ex10: {
    'App.tsx': `import { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';

export default function App() {
  const [name, setName] = useState('');
  return (
    <View style={{ flex: 1, padding: 24, paddingTop: 80, gap: 12 }}>
      <TextInput value={name} onChangeText={setName} placeholder="Your name" style={{ borderWidth: 1, padding: 12 }} />
      {name === '' ? <Text>Type your name above</Text> : <Text>Hello, {name}!</Text>}
      <Pressable onPress={() => setName('')}><Text>Clear</Text></Pressable>
    </View>
  );
}`,
  },
  ex13: {
    'App.tsx': `import { View, Text } from 'react-native';

export default function App() {
  return (
    <View className="flex-1 bg-slate-100 p-6 pt-20">
      <View className="flex-row items-center gap-3 bg-white rounded-2xl p-4 shadow-md">
        <View className="w-12 h-12 rounded-full bg-indigo-500" />
        <View>
          <Text className="text-lg font-bold">Mariam Ahmed</Text>
          <Text className="text-slate-500">Mobile Development · Lab 02</Text>
        </View>
      </View>
    </View>
  );
}`,
  },
  ex15: {
    'App.tsx': `import { FlatList, View, Text } from 'react-native';

const COURSES = [
  { id: 'c1', title: 'React basics', hours: 3 },
  { id: 'c2', title: 'React Native UI', hours: 4 },
  { id: 'c3', title: 'Styling with NativeWind', hours: 2 },
  { id: 'c4', title: 'Lists & FlatList', hours: 2 },
  { id: 'c5', title: 'State & hooks', hours: 3 },
];

function CourseItem({ title, hours }) {
  return (
    <View className="flex-row justify-between px-4 py-3 border-b border-slate-200">
      <Text>{title}</Text>
      <Text className="text-slate-500">{hours} h</Text>
    </View>
  );
}

export default function App() {
  return (
    <View className="flex-1 bg-white pt-14">
      <Text className="text-2xl font-bold px-4 mb-2">My courses</Text>
      <FlatList data={COURSES} keyExtractor={(item) => item.id} renderItem={({ item }) => <CourseItem title={item.title} hours={item.hours} />} />
    </View>
  );
}`,
  },
  ex16: {
    'App.tsx': `import { useState } from 'react';
import { View, Text, TextInput, FlatList } from 'react-native';
import ContactCard from './ContactCard';

const CONTACTS = [
  { id: '1', name: 'Mariam Ahmed', phone: '0100 123 4567' },
  { id: '2', name: 'Ali Hassan', phone: '0111 222 3344' },
  { id: '3', name: 'Salma Youssef', phone: '0122 987 6543' },
  { id: '4', name: 'Omar Khaled', phone: '0155 246 8101' },
  { id: '5', name: 'Alia Mostafa', phone: '0109 555 1212' },
];

export default function App() {
  const [query, setQuery] = useState('');
  const [favs, setFavs] = useState([]);
  const shown = CONTACTS.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()));
  const toggle = (id) => setFavs(favs.includes(id) ? favs.filter((f) => f !== id) : [...favs, id]);

  return (
    <View className="flex-1 bg-slate-50 pt-14 px-4">
      <Text className="text-2xl font-bold mb-3">Contacts</Text>
      <TextInput value={query} onChangeText={setQuery} placeholder="Search by name" className="bg-white border border-slate-200 rounded-xl px-4 py-3 mb-3" />
      <FlatList
        data={shown}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => (
          <ContactCard name={item.name} phone={item.phone} favourite={favs.includes(item.id)} onToggle={() => toggle(item.id)} />
        )}
      />
    </View>
  );
}`,
    'ContactCard.tsx': `import { View, Text, Pressable } from 'react-native';

export default function ContactCard({ name, phone, favourite, onToggle }) {
  return (
    <View className="flex-row items-center bg-white rounded-xl p-4 mb-2">
      <View className="flex-1">
        <Text className="font-semibold">{name}</Text>
        <Text className="text-slate-500">{phone}</Text>
      </View>
      <Pressable onPress={onToggle}>
        <Text className="text-2xl">{favourite ? '★' : '☆'}</Text>
      </Pressable>
    </View>
  );
}`,
  },
  ex17: {
    'App.tsx': `import { useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList } from 'react-native';
import TaskItem from './TaskItem';

const START = [
  { id: '1', title: 'Install Expo Go' },
  { id: '2', title: 'Finish Lab 02' },
];

export default function App() {
  const [tasks, setTasks] = useState(START);
  const [text, setText] = useState('');

  function addTask() {
    if (!text.trim()) return;
    setTasks([...tasks, { id: String(Date.now()), title: text.trim() }]);
    setText('');
  }

  return (
    <View className="flex-1 bg-slate-50 pt-14 px-4">
      <Text className="text-2xl font-bold mb-3">My tasks</Text>
      <View className="flex-row gap-2 mb-3">
        <TextInput value={text} onChangeText={setText} placeholder="New task" className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3" />
        <Pressable onPress={addTask} className="bg-indigo-500 rounded-xl px-4 justify-center">
          <Text className="text-white font-bold">Add</Text>
        </Pressable>
      </View>
      <FlatList data={tasks} keyExtractor={(t) => t.id} renderItem={({ item }) => <TaskItem title={item.title} />} />
    </View>
  );
}`,
    'TaskItem.tsx': `import { View, Text } from 'react-native';

export default function TaskItem({ title }) {
  return (
    <View className="bg-white rounded-xl p-4 mb-2">
      <Text>{title}</Text>
    </View>
  );
}`,
  },
};

/** Typical wrong answers: which checks they must fail. */
export const mistakes: { ex: string; name: string; files: Files; fails: string[]; passes?: string[]; message?: RegExp }[] = [
  {
    ex: 'ex03',
    name: 'lowercase component name',
    files: { 'App.tsx': `function greeting() { return <h2>Hi</h2>; }\nexport default function App() { return <div><greeting /><greeting /></div>; }` },
    fails: ['defined', 'twice'],
    message: /capital letter/,
  },
  {
    ex: 'ex03',
    name: 'used only once',
    files: { 'App.tsx': `function Greeting() { return <h2>Hi</h2>; }\nexport default function App() { return <div><Greeting /></div>; }` },
    fails: ['twice', 'renders'],
    passes: ['defined'],
  },
  {
    ex: 'ex04',
    name: 'props object style is fine, but all cards the same name',
    files: {
      'App.tsx': `function ProfileCard(props) { return <div><h3>{props.name}</h3><p>{props.role}</p></div>; }
export default function App() { return <div><ProfileCard name="A" role="x" /><ProfileCard name="A" role="y" /><ProfileCard name="A" role="z" /></div>; }`,
    },
    fails: ['different'],
    passes: ['receives', 'shows', 'three', 'visible'],
  },
  {
    ex: 'ex05',
    name: 'changes the variable directly (starter)',
    files: { 'App.tsx': `export default function App() { let count = 0; return <div><h1>Count: {count}</h1><button onClick={() => { count = count + 1; }}>+1</button></div>; }` },
    fails: ['state', 'setter', 'works'],
  },
  {
    ex: 'ex08',
    name: 'image without a size',
    files: {
      'App.tsx': `import { View, Text, Image, Pressable } from 'react-native';
export default function App() { return <View><Image source={{ uri: 'x.png' }} /><Text>Me</Text><Pressable onPress={() => {}}><Text>Follow</Text></Pressable></View>; }`,
    },
    fails: ['size'],
    passes: ['image', 'name', 'follow'],
  },
  {
    ex: 'ex09',
    name: 'only onClick fixed',
    files: {
      'App.tsx': `import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
export default function App() {
  const [likes, setLikes] = useState(0);
  return (
    <View>
      Likes: {likes}
      <Pressable onPress={() => setLikes(likes + 1)}><Text>❤️ Like</Text></Pressable>
      <div><Text>Tap</Text></div>
    </View>
  );
}`,
    },
    fails: ['text', 'nodiv', 'works'],
    passes: ['onpress'],
  },
  {
    ex: 'ex10',
    name: 'uses onChange instead of onChangeText',
    files: {
      'App.tsx': `import { useState } from 'react';
import { View, Text, TextInput } from 'react-native';
export default function App() {
  const [name, setName] = useState('');
  return <View><TextInput value={name} onChange={(e) => setName(e.target.value)} /><Text>Hello, {name}!</Text></View>;
}`,
    },
    fails: ['controlled', 'empty', 'clear'],
    passes: ['state'],
    message: /onChangeText/,
  },
  {
    ex: 'ex15',
    name: 'FlatList without keyExtractor, CourseItem not used',
    files: {
      'App.tsx': `import { FlatList, Text } from 'react-native';
const COURSES = [{ id: 'c1', title: 'React basics', hours: 3 }];
export default function App() { return <FlatList data={COURSES} renderItem={({ item }) => <Text>{item.title}</Text>} />; }`,
    },
    fails: ['item', 'itemShows', 'render', 'key', 'rows'],
    passes: ['flatlist'],
  },
];
