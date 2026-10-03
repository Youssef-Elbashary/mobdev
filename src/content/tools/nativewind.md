---
name: NativeWind
description: Tailwind CSS for React Native. Style components with short class names instead of long style objects.
category: Styling
order: 6
logo: ../../assets/tools/nativewind.svg
color: '#38bdf8'
required: false
whyWeUseIt: Styling is faster and more consistent. Anything you already know from Tailwind on the web works here too.
docs: https://www.nativewind.dev
troubleshooting:
  - problem: className has no effect
    cause: The config doesn't match your installed NativeWind version, or the `content` paths don't include your files.
    solution: Follow the setup guide for the exact version in your package.json, then restart with a clean cache.
    commands: ['npx expo start --clear']
relatedLabs: [lab-01]
---

## StyleSheet vs NativeWind

```tsx
// Built-in StyleSheet
<View style={styles.card}><Text style={styles.title}>Hi</Text></View>

// NativeWind
<View className="rounded-xl bg-white p-4"><Text className="text-lg font-bold">Hi</Text></View>
```

> [!WARNING]
> Setup steps differ between major versions. Always follow the **official guide for the version you installed**, not an old tutorial.

Learn the plain `StyleSheet` first (Lab 01), then switch to NativeWind if your team prefers it.
