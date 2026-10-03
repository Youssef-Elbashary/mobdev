/**
 * COURSE-LEVEL SETTINGS
 * Edit this file to change course name, overview copy and navigation.
 * Everything in [brackets] is a placeholder waiting for real course info.
 */
export const course = {
  name: 'Mobile Development',
  short: 'MobDev',
  code: '25CSCI38H',
  term: '2026–2027 · Semester One',
  university: 'The British University in Egypt · ICS',
  instructor: 'Dr. Amira Abdelaziz',
  contact: 'amira.abdelaziz@bue.edu.eg',
  tagline:
    'Learn, build, experiment, and ship mobile applications through hands-on labs, coursework, a capstone project, tools, and practical development guides.',

  overview: {
    what: 'A practical, build-first course on designing and shipping mobile applications — from your first running screen to a complete, tested app on a real device.',
    learn: [
      'How mobile apps are structured, rendered and run',
      'Building responsive interfaces from reusable components',
      'State, navigation and application logic',
      'Consuming REST APIs and persisting data on-device',
      'Debugging, testing and preparing an app for release',
    ],
    build: 'A series of small lab apps that grow into one polished course project you can put in your portfolio.',
    tools: 'React Native + Expo, Expo Go, VS Code, Node.js/npm, Git & GitHub, NativeWind and the Android emulator.',
    outcome:
      'Plan, build, debug and present a working mobile application — and explain the engineering decisions behind it.',
  },
};

/** Teaching team — shown on the home page, in the footer and in Lab 01. */
export const team = [
  { role: 'Module leader', name: 'Dr. Amira Abdelaziz', email: 'amira.abdelaziz@bue.edu.eg' },
  { role: 'TA', name: 'Ramy Abousaif', email: 'ramy.abousaif@bue.edu.eg' },
  { role: 'TA', name: 'Ali Motawea', email: 'ali.motawea@bue.edu.eg' },
  { role: 'TA', name: 'Youssef Mahmoud', email: 'youssef.elbashary@bue.edu.eg' },
];

/** Assessment split for the module. */
export const assessment = [
  { label: 'Coursework project', weight: 60, sub: 'team of up to 3 students' },
  { label: 'Final exam', weight: 40, sub: 'written exam' },
];

export const nav = [
  { label: 'Home', href: '/' },
  { label: 'Labs', href: '/labs' },
  { label: 'Coursework', href: '/coursework' },
  { label: 'Project', href: '/project' },
  { label: 'Commands', href: '/commands' },
  { label: 'Tools', href: '/tools' },
  { label: 'Setup', href: '/setup' },
  { label: 'Resources', href: '/resources' },
];

export const secondaryNav = [
  { label: 'Troubleshooting', href: '/troubleshooting' },
  { label: 'Extra Learning', href: '/extra' },
];
