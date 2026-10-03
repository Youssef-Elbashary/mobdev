/**
 * NativeWind stand-in for the lab preview: turns utility classes ("p-4 bg-blue-500 rounded-xl")
 * into a React Native style object, using Tailwind v3's default scale and palette (what NativeWind uses).
 * Covers the classes students meet in the course; anything else is reported as unknown.
 */
import { palette } from './tw-colors.ts';

export type RNStyle = Record<string, unknown>;
export type ClassResult = { style: RNStyle; active?: RNStyle; unknown: string[] };

const SCALE = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 72, 80, 96];
const FONT_SIZE: Record<string, [number, number]> = {
  xs: [12, 16], sm: [14, 20], base: [16, 24], lg: [18, 28], xl: [20, 28], '2xl': [24, 32], '3xl': [30, 36],
  '4xl': [36, 40], '5xl': [48, 48], '6xl': [60, 60], '7xl': [72, 72], '8xl': [96, 96], '9xl': [128, 128],
};
const FONT_WEIGHT: Record<string, string> = {
  thin: '100', extralight: '200', light: '300', normal: '400', medium: '500', semibold: '600', bold: '700', extrabold: '800', black: '900',
};
const RADIUS: Record<string, number> = { none: 0, sm: 2, '': 4, md: 6, lg: 8, xl: 12, '2xl': 16, '3xl': 24, full: 9999 };
const LEADING: Record<string, number> = { none: 1, tight: 1.25, snug: 1.375, normal: 1.5, relaxed: 1.625, loose: 2 };
const TRACKING: Record<string, number> = { tighter: -0.05, tight: -0.025, normal: 0, wide: 0.025, wider: 0.05, widest: 0.1 };
const MAX_W: Record<string, number | string> = {
  xs: 320, sm: 384, md: 448, lg: 512, xl: 576, '2xl': 672, '3xl': 768, '4xl': 896, '5xl': 1024, '6xl': 1152, '7xl': 1280, full: '100%', none: 'none',
};
const SHADOW: Record<string, RNStyle> = {
  sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  '': { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 2 },
  md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 4 },
  lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 15, elevation: 8 },
  xl: { shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.1, shadowRadius: 25, elevation: 12 },
  '2xl': { shadowColor: '#000', shadowOffset: { width: 0, height: 25 }, shadowOpacity: 0.25, shadowRadius: 50, elevation: 16 },
  none: { shadowOpacity: 0, elevation: 0 },
};
const ALIGN: Record<string, string> = { start: 'flex-start', end: 'flex-end', center: 'center', baseline: 'baseline', stretch: 'stretch', auto: 'auto' };
const JUSTIFY: Record<string, string> = { start: 'flex-start', end: 'flex-end', center: 'center', between: 'space-between', around: 'space-around', evenly: 'space-evenly' };

/** spacing / sizing value: "4" → 16, "0.5" → 2, "px" → 1, "1/2" → "50%", "full" → "100%", "[13px]" → 13 */
function size(token: string, allowKeywords = true): number | string | undefined {
  if (token === 'px') return 1;
  if (/^\d+(\.\d+)?$/.test(token)) {
    const n = Number(token);
    return SCALE.includes(n) ? n * 4 : undefined;
  }
  const frac = /^(\d+)\/(\d+)$/.exec(token);
  if (frac) return `${+((Number(frac[1]) / Number(frac[2])) * 100).toFixed(6)}%`;
  if (allowKeywords) {
    if (token === 'full' || token === 'screen') return '100%';
    if (token === 'auto') return 'auto';
  }
  const arbitrary = /^\[(-?\d+(?:\.\d+)?)(px|%)?\]$/.exec(token);
  if (arbitrary) return arbitrary[2] === '%' ? `${arbitrary[1]}%` : Number(arbitrary[1]);
  return undefined;
}

function withAlpha(hex: string, alpha: number) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** "blue-500" → "#3b82f6", "black/50" → "rgba(0, 0, 0, 0.5)", "[#ff0000]" → "#ff0000" */
function color(token: string): string | undefined {
  const [name, opacity] = token.split('/');
  let hex: string | undefined;
  if (name === 'white') hex = '#ffffff';
  else if (name === 'black') hex = '#000000';
  else if (name === 'transparent') return 'transparent';
  else if (/^\[#[0-9a-fA-F]{3,8}\]$/.test(name)) hex = name.slice(1, -1);
  else {
    const m = /^([a-z]+)-(\d{2,3})$/.exec(name);
    hex = m ? palette[m[1]]?.[m[2]] : undefined;
  }
  if (!hex) return undefined;
  if (opacity === undefined) return hex;
  const a = Number(opacity);
  return Number.isFinite(a) ? withAlpha(hex, a / 100) : undefined;
}

const SPACING_PROPS: Record<string, string[]> = {
  p: ['padding'], px: ['paddingHorizontal'], py: ['paddingVertical'], pt: ['paddingTop'], pr: ['paddingRight'], pb: ['paddingBottom'], pl: ['paddingLeft'],
  m: ['margin'], mx: ['marginHorizontal'], my: ['marginVertical'], mt: ['marginTop'], mr: ['marginRight'], mb: ['marginBottom'], ml: ['marginLeft'],
  gap: ['gap'], 'gap-x': ['columnGap'], 'gap-y': ['rowGap'],
  w: ['width'], h: ['height'], 'min-w': ['minWidth'], 'min-h': ['minHeight'], 'max-h': ['maxHeight'], size: ['width', 'height'],
  top: ['top'], right: ['right'], bottom: ['bottom'], left: ['left'], inset: ['top', 'right', 'bottom', 'left'],
  'inset-x': ['left', 'right'], 'inset-y': ['top', 'bottom'], basis: ['flexBasis'],
};
const BORDER_SIDES: Record<string, string> = { t: 'Top', r: 'Right', b: 'Bottom', l: 'Left' };

/** Applies one class to `s`. Returns false if the class is unknown. */
function apply(cls: string, s: RNStyle, ratio: { leading?: number; tracking?: number }): boolean {
  const neg = cls.startsWith('-');
  const c = neg ? cls.slice(1) : cls;

  // keywords
  const keywords: Record<string, RNStyle> = {
    flex: { display: 'flex' }, hidden: { display: 'none' },
    'flex-1': { flex: 1 }, 'flex-auto': { flexGrow: 1, flexShrink: 1, flexBasis: 'auto' }, 'flex-initial': { flexGrow: 0, flexShrink: 1, flexBasis: 'auto' }, 'flex-none': { flexGrow: 0, flexShrink: 0, flexBasis: 'auto' },
    'flex-row': { flexDirection: 'row' }, 'flex-col': { flexDirection: 'column' }, 'flex-row-reverse': { flexDirection: 'row-reverse' }, 'flex-col-reverse': { flexDirection: 'column-reverse' },
    'flex-wrap': { flexWrap: 'wrap' }, 'flex-wrap-reverse': { flexWrap: 'wrap-reverse' }, 'flex-nowrap': { flexWrap: 'nowrap' },
    grow: { flexGrow: 1 }, 'grow-0': { flexGrow: 0 }, shrink: { flexShrink: 1 }, 'shrink-0': { flexShrink: 0 },
    absolute: { position: 'absolute' }, relative: { position: 'relative' },
    'overflow-hidden': { overflow: 'hidden' }, 'overflow-visible': { overflow: 'visible' }, 'overflow-scroll': { overflow: 'scroll' },
    'text-left': { textAlign: 'left' }, 'text-center': { textAlign: 'center' }, 'text-right': { textAlign: 'right' }, 'text-justify': { textAlign: 'justify' },
    italic: { fontStyle: 'italic' }, 'not-italic': { fontStyle: 'normal' },
    underline: { textDecorationLine: 'underline' }, 'line-through': { textDecorationLine: 'line-through' }, 'no-underline': { textDecorationLine: 'none' },
    uppercase: { textTransform: 'uppercase' }, lowercase: { textTransform: 'lowercase' }, capitalize: { textTransform: 'capitalize' }, 'normal-case': { textTransform: 'none' },
    'font-sans': { fontFamily: 'System' }, 'font-serif': { fontFamily: 'serif' }, 'font-mono': { fontFamily: 'monospace' },
    'aspect-square': { aspectRatio: 1 }, 'aspect-video': { aspectRatio: 16 / 9 },
    'border-solid': { borderStyle: 'solid' }, 'border-dashed': { borderStyle: 'dashed' }, 'border-dotted': { borderStyle: 'dotted' },
  };
  if (!neg && keywords[c]) return Object.assign(s, keywords[c]), true;

  let m: RegExpExecArray | null;

  // spacing & sizing (p-4, mx-auto, w-1/2, -mt-2, gap-x-3, size-10)
  if ((m = /^(p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|gap-x|gap-y|gap|min-w|min-h|max-h|w|h|size|inset-x|inset-y|inset|top|right|bottom|left|basis)-(.+)$/.exec(c))) {
    const v = size(m[2]);
    if (v === undefined) return false;
    const value = neg && typeof v === 'number' ? -v : v;
    for (const prop of SPACING_PROPS[m[1]]) s[prop] = value;
    return true;
  }
  if ((m = /^max-w-(.+)$/.exec(c)) && MAX_W[m[1]] !== undefined) return (s.maxWidth = MAX_W[m[1]]), true;

  // flexbox alignment
  if ((m = /^items-(.+)$/.exec(c)) && ALIGN[m[1]]) return (s.alignItems = ALIGN[m[1]]), true;
  if ((m = /^self-(.+)$/.exec(c)) && ALIGN[m[1]]) return (s.alignSelf = ALIGN[m[1]]), true;
  if ((m = /^justify-(.+)$/.exec(c)) && JUSTIFY[m[1]]) return (s.justifyContent = JUSTIFY[m[1]]), true;
  if ((m = /^content-(.+)$/.exec(c)) && (ALIGN[m[1]] || JUSTIFY[m[1]])) return (s.alignContent = ALIGN[m[1]] ?? JUSTIFY[m[1]]), true;

  // typography
  if ((m = /^text-(.+)$/.exec(c))) {
    if (FONT_SIZE[m[1]]) return (s.fontSize = FONT_SIZE[m[1]][0]), (s.lineHeight = FONT_SIZE[m[1]][1]), true;
    const arb = /^\[(\d+)(px)?\]$/.exec(m[1]);
    if (arb) return (s.fontSize = Number(arb[1])), true;
    const col = color(m[1]);
    return col ? ((s.color = col), true) : false;
  }
  if ((m = /^font-(.+)$/.exec(c)) && FONT_WEIGHT[m[1]]) return (s.fontWeight = FONT_WEIGHT[m[1]]), true;
  if ((m = /^leading-(.+)$/.exec(c))) {
    if (LEADING[m[1]] !== undefined) return (ratio.leading = LEADING[m[1]]), true;
    const v = size(m[1], false);
    return typeof v === 'number' ? ((s.lineHeight = v), true) : false;
  }
  if ((m = /^tracking-(.+)$/.exec(c)) && TRACKING[m[1]] !== undefined) return (ratio.tracking = TRACKING[m[1]]), true;

  // backgrounds & borders
  if ((m = /^bg-(.+)$/.exec(c))) {
    const col = color(m[1]);
    return col ? ((s.backgroundColor = col), true) : false;
  }
  if ((m = /^rounded(?:-([trbl]{1,2}))?(?:-(.+))?$/.exec(c))) {
    const r = RADIUS[m[2] ?? ''];
    if (r === undefined) return false;
    if (!m[1]) s.borderRadius = r;
    else {
      const corners: Record<string, string[]> = { t: ['TopLeft', 'TopRight'], r: ['TopRight', 'BottomRight'], b: ['BottomLeft', 'BottomRight'], l: ['TopLeft', 'BottomLeft'], tl: ['TopLeft'], tr: ['TopRight'], bl: ['BottomLeft'], br: ['BottomRight'] };
      if (!corners[m[1]]) return false;
      for (const k of corners[m[1]]) s[`border${k}Radius`] = r;
    }
    return true;
  }
  if ((m = /^border(?:-([trblxy]))?(?:-(\d+))?$/.exec(c))) {
    const width = m[2] === undefined ? 1 : Number(m[2]);
    if (![0, 1, 2, 4, 8].includes(width)) return false;
    const sides = m[1] === 'x' ? ['Left', 'Right'] : m[1] === 'y' ? ['Top', 'Bottom'] : m[1] ? [BORDER_SIDES[m[1]]] : [''];
    for (const side of sides) s[`border${side}Width`] = width;
    return true;
  }
  if ((m = /^border-(.+)$/.exec(c))) {
    const col = color(m[1]);
    return col ? ((s.borderColor = col), true) : false;
  }

  // effects & layering
  if ((m = /^opacity-(\d+)$/.exec(c))) return (s.opacity = Number(m[1]) / 100), true;
  if ((m = /^shadow(?:-(.+))?$/.exec(c)) && SHADOW[m[1] ?? '']) return Object.assign(s, SHADOW[m[1] ?? '']), true;
  if ((m = /^z-(\d+)$/.exec(c))) return (s.zIndex = Number(m[1])), true;

  return false;
}

/** Every class the preview understands, most useful first (used for editor autocomplete). */
export function knownClasses(): string[] {
  const out: string[] = [];
  const add = (...c: string[]) => out.push(...c);
  add(
    'flex-1', 'flex-row', 'flex-col', 'flex-wrap', 'items-start', 'items-center', 'items-end', 'items-stretch',
    'justify-start', 'justify-center', 'justify-end', 'justify-between', 'justify-around', 'justify-evenly',
    'self-start', 'self-center', 'self-end', 'self-stretch', 'grow', 'shrink-0', 'absolute', 'relative', 'hidden', 'overflow-hidden', 'aspect-square',
  );
  const steps = ['0', '0.5', '1', '1.5', '2', '2.5', '3', '4', '5', '6', '8', '10', '12', '14', '16', '20', '24', '32', '40', '48', '64'];
  for (const p of ['p', 'px', 'py', 'pt', 'pb', 'pl', 'pr', 'm', 'mx', 'my', 'mt', 'mb', 'ml', 'mr', 'gap', 'gap-x', 'gap-y']) for (const s of steps) add(`${p}-${s}`);
  for (const p of ['w', 'h', 'size']) {
    for (const s of steps) add(`${p}-${s}`);
    add(`${p}-full`, `${p}-1/2`, `${p}-1/3`, `${p}-2/3`, `${p}-1/4`, `${p}-3/4`);
  }
  add('mx-auto', 'w-auto', 'h-auto', 'min-h-0', 'min-w-0');
  for (const k of Object.keys(MAX_W)) add(`max-w-${k}`);
  for (const k of Object.keys(FONT_SIZE)) add(`text-${k}`);
  for (const k of Object.keys(FONT_WEIGHT)) add(`font-${k}`);
  add('text-left', 'text-center', 'text-right', 'italic', 'underline', 'line-through', 'uppercase', 'lowercase', 'capitalize', 'font-mono');
  for (const k of Object.keys(LEADING)) add(`leading-${k}`);
  for (const k of Object.keys(TRACKING)) add(`tracking-${k}`);
  add('bg-white', 'bg-black', 'bg-transparent', 'text-white', 'text-black', 'border-white', 'border-black', 'border-transparent');
  for (const [name, shades] of Object.entries(palette)) for (const shade of Object.keys(shades)) add(`bg-${name}-${shade}`, `text-${name}-${shade}`, `border-${name}-${shade}`);
  add('border', 'border-0', 'border-2', 'border-4', 'border-t', 'border-b', 'border-l', 'border-r', 'border-dashed');
  for (const k of Object.keys(RADIUS)) add(k ? `rounded-${k}` : 'rounded');
  add('rounded-t-xl', 'rounded-b-xl', 'rounded-t-2xl', 'rounded-b-2xl');
  for (const k of Object.keys(SHADOW)) add(k ? `shadow-${k}` : 'shadow');
  for (const o of [0, 10, 25, 50, 75, 90, 100]) add(`opacity-${o}`);
  add('z-10', 'z-20', 'z-50', 'active:opacity-70', 'active:bg-slate-100', 'active:bg-slate-200');
  return out;
}

const cache = new Map<string, ClassResult>();

/** className → React Native style. `active:` classes apply while a Pressable is pressed. */
export function classToStyle(className: string): ClassResult {
  const hit = cache.get(className);
  if (hit) return hit;
  const style: RNStyle = {};
  const active: RNStyle = {};
  const unknown: string[] = [];
  const ratio: { leading?: number; tracking?: number } = {};
  for (const raw of className.split(/\s+/).filter(Boolean)) {
    const parts = raw.split(':');
    const cls = parts.pop()!;
    const variants = parts;
    if (variants.some((v) => v !== 'active')) continue; // dark:, md:, ios: … are not simulated in the preview
    const target = variants.includes('active') ? active : style;
    if (!apply(cls, target, ratio)) unknown.push(raw);
  }
  const fontSize = typeof style.fontSize === 'number' ? style.fontSize : 16;
  if (ratio.leading !== undefined) style.lineHeight = Math.round(ratio.leading * fontSize);
  if (ratio.tracking !== undefined) style.letterSpacing = +(ratio.tracking * fontSize).toFixed(2);
  const result: ClassResult = { style, ...(Object.keys(active).length ? { active } : null), unknown };
  cache.set(className, result);
  return result;
}
