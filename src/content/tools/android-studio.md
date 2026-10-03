---
name: Android Studio & Emulator
description: Provides the Android SDK and a virtual Android phone (emulator) that runs on your laptop.
category: Devices
order: 7
logo: ../../assets/tools/androidstudio.svg
color: '#3ddc84'
required: false
whyWeUseIt: It gives you a phone on your screen, which is useful if you don't have an Android phone or the Wi-Fi blocks Expo Go. It is also needed later for native builds. You don't write code in it; VS Code is still your editor.
docs: https://developer.android.com/studio
troubleshooting:
  - problem: Emulator is very slow or won't start
    cause: Hardware virtualisation is disabled.
    solution: Enable VT-x / AMD-V in BIOS. On Windows, also enable "Windows Hypervisor Platform".
  - problem: '"adb: command not found"'
    solution: Add the SDK `platform-tools` folder to PATH, then open a new terminal.
    commands: ['adb --version']
relatedLabs: [lab-01]
---

## Create an emulator

1. Android Studio → **Device Manager** → **Create device**
2. Pick a **Pixel** profile → download a system image → **Finish**
3. Press ▶ to boot it
4. In your project terminal, press **`a`** while `npx expo start` is running

```bash
adb devices
emulator -list-avds
```

See **Setup → Step 4** for the `ANDROID_HOME` / PATH configuration.
