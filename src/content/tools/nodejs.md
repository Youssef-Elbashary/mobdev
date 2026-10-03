---
name: Node.js, npm & npx
description: Node.js runs the JavaScript tooling. npm installs packages. npx runs a package's command without installing it.
category: Runtime
order: 4
logo: ../../assets/tools/nodejs.svg
color: '#5fa04e'
whyWeUseIt: Expo, the dev server and every library run on Node. You don't need npm or npx to be installed separately — both come with Node.
docs: https://nodejs.org/en/learn
relatedLabs: [lab-01]
---

## npm vs npx

| | **npm** — Node Package Manager | **npx** — Node Package eXecute |
| --- | --- | --- |
| Job | **Installs** packages into `node_modules` | **Runs** a package's command |
| Example | `npm install` | `npx create-expo-app@latest` |
| Remember | "get the tool" | "use the tool" |

```bash
node -v
npm -v
npx -v
```

> [!WARNING]
> Install the **LTS** version. Never commit `node_modules/`; it's rebuilt by running `npm install`.
