---
title: The Course Project
tagline: Design, build and ship one complete mobile app.
description: 'In teams of up to 3, you build a mobile app from your own new idea: analysis, design, implementation, testing and a live demo. It is worth 60% of the module.'
problem: 'Choose a realistic problem for a specific group of users and get it approved by the instructor. It must be a **new idea**, not a previous project. A list of ideas will be provided if you need inspiration.'
deadline: Week 12
objectives:
  - Architect the solution and communicate it clearly, to people and to AI
  - Critically evaluate AI-generated code
  - Integrate and refine that code into one coherent, working system
  - Present and defend your engineering decisions
requirements:
  - 'Team of **max 3 students**, with a **new**, instructor-approved idea'
  - '**Git & GitHub are mandatory**: one branch per member, with commits from each member''s own account'
  - At least 9 screens (3 per member), excluding sign-in and registration
  - Architecture / design pattern applied. **Monolithic = 0 for Phase 2**
  - Persistent data storage (local and/or cloud)
  - One Google API + one device hardware/software feature
  - 3 unit tests + a full AI engineering log
features:
  - { name: 5+ functional requirements, detail: 'Your core features. Login and sign-up do not count.' }
  - { name: Google API, detail: 'Maps, YouTube Data, Analytics, Cloud Storage, Drive, Calendar, Docs, Translate or Forms.' }
  - { name: Device feature, detail: 'Camera, device info, location, sensors, microphone/speakers, a platform-specific feature or inter-app communication.' }
  - { name: Persistent storage, detail: File storage, a local database, or a cloud database. }
  - { name: Validation & error handling, detail: Validate every form. Catch failures and show clear messages. }
  - { name: Sign-in / registration, detail: 'Allowed, but not counted toward screens or requirements.', required: false }
technicalRequirements:
  - 'React Native + Expo, TypeScript (as taught in the labs)'
  - Folder structure reflects your chosen pattern (e.g. MVVM, Provider/Context)
  - '3 unit tests: designed, run and reported'
  - No secrets or API keys committed. Use `.env` and `.gitignore`
uiRequirements:
  - '9+ screens: 3 per member, each correctly implemented'
  - Consistent styling (StyleSheet or NativeWind)
  - Clear feedback for loading, empty and error states
milestones:
  - { name: Team + idea, detail: Form a team and submit your idea for approval., due: Week 2 }
  - { name: Phase 1, detail: 'Requirements, diagrams, architecture, data plan, 9 screens.', due: Week 6 }
  - { name: Build, detail: 'Storage, Google API, device feature, validation.', due: Weeks 7–11 }
  - { name: Phase 2, detail: 'Final app, 3 unit tests, AI engineering log.', due: Week 12 }
  - { name: Demo, detail: '30-minute team demo + individual questions.', due: Final week }
deliverables:
  - Phase 1 report + UI code (e-learning **and** printed)
  - Phase 2 amended report + final code + AI engineering log
  - Contribution table on page 1 of each report
  - Signed coursework submission form + Statement of Academic Honesty
  - Live presentation & demo. **Attendance is mandatory**
evaluation:
  - { criterion: 'Phase 1 — Analysis, architecture & prototype', weight: 30, detail: 'Use case 5 · Activity 5 · UI 9 · Architecture 6 (+ report).' }
  - { criterion: 'Phase 2 — Implementation, testing & AI log', weight: 50, detail: 'Architecture 5 · Storage 10 · APIs & errors 11 · Tests 9 · AI log 15.' }
  - { criterion: Presentation & demo, weight: 20, detail: 'Individual questions on functionality, architecture (group) and AI decisions. Marks can differ between members.' }
resources:
  - { label: Phase 1 brief, href: /coursework/cw-01 }
  - { label: Phase 2 brief, href: /coursework/cw-02 }
  - { label: Lab 01 — Git & GitHub basics, href: /labs/lab-01 }
  - { label: Command Handbook, href: /commands }
faq:
  - { q: How many students per team?, a: Maximum 3. }
  - { q: Can we use AI?, a: 'Yes, as a development aid. Log every significant interaction (prompt → output → your changes → rationale). Reports must be written by you, not AI. Paraphrasing is limited to 20%.' }
  - { q: What if I miss the demo?, a: 'You are marked absent for the presentation & demo deliverable (20 marks).' }
  - { q: Do all members get the same mark?, a: 'Not necessarily. Marks depend on individual contribution and discussion, and your Git commits are part of the evidence.' }
---

## AI engineering log — the format

For every significant AI interaction that produces code:

| Part | Write down |
| --- | --- |
| **Prompt** | Verbatim, with module/feature, constraints and specifics |
| **Output** | The full code the AI produced |
| **Critical analysis** | What you changed and why · how you verified it (test, manual check) |
| **Rationale** | Why you used AI for this part |

> [!CAUTION]
> Asking AI to "generate the entire application" without your own modular design is **heavily penalised**. AI-generated code without its prompt in the log = **0 for the log and −5 from Phase 2 implementation.**
