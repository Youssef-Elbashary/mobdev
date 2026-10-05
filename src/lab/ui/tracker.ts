/**
 * Sends progress events to the server (POST /api/lab/progress) for the instructor's /admin view.
 * If the network drops (campus Wi-Fi…), events wait in localStorage and are re-sent later.
 */
import { deviceId, getStudent, storage } from './store.ts';
import { record } from '@/scripts/progress';

export type LabEvent = {
  lab: string;
  event: 'start' | 'check' | 'hint';
  exercise?: string;
  result?: 'pass' | 'partial' | 'fail';
  score?: number;
};

type Queued = LabEvent & { name: string; studentId: string; deviceId: string; at: number };

const QUEUE = 'lab:queue';

function readQueue(): Queued[] {
  try {
    return JSON.parse(storage.get(QUEUE) ?? '[]');
  } catch {
    return [];
  }
}

function writeQueue(q: Queued[]) {
  storage.set(QUEUE, JSON.stringify(q.slice(-200)));
}

async function post(item: Queued): Promise<boolean> {
  try {
    const res = await fetch('/api/lab/progress', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(item),
      keepalive: true,
    });
    // 4xx means the event itself is bad (don't retry it forever); 5xx / network → retry later
    return res.ok || (res.status >= 400 && res.status < 500 && res.status !== 429);
  } catch {
    return false;
  }
}

let flushing = false;
export async function flushQueue() {
  if (flushing) return;
  flushing = true;
  try {
    let q = readQueue();
    while (q.length) {
      if (!(await post(q[0]))) break;
      q = readQueue().slice(1);
      writeQueue(q);
    }
  } finally {
    flushing = false;
  }
}

export function track(event: LabEvent) {
  const student = getStudent();
  if (!student) return; // not signed in: nothing to report yet
  const item: Queued = { ...event, name: student.name, studentId: student.id, deviceId: deviceId(), at: Date.now() };
  writeQueue([...readQueue(), item]);
  if (event.event === 'check' && event.exercise && event.result) {
    const total = 10;
    const passed = event.result === 'pass' ? total : Math.max(0, Math.min(total - 1, Math.round((event.score ?? 0) * total)));
    record.attempt({ lab: event.lab, exercise: event.exercise, passed, total, files: { 'result.txt': `Interactive check: ${event.result} (${passed}/${total})` } });
    if (event.result === 'pass') record.task({ lab: event.lab, task: event.exercise, done: true });
  }
  void flushQueue();
}

let started = false;
let activeLab = '';
let heartbeat: number | undefined;
export function startTracker(lab: string) {
  activeLab = lab;
  if (started) return;
  started = true;
  window.addEventListener('online', () => void flushQueue());
  setInterval(() => void flushQueue(), 30_000);
  const seen = () => {
    if (document.visibilityState === 'visible' && activeLab && getStudent()) track({ lab: activeLab, event: 'start' });
  };
  heartbeat = window.setInterval(seen, 45_000);
  document.addEventListener('visibilitychange', seen);
  window.addEventListener('lab:student', seen);
  seen();
  void flushQueue();
}
