export type DiffLine = { type: ' ' | '+' | '-'; text: string };

export function reviewDialog(options: {
  diff: DiffLine[];
  path: string;
  message: string;
  onSave: () => Promise<void>;
}) {
  const dialog = document.createElement('dialog');
  dialog.className = 'cms-dialog';
  const panel = document.createElement('div');
  panel.className = 'cms-dialog-panel';
  const head = document.createElement('header');
  const title = document.createElement('div');
  title.innerHTML = '<p class="cms-k mono">Review changes</p><h2>Ready to save?</h2>';
  const close = document.createElement('button');
  close.type = 'button'; close.className = 'cms-dialog-x'; close.textContent = '\u00d7'; close.setAttribute('aria-label', 'Close review');
  close.onclick = () => dialog.close();
  head.append(title, close);

  const meta = document.createElement('div');
  meta.className = 'cms-review-meta';
  const path = document.createElement('code'); path.textContent = options.path;
  const message = document.createElement('span'); message.textContent = options.message;
  meta.append(path, message);

  const diff = document.createElement('pre');
  diff.className = 'cms-diff';
  for (const line of options.diff) {
    const row = document.createElement('span');
    row.className = line.type === '+' ? 'add' : line.type === '-' ? 'del' : 'same';
    row.textContent = `${line.type} ${line.text}`;
    diff.append(row);
  }
  const actions = document.createElement('footer');
  const back = document.createElement('button'); back.type = 'button'; back.className = 'btn btn-ghost'; back.textContent = 'Back'; back.onclick = () => dialog.close();
  const save = document.createElement('button'); save.type = 'button'; save.className = 'btn btn-primary'; save.textContent = 'Save draft';
  save.onclick = async () => {
    save.disabled = true; save.textContent = 'Saving\u2026';
    try { await options.onSave(); dialog.close(); dialog.remove(); }
    catch { save.disabled = false; save.textContent = 'Save draft'; }
  };
  actions.append(back, save);
  panel.append(head, meta, diff, actions);
  dialog.append(panel);
  dialog.addEventListener('close', () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();
  return dialog;
}
