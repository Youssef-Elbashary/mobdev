---
step: 2
title: Install Node.js & the SDK tooling
summary: Node.js runs the development server, package manager and command-line tools.
estimatedTime: 10 min
tool: nodejs
requirements:
  - Internet connection
verify:
  - { command: node -v, expect: v20.x or newer }
  - { command: npm -v, expect: Any version number }
troubleshooting:
  - problem: node works in one terminal but not another
    solution: Close all terminals and your editor, then reopen. PATH is only read when a terminal starts.
---

## Download

Always install the **LTS** (long-term support) version from [nodejs.org](https://nodejs.org).

## Installation

### Windows

1. Run the `.msi` installer and accept the defaults.
2. Leave **Automatically install the necessary tools** unticked unless your instructor says otherwise.

### macOS

Use the `.pkg` installer, or Homebrew:

```bash
brew install node@22
```

### Linux

Use a version manager so you never need `sudo` for npm:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
nvm install --lts
```

## Configuration

No configuration is needed. Check the versions in a **new** terminal.
