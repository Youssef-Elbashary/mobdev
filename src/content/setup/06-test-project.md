---
step: 6
title: Run a test project
summary: Create and run a starter app to prove every piece works together.
estimatedTime: 10 min
verify:
  - { command: npx expo start, expect: A QR code and "Metro waiting on…" }
---

## Create the project

```bash
npx create-expo-app@latest setup-check
cd setup-check
npx expo start
```

## Open it

- Press `a` to open the Android emulator, **or**
- Scan the QR code with Expo Go on your phone.

You should see the starter screen within a minute.
