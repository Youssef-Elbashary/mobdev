import type { Playground } from '@/lib/playgrounds';

export default {
  title: 'One component, many looks',
  goal: '`Skill` is written once and used four times with different **props**. **Try:** add a fifth skill, or change a `level`.',
  files: {
    'App.tsx': `import { View, Text, StyleSheet } from 'react-native';

type SkillProps = { icon: string; label: string; level: number; color: string };

// a component is a function: props in → UI out
function Skill({ icon, label, level, color }: SkillProps) {
  return (
    <View style={styles.card}>
      <View style={[styles.icon, { backgroundColor: color + '22' }]}>
        <Text style={styles.iconText}>{icon}</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: level + '%', backgroundColor: color }]} />
        </View>
      </View>
      <Text style={[styles.level, { color }]}>{level}%</Text>
    </View>
  );
}

export default function App() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>My skills</Text>
      <Skill icon="⚛️" label="React" level={70} color="#0EA5E9" />
      <Skill icon="📱" label="React Native" level={45} color="#8B5CF6" />
      <Skill icon="🪝" label="Hooks" level={30} color="#10B981" />
      <Skill icon="🧭" label="Navigation" level={10} color="#F59E0B" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, gap: 10, padding: 18, paddingTop: 26, backgroundColor: '#F8FAFC' },
  title: { fontSize: 28, fontWeight: '800', color: '#0F172A', marginBottom: 6 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, backgroundColor: '#FFFFFF', boxShadow: '0 4px 14px rgba(15, 23, 42, 0.07)' },
  icon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 20 },
  body: { flex: 1, gap: 6 },
  label: { fontWeight: '700', color: '#0F172A' },
  track: { height: 6, borderRadius: 3, backgroundColor: '#F1F5F9', overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  level: { fontWeight: '800', fontSize: 13 },
});
`,
  },
} satisfies Playground;
