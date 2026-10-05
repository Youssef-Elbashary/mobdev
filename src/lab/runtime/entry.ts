/**
 * Bootstraps the preview inside the sandboxed iframe (bundled to public/lab-runtime/runtime.js).
 * The parent page sends { type: 'run' | 'rpc' } messages; we answer with ready / rendered / error / log / rpc-result.
 */
import { createRuntime } from './core.ts';
import type { FromRuntime, LogLevel, ToRuntime } from './protocol.ts';

const CSS = `
html,body{margin:0;height:100%;background:#fff;color:#11181c;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased}
#root{position:absolute;inset:0;display:flex;flex-direction:column;overflow:hidden}
body[data-frame="web"] #root{display:block;overflow:auto;padding:12px;box-sizing:border-box}
.lab-status,.lab-home{display:none}
body[data-frame="phone"] .lab-status{display:flex;position:fixed;z-index:50;top:0;left:0;right:0;height:44px;align-items:center;justify-content:space-between;padding:0 22px 0 26px;font:600 14px/1 system-ui,-apple-system,sans-serif;color:#11181c;pointer-events:none;box-sizing:border-box}
.lab-island{position:absolute;left:50%;top:9px;width:92px;height:26px;margin-left:-46px;border-radius:20px;background:#0b0d10}
.lab-icons{display:flex;gap:5px;align-items:center}
.lab-icons i{display:block;width:3px;border-radius:1px;background:#11181c}
.lab-battery{width:22px;height:11px;border:1.5px solid #11181c;border-radius:3px;box-sizing:border-box;position:relative}
.lab-battery::after{content:"";position:absolute;inset:1.5px;right:5px;background:#11181c;border-radius:1px}
body[data-frame="phone"] .lab-home{display:block;position:fixed;z-index:50;bottom:7px;left:50%;width:110px;height:5px;margin-left:-55px;border-radius:5px;background:#11181c;pointer-events:none}
.lab-redbox{position:absolute;inset:0;z-index:40;overflow:auto;padding:58px 18px 18px;background:#b91c1c;color:#fff;font:14px/1.45 system-ui,sans-serif;box-sizing:border-box}
body[data-frame="web"] .lab-redbox{padding-top:18px}
.lab-redbox b{display:block;font-size:20px;margin-bottom:8px}
.lab-redbox p{margin:0 0 10px;white-space:pre-wrap;word-break:break-word}
.lab-redbox .lab-redbox-hint{background:rgba(0,0,0,.22);border-radius:8px;padding:8px 10px}
.lab-redbox small{opacity:.85;font-family:ui-monospace,monospace}
.lab-alert{position:fixed;z-index:60;left:16px;right:16px;top:52px;padding:12px 14px;border-radius:14px;background:rgba(30,30,32,.92);color:#fff;font:14px/1.4 system-ui,sans-serif;white-space:pre-line;box-shadow:0 8px 24px rgba(0,0,0,.25)}
`;

const style = document.createElement('style');
style.textContent = CSS;
document.head.appendChild(style);

document.body.insertAdjacentHTML(
  'afterbegin',
  `<div class="lab-status" aria-hidden="true"><span>9:41</span><i class="lab-island"></i><span class="lab-icons"><i style="height:4px"></i><i style="height:6px"></i><i style="height:8px"></i><i style="height:10px"></i><span class="lab-battery"></span></span></div>
   <div class="lab-home" aria-hidden="true"></div>`,
);

let container = document.getElementById('root');
if (!container) {
  container = document.createElement('div');
  container.id = 'root';
  document.body.appendChild(container);
}

type Outgoing = FromRuntime extends infer M ? (M extends { __lab: 1 } ? Omit<M, '__lab'> : never) : never;
const post = (message: Outgoing) => window.parent.postMessage({ __lab: 1, ...message }, '*');

const runtime = createRuntime({
  container,
  post,
  onFrame: (frame) => {
    document.body.dataset.frame = frame;
  },
});

// Show console.log / warnings from student code (and from twrnc for unknown classes) in the console panel.
for (const level of ['log', 'info', 'warn', 'error'] as LogLevel[]) {
  const original = console[level].bind(console);
  console[level] = (...args: unknown[]) => {
    original(...args);
    runtime.log(level, args);
  };
}

window.addEventListener('error', (event) => runtime.report(event.error ?? event.message));
window.addEventListener('unhandledrejection', (event) => runtime.report(event.reason));

window.addEventListener('message', async (event) => {
  if (event.source !== window.parent) return;
  const message = event.data as ToRuntime;
  if (!message || message.__lab !== 1) return;
  if (message.type === 'run') {
    await runtime.run(message);
  } else if (message.type === 'rpc') {
    try {
      const value = await runtime.rpc(message.method, message.args);
      post({ type: 'rpc-result', id: message.id, ok: true, value });
    } catch (error) {
      post({ type: 'rpc-result', id: message.id, ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  }
});

post({ type: 'ready' });
