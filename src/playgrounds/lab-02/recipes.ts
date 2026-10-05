import type { Walkthrough } from '@/lib/playgrounds';

/* The solved 4-page example app. Every file works unchanged in a real Expo project
   (npx create-expo-app@latest --template tabs) and in the in-page runner. */

const data = `export type Recipe = {
  id: string;
  title: string;
  emoji: string;
  minutes: number;
  ingredients: string[];
  steps: string[];
};

export const RECIPES: Recipe[] = [
  {
    id: '1', title: 'Koshari', emoji: '🍝', minutes: 45,
    ingredients: ['Rice', 'Lentils', 'Pasta', 'Tomato sauce', 'Crispy onions'],
    steps: ['Cook rice, lentils and pasta separately.', 'Simmer a garlicky tomato sauce.', 'Layer everything and top with onions.'],
  },
  {
    id: '2', title: 'Shakshuka', emoji: '🍳', minutes: 25,
    ingredients: ['Eggs', 'Tomatoes', 'Pepper', 'Onion', 'Cumin'],
    steps: ['Soften onion and pepper.', 'Add tomatoes and cumin, simmer.', 'Crack in the eggs and cover until set.'],
  },
  {
    id: '3', title: 'Falafel', emoji: '🧆', minutes: 30,
    ingredients: ['Fava beans', 'Herbs', 'Garlic', 'Sesame'],
    steps: ['Blend soaked beans with herbs and garlic.', 'Shape into discs and dip in sesame.', 'Fry until golden.'],
  },
  {
    id: '4', title: 'Lentil Soup', emoji: '🥣', minutes: 35,
    ingredients: ['Red lentils', 'Carrot', 'Onion', 'Cumin', 'Lemon'],
    steps: ['Boil lentils with carrot and onion.', 'Blend until smooth.', 'Season with cumin and lemon.'],
  },
  {
    id: '5', title: 'Fattah', emoji: '🍚', minutes: 60,
    ingredients: ['Rice', 'Toasted bread', 'Garlic vinegar sauce', 'Beef'],
    steps: ['Cook the beef and its broth.', 'Layer bread, rice and sauce.', 'Top with the beef.'],
  },
  {
    id: '6', title: 'Basbousa', emoji: '🍰', minutes: 50,
    ingredients: ['Semolina', 'Yogurt', 'Sugar syrup', 'Coconut'],
    steps: ['Mix semolina, yogurt and coconut.', 'Bake until golden.', 'Pour cold syrup over the hot cake.'],
  },
];
`;

const context = `import { createContext, useContext, useState, type ReactNode } from 'react';
import { RECIPES, type Recipe } from '../data/recipes';

type NewRecipe = { title: string; emoji: string; minutes: number };
type RecipesValue = {
  recipes: Recipe[];
  isFavorite: (id: string) => boolean;
  toggleFavorite: (id: string) => void;
  addRecipe: (r: NewRecipe) => void;
};

// 1. create the context (the "shared box")
const RecipesContext = createContext<RecipesValue | null>(null);

// 2. the provider owns the state and wraps the whole app (see app/_layout.tsx)
export function RecipesProvider({ children }: { children: ReactNode }) {
  const [recipes, setRecipes] = useState<Recipe[]>(RECIPES);
  const [favorites, setFavorites] = useState<string[]>([]);

  const value: RecipesValue = {
    recipes,
    isFavorite: (id) => favorites.includes(id),
    toggleFavorite: (id) =>
      setFavorites((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id])),
    addRecipe: ({ title, emoji, minutes }) =>
      setRecipes((r) => [
        { id: String(Date.now()), title, emoji: emoji || '🍽️', minutes, ingredients: [], steps: [] },
        ...r,
      ]),
  };

  return <RecipesContext.Provider value={value}>{children}</RecipesContext.Provider>;
}

// 3. a custom hook: any page calls useRecipes() to read or change the shared state
export function useRecipes() {
  const value = useContext(RecipesContext);
  if (!value) throw new Error('useRecipes() must be used inside <RecipesProvider>');
  return value;
}
`;

const card = `import { Link } from 'expo-router';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import type { Recipe } from '../data/recipes';
import { useRecipes } from '../context/recipes';

// props: the recipe to show. Tapping it opens /recipe/<id>
export default function RecipeCard({ recipe }: { recipe: Recipe }) {
  const { isFavorite } = useRecipes();
  return (
    <Link href={\`/recipe/\${recipe.id}\`} asChild>
      <Pressable style={styles.card}>
        <Text style={styles.emoji}>{recipe.emoji}</Text>
        <View style={styles.info}>
          <Text style={styles.title}>{recipe.title}</Text>
          <Text style={styles.meta}>⏱ {recipe.minutes} min</Text>
        </View>
        {isFavorite(recipe.id) && <Text style={styles.heart}>♥</Text>}
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, marginBottom: 10, borderRadius: 14, backgroundColor: '#fff7ed' },
  emoji: { fontSize: 32 },
  info: { flex: 1 },
  title: { fontSize: 16, fontWeight: '700' },
  meta: { color: '#9a3412', marginTop: 2 },
  heart: { fontSize: 18, color: '#e8590c' },
});
`;

const rootLayout = `import { Stack } from 'expo-router';
import { RecipesProvider } from '../context/recipes';

// Root layout: a Stack (pages slide on top of each other, with a Back button),
// wrapped in the provider so every page shares the same recipes and favorites.
export default function RootLayout() {
  return (
    <RecipesProvider>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="recipe/[id]" options={{ title: 'Recipe' }} />
      </Stack>
    </RecipesProvider>
  );
}
`;

const tabsLayout = `import { Tabs } from 'expo-router';
import { Text } from 'react-native';

// Every file in app/(tabs)/ becomes a tab. (tabs) is a group: it is not part of the URL.
export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#e8590c' }}>
      <Tabs.Screen name="index" options={{ title: 'Recipes', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>🍽</Text> }} />
      <Tabs.Screen name="favorites" options={{ title: 'Favorites', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>♥</Text> }} />
      <Tabs.Screen name="add" options={{ title: 'Add', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>＋</Text> }} />
    </Tabs>
  );
}
`;

const home = `import { useMemo, useState } from 'react';
import { FlatList, Text, TextInput, View, StyleSheet } from 'react-native';
import RecipeCard from '../../components/RecipeCard';
import { useRecipes } from '../../context/recipes';

// Page 1: all recipes + search
export default function HomeScreen() {
  const { recipes } = useRecipes();
  const [query, setQuery] = useState('');

  // only re-filter when the list or the query changes
  const visible = useMemo(
    () => recipes.filter((r) => r.title.toLowerCase().includes(query.toLowerCase())),
    [recipes, query],
  );

  return (
    <View style={styles.screen}>
      <TextInput style={styles.search} placeholder="Search recipes" value={query} onChangeText={setQuery} />
      <FlatList
        data={visible}
        keyExtractor={(r) => r.id}
        renderItem={({ item }) => <RecipeCard recipe={item} />}
        ListEmptyComponent={<Text style={styles.empty}>No recipe matches "{query}"</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 14, backgroundColor: '#fff' },
  search: { borderWidth: 1, borderColor: '#fed7aa', borderRadius: 12, padding: 10, marginBottom: 12, fontSize: 15 },
  empty: { textAlign: 'center', color: '#94a3b8', marginTop: 24 },
});
`;

const details = `import { Stack, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, Text, StyleSheet } from 'react-native';
import { useRecipes } from '../../context/recipes';

// Page 2: one recipe. The [id] in the file name is a route param: /recipe/3 → id = "3"
export default function RecipeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { recipes, isFavorite, toggleFavorite } = useRecipes();
  const recipe = recipes.find((r) => r.id === id);

  if (!recipe) return <Text style={styles.missing}>Recipe not found</Text>;
  const fav = isFavorite(recipe.id);

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      {/* change the header title from inside the page */}
      <Stack.Screen options={{ title: recipe.title }} />
      <Text style={styles.emoji}>{recipe.emoji}</Text>
      <Text style={styles.title}>{recipe.title}</Text>
      <Text style={styles.meta}>⏱ {recipe.minutes} min</Text>

      <Pressable style={[styles.fav, fav && styles.favOn]} onPress={() => toggleFavorite(recipe.id)}>
        <Text style={[styles.favText, fav && styles.favTextOn]}>{fav ? '♥ Remove from favorites' : '♡ Add to favorites'}</Text>
      </Pressable>

      {recipe.ingredients.length > 0 && <Text style={styles.h}>Ingredients</Text>}
      {recipe.ingredients.map((x) => <Text key={x} style={styles.li}>• {x}</Text>)}
      {recipe.steps.length > 0 && <Text style={styles.h}>Steps</Text>}
      {recipe.steps.map((s, i) => <Text key={s} style={styles.li}>{i + 1}. {s}</Text>)}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 20, alignItems: 'center', backgroundColor: '#fff' },
  missing: { padding: 24, textAlign: 'center' },
  emoji: { fontSize: 64 },
  title: { fontSize: 24, fontWeight: '800', marginTop: 4 },
  meta: { color: '#9a3412', marginTop: 4 },
  fav: { marginVertical: 16, paddingVertical: 10, paddingHorizontal: 18, borderRadius: 999, borderWidth: 1.5, borderColor: '#e8590c' },
  favOn: { backgroundColor: '#e8590c' },
  favText: { color: '#e8590c', fontWeight: '700' },
  favTextOn: { color: '#fff' },
  h: { alignSelf: 'stretch', fontSize: 16, fontWeight: '700', marginTop: 10, marginBottom: 4 },
  li: { alignSelf: 'stretch', color: '#334155', marginBottom: 4 },
});
`;

const favorites = `import { FlatList, Text, View, StyleSheet } from 'react-native';
import RecipeCard from '../../components/RecipeCard';
import { useRecipes } from '../../context/recipes';

// Page 3: only the favorites. The data comes from the shared context.
export default function FavoritesScreen() {
  const { recipes, isFavorite } = useRecipes();
  const favorites = recipes.filter((r) => isFavorite(r.id));

  return (
    <View style={styles.screen}>
      <Text style={styles.count}>{favorites.length} {favorites.length === 1 ? 'favorite' : 'favorites'}</Text>
      <FlatList
        data={favorites}
        keyExtractor={(r) => r.id}
        renderItem={({ item }) => <RecipeCard recipe={item} />}
        ListEmptyComponent={<Text style={styles.empty}>No favorites yet: tap ♡ on a recipe</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 14, backgroundColor: '#fff' },
  count: { color: '#64748b', marginBottom: 10 },
  empty: { textAlign: 'center', color: '#94a3b8', marginTop: 24 },
});
`;

const add = `import { useRef, useState } from 'react';
import { router } from 'expo-router';
import { Pressable, Text, TextInput, View, StyleSheet } from 'react-native';
import { useRecipes } from '../../context/recipes';

// Page 4: a form. Validate, add to the shared list, go back to Home.
export default function AddScreen() {
  const { addRecipe } = useRecipes();
  const [title, setTitle] = useState('');
  const [emoji, setEmoji] = useState('');
  const [minutes, setMinutes] = useState('');
  const [error, setError] = useState('');
  const titleRef = useRef<TextInput>(null);

  function save() {
    if (!title.trim()) {
      setError('Title is required');
      titleRef.current?.focus();
      return;
    }
    const mins = Number(minutes);
    if (!Number.isInteger(mins) || mins <= 0) {
      setError('Minutes must be a positive number');
      return;
    }
    addRecipe({ title: title.trim(), emoji: emoji.trim(), minutes: mins });
    setTitle('');
    setEmoji('');
    setMinutes('');
    setError('');
    router.push('/');
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.label}>Title</Text>
      <TextInput ref={titleRef} style={styles.input} placeholder="Title" value={title} onChangeText={setTitle} />
      <Text style={styles.label}>Emoji</Text>
      <TextInput style={styles.input} placeholder="Emoji" value={emoji} onChangeText={setEmoji} />
      <Text style={styles.label}>Minutes</Text>
      <TextInput style={styles.input} placeholder="Minutes" value={minutes} onChangeText={setMinutes} keyboardType="number-pad" />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={styles.save} onPress={save}>
        <Text style={styles.saveText}>Save recipe</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 18, gap: 6, backgroundColor: '#fff' },
  label: { fontWeight: '700', marginTop: 6 },
  input: { borderWidth: 1, borderColor: '#fed7aa', borderRadius: 12, padding: 10, fontSize: 15 },
  error: { color: '#dc2626', marginTop: 6 },
  save: { marginTop: 14, backgroundColor: '#e8590c', padding: 14, borderRadius: 12, alignItems: 'center' },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
`;

export default {
  title: 'Recipes: the solved 4-page app',
  files: {
    'app/_layout.tsx': rootLayout,
    'app/(tabs)/_layout.tsx': tabsLayout,
    'app/(tabs)/index.tsx': home,
    'app/recipe/[id].tsx': details,
    'app/(tabs)/favorites.tsx': favorites,
    'app/(tabs)/add.tsx': add,
    'components/RecipeCard.tsx': card,
    'context/recipes.tsx': context,
    'data/recipes.ts': data,
  },
  tree: [
    { file: 'app/_layout.tsx', note: 'The **root layout**: a `Stack` (pages slide on top, with Back), wrapped in `RecipesProvider` so every page shares the same data (Task 5.3).', href: '/' },
    { file: 'app/(tabs)/_layout.tsx', note: 'The **tab bar**. Each file in `(tabs)/` becomes a tab; `(tabs)` is a *group*, so it is not part of the URL.', href: '/' },
    { file: 'app/(tabs)/index.tsx', note: '**Page 1: Home.** A `FlatList` of `RecipeCard`s and a search box filtered with `useMemo` (exercise E9). URL: `/`', href: '/' },
    { file: 'app/(tabs)/favorites.tsx', note: '**Page 3: Favorites.** Filters the shared recipes with `isFavorite` from the context. URL: `/favorites`', href: '/favorites' },
    { file: 'app/(tabs)/add.tsx', note: '**Page 4: Add.** A form with `useState`, validation, `useRef` to focus the bad field (E6, E8), then `router.push(\'/\')`. URL: `/add`', href: '/add' },
    { file: 'app/recipe/[id].tsx', note: '**Page 2: Details.** `[id]` is a **route param**, read with `useLocalSearchParams()`. `<Stack.Screen options>` sets the header title (Task 5.2). URL: `/recipe/1`', href: '/recipe/1' },
    { file: 'components/RecipeCard.tsx', note: 'A reusable component with **props** (E2). `<Link href asChild>` makes the whole card open the Details page.' },
    { file: 'context/recipes.tsx', note: '**Shared state**: `createContext` + a provider that owns the state + a custom hook `useRecipes()` that any page can call.' },
    { file: 'data/recipes.ts', note: 'Plain data with a TypeScript **type**.' },
  ],
} satisfies Walkthrough;
