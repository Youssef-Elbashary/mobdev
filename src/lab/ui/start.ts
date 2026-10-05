/** The "Start Lab" card: every student types name + student ID once; it's sent with their progress. */
import { clearStudent, getStudent, ID_RE, NAME_RE, setStudent } from './store.ts';
import { track } from './tracker.ts';
import { clearProgressIdentity, getIdentity, setProgressIdentity } from '@/scripts/progress';

export function mountStart(lab: string) {
  const root = document.querySelector<HTMLElement>('[data-lab-start]');
  if (!root || root.dataset.wired) return;
  root.dataset.wired = '1';
  const form = root.querySelector<HTMLFormElement>('form')!;
  const formBox = root.querySelector<HTMLElement>('[data-ls-form]')!;
  const signed = root.querySelector<HTMLElement>('[data-ls-signed]')!;
  const err = root.querySelector<HTMLElement>('[data-ls-error]')!;
  const nameIn = form.querySelector<HTMLInputElement>('[name="name"]')!;
  const idIn = form.querySelector<HTMLInputElement>('[name="studentId"]')!;

  const show = () => {
    const progress = getIdentity();
    if (!getStudent() && progress) setStudent({ name: progress.name, id: progress.studentId });
    const s = getStudent();
    if (s && !progress) setProgressIdentity(s.name, s.id);
    formBox.hidden = !!s;
    signed.hidden = !s;
    root.classList.toggle('is-signed', !!s);
    if (s) {
      signed.querySelector('[data-ls-name]')!.textContent = s.name;
      signed.querySelector('[data-ls-id]')!.textContent = s.id;
    }
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = nameIn.value.replace(/\s+/g, ' ').trim();
    const id = idIn.value.trim();
    if (name.length < 2 || name.length > 60 || !NAME_RE.test(name)) {
      err.textContent = 'Please type your full name (letters only).';
      nameIn.focus();
      return;
    }
    if (!ID_RE.test(id)) {
      err.textContent = 'Your student ID should be 3–20 letters or numbers.';
      idIn.focus();
      return;
    }
    err.textContent = '';
    setStudent({ name, id });
    setProgressIdentity(name, id);
    track({ lab, event: 'start' });
    show();
  });

  signed.querySelector('[data-ls-change]')?.addEventListener('click', () => {
    const s = getStudent();
    clearStudent();
    clearProgressIdentity();
    if (s) {
      nameIn.value = s.name;
      idIn.value = s.id;
    }
    show();
    nameIn.focus();
  });

  show();
}
