/**
 * Lab 02 exercise list — plain data shared by the lab page, the progress API and /admin.
 * Keep ids stable: progress is stored by id.
 */
export const LAB_ID = 'lab-02';

export type ExerciseMeta = { id: string; n: number; title: string; block: number; kind: string; final?: boolean };

export const BLOCKS = [
  { n: 1, part: 1, time: '0–10', title: 'How a React app starts' },
  { n: 2, part: 1, time: '10–20', title: 'Components' },
  { n: 3, part: 1, time: '20–30', title: 'Props & hooks' },
  { n: 4, part: 2, time: '30–40', title: 'React Native components' },
  { n: 5, part: 2, time: '40–50', title: 'Inputs & state' },
  { n: 6, part: 2, time: '50–60', title: 'Styling & NativeWind' },
  { n: 7, part: 2, time: '60–70', title: 'Lists' },
  { n: 8, part: 2, time: '70–80', title: 'Putting it together' },
  { n: 9, part: 2, time: '80–90', title: 'Final challenge' },
] as const;

export const EXERCISES: ExerciseMeta[] = [
  { id: 'ex01', n: 1, block: 1, kind: 'order', title: 'Order the app start-up' },
  { id: 'ex02', n: 2, block: 2, kind: 'label', title: 'Split a screen into components' },
  { id: 'ex03', n: 3, block: 2, kind: 'code', title: 'Your first component' },
  { id: 'ex04', n: 4, block: 3, kind: 'code', title: 'Reusable ProfileCard with props' },
  { id: 'ex05', n: 5, block: 3, kind: 'code', title: 'useState counter' },
  { id: 'ex06', n: 6, block: 3, kind: 'predict', title: 'When does useEffect run?' },
  { id: 'ex07', n: 7, block: 4, kind: 'match', title: 'Match the core components' },
  { id: 'ex08', n: 8, block: 4, kind: 'code', title: 'Profile screen' },
  { id: 'ex09', n: 9, block: 5, kind: 'fix', title: 'Fix the React Native bugs' },
  { id: 'ex10', n: 10, block: 5, kind: 'code', title: 'Live greeting with TextInput' },
  { id: 'ex11', n: 11, block: 6, kind: 'flex', title: 'Flexbox playground' },
  { id: 'ex12', n: 12, block: 6, kind: 'match', title: 'Match the NativeWind classes' },
  { id: 'ex13', n: 13, block: 6, kind: 'code', title: 'Style a card with NativeWind' },
  { id: 'ex14', n: 14, block: 7, kind: 'order', title: 'Assemble a FlatList screen' },
  { id: 'ex15', n: 15, block: 7, kind: 'code', title: 'Course list with FlatList' },
  { id: 'ex16', n: 16, block: 8, kind: 'code', title: 'Contacts: search & favourites' },
  { id: 'ex17', n: 17, block: 9, kind: 'code', title: 'Final: task list app', final: true },
];

export const EXERCISE_IDS = EXERCISES.map((e) => e.id);
export const FINAL_ID = 'ex17';
