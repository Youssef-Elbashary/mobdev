/**
 * GET /api/admin/stream — live check-ins for /admin (Server-Sent Events).
 * Vercel can't host WebSockets, so the server keeps one HTTP response open and pushes
 * each new check-in within ~1 s. Each connection lives ~50 s, then the browser
 * reconnects by itself and resumes from the last entry it saw (Last-Event-ID).
 */
import type { APIRoute } from 'astro';
import { getStore, isAdmin } from '@/lib/attendance/server';

export const prerender = false;

const LIFETIME_MS = 50_000;
const TICK_MS = 1_000;
const PING_MS = 15_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const GET: APIRoute = async ({ request, cookies, url }) => {
  if (!isAdmin(cookies)) return new Response('Unauthorized', { status: 401 });
  const store = getStore();
  if (!store) return new Response('Attendance database not connected', { status: 503 });

  let last = Math.max(0, Number(request.headers.get('last-event-id') ?? url.searchParams.get('from') ?? 0) || 0);
  const enc = new TextEncoder();

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      request.signal.addEventListener('abort', () => (open = false));
      const send = (chunk: string) => {
        if (open) controller.enqueue(enc.encode(chunk));
      };
      const started = Date.now();
      let lastPing = started;

      send('retry: 1500\n\n');
      try {
        while (open && Date.now() - started < LIFETIME_MS) {
          // entry numbers only grow (a database may skip numbers), so ask for anything after the last one sent
          const fresh = await store.list(last);
          for (const entry of fresh) {
            send(`id: ${entry.n}\nevent: entry\ndata: ${JSON.stringify(entry)}\n\n`);
            last = Math.max(last, entry.n);
          }
          if (!fresh.length && Date.now() - lastPing >= PING_MS) {
            send(': ping\n\n');
            lastPing = Date.now();
          }
          await sleep(TICK_MS);
        }
      } catch (err) {
        console.error('[attendance] stream error', err);
      } finally {
        open = false;
        try {
          controller.close();
        } catch {}
      }
    },
  });

  return new Response(body, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    },
  });
};
