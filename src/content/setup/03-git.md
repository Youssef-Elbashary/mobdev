---
step: 3
title: Install Git
summary: Version control for every lab, coursework and the course project.
estimatedTime: 10 min
tool: git
requirements:
  - A GitHub account (free)
verify:
  - { command: git --version, expect: git version 2.x }
  - { command: git config --global user.name, expect: Your name }
troubleshooting:
  - problem: Commits show the wrong name or email
    solution: Set your identity globally (see Configuration), then make a new commit.
---

## Installation

### Windows

Download **Git for Windows** from [git-scm.com](https://git-scm.com/download/win). Keep the defaults — they include **Git Bash**, a Unix-style terminal used in many course examples.

### macOS

```bash
xcode-select --install
```

### Linux

```bash
sudo apt install git
```

## GitHub account

Create a free account at [github.com](https://github.com/signup). **Every team member needs their own account.** Commits must come from you.

## Configuration

Tell Git who you are — use the same email as your GitHub account:

```bash
git config --global user.name "Your Name"
git config --global user.email "you@bue.edu.eg"
git config --global init.defaultBranch main
```
