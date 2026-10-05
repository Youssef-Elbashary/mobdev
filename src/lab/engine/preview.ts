/**
 * The live preview on the lab page: a sandboxed iframe (no access to the site, its cookies or storage)
 * that runs the student's compiled files. Implements PreviewDriver so checks can press/type/read it.
 */
import type { Found, Frame, FromRuntime, LabErrorInfo, LogLevel, PreviewDriver, Query, ToRuntime } from '../runtime/protocol.ts';

type Handlers = {
  onLog?: (level: LogLevel, text: string) => void;
  /** errors that happen after rendering (e.g. inside an onPress handler) */
  onError?: (error: LabErrorInfo) => void;
};

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> };

const RUN_TIMEOUT = 6000;
const RPC_TIMEOUT = 5000;

/**
 * The runtime is fetched once by the page (same origin) and written into each iframe.
 * A sandboxed iframe has an opaque origin, so asking it to load the script itself is a
 * cross-site request — some servers (e.g. Vite's dev server) refuse those.
 */
let runtimeCode: Promise<string> | null = null;
function loadRuntime(): Promise<string> {
  const version = typeof __LAB_RUNTIME_VERSION__ === 'string' ? __LAB_RUNTIME_VERSION__ : 'dev';
  runtimeCode ??= fetch(`/lab-runtime/runtime.js?v=${version}`)
    .then((r) => {
      if (!r.ok) throw new Error(`runtime ${r.status}`);
      return r.text();
    })
    .then((code) => code.replace(/<\/script/gi, '<\\/script'))
    .catch((error) => {
      runtimeCode = null; // try again next time
      throw error;
    });
  return runtimeCode;
}

export class LabPreview implements PreviewDriver {
  iframe!: HTMLIFrameElement;
  private ready!: Promise<void>;
  private markReady!: () => void;
  private seq = 0;
  private runs = new Map<number, (r: { ok: boolean; error?: LabErrorInfo }) => void>();
  private rpcs = new Map<number, Pending>();
  private last: { files: Record<string, string>; entry: string } | null = null;

  constructor(
    private host: HTMLElement,
    private frame: Frame,
    private handlers: Handlers = {},
  ) {
    window.addEventListener('message', this.onMessage);
    this.create();
  }

  private create() {
    this.ready = new Promise((resolve) => (this.markReady = resolve));
    const iframe = document.createElement('iframe');
    iframe.className = 'lab-frame';
    iframe.title = this.frame === 'phone' ? 'Phone preview' : 'Browser preview';
    iframe.setAttribute('sandbox', 'allow-scripts');
    this.iframe?.remove();
    this.iframe = iframe;
    this.host.appendChild(iframe);
    loadRuntime().then(
      (code) => {
        if (this.iframe !== iframe) return; // replaced meanwhile
        iframe.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body data-frame="${this.frame}"><div id="root"></div><script>${code}</script></body></html>`;
      },
      (error) => {
        console.error('[lab] could not load the preview runtime', error);
        this.handlers.onError?.({ message: 'The preview could not load.', hint: 'Check your internet connection, then refresh the page.' });
      },
    );
  }

  private onMessage = (event: MessageEvent) => {
    if (!this.iframe || event.source !== this.iframe.contentWindow) return;
    const msg = event.data as FromRuntime;
    if (!msg || msg.__lab !== 1) return;
    switch (msg.type) {
      case 'ready':
        this.markReady();
        break;
      case 'rendered':
        this.runs.get(msg.id)?.({ ok: true });
        this.runs.delete(msg.id);
        break;
      case 'error':
        if (msg.id !== undefined && this.runs.has(msg.id)) {
          this.runs.get(msg.id)!({ ok: false, error: msg.error });
          this.runs.delete(msg.id);
        } else this.handlers.onError?.(msg.error);
        break;
      case 'log':
        this.handlers.onLog?.(msg.level, msg.text);
        break;
      case 'rpc-result': {
        const p = this.rpcs.get(msg.id);
        if (!p) break;
        clearTimeout(p.timer);
        this.rpcs.delete(msg.id);
        if (msg.ok) p.resolve(msg.value);
        else p.reject(new Error(msg.error));
        break;
      }
    }
  };

  private send(message: Omit<ToRuntime, '__lab'>) {
    this.iframe.contentWindow?.postMessage({ __lab: 1, ...message }, '*');
  }

  /** Runs compiled files. Resolves when the app rendered (or failed). Recovers from endless loops. */
  async run(files: Record<string, string>, entry: string, frame: Frame = this.frame): Promise<{ ok: boolean; error?: LabErrorInfo }> {
    this.last = { files, entry };
    await this.ready;
    const id = ++this.seq;
    const result = new Promise<{ ok: boolean; error?: LabErrorInfo }>((resolve) => {
      this.runs.set(id, resolve);
      setTimeout(() => {
        if (!this.runs.has(id)) return;
        this.runs.delete(id);
        this.create(); // the old page is stuck — start a fresh one
        resolve({ ok: false, error: { message: 'Your app took too long to start.', hint: 'Is there an endless loop, or state being set during render?' } });
      }, RUN_TIMEOUT);
    });
    this.send({ type: 'run', id, files, entry, frame });
    return result;
  }

  private rpc<T>(method: string, ...args: unknown[]): Promise<T> {
    const id = ++this.seq;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.rpcs.delete(id);
        reject(new Error(`The preview didn’t answer (${method}).`));
      }, RPC_TIMEOUT);
      this.rpcs.set(id, { resolve: resolve as (v: unknown) => void, reject, timer });
      this.send({ type: 'rpc', id, method, args });
    });
  }

  text() {
    return this.rpc<string>('text');
  }
  find(q: Query = {}) {
    return this.rpc<Found[]>('find', q);
  }
  count(q: Query = {}) {
    return this.rpc<number>('count', q);
  }
  press(q: Query = {}) {
    return this.rpc<boolean>('press', q);
  }
  type(q: Query, value: string) {
    return this.rpc<boolean>('type', q, value);
  }
  logs() {
    return this.rpc<string[]>('logs');
  }
  wait(ms: number) {
    return this.rpc<void>('wait', ms);
  }
  async rerun() {
    if (this.last) await this.run(this.last.files, this.last.entry);
  }

  destroy() {
    window.removeEventListener('message', this.onMessage);
    for (const p of this.rpcs.values()) clearTimeout(p.timer);
    this.rpcs.clear();
    this.runs.clear();
    this.iframe?.remove();
  }
}
