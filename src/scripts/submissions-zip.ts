/**
 * Batch download of student hand-ins as one ZIP, built in the admin's browser (no server time, no size limit).
 * PDFs are fetched straight from Vercel Blob (public, CORS-enabled) a few at a time and streamed into
 * client-zip. Chrome/Edge write the ZIP straight to disk via the File System Access API; other browsers
 * build it in memory and download it.
 */
import { downloadZip } from 'client-zip';
import { entriesCsv, zipPath, type Entry } from '@/lib/project-files/core';

const PARALLEL = 4;

type Picker = (opts: object) => Promise<{ createWritable(): Promise<WritableStream> }>;

/**
 * Must be called straight from a click handler: the save dialog (Chrome/Edge) needs the user gesture.
 * Returns how many PDFs were included and how many could not be fetched.
 */
export async function downloadSubmissions(
  title: string,
  file: { due_at: string | null },
  entries: Entry[],
  onProgress: (done: number, total: number) => void,
): Promise<{ saved: boolean; included: number; failed: number }> {
  const zipName = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'submissions'}.zip`;
  const picker = (window as unknown as { showSaveFilePicker?: Picker }).showSaveFilePicker;
  let sink: WritableStream | null = null;
  if (picker) {
    try {
      const handle = await picker({ suggestedName: zipName, types: [{ description: 'ZIP archive', accept: { 'application/zip': ['.zip'] } }] });
      sink = await handle.createWritable();
    } catch (error) {
      if ((error as DOMException)?.name === 'AbortError') return { saved: false, included: 0, failed: 0 };
      sink = null; // picker unavailable here (e.g. cross-origin iframe) → in-memory fallback
    }
  }

  const used = new Set<string>();
  const items = entries.map((e) => ({ entry: e, path: zipPath(e, used) }));
  let done = 0;
  let failed = 0;
  const fetchOne = (url: string) => fetch(url, { cache: 'no-store' }).then((r) => (r.ok ? r : Promise.reject(new Error(String(r.status)))));

  async function* files() {
    yield { name: 'index.csv', input: '﻿' + entriesCsv(file, entries), lastModified: new Date() };
    const queue = items.map((item) => ({ item, response: null as Promise<Response> | null }));
    const start = (i: number) => {
      if (!queue[i] || queue[i].response) return;
      queue[i].response = fetchOne(queue[i].item.entry.url);
      queue[i].response!.catch(() => {}); // handled when its turn comes; avoids "unhandled rejection" noise
    };
    for (let i = 0; i < PARALLEL; i++) start(i);
    for (let i = 0; i < queue.length; i++) {
      start(i);
      start(i + PARALLEL);
      const { item } = queue[i];
      try {
        const response = await queue[i].response!;
        yield { name: item.path, input: response, lastModified: new Date(item.entry.updated_at) };
      } catch {
        failed++;
        yield { name: `${item.path.replace(/\.pdf$/, '')} - MISSING.txt`, input: `Could not download ${item.entry.url}\n`, lastModified: new Date() };
      }
      onProgress(++done, items.length);
    }
  }

  const zip = downloadZip(files());
  if (sink) {
    await zip.body!.pipeTo(sink);
  } else {
    const blob = await zip.blob();
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: zipName });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
  }
  return { saved: true, included: items.length - failed, failed };
}
