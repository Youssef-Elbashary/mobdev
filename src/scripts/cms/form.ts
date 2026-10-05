import type { Field } from '@/lib/cms/fields';

export type FormErrors = Record<string, string>;

const clone = <T>(value: T): T => structuredClone(value);

function inputFor(field: Exclude<Field, { type: 'group' | 'rows' | 'list' }>, value: unknown) {
  if (field.type === 'textarea') {
    const el = document.createElement('textarea');
    el.rows = 4;
    el.value = String(value ?? '');
    return el;
  }
  if (field.type === 'enum') {
    const el = document.createElement('select');
    for (const option of field.options) {
      const node = document.createElement('option');
      node.value = node.textContent = option;
      node.selected = option === value;
      el.append(node);
    }
    return el;
  }
  const el = document.createElement('input');
  el.type = field.type === 'number' ? 'number' : field.type;
  el.value = String(value ?? '');
  return el;
}

export function renderForm(
  fields: Field[],
  source: Record<string, unknown>,
  onChange: (value: Record<string, unknown>) => void,
  options: { errors?: FormErrors; newEntry?: boolean } = {},
) {
  const state = clone(source);
  const form = document.createElement('div');
  form.className = 'cms-form';

  const emit = () => onChange(clone(state));
  const setAt = (path: (string | number)[], value: unknown) => {
    let node: any = state;
    path.slice(0, -1).forEach((part) => (node = node[part]));
    node[path.at(-1)!] = value;
    emit();
  };

  const draw = (into: HTMLElement, specs: Field[], value: any, path: (string | number)[]) => {
    for (const field of specs) {
      const fieldPath = [...path, field.key];
      const error = options.errors?.[fieldPath.join('.')];

      if (field.type === 'group') {
        value[field.key] ??= {};
        const section = document.createElement('fieldset');
        section.className = 'cms-group';
        const legend = document.createElement('legend');
        legend.textContent = field.label;
        section.append(legend);
        draw(section, field.fields, value[field.key], fieldPath);
        into.append(section);
        continue;
      }

      if (field.type === 'rows') {
        value[field.key] ??= [];
        const section = document.createElement('fieldset');
        section.className = 'cms-group cms-rows';
        const legend = document.createElement('legend');
        legend.textContent = field.label;
        section.append(legend);
        if (field.help) section.append(help(field.help));
        const list = document.createElement('div');
        list.className = 'cms-row-list';
        const redraw = () => {
          list.replaceChildren();
          (value[field.key] as Record<string, unknown>[]).forEach((row, index, rows) => {
            const card = document.createElement('div');
            card.className = 'cms-row';
            const head = document.createElement('div');
            head.className = 'cms-row-head';
            const title = document.createElement('b');
            title.textContent = `${field.itemLabel} ${index + 1}`;
            const controls = document.createElement('div');
            for (const [label, delta] of [['\u2191', -1], ['\u2193', 1]] as const) {
              const button = smallButton(label, `${delta < 0 ? 'Move up' : 'Move down'} ${field.itemLabel}`);
              button.disabled = delta < 0 ? index === 0 : index === rows.length - 1;
              button.onclick = () => {
                [rows[index], rows[index + delta]] = [rows[index + delta], rows[index]];
                redraw(); emit();
              };
              controls.append(button);
            }
            const remove = smallButton('\u00d7', `Remove ${field.itemLabel}`);
            remove.classList.add('danger');
            remove.onclick = () => { rows.splice(index, 1); redraw(); emit(); };
            controls.append(remove);
            head.append(title, controls);
            card.append(head);
            draw(card, field.fields, row, [...fieldPath, index]);
            list.append(card);
          });
        };
        redraw();
        const add = smallButton(`+ Add ${field.itemLabel}`, `Add ${field.itemLabel}`);
        add.classList.add('cms-add');
        add.onclick = () => {
          const row: Record<string, unknown> = {};
          field.fields.forEach((f) => (row[f.key] = f.type === 'number' ? 0 : f.type === 'list' || f.type === 'rows' ? [] : f.type === 'group' ? {} : ''));
          (value[field.key] as Record<string, unknown>[]).push(row);
          redraw(); emit();
        };
        section.append(list, add);
        into.append(section);
        continue;
      }

      if (field.type === 'list') {
        value[field.key] ??= [];
        const wrap = fieldWrap(field.label, field.help, error);
        const list = document.createElement('div');
        list.className = 'cms-chip-list';
        const redraw = () => {
          list.replaceChildren();
          (value[field.key] as string[]).forEach((item, index, items) => {
            const row = document.createElement('div');
            row.className = 'cms-chip-row';
            const input = document.createElement('input');
            input.className = 'input';
            input.value = item;
            input.placeholder = field.placeholder ?? 'Item';
            input.oninput = () => { items[index] = input.value; emit(); };
            const remove = smallButton('\u00d7', 'Remove item');
            remove.onclick = () => { items.splice(index, 1); redraw(); emit(); };
            row.append(input, remove);
            list.append(row);
          });
        };
        redraw();
        const add = smallButton('+ Add item', 'Add item');
        add.classList.add('cms-add');
        add.onclick = () => { (value[field.key] as string[]).push(''); redraw(); emit(); };
        wrap.append(list, add);
        into.append(wrap);
        continue;
      }

      const wrap = fieldWrap(field.label, field.help, error);
      const input = inputFor(field, value[field.key]);
      input.className = 'input';
      if (field.required) input.required = true;
      if (field.idField && !options.newEntry) input.disabled = true;
      input.addEventListener('input', () => setAt(fieldPath, field.type === 'number' ? Number(input.value) : input.value));
      wrap.insertBefore(input, wrap.querySelector('.cms-help, .cms-error'));
      into.append(wrap);
    }
  };

  draw(form, fields, state, []);
  return form;
}

function fieldWrap(label: string, description?: string, error?: string) {
  const wrap = document.createElement('label');
  wrap.className = 'cms-field';
  const title = document.createElement('span');
  title.className = 'cms-field-label';
  title.textContent = label;
  wrap.append(title);
  if (description) wrap.append(help(description));
  if (error) {
    const message = document.createElement('span');
    message.className = 'cms-error';
    message.textContent = error;
    wrap.append(message);
  }
  return wrap;
}

function help(text: string) {
  const el = document.createElement('span');
  el.className = 'cms-help';
  el.textContent = text;
  return el;
}

function smallButton(text: string, label: string) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'cms-mini';
  button.textContent = text;
  button.setAttribute('aria-label', label);
  return button;
}
