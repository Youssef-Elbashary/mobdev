---
step: 5
title: Configure an emulator or device
summary: Create a virtual device, or connect your own phone.
estimatedTime: 15 min
tool: expo-go
verify:
  - { command: adb devices, expect: At least one device listed as "device" }
troubleshooting:
  - problem: Physical phone shows as "unauthorized"
    solution: Unlock the phone and accept the "Allow USB debugging?" prompt.
---

## Option A — Virtual device

1. Android Studio → **Device Manager** → **Create Virtual Device**.
2. Pick a recent **Pixel** profile.
3. Download the latest stable **system image** and finish.
4. Press ▶ to boot it.

## Option B — Your own phone

1. Install **Expo Go** from the Play Store / App Store.
2. Make sure your phone and laptop are on the **same Wi-Fi network**.

> [!TIP]
> Campus Wi-Fi often blocks device-to-device traffic. If the phone can't connect, use `npx expo start --tunnel`.
