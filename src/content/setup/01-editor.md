---
step: 1
title: Install the development environment
summary: Install the code editor and the extensions used throughout the course.
estimatedTime: 10 min
tool: code-editor
requirements:
  - Administrator rights on your computer
  - About 500 MB free disk space
verify:
  - { command: code --version, expect: Prints a version number such as 1.9x.x }
troubleshooting:
  - problem: "'code' command not found"
    solution: 'Open VS Code → Command Palette → "Shell Command: Install ''code'' command in PATH", then reopen the terminal.'
---

## Download

Download the editor from the official website: [code.visualstudio.com](https://code.visualstudio.com).

## Installation

### Windows

1. Run the downloaded `.exe` installer.
2. Tick **Add to PATH** and **Add "Open with Code" action**.
3. Finish and launch the editor.

### macOS

1. Open the downloaded `.zip` and drag **Visual Studio Code** into **Applications**.
2. Launch it, open the Command Palette (`Cmd + Shift + P`) and run **Shell Command: Install 'code' command in PATH**.

### Linux

```bash
sudo snap install code --classic
```

Or install the `.deb` / `.rpm` package from the download page.

## Configuration

Install the recommended extensions from the terminal:

```bash
code --install-extension esbenp.prettier-vscode
code --install-extension dbaeumer.vscode-eslint
code --install-extension expo.vscode-expo-tools
```

> [!TIP]
> Turn on **Format on Save** (Settings → search "format on save"). It removes a whole category of messy-code problems.
