import type { Playground } from '@/lib/playgrounds';

const start = `import { View, Text, StyleSheet } from 'react-native';

const courses = [
  { id: 'c1', name: 'Mobile Development' },
  { id: 'c2', name: 'Databases' },
  { id: 'c3', name: 'Computer Networks' },
  { id: 'c4', name: 'Software Engineering' },
];

export default function App() {
  return (
    <View style={styles.screen}>
      <Text style={styles.eyebrow}>SEMESTER ONE</Text>
      <Text style={styles.title}>My courses</Text>
      {/* TODO: show ALL courses with courses.map(...), each with a key */}
      <Text style={styles.row}>{courses[0].name}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 20, paddingTop: 28, gap: 10, backgroundColor: '#EFF6FF' },
  eyebrow: { fontSize: 12, fontWeight: '700', letterSpacing: 1.2, color: '#60A5FA' },
  title: { fontSize: 28, fontWeight: '800', color: '#172554', marginBottom: 6 },
  row: {
    paddingVertical: 16, paddingHorizontal: 18, borderRadius: 16, overflow: 'hidden',
    backgroundColor: '#FFFFFF', color: '#1E3A8A', fontSize: 16, fontWeight: '600',
    borderLeftWidth: 4, borderLeftColor: '#3B82F6', boxShadow: '0 4px 14px rgba(30, 58, 138, 0.08)',
  },
});
`;

const solution = start.replace(
  `      {/* TODO: show ALL courses with courses.map(...), each with a key */}\n      <Text style={styles.row}>{courses[0].name}</Text>`,
  `      {courses.map((course) => (\n        <Text key={course.id} style={styles.row}>{course.name}</Text>\n      ))}`,
);

export default {
  title: 'List every course',
  goal: 'Turn the array into a list with `.map()`. Give each item a **key** (open the console to see React’s warning without it).',
  hint: '`{courses.map((course) => <Text key={course.id}>{course.name}</Text>)}`. The key must be unique and stable, so use the `id`, not the index.',
  files: { 'App.tsx': start },
  solution: { 'App.tsx': solution },
  checks: [
    { name: 'Shows all 4 courses', steps: [{ expectText: 'Mobile Development' }, { expectText: 'Databases' }, { expectText: 'Computer Networks' }, { expectText: 'Software Engineering' }] },
    { name: 'Uses .map()', steps: [{ expectCode: '\\.map\\(', message: 'Use courses.map(...) to build the list.' }] },
    { name: 'Every item has a key', steps: [{ expectCode: 'key=\\{', message: 'Every item in a list needs a key, e.g. key={course.id}' }] },
  ],
} satisfies Playground;
