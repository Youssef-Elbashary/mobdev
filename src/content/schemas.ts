/**
 * CONTENT SCHEMAS — shared by the site build (src/content.config.ts) and the admin CMS,
 * so a CMS save that would break the build is refused with the same rules.
 * Fields that hold an image take an `image` factory: Astro's `image()` in the build, a plain string in the CMS.
 */
import { z } from 'astro/zod';

type ImageField = () => z.ZodTypeAny;
const imagePath: ImageField = () => z.string();

export const difficulty = z.enum(['Beginner', 'Intermediate', 'Advanced']);
export const link = z.object({ label: z.string(), href: z.string() });
export const problem = z.object({
  problem: z.string(),
  cause: z.string().optional(),
  solution: z.string(),
  commands: z.array(z.string()).optional(),
  notes: z.string().optional(),
});
export const faq = z.object({ q: z.string(), a: z.string() });

export const labSchema = (image: ImageField = imagePath) =>
  z.object({
    number: z.number(),
    title: z.string(),
    description: z.string(),
    difficulty,
    estimatedTime: z.string(),
    skills: z.array(z.string()).default([]),
    objectives: z.array(z.string()).default([]),
    prerequisites: z.array(z.string()).default([]),
    expectedResult: z
      .object({
        description: z.string(),
        image: image().optional(),
        screen: z.array(z.string()).optional(),
      })
      .optional(),
    troubleshooting: z.array(problem).default([]),
    submission: z.array(z.string()).default([]),
    extraChallenge: z.string().optional(),
    resources: z.array(link).default([]),
    roadmapStage: z.string().optional(),
    draft: z.boolean().default(false),
  });

export const courseworkSchema = z.object({
  number: z.number(),
  title: z.string(),
  description: z.string(),
  weight: z.string().optional(),
  deadline: z.string().optional(), // ISO date, or leave empty for "TBA"
  objectives: z.array(z.string()).default([]),
  requirements: z.array(z.string()).default([]),
  tasks: z.array(z.object({ title: z.string(), detail: z.string() })).default([]),
  deliverables: z.array(z.string()).default([]),
  submission: z.array(z.string()).default([]),
  grading: z.array(z.object({ criterion: z.string(), weight: z.union([z.string(), z.number()]), detail: z.string().optional() })).default([]),
  resources: z.array(link).default([]),
  faq: z.array(faq).default([]),
  draft: z.boolean().default(false),
});

export const projectSchema = z.object({
  title: z.string(),
  tagline: z.string(),
  description: z.string(),
  problem: z.string(),
  deadline: z.string().optional(),
  objectives: z.array(z.string()).default([]),
  requirements: z.array(z.string()).default([]),
  features: z.array(z.object({ name: z.string(), detail: z.string(), required: z.boolean().default(true) })).default([]),
  technicalRequirements: z.array(z.string()).default([]),
  uiRequirements: z.array(z.string()).default([]),
  milestones: z.array(z.object({ name: z.string(), detail: z.string(), due: z.string().optional() })).default([]),
  deliverables: z.array(z.string()).default([]),
  evaluation: z.array(z.object({ criterion: z.string(), weight: z.union([z.string(), z.number()]), detail: z.string().optional() })).default([]),
  resources: z.array(link).default([]),
  faq: z.array(faq).default([]),
});

export const toolSchema = (image: ImageField = imagePath) =>
  z.object({
    name: z.string(),
    description: z.string(),
    category: z.string(),
    order: z.number().default(99),
    logo: image().optional(), // path to an image, e.g. ../../assets/tools/react.svg
    monogram: z.string().optional(), // fallback text when there is no logo, e.g. "AS"
    color: z.string().optional(), // brand accent (glow + fallback tile)
    required: z.boolean().default(true), // false → shown as "Optional"
    alternatives: z.array(z.object({ name: z.string(), verdict: z.string() })).default([]),
    platforms: z.array(z.enum(['Windows', 'macOS', 'Linux'])).default(['Windows', 'macOS', 'Linux']),
    whyWeUseIt: z.string().optional(),
    docs: z.string().optional(),
    extensions: z.array(z.object({ name: z.string(), detail: z.string() })).default([]),
    troubleshooting: z.array(problem).default([]),
    relatedLabs: z.array(z.string()).default([]),
    resources: z.array(link).default([]),
  });

export const setupSchema = z.object({
  step: z.number(),
  title: z.string(),
  summary: z.string(),
  estimatedTime: z.string().optional(),
  tool: z.string().optional(), // id of a tool page
  requirements: z.array(z.string()).default([]),
  verify: z.array(z.object({ command: z.string(), expect: z.string() })).default([]),
  troubleshooting: z.array(problem).default([]),
});

export const commandSchema = z.object({
  command: z.string(),
  title: z.string(),
  description: z.string(),
  category: z.string(),
  examples: z.array(z.object({ code: z.string(), note: z.string().optional() })).default([]),
  notes: z.string().optional(),
  commonMistakes: z.array(z.string()).default([]),
  related: z.array(z.string()).default([]),
  platform: z.string().optional(),
});

export const roadmapSchema = z.object({
  order: z.number(),
  title: z.string(),
  summary: z.string(),
  topics: z.array(z.string()).default([]),
  links: z.array(link).default([]),
});

export const troubleshootingSchema = problem.extend({ category: z.string() });

export const resourceSchema = z.object({
  title: z.string(),
  href: z.string(),
  category: z.enum(['Official Docs', 'Tutorials', 'Videos', 'Articles', 'Tools', 'References', 'Cheat Sheets']),
  description: z.string().optional(),
  source: z.string().optional(),
});

export const extraSchema = z.object({
  title: z.string(),
  category: z.string(),
  summary: z.string(),
  points: z.array(z.string()).default([]),
  links: z.array(link).default([]),
});

export const checklistSchema = z.object({ label: z.string(), hint: z.string().optional(), guide: z.string().optional() });

/** src/content/data/site.yaml — course info, teaching team and assessment split (read by src/site.config.ts). */
export const siteSchema = z.object({
  course: z.object({
    name: z.string().min(1),
    short: z.string().min(1),
    code: z.string(),
    term: z.string(),
    university: z.string(),
    instructor: z.string(),
    contact: z.string(),
    tagline: z.string(),
    overview: z.object({
      what: z.string(),
      learn: z.array(z.string()),
      build: z.string(),
      tools: z.string(),
      outcome: z.string(),
    }),
  }),
  team: z.array(z.object({ role: z.string().min(1), name: z.string().min(1), email: z.string().email() })).min(1),
  assessment: z
    .array(z.object({ label: z.string().min(1), weight: z.number().min(0).max(100), sub: z.string() }))
    .min(1)
    .refine((rows) => rows.reduce((a, r) => a + r.weight, 0) === 100, { message: 'The weights must add up to 100.' }),
});
