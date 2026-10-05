/**
 * The `react-native` module that student code imports inside the lab preview.
 * It is react-native-web plus three lab additions:
 *  1. every core component tags its DOM node with data-rn="<Name>" and its resolved style
 *     (data-rn-style), so exercise checks can read what the student built;
 *  2. `className` works like NativeWind: utility classes become React Native styles (via twrnc);
 *  3. View-like components throw React Native's real error for raw text inside them.
 */
import { Children, createElement, forwardRef, type ComponentType } from 'react';
import * as RNW from 'react-native-web';
import { classToStyle } from './tw.ts';

export * from 'react-native-web';

export const TEXT_ERROR = 'Text strings must be rendered within a <Text> component.';

const warned = new Set<string>();
/** Called before each run so a misspelled class is reported again for the new code. */
export function resetClassWarnings() {
  warned.clear();
}

/** Space taken by the phone's status bar / home indicator (0 in the web frame). */
export const insets = { top: 0, bottom: 0, left: 0, right: 0 };
export function setInsets(next: Partial<typeof insets>) {
  Object.assign(insets, next);
}

type AnyProps = Record<string, any>;

function flatten(style: unknown): Record<string, unknown> {
  try {
    return { ...(RNW.StyleSheet.flatten(style as any) as Record<string, unknown>) };
  } catch {
    return {};
  }
}

function assertNoRawText(children: unknown, name: string) {
  if (typeof children === 'function') return; // <Pressable>{({ pressed }) => …}</Pressable>
  Children.forEach(children as any, (child: unknown) => {
    if ((typeof child === 'string' && child.trim() !== '') || typeof child === 'number') {
      const error = new Error(`${TEXT_ERROR}\n"${String(child).trim().slice(0, 40)}" is directly inside <${name}>.`);
      (error as Error & { hint?: string }).hint = 'Wrap the words in <Text>…</Text>.';
      throw error;
    }
  });
}

function fromClassName(className: unknown) {
  if (!className) return { style: undefined, active: undefined };
  const result = classToStyle(String(className));
  for (const cls of result.unknown) {
    if (warned.has(cls)) continue;
    warned.add(cls);
    console.warn(`NativeWind: "${cls}" is not a class this preview knows — check the spelling.`);
  }
  return result;
}

/** Wraps a react-native-web component with className support and data-rn tagging. */
function lab(name: string, Base: ComponentType<any>, viewLike = false, pressable = false) {
  const Wrapped = forwardRef<unknown, AnyProps>(function LabComponent({ className, style, dataSet, contentContainerClassName, ...rest }, ref) {
    if (viewLike) assertNoRawText(rest.children, name);
    if (contentContainerClassName) {
      // NativeWind's className for ScrollView / FlatList content
      rest.contentContainerStyle = [fromClassName(contentContainerClassName).style, rest.contentContainerStyle];
    }
    const { style: fromClass, active } = fromClassName(className);
    const merged =
      pressable && (typeof style === 'function' || active)
        ? (state: { pressed?: boolean }) => [fromClass, state?.pressed ? active : undefined, typeof style === 'function' ? style(state) : style]
        : fromClass
          ? [fromClass, style]
          : style;
    const resolved = flatten(typeof merged === 'function' ? merged({ pressed: false, hovered: false, focused: false }) : merged);
    return createElement(Base, {
      ...rest,
      ref,
      style: merged,
      dataSet: { ...dataSet, rn: name, rnStyle: JSON.stringify(resolved), ...(className ? { rnClass: String(className) } : null) },
    });
  });
  Wrapped.displayName = name;
  return Wrapped;
}

const SafeAreaBase = forwardRef<unknown, AnyProps>(function SafeAreaBase({ style, ...rest }, ref) {
  return createElement(RNW.View, {
    ...rest,
    ref,
    style: [{ paddingTop: insets.top, paddingBottom: insets.bottom, paddingLeft: insets.left, paddingRight: insets.right }, style],
  });
});

export const View = lab('View', RNW.View, true);
export const Text = lab('Text', RNW.Text);
export const Image = lab('Image', RNW.Image);
export const ImageBackground = lab('ImageBackground', RNW.ImageBackground, true);
export const TextInput = lab('TextInput', RNW.TextInput);
export const Pressable = lab('Pressable', RNW.Pressable, true, true);
export const TouchableOpacity = lab('TouchableOpacity', RNW.TouchableOpacity, true);
export const TouchableHighlight = lab('TouchableHighlight', RNW.TouchableHighlight, true);
export const Button = lab('Button', RNW.Button);
export const ScrollView = lab('ScrollView', RNW.ScrollView, true);
export const FlatList = lab('FlatList', RNW.FlatList);
export const SectionList = lab('SectionList', RNW.SectionList);
export const Switch = lab('Switch', RNW.Switch);
export const ActivityIndicator = lab('ActivityIndicator', RNW.ActivityIndicator);
export const KeyboardAvoidingView = lab('KeyboardAvoidingView', RNW.KeyboardAvoidingView, true);
export const SafeAreaView = lab('SafeAreaView', SafeAreaBase, true);

/** Alert.alert shows a small banner on the phone screen and logs to the console panel. */
export const Alert = {
  alert(title: string, message?: string) {
    console.log(`Alert: ${title}${message ? ` — ${message}` : ''}`);
    if (typeof document === 'undefined') return;
    const banner = document.createElement('div');
    banner.className = 'lab-alert';
    banner.textContent = message ? `${title}\n${message}` : title;
    document.body.appendChild(banner);
    setTimeout(() => banner.remove(), 2500);
  },
};
