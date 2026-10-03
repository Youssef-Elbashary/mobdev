---
name: Git & GitHub
description: Git records every change to your code. GitHub hosts the shared team repository online.
category: Version Control
order: 5
logo: ../../assets/tools/git.svg
color: '#f05033'
whyWeUseIt: Git is mandatory in this module. Every team member must commit on their own branch, because your commit history shows your individual contribution to the coursework.
docs: https://docs.github.com/en/get-started
extensions:
  - { name: GitHub account, detail: 'Free at github.com. Use your real name so we can match your commits to you.' }
  - { name: GitLens (VS Code), detail: Shows who changed each line and when. }
  - { name: GitHub CLI (gh), detail: 'Optional: create repos and sign in from the terminal.' }
troubleshooting:
  - problem: Authentication failed on git push
    solution: GitHub doesn't accept passwords. Sign in through the browser pop-up (Git Credential Manager) or with the GitHub CLI.
    commands: ['gh auth login']
  - problem: '"remote origin already exists"'
    solution: Point it at the right URL instead of adding it again.
    commands: ['git remote set-url origin <repository-url>']
relatedLabs: [lab-01]
---

## Git vs GitHub

| Git | GitHub |
| --- | --- |
| A program on **your laptop** | A **website** that hosts repos |
| Tracks changes, commits, branches | Shares the repo with your team, pull requests |

## The team workflow

```bash
git switch -c ali/login-screen   # 1. your own branch
git add .                         # 2. stage
git commit -m "Add login screen"  # 3. commit
git push -u origin ali/login-screen  # 4. push → open a Pull Request
git switch main && git pull       # 5. after merge: update main
```

> [!IMPORTANT]
> Never work directly on `main`. One branch per member (or per feature), merged through a Pull Request.
