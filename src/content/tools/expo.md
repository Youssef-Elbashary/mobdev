---
name: Expo
description: The toolkit on top of React Native. It creates projects, runs the dev server and handles the native setup for you.
category: Framework
order: 2
logo: ../../assets/tools/expo.svg
color: '#9aa3ad'
whyWeUseIt: Plain React Native needs a lot of native configuration before you see one screen. With Expo you run one command, scan a QR code and your app is on your phone. It also includes ready-made modules for the camera, location and sensors, which you need for the coursework's device feature.
docs: https://docs.expo.dev
alternatives:
  - { name: React Native CLI, verdict: 'Full control, but you must configure Android Studio, Gradle and Xcode before running anything. Expo does this for you and still lets you add native code later.' }
troubleshooting:
  - problem: '"npxexpo" is not recognized'
    solution: 'It is two words: `npx expo start`.'
  - problem: Strange bundling errors after installing a package
    solution: Clear the cache, then check versions.
    commands: ['npx expo start --clear', 'npx expo-doctor', 'npx expo install --fix']
relatedLabs: [lab-01]
---

## The commands you'll use most

| Command | What it does |
| --- | --- |
| `npx create-expo-app@latest` | Create a new project |
| `npm run reset-project` | Clear the starter template so you get a blank app |
| `npx expo start` | Start the dev server and show the QR code |
| `npx expo install <pkg>` | Install a library at the version that matches your Expo SDK |

> [!IMPORTANT]
> For libraries with native code, use `npx expo install` rather than `npm install`. It picks the version that works with your Expo SDK.
