---
name: Expo Go
description: A free phone app that runs your project instantly. Scan a QR code and the app opens on your phone, with no build step.
category: Devices
order: 3
logo: ../../assets/tools/expo.svg
color: '#c8ff4d'
whyWeUseIt: It is the fastest way to see your app on a real phone. Save a file and the phone updates in about a second (Fast Refresh). You don't need a Mac or an emulator.
docs: https://expo.dev/go
troubleshooting:
  - problem: Phone can't connect to the dev server
    cause: Your phone and laptop are on different networks, or campus Wi-Fi blocks devices from reaching each other.
    solution: Put both on the same network, or use tunnel mode.
    commands: ['npx expo start --tunnel']
  - problem: '"Project is incompatible with this version of Expo Go"'
    cause: Expo Go supports one SDK version at a time.
    solution: Update Expo Go from the store, or check your SDK version.
    commands: ['npx expo --version']
relatedLabs: [lab-01]
---

## Setup (2 minutes)

1. Install **Expo Go** from the Play Store or App Store.
2. Connect your phone to the **same Wi-Fi** as your laptop.
3. Run `npx expo start`, then scan the QR code (Android: in Expo Go · iOS: with the Camera app).

> [!NOTE]
> Expo Go is a learning tool. For a production app you would use a *development build*. You don't need one for the labs.
