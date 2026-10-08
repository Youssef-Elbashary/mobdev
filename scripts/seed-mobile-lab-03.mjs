import { neon } from '@neondatabase/serverless';
import { compileLab, compileModule, sanitizeFlow } from '../src/lib/platform/core.ts';
import { mobileDevelopmentLab03 } from '../src/lib/platform/seeds/mobile-development-lab-03.ts';

const confirm = process.argv.includes('--confirm-production');
const url = process.env.DATABASE_URL_PRODUCTION || process.env.DATABASE_URL;
if (!url) throw new Error('Set DATABASE_URL_PRODUCTION or DATABASE_URL.');
const moduleSlug = 'mobile-development';
const labSlug = 'lab-03';
const labFlow = mobileDevelopmentLab03();
const compiledLab = compileLab(labFlow, `${moduleSlug}--${labSlug}`);
if (compiledLab.warnings.length) throw new Error(compiledLab.warnings.join('\n'));

const sql = neon(url);
const [module] = await sql.query('select slug, flow from platform_modules where slug = $1', [moduleSlug]);
if (!module) throw new Error('The live Mobile Development canvas module does not exist.');
const moduleFlow = typeof module.flow === 'string' ? JSON.parse(module.flow) : module.flow;

if (!moduleFlow.nodes.some((node) => node.type === 'lab' && node.data?.slug === labSlug)) {
  const unique = (base) => {
    let id = base;
    for (let n = 2; moduleFlow.nodes.some((node) => node.id === id); n++) id = `${base}-${n}`;
    return id;
  };
  const byId = new Map(moduleFlow.nodes.map((node) => [node.id, node]));
  const next = new Map(moduleFlow.edges.map((edge) => [edge.from, edge.to]));
  const ordered = [];
  for (let node = moduleFlow.nodes.find((item) => item.type === 'module'); node && !ordered.includes(node); node = byId.get(next.get(node.id))) ordered.push(node);
  const tail = ordered.at(-1);
  if (!tail) throw new Error('The module canvas has no root.');
  const weekId = unique('week-03');
  const labId = unique('lab-03');
  moduleFlow.nodes.push({ id: weekId, type: 'divider', x: tail.x, y: tail.y + 160, data: { title: 'Week 3' } }, { id: labId, type: 'lab', x: tail.x, y: tail.y + 320, data: { slug: labSlug } });
  moduleFlow.edges.push({ from: tail.id, to: weekId }, { from: weekId, to: labId });
}

const cleanModule = sanitizeFlow(moduleFlow, 'module');
if (!cleanModule.ok) throw new Error(cleanModule.error);
if (!compileModule(cleanModule.value).items.some((item) => item.kind === 'lab' && item.slug === labSlug)) throw new Error('Lab 03 is not connected to the module canvas.');
const summary = { module: moduleSlug, lab: labSlug, title: compiledLab.meta.title, parts: compiledLab.blocks.filter((b) => b.kind === 'part').length, tasks: compiledLab.blocks.filter((b) => b.kind === 'task').length, exercises: Object.keys(compiledLab.exercises).length, nodes: labFlow.nodes.length, published: true };

if (!confirm) {
  console.log(JSON.stringify({ dryRun: true, ...summary }, null, 2));
  console.log('Re-run with --confirm-production to update the live platform tables.');
  process.exit(0);
}

await sql.query(`insert into platform_labs (module, slug, title, published, flow) values ($1, $2, $3, true, $4::jsonb)
  on conflict (module, slug) do update set title = excluded.title, published = true, flow = excluded.flow, updated_at = now()`, [moduleSlug, labSlug, compiledLab.meta.title, JSON.stringify(labFlow)]);
await sql.query('update platform_modules set flow = $2::jsonb, published = true, updated_at = now() where slug = $1', [moduleSlug, JSON.stringify(cleanModule.value)]);
const [saved] = await sql.query('select title, published, jsonb_array_length(flow->\'nodes\')::int as nodes from platform_labs where module = $1 and slug = $2', [moduleSlug, labSlug]);
console.log(JSON.stringify({ seeded: true, ...summary, stored: saved }, null, 2));
