/**
 * Editor autocomplete tuned to what Lab 02 teaches: React Native components and their props,
 * hooks, imports, the student's own components (with their props) and NativeWind classes.
 */
import { snippetCompletion, type Completion, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete';
import { syntaxTree } from '@codemirror/language';
import type { SyntaxNode } from '@lezer/common';
import { classToStyle, knownClasses } from '../runtime/tw.ts';
import type { Frame } from '../runtime/protocol.ts';

type PropSpec = [label: string, template: string, info: string];

const style: PropSpec = ['style', 'style={{ ${} }}', 'a style object, e.g. { padding: 16 }'];
const className: PropSpec = ['className', 'className="${}"', 'NativeWind classes, e.g. "p-4 bg-white"'];
const onPress: PropSpec = ['onPress', 'onPress={() => ${}}', 'runs when tapped'];

const RN: Record<string, { info: string; props: PropSpec[] }> = {
  View: { info: 'a box that groups and lays out children', props: [className, style, ['testID', 'testID="${}"', 'id for tests']] },
  Text: { info: 'shows text — all words must be inside one', props: [className, style, ['numberOfLines', 'numberOfLines={${1}}', 'cut off after N lines'], onPress] },
  Image: {
    info: 'a picture — needs a width and height',
    props: [['source', "source={{ uri: ${'https://…'} }}", 'the picture: { uri: URL }'], className, style, ['resizeMode', 'resizeMode="${cover}"', 'cover · contain · stretch']],
  },
  TextInput: {
    info: 'a box the user types in',
    props: [
      ['value', 'value={${}}', 'what the input shows (from state)'],
      ['onChangeText', 'onChangeText={${}}', 'called with the new text'],
      ['placeholder', 'placeholder="${}"', 'grey hint text'],
      className, style,
      ['keyboardType', 'keyboardType="${numeric}"', 'default · numeric · email-address · phone-pad'],
      ['secureTextEntry', 'secureTextEntry', 'hide what is typed (passwords)'],
      ['multiline', 'multiline', 'allow several lines'],
      ['onSubmitEditing', 'onSubmitEditing={() => ${}}', 'Enter / Done pressed'],
      ['autoFocus', 'autoFocus', 'focus when the screen opens'],
    ],
  },
  Pressable: { info: 'makes anything tappable', props: [onPress, className, style, ['onLongPress', 'onLongPress={() => ${}}', 'tap and hold'], ['disabled', 'disabled={${}}', 'ignore taps']] },
  ScrollView: {
    info: 'scrolls content taller than the screen',
    props: [['contentContainerClassName', 'contentContainerClassName="${}"', 'classes for the scrolling content'], ['contentContainerStyle', 'contentContainerStyle={{ ${} }}', 'style for the scrolling content'], ['horizontal', 'horizontal', 'scroll sideways'], className, style],
  },
  FlatList: {
    info: 'efficient list: renders only visible rows',
    props: [
      ['data', 'data={${}}', 'the array to show'],
      ['renderItem', 'renderItem={({ item }) => ${}}', 'turns one item into a component'],
      ['keyExtractor', 'keyExtractor={(item) => item.${id}}', 'which field is unique'],
      ['ItemSeparatorComponent', 'ItemSeparatorComponent={() => ${}}', 'drawn between rows'],
      ['ListEmptyComponent', 'ListEmptyComponent={${}}', 'shown when data is empty'],
      ['contentContainerClassName', 'contentContainerClassName="${}"', 'classes for the list content'],
      ['horizontal', 'horizontal', 'scroll sideways'],
      ['numColumns', 'numColumns={${2}}', 'a grid'],
      className, style,
    ],
  },
  SafeAreaView: { info: 'keeps content away from the notch and home bar', props: [className, style] },
  Button: { info: 'a simple native button', props: [['title', 'title="${}"', 'the label'], onPress, ['color', 'color="${}"', 'text/background colour']] },
  Switch: { info: 'an on/off toggle', props: [['value', 'value={${}}', 'on or off'], ['onValueChange', 'onValueChange={${}}', 'called with true/false']] },
  ActivityIndicator: { info: 'a loading spinner', props: [['size', 'size="${large}"', 'small · large'], ['color', 'color="${}"', 'colour']] },
};

const WEB: Record<string, PropSpec[]> = {
  div: [style, ['onClick', 'onClick={() => ${}}', 'runs when clicked']],
  button: [['onClick', 'onClick={() => ${}}', 'runs when clicked'], style],
  input: [['value', 'value={${}}', 'what the input shows'], ['onChange', 'onChange={(e) => ${}}', 'e.target.value is the new text'], ['placeholder', 'placeholder="${}"', 'hint text'], ['type', 'type="${text}"', 'text · number · password']],
  img: [['src', 'src="${}"', 'image URL'], ['alt', 'alt="${}"', 'description'], style],
  h1: [style], h2: [style], h3: [style], p: [style], span: [style], ul: [style], li: [style],
};

const HOOKS: Completion[] = [
  snippetCompletion('const [${value}, ${setValue}] = useState(${initial});', { label: 'useState', detail: 'state + setter', type: 'function', boost: 2 }),
  snippetCompletion('useEffect(() => {\n\t${}\n}, [${}]);', { label: 'useEffect', detail: 'run after render', type: 'function', boost: 2 }),
  { label: 'useRef', type: 'function', detail: 'a value that survives renders' },
  { label: 'useMemo', type: 'function', detail: 'remember a computed value' },
  { label: 'useCallback', type: 'function', detail: 'remember a function' },
  { label: 'useContext', type: 'function', detail: 'read shared data' },
];

const RN_EXPORTS = [...Object.keys(RN), 'StyleSheet', 'TouchableOpacity', 'Alert', 'Platform', 'Dimensions', 'useWindowDimensions', 'KeyboardAvoidingView'];

let classOptions: Completion[] | null = null;
function classes(): Completion[] {
  if (classOptions) return classOptions;
  classOptions = knownClasses().map((cls, i) => {
    const s = classToStyle(cls.replace(/^active:/, '')).style;
    const detail = Object.entries(s)
      .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
      .join(', ');
    return { label: cls, type: 'constant', detail: cls.startsWith('active:') ? `when pressed: ${detail}` : detail, boost: -Math.floor(i / 200) };
  });
  return classOptions;
}

const above = (node: SyntaxNode | null, name: string) => {
  for (let n = node; n; n = n.parent) if (n.name === name) return n;
  return null;
};

/** Components the student declared (function X / const X =) and their destructured props. */
function studentComponents(doc: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const re = /(?:function\s+([A-Z]\w*)\s*\(\s*(\{[^}]*\})?|const\s+([A-Z]\w*)\s*=\s*\(\s*(\{[^}]*\})?)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(doc))) {
    const name = m[1] ?? m[3];
    const params = (m[2] ?? m[4] ?? '').replace(/[{}]/g, '').split(',').map((p) => p.trim().split(/[\s=:]/)[0]).filter(Boolean);
    out.set(name, params);
  }
  return out;
}

export function labCompletions(frame: Frame, allCode: () => string) {
  return (context: CompletionContext): CompletionResult | null => {
    const { state, pos } = context;
    const node = syntaxTree(state).resolveInner(pos, -1);
    const line = state.doc.lineAt(pos);
    const before = line.text.slice(0, pos - line.from);

    // className="p-4 bg-|"
    const attrValue = above(node, 'JSXAttributeValue');
    if (attrValue) {
      const nameNode = attrValue.parent?.firstChild;
      const attrName = nameNode ? state.sliceDoc(nameNode.from, nameNode.to) : '';
      if (!/className$/.test(attrName)) return null;
      const word = context.matchBefore(/[\w:/.[\]#-]*/);
      return { from: word ? word.from : pos, options: classes(), validFor: /^[\w:/.[\]#-]*$/ };
    }

    // import { … } from 'react-native'
    if (/import\s*\{[^}]*$/.test(before)) {
      const mod = /from\s*['"]([^'"]+)['"]/.exec(line.text)?.[1] ?? '';
      const word = context.matchBefore(/\w*$/);
      const names = mod === 'react' ? ['useState', 'useEffect', 'useRef', 'useMemo', 'useCallback', 'useContext'] : RN_EXPORTS;
      return { from: word ? word.from : pos, options: names.map((n) => ({ label: n, type: mod === 'react' ? 'function' : 'class' })) };
    }

    // <Tag   (tag name after "<")
    const tag = context.matchBefore(/<\/?[A-Za-z][\w.]*$|<$/);
    if (tag && !above(node, 'String') && !above(node, 'LineComment') && !above(node, 'BlockComment')) {
      const from = tag.from + (tag.text.startsWith('</') ? 2 : 1);
      const mine = [...studentComponents(allCode()).keys()].map((n): Completion => ({ label: n, type: 'class', detail: 'your component', boost: 3 }));
      const core = frame === 'phone'
        ? Object.entries(RN).map(([n, c]): Completion => ({ label: n, type: 'class', detail: c.info, boost: 1 }))
        : Object.keys(WEB).map((n): Completion => ({ label: n, type: 'type' }));
      return { from, options: [...mine, ...core], validFor: /^[\w.]*$/ };
    }

    // <View clas|   (attribute name inside an opening tag)
    const open = above(node, 'JSXOpenTag') ?? above(node, 'JSXSelfClosingTag');
    if (open && !above(node, 'JSXEscape')) {
      const tagNode = open.getChild('JSXIdentifier') ?? open.getChild('JSXMemberExpression');
      const word = context.matchBefore(/[\w-]*$/);
      if (tagNode && word && word.from > tagNode.to) {
        const tagName = state.sliceDoc(tagNode.from, tagNode.to);
        const own = studentComponents(allCode()).get(tagName);
        const specs: PropSpec[] = RN[tagName]?.props ?? WEB[tagName] ?? (own ?? []).map((p): PropSpec => [p, `${p}={\${}}`, `prop of ${tagName}`]);
        if (!specs.length) return null;
        return { from: word.from, options: specs.map(([label, template, info]) => snippetCompletion(template, { label, info, type: 'property' })), validFor: /^[\w-]*$/ };
      }
      return null;
    }

    // plain identifiers: hooks and React Native names
    const word = context.matchBefore(/[A-Za-z_]\w*$/);
    if (!word && !context.explicit) return null;
    if (above(node, 'String') || above(node, 'LineComment') || above(node, 'BlockComment')) return null;
    const extra = frame === 'phone' ? RN_EXPORTS.map((n): Completion => ({ label: n, type: 'class' })) : [];
    return { from: word ? word.from : pos, options: [...HOOKS, ...extra], validFor: /^\w*$/ };
  };
}
