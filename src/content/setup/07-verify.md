---
step: 7
title: Verify everything
summary: Run one final check of every tool before Lab 01.
estimatedTime: 5 min
verify:
  - { command: node -v, expect: v20.x or newer }
  - { command: git --version, expect: git version 2.x }
  - { command: adb devices, expect: Your emulator or phone }
  - { command: code --version, expect: A version number }
---

## Final check

Run each command in the **Verification** panel. If every one prints what's expected, your computer is ready for Mobile Development.

> [!IMPORTANT]
> Tick the final items in the **Setup checklist** — your progress is saved in this browser.

If anything fails, open the [Troubleshooting center](/troubleshooting).
