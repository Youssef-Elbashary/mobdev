/**
 * CONTENT SCHEMA
 * ---------------------------------------------------------------
 * Every piece of course content lives in src/content/ and is
 * validated against the schemas below. Add a file → a page appears.
 *
 *   labs/         lab-XX.md          → /labs/lab-XX
 *   coursework/   cw-XX.md           → /coursework/cw-XX
 *   project/      course-project.md  → /project
 *   tools/        <tool>.md          → /tools/<tool>
 *   setup/        <guide>.md         → /setup/<guide>
 *   data/*.yaml   commands, roadmap, troubleshooting, resources,
 *                 extra learning, setup checklist
 * ---------------------------------------------------------------
 */
import { defineCollection } from 'astro:content';
import { glob, file } from 'astro/loaders';
import { z } from 'astro/zod';

const difficulty = z.enum(['Beginner', 'Intermediate', 'Advanced']);
const link = z.object({ label: z.string(), href: z.string() });
const problem = z.object({
  problem: z.string(),
  cause: z.string().optional(),
  solution: z.string(),
  commands: z.array(z.string()).optional(),
  notes: z.string().optional(),
});
const faq = z.object({ q: z.string(), a: z.string() });

const labs = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/labs' }),
  schema: ({ image }) =>
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
      /** interactive lab: in-browser exercises + progress tracking (see src/lab/) */
      interactive: z.boolean().default(false),
    }),
});

const coursework = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/coursework' }),
  schema: z.object({
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
  }),
});

const project = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/project' }),
  schema: z.object({
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
  }),
});

const tools = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/tools' }),
  schema: ({ image }) => z.object({
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
  }),
});

const setup = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/setup' }),
  schema: z.object({
    step: z.number(),
    title: z.string(),
    summary: z.string(),
    estimatedTime: z.string().optional(),
    tool: z.string().optional(), // id of a tool page
    requirements: z.array(z.string()).default([]),
    verify: z.array(z.object({ command: z.string(), expect: z.string() })).default([]),
    troubleshooting: z.array(problem).default([]),
  }),
});

const commands = defineCollection({
  loader: file('./src/content/data/commands.yaml'),
  schema: z.object({
    command: z.string(),
    title: z.string(),
    description: z.string(),
    category: z.string(),
    examples: z.array(z.object({ code: z.string(), note: z.string().optional() })).default([]),
    notes: z.string().optional(),
    commonMistakes: z.array(z.string()).default([]),
    related: z.array(z.string()).default([]),
    platform: z.string().optional(),
  }),
});

const roadmap = defineCollection({
  loader: file('./src/content/data/roadmap.yaml'),
  schema: z.object({
    order: z.number(),
    title: z.string(),
    summary: z.string(),
    topics: z.array(z.string()).default([]),
    links: z.array(link).default([]),
  }),
});

const troubleshooting = defineCollection({
  loader: file('./src/content/data/troubleshooting.yaml'),
  schema: problem.extend({ category: z.string() }),
});

const resources = defineCollection({
  loader: file('./src/content/data/resources.yaml'),
  schema: z.object({
    title: z.string(),
    href: z.string(),
    category: z.enum(['Official Docs', 'Tutorials', 'Videos', 'Articles', 'Tools', 'References', 'Cheat Sheets']),
    description: z.string().optional(),
    source: z.string().optional(),
  }),
});

const extra = defineCollection({
  loader: file('./src/content/data/extra.yaml'),
  schema: z.object({
    title: z.string(),
    category: z.string(),
    summary: z.string(),
    points: z.array(z.string()).default([]),
    links: z.array(link).default([]),
  }),
});

const checklist = defineCollection({
  loader: file('./src/content/data/checklist.yaml'),
  schema: z.object({ label: z.string(), hint: z.string().optional(), guide: z.string().optional() }),
});

export const collections = { labs, coursework, project, tools, setup, commands, roadmap, troubleshooting, resources, extra, checklist };
