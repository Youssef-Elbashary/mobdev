/**
 * Messages between the lab page (parent) and the sandboxed preview iframe (runtime).
 * Every message carries `__lab: 1` so both sides can ignore unrelated postMessage traffic.
 */
export type Frame = 'phone' | 'web';

export type RunRequest = { type: 'run'; id: number; files: Record<string, string>; entry: string; frame: Frame };
export type RpcRequest = { type: 'rpc'; id: number; method: string; args: unknown[] };
export type ToRuntime = (RunRequest | RpcRequest) & { __lab: 1 };

export type LabErrorInfo = {
  message: string;
  hint?: string;
  file?: string;
  line?: number;
  column?: number;
};

export type LogLevel = 'log' | 'info' | 'warn' | 'error';

export type FromRuntime = (
  | { type: 'ready' }
  | { type: 'rendered'; id: number }
  | { type: 'error'; id?: number; error: LabErrorInfo }
  | { type: 'log'; level: LogLevel; text: string }
  | { type: 'rpc-result'; id: number; ok: boolean; value?: unknown; error?: string }
) & { __lab: 1 };

/** How checks address something on the preview screen. */
export type Query = {
  /** React Native component name, e.g. 'Text', 'Pressable', 'TextInput' */
  rn?: string;
  /** HTML tag for the web (React) part, e.g. 'button', 'h1', 'input' */
  tag?: string;
  /** text shown inside the element (case-insensitive substring) or a RegExp */
  text?: string | RegExp;
  testID?: string;
  placeholder?: string | RegExp;
  /** pick the n-th match (0-based) */
  index?: number;
};

/** A plain, serialisable description of an element on the preview screen. */
export type Found = {
  rn: string | null;
  tag: string;
  text: string;
  value?: string;
  placeholder?: string;
  testID?: string;
  /** the resolved React Native style (style prop + className merged) */
  style: Record<string, unknown>;
  className?: string;
  /** number of direct list rows (FlatList / ScrollView content) */
  items?: number;
};

/** What checks can do with the running app. Same API in the browser (via postMessage) and in Node tests. */
export interface PreviewDriver {
  text(): Promise<string>;
  find(q?: Query): Promise<Found[]>;
  count(q?: Query): Promise<number>;
  press(q?: Query): Promise<boolean>;
  type(q: Query, value: string): Promise<boolean>;
  logs(): Promise<string[]>;
  /** render the app again from scratch (fresh state) */
  rerun(): Promise<void>;
  wait(ms: number): Promise<void>;
}
