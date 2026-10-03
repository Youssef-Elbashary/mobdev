/** Lab 02 · Part 2 — React Native components, input & state, styling (phone frame). Exercises 7–13. */
import type { CodeExercise, FlexExercise, MatchExercise } from '../types.ts';
import { containsCall, el, htmlTags, jsxElements, rawTextInViews, stateHooks, weight } from '../helpers.ts';

export const AVATAR = 'https://mobdev.vercel.app/lab/avatar.png';

export const ex07: MatchExercise = {
  id: 'ex07',
  n: 7,
  title: 'Match the core components',
  minutes: 3,
  level: 1,
  kind: 'match',
  mono: true,
  prompt: 'Drag each React Native component onto the job it does.',
  pairs: [
    { chip: '<View>', target: 'A box that groups and lays out other components (like `<div>`)', why: '`View` is the building block of every layout.' },
    { chip: '<Text>', target: 'Shows words — every string on screen must be inside one', why: 'In React Native, text outside `<Text>` crashes the app.' },
    { chip: '<Image>', target: 'Shows a picture from a file or a URL (give it a width and height)', why: 'Network images need an explicit size.' },
    { chip: '<TextInput>', target: 'A box the user can type in', why: 'Read what they type with `onChangeText`.' },
    { chip: '<Pressable>', target: 'Makes anything tappable with `onPress`', why: 'Wrap any content to turn it into a button.' },
    { chip: '<ScrollView>', target: 'Scrolls content that is taller than the screen', why: 'Good for a page of content — renders everything at once.' },
    { chip: '<FlatList>', target: 'Shows a long list efficiently, rendering only what is visible', why: 'Built for long lists — it renders rows on demand.' },
    { chip: '<SafeAreaView>', target: 'Keeps content away from the notch and the home bar', why: 'It adds padding where the phone’s hardware covers the screen.' },
  ],
  hints: [
    'Start with the ones you know from the web: `View` ≈ `div`, `Text` ≈ `p`, `TextInput` ≈ `input`.',
    'Two of them scroll. One renders everything; the other only what is on screen.',
    'Phones have a notch at the top and a home bar at the bottom — one component avoids them.',
  ],
  success: 'These 8 components build almost every screen. Same React ideas — components, props, state — but the building blocks are native: `View`, `Text`, `Image`, `TextInput`, `Pressable`…',
};

export const ex08: CodeExercise = {
  id: 'ex08',
  n: 8,
  title: 'Profile screen',
  minutes: 4,
  level: 2,
  kind: 'code',
  frame: 'phone',
  entry: 'App.tsx',
  prompt: 'Inside the `View`, add an `Image` (the avatar), a `Text` with your name, and a `Pressable` “Follow” button.',
  files: {
    'App.tsx': `import { View, Text, Image, Pressable } from 'react-native';

const AVATAR = '${AVATAR}';

export default function App() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
      {/* 1. an Image showing AVATAR */}
      {/* 2. a Text with your name */}
      {/* 3. a Pressable with <Text>Follow</Text> inside */}
    </View>
  );
}
`,
  },
  checks: [
    {
      id: 'image',
      label: 'an `Image` with `source={{ uri: AVATAR }}`',
      fail: 'Add the avatar: `<Image source={{ uri: AVATAR }} />`',
      static: (c) => el(c.file(), 'Image').some((e) => !!e.attrs.source),
    },
    {
      id: 'size',
      label: 'the image has a width and height',
      fail: 'React Native can’t guess the size of a network image — add `style={{ width: 96, height: 96 }}` (or `className="w-24 h-24"`).',
      run: async (c) => {
        const [img] = await c.app.find({ rn: 'Image' });
        if (!img) return 'I can’t see an Image on the screen yet.';
        return Number(img.style.width) > 0 && Number(img.style.height) > 0;
      },
    },
    {
      id: 'name',
      label: 'a `Text` with your name',
      fail: 'Add a `<Text>` with your name inside the View.',
      static: (c) => el(c.file(), 'Text').some((e) => e.text && !/^follow(ing)?$/i.test(e.text)),
    },
    {
      id: 'follow',
      label: 'a `Pressable` “Follow” button',
      fail: 'Add a button: `<Pressable onPress={() => {}}><Text>Follow</Text></Pressable>`',
      run: async (c) => (await c.app.find({ rn: 'Pressable', text: 'Follow' })).length > 0,
    },
  ],
  hints: [
    'Three things go inside the View, one after the other: an `Image`, a `Text` and a `Pressable`.',
    'A network image needs `source={{ uri: AVATAR }}` **and** a width and height.',
    'A button is `<Pressable onPress={() => {}}>` with a `<Text>` inside it.',
  ],
  success: 'A real phone screen in 3 components. Notice the double braces in `source={{ uri: AVATAR }}`: the outer `{}` means “JavaScript here”, the inner `{}` is an object.',
  challenge: 'Use `useState` so the button switches between “Follow” and “Following”.',
};

export const ex09: CodeExercise = {
  id: 'ex09',
  n: 9,
  title: 'Fix the React Native bugs',
  minutes: 3,
  level: 3,
  kind: 'fix',
  frame: 'phone',
  entry: 'App.tsx',
  prompt: 'This screen was copied from a web project and has **3 bugs**. Fix them so “Like” adds 1.',
  files: {
    'App.tsx': `import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';

export default function App() {
  const [likes, setLikes] = useState(0);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      Likes: {likes}
      <Pressable onClick={() => setLikes(likes + 1)}>
        <Text style={{ fontSize: 20 }}>❤️ Like</Text>
      </Pressable>
      <div style={{ marginTop: 8 }}>
        <Text>Tap the heart!</Text>
      </div>
    </View>
  );
}
`,
  },
  checks: [
    {
      id: 'text',
      label: 'all words are inside `<Text>`',
      fail: 'Every word on screen must be inside `<Text>`.',
      static: (c) => {
        const raw = rawTextInViews(c.file());
        return raw.length === 0 || `“${raw[0].text}” is written straight inside <${raw[0].parent}> (line ${raw[0].line}) — wrap it in <Text>…</Text>.`;
      },
    },
    {
      id: 'onpress',
      label: 'the button uses `onPress`',
      fail: 'React Native buttons use `onPress` — `onClick` is a web event and never fires on a phone.',
      static: (c) => {
        const pressables = el(c.file(), 'Pressable');
        return pressables.length > 0 && pressables.every((p) => p.attrs.onPress && !p.attrs.onClick);
      },
    },
    {
      id: 'nodiv',
      label: 'no HTML tags like `<div>`',
      fail: 'There’s no `<div>` on a phone — React Native uses `<View>` for boxes.',
      static: (c) => {
        const html = htmlTags(c.file());
        return html.length === 0 || `\`<${html[0].name}>\` (line ${html[0].line}) is an HTML tag. Use \`<View>\` instead.`;
      },
    },
    {
      id: 'works',
      label: 'pressing Like shows `Likes: 1`',
      fail: 'After one press, the screen should show `Likes: 1`.',
      run: async (c) => {
        if (!(await c.app.press({ text: 'Like' }))) return 'I couldn’t find the Like button.';
        return /Likes:\s*1\b/.test(await c.app.text());
      },
    },
  ],
  hints: [
    'Look at the red error box in the preview first — it names the first bug.',
    'In React Native every word must be inside `<Text>`, and buttons use `onPress`.',
    'HTML tags such as `<div>` don’t exist on phones — `<View>` is the box.',
  ],
  success: 'These are the 3 most common beginner bugs: text outside `<Text>`, web events like `onClick`, and HTML tags. Now you’ll spot them instantly.',
};

export const ex10: CodeExercise = {
  id: 'ex10',
  n: 10,
  title: 'Live greeting with TextInput',
  minutes: 5,
  level: 7,
  kind: 'code',
  frame: 'phone',
  entry: 'App.tsx',
  prompt:
    'Typing a name shows `Hello, {name}!` instantly. When the name is empty, show `Type your name above`. A **Clear** button empties it.',
  files: {
    'App.tsx': `import { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';

export default function App() {
  // 1. keep the name in state

  return (
    <View style={{ flex: 1, padding: 24, paddingTop: 80, gap: 12 }}>
      <TextInput
        placeholder="Your name"
        style={{ borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 12, fontSize: 16 }}
      />
      {/* 2. "Hello, {name}!" — or "Type your name above" when the name is empty */}
      {/* 3. a Pressable "Clear" button that empties the name */}
    </View>
  );
}
`,
  },
  checks: [
    {
      id: 'state',
      label: 'the name is kept in state',
      fail: 'Keep the text in state: `const [name, setName] = useState(\'\');`',
      static: (c) => stateHooks(c.file()).length > 0,
    },
    {
      id: 'controlled',
      label: '`TextInput` has `value` and `onChangeText`',
      fail: 'Connect the input both ways: `value={name}` and `onChangeText={setName}`.',
      static: (c) => {
        const input = el(c.file(), 'TextInput')[0];
        if (!input) return 'Keep the `TextInput`.';
        if (input.attrs.onChange && !input.attrs.onChangeText) return 'In React Native use `onChangeText` — it gives you the text directly (onChange gives you an event).';
        if (!input.attrs.onChangeText) return 'Add `onChangeText={setName}` so every keystroke updates the state.';
        if (!input.attrs.value) return 'Add `value={name}` so the input always shows the state (and Clear can empty it).';
        return true;
      },
    },
    {
      id: 'typing',
      label: 'typing “Sara” shows `Hello, Sara!`',
      fail: 'When I type Sara, the screen should show `Hello, Sara!`.',
      run: async (c) => {
        if (!(await c.app.type({}, 'Sara'))) return 'I couldn’t find the TextInput.';
        return /Hello,\s*Sara!/.test(await c.app.text());
      },
    },
    {
      id: 'empty',
      label: 'empty name shows `Type your name above`',
      fail: 'When the name is empty, show `Type your name above` (hint: `name === \'\' ? … : …`).',
      run: async (c) => {
        const text = await c.app.text();
        return /Type your name above/i.test(text) && !/Hello,\s*!/.test(text);
      },
    },
    {
      id: 'clear',
      label: '**Clear** empties the name',
      fail: 'Pressing Clear should set the name back to `\'\'` — call `setName(\'\')` in its onPress.',
      run: async (c) => {
        await c.app.type({}, 'Sara');
        if (!(await c.app.press({ text: 'Clear' }))) return 'I couldn’t find a Clear button.';
        const [input] = await c.app.find({ rn: 'TextInput' });
        return input?.value === '' && !/Hello,\s*Sara/.test(await c.app.text());
      },
    },
  ],
  hints: [
    'Keep the text in state: `const [name, setName] = useState(\'\');`',
    'Connect the input both ways: `value={name}` and `onChangeText={setName}`.',
    'Pick what to show with a condition: `{name === \'\' ? <Text>…</Text> : <Text>Hello, {name}!</Text>}`',
  ],
  success: 'This is a **controlled input**: the TextInput always shows `name`, every keystroke calls `setName`, and React re-renders the greeting. Clear just sets the state back to `\'\'`.',
  challenge: 'Show how many letters were typed: `{name.length} letters`.',
};

export const ex11: FlexExercise = {
  id: 'ex11',
  n: 11,
  title: 'Flexbox playground',
  minutes: 3,
  level: 8,
  kind: 'flex',
  prompt: 'Change the style until the 3 boxes sit exactly on the dashed outlines. 3 rounds.',
  rounds: [
    { flexDirection: 'column', justifyContent: 'center', alignItems: 'center' },
    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
    { flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center' },
  ],
  hints: [
    '`flexDirection` picks the main axis: `column` (the React Native default) or `row`.',
    '`justifyContent` moves boxes along the main axis; `alignItems` along the other (cross) axis.',
    'In a row: justify = left ↔ right, align = top ↕ bottom.',
  ],
  success: 'That’s flexbox in React Native: column by default, `justifyContent` on the main axis, `alignItems` on the cross axis. In NativeWind the last round is `flex-row justify-evenly items-center`.',
};

export const ex12: MatchExercise = {
  id: 'ex12',
  n: 12,
  title: 'Match the NativeWind classes',
  minutes: 2,
  level: 8,
  kind: 'match',
  mono: true,
  prompt: 'Drag each NativeWind class onto the style it creates. Careful — 3 of the classes are fake!',
  pairs: [
    { chip: 'bg-blue-500', target: 'Blue background', why: 'Colours are `bg-{colour}-{shade}`; 500 is the middle shade.' },
    { chip: 'p-4', target: '16 px padding on every side', why: 'Spacing uses a 4 px scale: `p-4` = 16 px.' },
    { chip: 'rounded-xl', target: 'Rounded corners (12 px)', why: '`rounded-sm/md/lg/xl/2xl/full` — bigger names, rounder corners.' },
    { chip: 'text-white', target: 'White text', why: '`text-{colour}` sets the text colour.' },
    { chip: 'font-bold', target: 'Bold text', why: 'Weights use `font-`: `font-medium`, `font-semibold`, `font-bold`.' },
    { chip: 'flex-row', target: 'Children side by side', why: 'Same as `flexDirection: \'row\'`.' },
    { chip: 'items-center', target: 'Centre children on the cross axis', why: 'Same as `alignItems: \'center\'`.' },
    { chip: 'justify-between', target: 'Push children to both ends', why: 'Same as `justifyContent: \'space-between\'`.' },
  ],
  decoys: [
    { chip: 'bg-blue', why: 'Colours need a shade: `bg-blue-500`.' },
    { chip: 'padding-4', why: 'Padding is shortened to `p-`: `p-4`.' },
    { chip: 'text-bold', why: 'Weight uses `font-`, not `text-`: `font-bold`.' },
  ],
  hints: [
    'Spacing letters: `p` = padding, `m` = margin, then `x`/`y`/`t`/`b`… for sides.',
    'Colours always have a shade number, like `-500`.',
    'Flex classes copy the style names: row → `flex-row`, alignItems → `items-…`, justifyContent → `justify-…`.',
  ],
  success: 'NativeWind = Tailwind class names that become React Native styles. Short, consistent, and you can read the design straight from the code.',
};

const CARD_TARGET = `<div style="background:#f1f5f9;border-radius:18px;padding:22px 16px;width:250px">
  <div style="display:flex;align-items:center;gap:12px;background:#fff;border-radius:16px;padding:16px;box-shadow:0 4px 6px rgba(0,0,0,.1)">
    <div style="width:48px;height:48px;border-radius:50%;background:#6366f1;flex:none"></div>
    <div><div style="font:700 18px/28px system-ui;color:#11181c">Mariam Ahmed</div><div style="font:14px/20px system-ui;color:#64748b">Mobile Development · Lab 02</div></div>
  </div>
</div>`;

export const ex13: CodeExercise = {
  id: 'ex13',
  n: 13,
  title: 'Style a card with NativeWind',
  minutes: 4,
  level: 8,
  kind: 'code',
  frame: 'phone',
  entry: 'App.tsx',
  prompt: 'Fill in the empty `className`s so the card looks like the target: white rounded card, avatar circle, bold name, grey subtitle — side by side.',
  target: { html: CARD_TARGET, caption: 'Target' },
  files: {
    'App.tsx': `import { View, Text } from 'react-native';

export default function App() {
  return (
    <View className="flex-1 bg-slate-100 p-6 pt-20">
      <View className="">
        <View className="" />
        <View>
          <Text className="">Mariam Ahmed</Text>
          <Text className="">Mobile Development · Lab 02</Text>
        </View>
      </View>
    </View>
  );
}
`,
  },
  checks: [
    {
      id: 'classes',
      label: 'styled with `className` (NativeWind)',
      fail: 'For this exercise use NativeWind classes in the empty `className=""` slots, not `style`.',
      static: (c) => jsxElements(c.file()).filter((e) => e.attrs.className?.value?.trim()).length >= 5,
    },
    {
      id: 'card',
      label: 'card: white background and padding',
      fail: 'Card (the second View): white background and padding — `bg-white p-4`.',
      run: async (c) => {
        const card = (await c.app.find({ rn: 'View' }))[1];
        return !!card && /^#?fff(fff)?$|white/i.test(String(card.style.backgroundColor)) && Number(card.style.padding ?? card.style.paddingHorizontal) >= 12;
      },
    },
    {
      id: 'round',
      label: 'card: rounded corners',
      fail: 'Round the card’s corners: `rounded-2xl`.',
      run: async (c) => Number((await c.app.find({ rn: 'View' }))[1]?.style.borderRadius) >= 12,
    },
    {
      id: 'row',
      label: 'avatar and text side by side',
      fail: 'Put the avatar and the text in a row, centred: `flex-row items-center` (and `gap-3` for space).',
      run: async (c) => {
        const card = (await c.app.find({ rn: 'View' }))[1];
        return card?.style.flexDirection === 'row' && card.style.alignItems === 'center';
      },
    },
    {
      id: 'avatar',
      label: 'avatar: coloured circle',
      fail: 'Avatar (the third View): a size, a colour and fully rounded — `w-12 h-12 rounded-full bg-indigo-500`.',
      run: async (c) => {
        const a = (await c.app.find({ rn: 'View' }))[2];
        if (!a) return false;
        const w = Number(a.style.width);
        const h = Number(a.style.height);
        return w >= 32 && w === h && Number(a.style.borderRadius) >= w / 2 && !!a.style.backgroundColor;
      },
    },
    {
      id: 'title',
      label: 'name: bigger and bold',
      fail: 'Make the name stand out: `text-lg font-bold`.',
      run: async (c) => {
        const t = (await c.app.find({ rn: 'Text' }))[0];
        return !!t && weight(t.style.fontWeight) >= 600 && Number(t.style.fontSize) >= 18;
      },
    },
    {
      id: 'subtitle',
      label: 'subtitle: softer grey',
      fail: 'Make the subtitle softer: `text-slate-500`.',
      run: async (c) => {
        const t = (await c.app.find({ rn: 'Text' }))[1];
        const color = String(t?.style.color ?? '');
        return !!color && !/^#?(000|000000|11181c)$|^black$/i.test(color);
      },
    },
  ],
  hints: [
    'Work from the outside in: card → avatar → name → subtitle.',
    'Card: `bg-white rounded-2xl p-4 flex-row items-center gap-3` (shadows: `shadow-md`).',
    'Avatar: `w-12 h-12 rounded-full bg-indigo-500`. Name: `text-lg font-bold`. Subtitle: `text-slate-500`.',
  ],
  success: 'Same design you’d write with style objects, in a fraction of the code — and you can read the layout from the class names: `flex-row items-center gap-3`.',
  challenge: 'Add `active:opacity-70` to a Pressable around the card so it reacts to taps.',
};
