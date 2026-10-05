/**
 * CONTENT SCHEMA
 * ---------------------------------------------------------------
 * Every piece of course content lives in src/content/ and is
 * validated against the schemas in src/content/schemas.ts (shared
 * with the admin CMS). Add a file → a page appears.
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
import {
  checklistSchema,
  commandSchema,
  courseworkSchema,
  extraSchema,
  labSchema,
  projectSchema,
  resourceSchema,
  roadmapSchema,
  setupSchema,
  toolSchema,
  troubleshootingSchema,
} from './content/schemas';

const labs = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/labs' }),
  schema: ({ image }) => labSchema(image),
});

const coursework = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/coursework' }),
  schema: courseworkSchema,
});

const project = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/project' }),
  schema: projectSchema,
});

const tools = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/tools' }),
  schema: ({ image }) => toolSchema(image),
});

const setup = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/setup' }),
  schema: setupSchema,
});

const commands = defineCollection({ loader: file('./src/content/data/commands.yaml'), schema: commandSchema });
const roadmap = defineCollection({ loader: file('./src/content/data/roadmap.yaml'), schema: roadmapSchema });
const troubleshooting = defineCollection({ loader: file('./src/content/data/troubleshooting.yaml'), schema: troubleshootingSchema });
const resources = defineCollection({ loader: file('./src/content/data/resources.yaml'), schema: resourceSchema });
const extra = defineCollection({ loader: file('./src/content/data/extra.yaml'), schema: extraSchema });
const checklist = defineCollection({ loader: file('./src/content/data/checklist.yaml'), schema: checklistSchema });

export const collections = { labs, coursework, project, tools, setup, commands, roadmap, troubleshooting, resources, extra, checklist };
