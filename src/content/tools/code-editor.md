---
name: VS Code
description: The code editor for every lab. It includes a built-in terminal, Git support and React Native extensions.
category: Editor
order: 0
logo: ../../assets/tools/vscode.svg
color: '#3b9cff'
whyWeUseIt: It is free on every platform, the standard editor for React Native, and has the extensions below that catch mistakes before you run the app.
docs: https://code.visualstudio.com/docs
extensions:
  - { name: ESLint, detail: 'Flags likely bugs as you type (unused variables, wrong hook usage). **Required.**' }
  - { name: Prettier, detail: Formats your code on save. }
  - { name: Error Lens, detail: 'Shows errors inline, at the end of the line that caused them.' }
  - { name: Expo Tools, detail: Autocomplete and validation for app.json. }
  - { name: React Native Tools, detail: Debugging and IntelliSense for React Native. }
  - { name: GitLens, detail: 'Shows who changed each line and when.' }
  - { name: 'ES7+ React/React-Native snippets', detail: 'Type `rnfe` + Tab to get a full component.' }
  - { name: Tailwind CSS IntelliSense, detail: 'Autocompletes NativeWind class names.' }
troubleshooting:
  - problem: Formatting does nothing on save
    solution: Set Prettier as the default formatter and enable "Format On Save".
  - problem: "'code' command not found"
    solution: 'Command Palette → "Shell Command: Install ''code'' command in PATH".'
relatedLabs: [lab-01]
---

## Install the extensions in one go

```bash
code --install-extension dbaeumer.vscode-eslint
code --install-extension esbenp.prettier-vscode
code --install-extension usernamehw.errorlens
code --install-extension expo.vscode-expo-tools
code --install-extension msjsdiag.vscode-react-native
code --install-extension eamodio.gitlens
code --install-extension dsznajder.es7-react-js-snippets
code --install-extension bradlc.vscode-tailwindcss
```

## Recommended settings

```json title="settings.json"
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.tabSize": 2
}
```

## Shortcuts

| Action | Windows / Linux | macOS |
| --- | --- | --- |
| Command palette | `Ctrl + Shift + P` | `Cmd + Shift + P` |
| Open terminal | ``Ctrl + ` `` | ``Cmd + ` `` |
| Quick open file | `Ctrl + P` | `Cmd + P` |
