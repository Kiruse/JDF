import Source from '../source'
import type { Matcher } from './matchers'
import type { CharCodeRange } from './types'

export class Automaton {
  #curr: Node;
  #isTerminal = false;
  #error: string | undefined;
  data: any = {};
  
  constructor(public readonly root: Node) {
    this.#curr = root;
  }
  
  markTerminal() {
    this.#isTerminal = true;
    return this;
  }
  
  error(): string | undefined;
  error(msg: string): this;
  error(msg?: string) {
    if (msg) {
      this.#error = msg;
      return this;
    }
    return this.#error;
  }
  
  next(src: Source) {
    this.#isTerminal = false;
    this.#error = undefined;
    // TODO: process the next character from the source
    throw Error('not yet implemented');
  }
  
  get isTerminal() { return this.#isTerminal }
  get curr() { return this.#curr }
}

export type TransitionCallback = (state: Automaton) => void;

/** Nodes are low-level representations of `Matcher`s */
export interface Node {
  /** The matcher to which this node belongs. Provides additional context. */
  matcher?: Matcher;
  match: CharCodeRange[];
  next: Node[];
  onEnter: TransitionCallback[];
  onExit: TransitionCallback[];
}

interface NodeArgs {
  matcher?: Matcher;
  match: CharCodeRange[];
  next?: Node[];
  onEnter?: TransitionCallback[];
  onExit?: TransitionCallback[];
}

export const Node = ({ next = [], onEnter = [], onExit = [], ...args }: NodeArgs): Node => ({
  ...args,
  next,
  onEnter,
  onExit,
});

Node.Char = (c: string, args: Omit<NodeArgs, 'match'> = {}) => Node({
  ...args,
  match: [{
    begin: c.charCodeAt(0),
    end: c.charCodeAt(0),
  }],
});

Node.Empty = (args: Omit<NodeArgs, 'match'> = {}) => Node({ ...args, match: [] });

Node.parseRange = (range: string, args: Omit<NodeArgs, 'match'> = {}) => {
  const src = new Source(range);
  const ranges: CharCodeRange[] = [];
  while (!src.isEOF) {
    if (src.peek() === '\\') {
      ranges.push(Node.parseEscape(src));
    }
    else {
      const peek = src.peek(3);
      if (peek.match(/^.-.$/)) {
        const c1 = peek.charCodeAt(0);
        const c2 = peek.charCodeAt(2);
        if (c1 > c2) throw Error('Invalid range');
        ranges.push({ begin: c1, end: c2 });
        src.consume(3);
      } else {
        const code = src.consume()!.charCodeAt(0);
        ranges.push({ begin: code, end: code });
      }
    }
  }
  
  return Node({
    ...args,
    match: ranges,
  });
}

Node.parseEscape = (src: Source): CharCodeRange => {
  if (!src.consume('\\')) throw Error('Expected escape character');
  const c = src.consume();
  if (!c) throw Error('Expected escape sequence');
  
  const consumeHex = (n: number) => {
    const hex = src.consume(n);
    if (!hex) throw Error(`Not enough characters for hexadecimal escape sequence (wanted ${n})`);
    const code = parseInt(hex, 16);
    if (isNaN(code)) throw Error('Expected hexadecimal escape sequence');
    return code;
  }
  
  let code: number;
  switch (c) {
    case 'x': code = consumeHex(2); break;
    case 'u':
    case 'X': code = consumeHex(4); break;
    case 'U': code = consumeHex(8); break;
    case 't': code = 0x09; break;
    case 'n': code = 0x0a; break;
    case 'v': code = 0x0b; break;
    case 'f': code = 0x0c; break;
    case 'r': code = 0x0d; break;
    default: code = c.charCodeAt(0);
  }
  
  return { begin: code, end: code };
}
