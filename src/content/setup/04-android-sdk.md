---
step: 4
title: Configure the Android SDK & environment
summary: Install Android Studio for the SDK and emulator, then point your environment at it.
estimatedTime: 30–45 min
tool: android-studio
requirements:
  - 15 GB+ free disk space
  - 8 GB RAM minimum (16 GB recommended)
  - Hardware virtualisation enabled in BIOS
verify:
  - { command: adb --version, expect: Android Debug Bridge version 1.0.x }
  - { command: echo $ANDROID_HOME, expect: Path to your Android SDK folder }
troubleshooting:
  - problem: "SDK location not found"
    cause: ANDROID_HOME is not set or points to the wrong folder.
    solution: Copy the exact path from Android Studio → Settings → Languages & Frameworks → Android SDK.
---

## Download

Download **Android Studio** from [developer.android.com/studio](https://developer.android.com/studio).

## Installation

Run the installer and choose the **Standard** setup. It installs the SDK, platform-tools and an emulator image.

## Configuration

Add the SDK to your environment variables.

> [!IMPORTANT]
> Open a **new** terminal after changing environment variables.

### Windows

1. Search **"Edit the system environment variables"** → **Environment Variables**.
2. Add a user variable `ANDROID_HOME` = `%LOCALAPPDATA%\Android\Sdk`
3. Edit `Path` and add `%LOCALAPPDATA%\Android\Sdk\platform-tools`

```powershell
[Environment]::GetEnvironmentVariable("ANDROID_HOME", "User")
```

### macOS

Add to `~/.zshrc`:

```bash
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools
```

### Linux

Add to `~/.bashrc`:

```bash
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools
```
