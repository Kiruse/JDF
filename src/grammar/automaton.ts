import Source from '../source'
import type { Matcher } from './matchers'
import { CharCodeRange, CharCodeRanges } from './ranges'

/** Deterministic finite automaton, processing an input stream through a given consumer graph. When
 * non-deterministic behavior would be required, throws instead.
 */
export class Automaton {
  #root: Node;
  #isTerminal = false;
  #error: string | undefined;
  data: any = {};
  
  constructor(public readonly root: Node, isDeterministic = false) {
    this.#root = root;
    if (!isDeterministic) this.toDeterministic();
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
  
  parse(src: Source) {
    this.#isTerminal = false;
    this.#error = undefined;
    
    let node = this.#root;
    this.#dispatch(node, 'enter');
    
    while (!src.isEOF) {
      if (node.next.find(n => !n.match.subranges.length))
        throw Error('Invalid epsilon transition');
      
      const next = node.next.find(n => n.match.includes(src.peek()));
      if (!next) {
        if (this.#isTerminal) break;
        else throw new UnexpectedEOFError(node, src.clone());
      } else {
        src.consume();
        
        this.#dispatch(node, 'exit');
        node = next;
        this.#dispatch(node, 'enter');
        if (this.#error) throw new StateError(node, src.clone(), this.#error);
        
        this.#isTerminal = false;
        this.#error = undefined;
      }
    }
    
    throw Error('not yet implemented');
  }
  
  #dispatch(node: Node, type: 'enter' | 'exit') {
    let callbacks: TransitionCallback[];
    switch (type) {
      case 'enter': callbacks = node.onEnter; break;
      case 'exit':  callbacks = node.onExit;  break;
      default: throw Error(`Unknown transition type '${type}'`);
    }
    callbacks.forEach(cb => {
      try {
        cb(this);
      } catch (err) {
        console.warn('Error in transition callback:');
        console.error(err);
      }
    });
  }
  
  /** Convert the underlying graph into a deterministic graph. This is a computationally heavy
   * algorithm which should be called only once if possible.
   */
  toDeterministic() {
    const queue = new Set([this.#root]);
    const visited = new Map<Node, Node[]>();
    
    /** Get the new set of `next` nodes for the given `node`, merging overlapping nodes and cutting
     * out epsilon nodes.
     */
    const getNextNodes = (node: Node): Node[] => {
      if (visited.has(node)) return visited.get(node)!;
      
      // first, collect next nodes whilst cutting out empty nodes
      const newnext: Node[] = [];
      for (const next of node.next) {
        if (visited.has(next)) {
          newnext.push(...visited.get(next)!);
          continue;
        }
        
        if (!next.match.subranges.length) {
          const nextnext = getNextNodes(next).map(n => n.clone());
          nextnext.forEach(n => {
            n.onEnter.push(...next.onEnter);
            n.onExit.push(...next.onExit);
          });
          newnext.push(...nextnext);
        } else {
          newnext.push(next);
        }
      }
      
      // then, merge overlapping nodes
      // TODO: find unique nodes using node.match.unique method
      
      if (!node.match.subranges.length)
        visited.set(node, newnext);
      else
        visited.set(node, [node]);
      return newnext;
    }
    
    while (queue.size) {
      const node = queue.values().next().value as Node;
      node.next = getNextNodes(node);
      queue.delete(node);
    }
  }
  
  get isTerminal() { return this.#isTerminal }
}

export type TransitionCallback = (state: Automaton) => void;

/** Nodes are low-level representations of `Matcher`s */
export interface Node {
  /** The matcher to which this node belongs. Provides additional context. */
  matcher?: Matcher;
  match: CharCodeRanges;
  next: Node[];
  onEnter: TransitionCallback[];
  onExit: TransitionCallback[];
  /** Create a shallow clone of this node. */
  clone(): Node;
}

interface NodeArgs {
  matcher?: Matcher;
  match: CharCodeRanges;
  next?: Node[];
  onEnter?: TransitionCallback[];
  onExit?: TransitionCallback[];
}

export const Node = ({ next = [], onEnter = [], onExit = [], ...args }: NodeArgs): Node => ({
  ...args,
  next,
  onEnter,
  onExit,
  clone(): Node {
    return Node({
      matcher: this.matcher,
      match: this.match.clone(),
      next: this.next.slice(),
      onEnter: this.onEnter.slice(),
      onExit: this.onExit.slice(),
    });
  },
});

Node.Char = (c: string, args: Omit<NodeArgs, 'match'> = {}) => Node({
  ...args,
  match: new CharCodeRanges([[c, c]]),
});

Node.Empty = (args: Omit<NodeArgs, 'match'> = {}) => Node({ ...args, match: new CharCodeRanges() });

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
  
  return new CharCodeRange(code);
}

export class UnexpectedEOFError extends Error {
  constructor(public readonly node: Node, public readonly source: Source) {
    super('Unexpected end of input');
  }
}

export class StateError extends Error {
  constructor(public readonly node: Node, public readonly source: Source, message: string) {
    super(message);
  }
}
