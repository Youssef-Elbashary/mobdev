/** The session-aware Start Lab card: name, student ID and group are required. */
import { clearStudent, deviceId, getStudent, ID_RE, NAME_RE, setStudent } from './store.ts';
import { clearProgressIdentity, getIdentity, setProgressIdentity } from '@/scripts/progress';

type PublicSession = { id: string; open: boolean; ta_name?: string; time_slot?: string };
type PublicSessionResponse = PublicSession & { sessions?: PublicSession[] };

export function mountStart(lab: string) {
  const root = document.querySelector<HTMLElement>('[data-lab-start]');
  if (!root || root.dataset.wired) return;
  root.dataset.wired = '1';
  const form = root.querySelector<HTMLFormElement>('form')!;
  const formBox = root.querySelector<HTMLElement>('[data-ls-form]')!;
  const signed = root.querySelector<HTMLElement>('[data-ls-signed]')!;
  const status = root.querySelector<HTMLElement>('[data-ls-status]')!;
  const err = root.querySelector<HTMLElement>('[data-ls-error]')!;
  const nameIn = form.querySelector<HTMLInputElement>('[name="name"]')!;
  const idIn = form.querySelector<HTMLInputElement>('[name="studentId"]')!;
  const groupIn = form.querySelector<HTMLInputElement>('[name="group"]')!;
  const sessionField = form.querySelector<HTMLElement>('[data-ls-session]')!;
  const sessionIn = form.querySelector<HTMLSelectElement>('[name="sessionId"]')!;
  const submit = form.querySelector<HTMLButtonElement>('[type="submit"]')!;
  let session: PublicSession | null = null;
  let sessions: PublicSession[] = [];
  const labRoot = root.closest<HTMLElement>('[data-lab]');

  if (labRoot && !labRoot.dataset.sessionGuard) {
    labRoot.dataset.sessionGuard = '1';
    const guard = (event: Event) => {
      if (labRoot.dataset.sessionAccess === 'active') return;
      const target = event.target as HTMLElement | null;
      if (!target || target.closest('[data-lab-start]') || target.closest('a')) return;
      if (target.closest('button,input,textarea,select,[contenteditable="true"],.cm-editor,[data-exercise],[data-playground],[data-repo-submit],[data-checkin]')) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    for (const event of ['click', 'beforeinput', 'keydown', 'change', 'submit']) labRoot.addEventListener(event, guard, true);
  }

  const show = () => {
    const student = getStudent();
    const current = Boolean(student && session?.open && student.sessionId === session.id);
    form.hidden = sessions.length === 0;
    if (labRoot) labRoot.dataset.sessionAccess = current ? 'active' : 'readonly';
    formBox.hidden = current;
    signed.hidden = !current;
    root.classList.toggle('is-signed', current);
    submit.disabled = !session?.open;
    if (current && student) {
      signed.querySelector('[data-ls-name]')!.textContent = student.name;
      signed.querySelector('[data-ls-id]')!.textContent = student.id;
      signed.querySelector('[data-ls-group]')!.textContent = student.group;
      const progress = getIdentity();
      const sharedDeviceId = deviceId();
      if (!progress || progress.sessionId !== student.sessionId || progress.deviceKey !== sharedDeviceId) {
        setProgressIdentity(student.name, student.id, student.group, student.sessionId, sharedDeviceId);
      }
    }
  };

  const refreshSession = async () => {
    try {
      const response = await fetch(`/api/progress/session?lab=${encodeURIComponent(lab)}`, { cache: 'no-store' });
      const data = (await response.json()) as PublicSessionResponse;
      sessions = Array.isArray(data.sessions) ? data.sessions.filter((item) => item.open) : data.open ? [data] : [];
      const student = getStudent();
      const previousId = sessionIn.value;
      sessionIn.replaceChildren(...sessions.map((item) => new Option(`${item.time_slot ?? 'Current time slot'} — ${item.ta_name ?? 'TA'}`, item.id)));
      const preferredId = student && sessions.some((item) => item.id === student.sessionId)
        ? student.sessionId
        : sessions.some((item) => item.id === previousId) ? previousId : sessions[0]?.id ?? '';
      sessionIn.value = preferredId;
      session = sessions.find((item) => item.id === preferredId) ?? null;
      sessionField.hidden = sessions.length < 2;
      status.textContent = sessions.length > 1
        ? `${sessions.length} sessions are running. Choose your time slot and TA, then enter your details.`
        : session
          ? `Session started by ${session.ta_name ?? 'your TA'} · ${session.time_slot ?? 'current time slot'}. Enter your details to begin.`
        : 'Waiting for your TA to start this lab session. You can read the content in the meantime.';
    } catch {
      session = null;
      sessions = [];
      status.textContent = 'Could not check the session status. You can still read the lab content.';
    }
    show();
  };

  sessionIn.addEventListener('change', () => {
    session = sessions.find((item) => item.id === sessionIn.value) ?? null;
    err.textContent = '';
    show();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = nameIn.value.replace(/\s+/g, ' ').trim();
    const id = idIn.value.trim();
    const group = groupIn.value.replace(/\s+/g, ' ').trim();
    if (name.length < 2 || name.length > 60 || !NAME_RE.test(name)) {
      err.textContent = 'Please type your full name (letters only).';
      return nameIn.focus();
    }
    if (!ID_RE.test(id)) {
      err.textContent = 'Your student ID should be 3–20 letters or numbers.';
      return idIn.focus();
    }
    if (!group || group.length > 30) {
      err.textContent = 'Enter your group (for example, G1).';
      return groupIn.focus();
    }
    if (!session?.open) {
      err.textContent = 'Your TA has not started this session yet. You can read the lab content for now.';
      return;
    }
    err.textContent = 'Verifying this student and device…';
    submit.disabled = true;
    try {
      const sharedDeviceId = deviceId();
      const response = await fetch('/api/lab/progress', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ lab, name, studentId: id, deviceId: sharedDeviceId, group, sessionId: session.id, event: 'start' }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        err.textContent = data.message ?? data.error ?? 'Could not verify your identity. Ask your TA.';
        return;
      }
      err.textContent = '';
      // Identity is persisted only after verification: setStudent({ name, id })
      setStudent({ name, id, group, sessionId: session.id });
      setProgressIdentity(name, id, group, session.id, sharedDeviceId);
      show();
    } catch {
      err.textContent = 'The server could not verify your identity. Check the connection and try again.';
    } finally {
      submit.disabled = !session?.open;
    }
  });

  signed.querySelector('[data-ls-change]')?.addEventListener('click', () => {
    const student = getStudent();
    clearStudent();
    clearProgressIdentity();
    if (student) {
      nameIn.value = student.name;
      idIn.value = student.id;
      groupIn.value = student.group;
    }
    show();
    nameIn.focus();
  });

  void refreshSession();
  const timer = window.setInterval(() => {
    if (!root.isConnected) return clearInterval(timer);
    if (document.visibilityState === 'visible') void refreshSession();
  }, 15_000);
}
