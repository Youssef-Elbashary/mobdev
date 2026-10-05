/** Form descriptions for the CMS editors. Keys mirror src/content/schemas.ts (a unit test keeps them in sync). */
export type Field =
  | { key: string; label: string; type: 'text' | 'textarea' | 'number' | 'email' | 'url'; required?: boolean; help?: string; idField?: boolean }
  | { key: string; label: string; type: 'enum'; options: string[]; required?: boolean; help?: string }
  | { key: string; label: string; type: 'list'; help?: string; placeholder?: string }
  | { key: string; label: string; type: 'rows'; fields: Field[]; itemLabel: string; help?: string }
  | { key: string; label: string; type: 'group'; fields: Field[] };

const id: Field = { key: 'id', label: 'ID', type: 'text', required: true, idField: true, help: 'Letters, numbers and hyphens. Cannot be changed later.' };
const links: Field = { key: 'links', label: 'Links', type: 'rows', itemLabel: 'link', fields: [{ key: 'label', label: 'Label', type: 'text', required: true }, { key: 'href', label: 'URL', type: 'text', required: true }] };

export const LIST_FIELDS = {
  commands: [
    id,
    { key: 'command', label: 'Command', type: 'text', required: true, help: 'Placeholders in <angle brackets> are highlighted.' },
    { key: 'title', label: 'Title', type: 'text', required: true },
    { key: 'description', label: 'Description', type: 'textarea', required: true },
    { key: 'category', label: 'Category', type: 'text', required: true },
    { key: 'examples', label: 'Examples', type: 'rows', itemLabel: 'example', fields: [{ key: 'code', label: 'Code', type: 'text', required: true }, { key: 'note', label: 'Note', type: 'text' }] },
    { key: 'notes', label: 'Notes', type: 'textarea' },
    { key: 'commonMistakes', label: 'Common mistakes', type: 'list' },
    { key: 'related', label: 'Related command ids', type: 'list' },
    { key: 'platform', label: 'Platform', type: 'text', help: 'e.g. Windows, macOS / Linux' },
  ],
  troubleshooting: [
    id,
    { key: 'category', label: 'Category', type: 'text', required: true },
    { key: 'problem', label: 'Problem', type: 'text', required: true },
    { key: 'cause', label: 'Cause', type: 'textarea' },
    { key: 'solution', label: 'Solution', type: 'textarea', required: true },
    { key: 'commands', label: 'Commands', type: 'list' },
    { key: 'notes', label: 'Notes', type: 'textarea' },
  ],
  resources: [
    id,
    { key: 'title', label: 'Title', type: 'text', required: true },
    { key: 'href', label: 'URL', type: 'url', required: true },
    { key: 'category', label: 'Category', type: 'enum', required: true, options: ['Official Docs', 'Tutorials', 'Videos', 'Articles', 'Tools', 'References', 'Cheat Sheets'] },
    { key: 'description', label: 'Description', type: 'textarea' },
    { key: 'source', label: 'Source', type: 'text' },
  ],
  extra: [
    id,
    { key: 'title', label: 'Title', type: 'text', required: true },
    { key: 'category', label: 'Category', type: 'text', required: true },
    { key: 'summary', label: 'Summary', type: 'textarea', required: true },
    { key: 'points', label: 'Points', type: 'list' },
    links,
  ],
  roadmap: [
    id,
    { key: 'order', label: 'Order', type: 'number', required: true },
    { key: 'title', label: 'Title', type: 'text', required: true },
    { key: 'summary', label: 'Summary', type: 'textarea', required: true },
    { key: 'topics', label: 'Topics', type: 'list' },
    links,
  ],
  checklist: [
    id,
    { key: 'label', label: 'Label', type: 'text', required: true },
    { key: 'hint', label: 'Hint', type: 'text' },
    { key: 'guide', label: 'Setup guide id', type: 'text', help: 'e.g. 02-node' },
  ],
} satisfies Record<string, Field[]>;

export type ListName = keyof typeof LIST_FIELDS;

export const SITE_FIELDS: Field[] = [
  {
    key: 'course',
    label: 'Course',
    type: 'group',
    fields: [
      { key: 'name', label: 'Course name', type: 'text', required: true },
      { key: 'short', label: 'Short name', type: 'text', required: true },
      { key: 'code', label: 'Module code', type: 'text', required: true },
      { key: 'term', label: 'Term', type: 'text', required: true },
      { key: 'university', label: 'University', type: 'text', required: true },
      { key: 'instructor', label: 'Instructor', type: 'text', required: true },
      { key: 'contact', label: 'Contact email', type: 'email', required: true },
      { key: 'tagline', label: 'Tagline (home page)', type: 'textarea', required: true },
      {
        key: 'overview',
        label: 'Course overview',
        type: 'group',
        fields: [
          { key: 'what', label: 'What the course is', type: 'textarea', required: true },
          { key: 'learn', label: 'What you will learn', type: 'list' },
          { key: 'build', label: 'What you will build', type: 'textarea', required: true },
          { key: 'tools', label: 'Tools', type: 'textarea', required: true },
          { key: 'outcome', label: 'Outcome', type: 'textarea', required: true },
        ],
      },
    ],
  },
  {
    key: 'team',
    label: 'Teaching team',
    type: 'rows',
    itemLabel: 'team member',
    fields: [
      { key: 'role', label: 'Role', type: 'text', required: true },
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'email', label: 'Email', type: 'email', required: true },
    ],
  },
  {
    key: 'assessment',
    label: 'Assessment split',
    type: 'rows',
    itemLabel: 'part',
    help: 'The weights must add up to 100.',
    fields: [
      { key: 'label', label: 'Label', type: 'text', required: true },
      { key: 'weight', label: 'Weight %', type: 'number', required: true },
      { key: 'sub', label: 'Detail', type: 'text' },
    ],
  },
];
