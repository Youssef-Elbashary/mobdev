import { sanitizeFlow, type Flow, type LabNodeType } from '../core.ts';

const text = (...lines: string[]) => lines.join('\n');

/** Reproducible canvas source for the lab after the two file-based Mobile Development labs. */
export function mobileDevelopmentLab03(): Flow {
  const nodes: Flow['nodes'] = [];
  const edges: Flow['edges'] = [];
  let previous = '';
  const add = (id: string, type: LabNodeType, data: Record<string, string>) => {
    const i = nodes.length;
    nodes.push({ id, type, x: 100 + (i % 2) * 60, y: 100 + i * 145, data });
    if (previous) edges.push({ from: previous, to: id });
    previous = id;
  };

  add('root', 'start', {
    title: 'Lab 03 — UI Systems, Project Architecture & Navigation',
    description: 'Start the app you will grow throughout the semester, then give it a polished NativeWind UI, feature architecture, typed navigation, and safe development, staging and production configuration.',
    difficulty: 'Intermediate', estimatedTime: '3 hours 45 min',
    objectives: text(
      'Choose one approved app idea and define the semester product brief, users, features and screen map',
      'Turn a screen design into reusable, accessible React Native UI components',
      'Style responsive, consistent interfaces with NativeWind utility classes',
      'Organize an Expo app by feature and use TypeScript path aliases',
      'Build typed stack, tab and drawer navigation with route parameters',
      'Separate development, staging and production configuration without exposing secrets',
      'Combine the architecture into a project-ready starter structure',
    ),
  });

  add('part-project', 'part', { title: 'Start the semester application', time: '35 min' });
  add('task-project-idea', 'task', { title: 'Commit to one useful idea', time: '12 min', body: text(
    'From this lab onward, your team will apply each new technique to **one mobile application** and improve the same repository every week.', '',
    'Use **Campus Companion** as the worked example: students discover events, save activities, navigate campus and receive useful reminders. Your team may use its own instructor-approved idea, but it must keep one stable problem and user group.', '',
    'Create `docs/product-brief.md` with:', '- Problem in one sentence', '- Primary user and when they need the app', '- Three core features', '- One device feature and one external API', '- One measurable sign that the app is useful',
  ) });
  add('call-project-scope', 'callout', { tone: 'IMPORTANT', body: 'Build one vertical slice at a time. Do not generate the entire semester app now. Every later lab will add a taught capability to this same product and Git history.' });
  add('task-project-map', 'task', { title: 'Draw the first product and screen map', time: '13 min', body: text(
    'Start with this visual flow and adapt the labels to your idea:', '',
    '```text', '[Welcome] → [Home / discovery] → [Item details] → [Save / action]', '                   ↓                    ↓', '             [Search/filter]       [Profile/settings]', '```', '',
    'For each screen, write its purpose, main action, required data, and loading/empty/error states. Your first implementation will build the shell, not every final feature.',
  ) });
  add('task-project-roadmap', 'task', { title: 'See how the app grows across the semester', time: '10 min', body: text(
    '| Sprint | Add to the same application | Evidence |', '| --- | --- | --- |',
    '| Lab 03 | Product brief, design language, folders, navigation, environments | Working shell + architecture commit |',
    '| UI/state labs | Real screens, forms, lists and interaction states | Usable feature flow |',
    '| Data/API labs | Persistent data and external service | Loading, success, empty and error paths |',
    '| Device/testing labs | Hardware capability and automated tests | Demonstrated feature + test report |',
    '| Final labs | Accessibility, performance and release quality | Staging build and defended decisions |',
  ) });
  add('exercise-project-card', 'exercise', {
    title: 'Visualize the semester app idea', goal: 'Turn the plain brief into a clear product card using NativeWind utilities.',
    hint: 'Add a dark screen background, a contrasting rounded card, hierarchy, spacing and a green action badge.',
    starter: text("import { View, Text } from 'react-native';", 'export default function App() {', '  return <View>', '    <Text>Campus Companion</Text>', '    <Text>Find events, places and activities around campus.</Text>', '    <Text>Start exploring</Text>', '  </View>;', '}'),
    solution: text("import { View, Text } from 'react-native';", 'export default function App() {', '  return <View className="flex-1 justify-center bg-slate-950 p-6">', '    <View className="gap-4 rounded-3xl border border-slate-700 bg-slate-900 p-6">', '      <Text className="text-xs font-bold uppercase tracking-widest text-emerald-300">Semester app</Text>', '      <Text className="text-3xl font-bold text-white">Campus Companion</Text>', '      <Text className="text-base leading-6 text-slate-300">Find events, places and activities around campus.</Text>', '      <Text className="self-start rounded-full bg-emerald-300 px-4 py-2 font-bold text-slate-950">Start exploring</Text>', '    </View>', '  </View>;', '}'),
    checks: text('Keeps the product idea :: expect Campus Companion', 'Creates visual hierarchy :: code /text-3xl/ add a large title', 'Uses a card surface :: code /rounded-3xl/ add a rounded card', 'Uses spacing and colour :: code /bg-slate-950/ add the screen background'),
  });
  add('check-project', 'checkpoint', { body: 'Your repository now has one agreed semester idea, `docs/product-brief.md`, a screen map and a small backlog. Every later lab continues this same application.' });

  add('part-ui', 'part', { title: 'Visual UI systems with NativeWind', time: '55 min' });
  add('task-nativewind', 'task', { title: 'Understand the NativeWind styling loop', time: '12 min', body: text(
    'NativeWind lets React Native components use Tailwind-style utilities through `className`. Utilities remain native styles; they are not browser CSS.', '',
    '`flex-1 bg-slate-950 px-6 pt-12` reads as: fill available space → dark background → horizontal padding → top padding.', '',
    'Use utilities for **layout, spacing, color, typography and states**. Extract a component when a visual pattern repeats; do not hide a long duplicated class string in every screen.',
  ) });
  add('terminal-nativewind', 'terminal', { lines: text('$ npx expo install nativewind react-native-reanimated react-native-safe-area-context', '# Follow the NativeWind Expo installation guide for your installed version', '$ npx expo start --clear') });
  add('call-nativewind', 'callout', { tone: 'TIP', body: 'Use the official NativeWind installation guide for the exact configuration required by your installed version. After setup, verify `className="bg-emerald-300"` on a `View` before styling the whole app.' });
  add('task-nativewind-visual', 'task', { title: 'Build hierarchy, rhythm and states', time: '13 min', body: text(
    'A polished screen is a system, not decoration:', '',
    '| Visual decision | NativeWind examples | Purpose |', '| --- | --- | --- |',
    '| Hierarchy | `text-3xl font-bold`, `text-sm text-slate-400` | Show what matters first |',
    '| Rhythm | `gap-4`, `p-6`, `space-y-3` | Make spacing consistent |',
    '| Surface | `rounded-2xl border bg-slate-900` | Group related content |',
    '| Feedback | `active:opacity-70`, disabled treatment | Show interaction state |',
    '| Platform/theme | `ios:pt-2`, `android:pt-3`, `dark:bg-slate-950` | Adapt intentionally |',
  ) });
  add('task-ui-plan', 'task', { title: 'Read the screen before writing JSX', time: '10 min', body: text(
    'Split one project wireframe into **layout**, reusable **UI primitives**, and data-aware **feature components**.',
    '', 'Write the component tree first. Keep colors, spacing and typography in tokens instead of scattering one-off values.',
  ) });
  add('code-theme', 'code', { title: 'src/theme/tokens.ts', lang: 'ts', code: text(
    "export const colors = { background: '#0B1020', surface: '#151C31',",
    "  text: '#F8FAFC', muted: '#94A3B8', primary: '#7CFFB2', danger: '#FB7185' } as const;",
    'export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;',
    'export const radius = { sm: 8, md: 14, pill: 999 } as const;',
  ) });
  add('task-ui-action', 'task', { title: 'Create a reusable, accessible action', time: '15 min', body: text(
    'A UI primitive owns appearance and feedback; the feature decides what happens.', '',
    '- Use `Pressable` state for feedback.', '- Add `accessibilityRole`, a label and disabled state.',
    '- Prefer an explicit `variant` over many boolean props.', '- Keep business data out of shared `ui/` components.',
  ) });
  add('code-button', 'code', { title: 'src/components/ui/AppButton.tsx', lang: 'tsx', code: text(
    "import { Pressable, StyleSheet, Text } from 'react-native';",
    "type Props = { label: string; onPress: () => void; variant?: 'primary' | 'ghost'; disabled?: boolean };",
    "export function AppButton({ label, onPress, variant = 'primary', disabled = false }: Props) {",
    '  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress}',
    '    style={({ pressed }) => [styles.base, styles[variant], pressed && styles.pressed, disabled && styles.disabled]}>',
    '    <Text style={styles.label}>{label}</Text>', '  </Pressable>;', '}',
    'const styles = StyleSheet.create({',
    "  base: { minHeight: 48, paddingHorizontal: 18, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },",
    "  primary: { backgroundColor: '#7CFFB2' }, ghost: { borderWidth: 1, borderColor: '#7CFFB2' },",
    "  label: { fontWeight: '700' }, pressed: { opacity: 0.7 }, disabled: { opacity: 0.4 },", '});',
  ) });
  add('exercise-ui', 'exercise', {
    title: 'Accessible save card', goal: 'Make **Save** change to **Saved**, and expose it as an accessible button.',
    hint: 'Update the boolean in `onPress` and add `accessibilityRole="button"`.',
    starter: text("import { useState } from 'react';", "import { View, Text, Pressable } from 'react-native';", 'export default function App() {', '  const [saved, setSaved] = useState(false);', '  return <View className="flex-1 justify-center bg-slate-950 p-6">', '    <View className="gap-4 rounded-2xl bg-slate-900 p-5">', '      <Text className="text-xl font-bold text-white">Architecture notes</Text>', "      <Pressable onPress={() => {}}><Text className=\"text-emerald-300\">{saved ? 'Saved' : 'Save'}</Text></Pressable>", '    </View>', '  </View>;', '}'),
    solution: text("import { useState } from 'react';", "import { View, Text, Pressable } from 'react-native';", 'export default function App() {', '  const [saved, setSaved] = useState(false);', '  return <View className="flex-1 justify-center bg-slate-950 p-6">', '    <View className="gap-4 rounded-2xl bg-slate-900 p-5">', '      <Text className="text-xl font-bold text-white">Architecture notes</Text>', '      <Pressable accessibilityRole="button" onPress={() => setSaved(true)} className="self-start rounded-xl bg-emerald-300 px-4 py-3 active:opacity-70"><Text className="font-bold text-slate-950">{saved ? \'Saved\' : \'Save\'}</Text></Pressable>', '    </View>', '  </View>;', '}'),
    checks: text('Starts ready :: expect exact Save', 'Pressing saves :: press Save; expect exact Saved', 'Accessible :: code /accessibilityRole/ add accessibilityRole', 'Styled interaction :: code /active:opacity-70/ add pressed feedback'),
  });
  add('check-ui', 'checkpoint', { body: 'You have theme tokens and a shared primitive with typed props, interaction feedback and accessibility semantics.' });

  add('part-architecture', 'part', { title: 'Feature architecture & path aliases', time: '35 min' });
  add('task-folders', 'task', { title: 'Organize by feature, not file type', time: '15 min', body: text(
    'Keep each feature’s screens, components, hooks, API calls and types together. Extract shared code only after multiple features need it.', '',
    '```text', 'src/', '  app/navigation/', '  components/ui/', '  features/', '    auth/{screens,components,api.ts,types.ts}', '    profile/{screens,components,api.ts,types.ts}', '  services/', '  theme/', '```',
    '', 'Features may import shared UI/services. Shared code must not import a feature; this one-way rule prevents circular architecture.',
  ) });
  add('call-boundary', 'callout', { tone: 'IMPORTANT', body: 'Avoid one giant global `components/`, `screens/` and `utils/` structure. It hides ownership as the project grows.' });
  add('task-alias', 'task', { title: 'Replace fragile relative paths with aliases', time: '15 min', body: 'Configure `@/` once. Use it across architecture boundaries, while nearby files inside one feature may still use `./` and `../`.' });
  add('code-tsconfig', 'code', { title: 'tsconfig.json', lang: 'json', code: text('{', '  "extends": "expo/tsconfig.base",', '  "compilerOptions": {', '    "strict": true,', '    "baseUrl": ".",', '    "paths": { "@/*": ["src/*"] }', '  }', '}') });
  add('code-alias', 'code', { title: 'src/features/profile/screens/ProfileScreen.tsx', lang: 'tsx', code: text("import { AppButton } from '@/components/ui/AppButton';", "import { colors } from '@/theme/tokens';", "import { updateProfile } from '../api';") });
  add('terminal-alias', 'terminal', { lines: text('$ npx expo start --clear', '# restart Metro after changing tsconfig paths', '> Bundler cache cleared') });
  add('check-architecture', 'checkpoint', { body: 'Cross-feature imports use `@/`; imports inside one feature stay relative. TypeScript and Metro resolve both.' });

  add('part-navigation', 'part', { title: 'Typed stack, tabs & drawer navigation', time: '55 min' });
  add('task-nav-install', 'task', { title: 'Install the navigation layers', time: '10 min', body: 'Install navigator packages normally, and native dependencies through Expo so versions match the SDK.' });
  add('terminal-nav', 'terminal', { lines: text('$ npm install @react-navigation/native @react-navigation/native-stack @react-navigation/bottom-tabs @react-navigation/drawer', '$ npx expo install react-native-screens react-native-safe-area-context react-native-gesture-handler react-native-reanimated', '# restart Expo after native dependency changes') });
  add('task-stack', 'task', { title: 'Type routes and parameters', time: '20 min', body: text('Define every route and its params once. `undefined` means no params; an object makes them required and typed.', '', 'Never hide an incorrect call with `as any`. Fix the param list or navigation call.') });
  add('code-stack', 'code', { title: 'src/app/navigation/RootNavigator.tsx', lang: 'tsx', code: text(
    "import { NavigationContainer } from '@react-navigation/native';", "import { createNativeStackNavigator, type NativeStackScreenProps } from '@react-navigation/native-stack';",
    'export type RootStackParamList = {', '  Home: undefined;', "  Details: { itemId: string; source?: 'search' | 'featured' };", '};',
    'const Stack = createNativeStackNavigator<RootStackParamList>();', "export type DetailsProps = NativeStackScreenProps<RootStackParamList, 'Details'>;",
    '// navigation.navigate(\'Details\', { itemId: item.id, source: \'search\' });',
  ) });
  add('task-nested', 'task', { title: 'Choose stack, tabs and drawer by interaction', time: '15 min', body: text(
    '- **Stack:** drill into details/editing and return with Back.', '- **Tabs:** switch among a few equal top-level areas.', '- **Drawer:** reveal a larger set of occasional destinations.', '',
    'A common root is `Stack(Auth, MainTabs, Details)`. Nest as little as possible because each navigator adds history and options.',
  ) });
  add('code-nested', 'code', { title: 'src/app/navigation/types.ts', lang: 'ts', code: text(
    "import type { NavigatorScreenParams } from '@react-navigation/native';",
    "export type MainTabParamList = { Feed: undefined; Profile: { userId: string } };",
    'export type RootStackParamList = { Main: NavigatorScreenParams<MainTabParamList>; Details: { itemId: string } };',
    "// navigation.navigate('Main', { screen: 'Profile', params: { userId: '42' } });",
  ) });
  add('call-navigation', 'callout', { tone: 'TIP', body: 'Do not add every navigator just to demonstrate it. Choose what matches the user’s mental model and defend that choice.' });
  add('exercise-navigation', 'exercise', {
    title: 'Model top-level navigation state', goal: 'Wire all three controls so the status shows the active navigation pattern.', hint: 'Call `setActive(item)`.',
    starter: text("import { useState } from 'react';", "import { View, Text, Pressable } from 'react-native';", 'export default function App() {', "  const [active, setActive] = useState('Stack');", "  const items = ['Stack', 'Tabs', 'Drawer'];", "  return <View style={{ flex: 1, justifyContent: 'center', gap: 12 }}>", '    <Text>{active} active</Text>', '    {items.map(item => <Pressable key={item} onPress={() => {}}><Text>{item}</Text></Pressable>)}', '  </View>;', '}'),
    solution: text("import { useState } from 'react';", "import { View, Text, Pressable } from 'react-native';", 'export default function App() {', "  const [active, setActive] = useState('Stack');", "  const items = ['Stack', 'Tabs', 'Drawer'];", "  return <View style={{ flex: 1, justifyContent: 'center', gap: 12 }}>", '    <Text>{active} active</Text>', '    {items.map(item => <Pressable key={item} onPress={() => setActive(item)}><Text>{item}</Text></Pressable>)}', '  </View>;', '}'),
    checks: text('Starts on stack :: expect exact Stack active', 'Tabs switch :: press Tabs; expect exact Tabs active', 'Drawer switch :: press Drawer; expect exact Drawer active', 'Updates state :: code /setActive\(item\)/ call setActive(item)'),
  });
  add('check-navigation', 'checkpoint', { body: 'The app has one `NavigationContainer`; routes/params are typed, and each nested navigator has a clear purpose.' });

  add('part-environments', 'part', { title: 'Development, staging & production', time: '35 min' });
  add('task-env-public', 'task', { title: 'Define a public environment contract', time: '15 min', body: text(
    'Expo inlines `EXPO_PUBLIC_` variables into the client. Use them only for public values such as API base URLs and environment names.', '',
    '**Never put database passwords, service-role keys or private API secrets in a mobile app.** Keep them on a server.',
  ) });
  add('code-env', 'code', { title: '.env.development / .env.staging / .env.production', lang: 'bash', code: text(
    '# development', 'EXPO_PUBLIC_APP_ENV=development', 'EXPO_PUBLIC_API_URL=http://192.168.1.10:3000', '',
    '# staging', 'EXPO_PUBLIC_APP_ENV=staging', 'EXPO_PUBLIC_API_URL=https://staging-api.example.com', '',
    '# production', 'EXPO_PUBLIC_APP_ENV=production', 'EXPO_PUBLIC_API_URL=https://api.example.com',
  ) });
  add('call-env', 'callout', { tone: 'CAUTION', body: '`EXPO_PUBLIC_` means public. Commit `.env.example`, but ignore real `.env*` files. Environment separation does not turn client data into secrets.' });
  add('task-builds', 'task', { title: 'Give each build its own identity', time: '15 min', body: 'Use an app variant for the display name, package/bundle identifier and API environment. Separate identifiers let all three builds coexist on one phone.' });
  add('code-config', 'code', { title: 'app.config.ts', lang: 'ts', code: text(
    "import type { ExpoConfig } from 'expo/config';", "const variant = process.env.APP_VARIANT ?? 'development';", "const production = variant === 'production';", "const staging = variant === 'staging';", '',
    'export default <ExpoConfig>{', "  name: production ? 'Project' : staging ? 'Project (Staging)' : 'Project (Dev)',", "  slug: 'project',",
    "  ios: { bundleIdentifier: production ? 'com.team.project' : `com.team.project.${variant}` },",
    "  android: { package: production ? 'com.team.project' : `com.team.project.${variant}` },", '};',
  ) });
  add('code-eas', 'code', { title: 'eas.json', lang: 'json', code: text('{', '  "build": {', '    "development": { "developmentClient": true, "distribution": "internal", "env": { "APP_VARIANT": "development" } },', '    "staging": { "distribution": "internal", "env": { "APP_VARIANT": "staging" } },', '    "production": { "autoIncrement": true, "env": { "APP_VARIANT": "production" } }', '  }', '}') });
  add('exercise-environment', 'exercise', {
    title: 'Make the environment visible', goal: 'Show a clear **STAGING** badge and staging API host.', hint: 'Change both constants and let the UI read them.',
    starter: text("import { View, Text } from 'react-native';", "const APP_ENV = 'development';", "const API_URL = 'http://localhost:3000';", 'export default function App() {', "  return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>", '    <Text>{APP_ENV.toUpperCase()}</Text><Text>{API_URL}</Text>', '  </View>;', '}'),
    solution: text("import { View, Text } from 'react-native';", "const APP_ENV = 'staging';", "const API_URL = 'https://staging-api.example.com';", 'export default function App() {', "  return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>", '    <Text>{APP_ENV.toUpperCase()}</Text><Text>{API_URL}</Text>', '  </View>;', '}'),
    checks: text('Shows staging :: expect exact STAGING', 'Uses staging API :: expect staging-api.example.com', 'Environment is data :: code /APP_ENV\s*=\s*[\'\"]staging[\'\"]/ set APP_ENV'),
  });
  add('check-env', 'checkpoint', { body: 'Dev, staging and production have distinct identities and API URLs. No secret appears in source or an `EXPO_PUBLIC_` variable.' });

  add('part-integrate', 'part', { title: 'Semester Sprint 01 deliverable', time: '25 min' });
  add('task-integrate', 'task', { title: 'Build the project foundation on your branch', time: '15 min', body: text(
    'Apply the lab to your semester app—not a throwaway example. Submit:', '',
    '- `docs/product-brief.md` and screen map', '- NativeWind design language and two polished screens', '- Feature-based `src/` folders and `@/` aliases',
    '- Typed navigation shell with at least one real route parameter', '- Development, staging and production examples with no secrets', '- README section called **Sprint 01 — Architecture decisions**',
  ) });
  add('terminal-commit', 'terminal', { lines: text('$ git switch -c feature/app-architecture', '$ git add src app.config.ts eas.json .env.example tsconfig.json', '$ git commit -m "build app architecture and environments"', '$ git push -u origin feature/app-architecture') });
  add('task-review', 'task', { title: 'Architecture and product review', time: '10 min', body: text('- Is the user problem specific and stable enough for the semester?', '- Can a teammate find one feature quickly?', '- Does NativeWind produce clear hierarchy and consistent spacing?', '- Do aliases resolve in TypeScript and Metro?', '- Are all routes and params typed?', '- Can three environments coexist safely?', '- Are loading, empty, error and disabled states designed?') });
  add('repo', 'repo', {});
  add('checkin', 'checkin', {});

  const clean = sanitizeFlow({ nodes, edges }, 'lab');
  if (!clean.ok) throw new Error(clean.error);
  return clean.value;
}
