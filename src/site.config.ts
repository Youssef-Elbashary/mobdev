/**
 * COURSE-LEVEL SETTINGS
 * Course info, teaching team and assessment live in src/content/data/site.yaml
 * (editable from the admin CMS). Navigation is defined here.
 */
import { parse } from 'yaml';
import { siteSchema } from './content/schemas';
import siteYaml from './content/data/site.yaml?raw';

const site = siteSchema.parse(parse(siteYaml));

/** Course name, codes, overview copy. */
export const course = site.course;

/** Teaching team — shown on the home page, in the footer and in Lab 01. */
export const team = site.team;

/** Assessment split for the module. */
export const assessment = site.assessment;

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
