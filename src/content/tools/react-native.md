---
name: React Native
description: The framework we build every app with. One JavaScript/TypeScript codebase renders real native UI on Android and iOS.
category: Framework
order: 1
logo: ../../assets/tools/react.svg
color: '#61dafb'
whyWeUseIt: You write one codebase and get two real native apps. It uses React, the most widely used UI library, so what you learn also applies to web development and to jobs.
docs: https://reactnative.dev/docs/getting-started
alternatives:
  - { name: Native (Kotlin / Swift), verdict: 'Best performance and full platform access, but you would build **two separate apps** in two languages with two IDEs. That is too much for a one-semester team project.' }
  - { name: Flutter (Dart), verdict: 'Excellent framework, but it uses Dart, which few students already know, and draws its own widgets instead of using native ones. React Native reuses JavaScript/TypeScript and React skills you already have or will use on the web.' }
  - { name: Web / PWA, verdict: 'Easy to start, but has limited access to device hardware (camera, sensors, background work), and the coursework needs a device-specific feature.' }
relatedLabs: [lab-01]
resources:
  - { label: React Native docs, href: 'https://reactnative.dev/docs/getting-started' }
---

## What it is

| | |
| --- | --- |
| Language | JavaScript / **TypeScript** |
| UI model | React components: `<View>`, `<Text>`, `<Image>`… |
| Output | Real native Android + iOS views, not a web page |
| Made by | Meta, with a large open-source community |

## How it works

```text
Your code (TSX)  →  React Native  →  native Android / iOS views
```

> [!TIP]
> Already know HTML? `<View>` works like `<div>`, and `<Text>` is where all text must go.
