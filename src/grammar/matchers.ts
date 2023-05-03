import { Node } from './automaton'
import type { CharCodeRange, SubGraph } from './types';

export type Matcher = LiteralMatcher | ChainMatcher | OptionsMatcher | AnyMatcher | RangesMatcher | RepeatMatcher;
export interface GenericMatcher {
  toSubGraph(): SubGraph;
}

export type LiteralMatcher = ReturnType<typeof literal>;
export const literal = (str: string) => ({
  type: 'literal' as const,
  match: str,
  toSubGraph() {
    const nodes = str.split('').map(c => Node.Char(c));
    for (let i = 1; i < nodes.length; ++i) {
      nodes[i - 1].next.push(nodes[i]);
    }
    return {
      root: nodes[0],
      tails: [nodes[nodes.length-1]],
    };
  },
});

export type ChainMatcher = ReturnType<typeof chain>;
export const chain = (matchers: GenericMatcher[]) => ({
  type: 'chain',
  matchers,
  toSubGraph() {
    if (!matchers.length)
      throw Error('Empty matcher chain');
    
    const subgraphs = matchers.map(m => m.toSubGraph());
    for (let i = 1; i < subgraphs.length; ++i) {
      subgraphs[i-1].tails.forEach(tail => {
        tail.next.push(subgraphs[i].root);
      });
    }
    return {
      root: subgraphs[0].root,
      tails: subgraphs[subgraphs.length-1].tails,
    };
  },
});

export type OptionsMatcher = ReturnType<typeof options>;
export const options = (matchers: GenericMatcher[]) => ({
  type: 'options',
  matchers,
  toSubGraph() {
    const root = Node.Empty();
    const subgraphs = matchers.map(m => m.toSubGraph());
    for (const sg of subgraphs) {
      root.next.push(sg.root);
    }
    return {
      root,
      tails: subgraphs.flatMap(sg => sg.tails),
    };
  },
});

export type AnyMatcher = ReturnType<typeof any>;
export const any = () => ({
  type: 'any',
  toSubGraph() {
    const node = Node({ match: [{ begin: 0, end: 0x10ffff }] });
    return {
      root: node,
      tails: [node],
    };
  },
});

export type RangesMatcher = ReturnType<typeof ranges>;
export const ranges = (ranges: CharCodeRange[]) => ({
  type: 'range',
  ranges,
  toSubGraph() {
    const node = Node({ match: ranges });
    return {
      root: node,
      tails: [node],
    };
  },
});

export type RepeatMatcher = ReturnType<typeof repeat>;
export const repeat = (matcher: GenericMatcher, min: number, max: number) => ({
  type: 'repeat' as const,
  matcher,
  range: { min, max },
  toSubGraph() {
    const key = Symbol('jdf-repeat');
    const root = Node.Empty();
    const tail = Node.Empty({
      onEnter: [automaton => {
        const count = automaton.data[key] ?? 0;
        if (count < min || max < count) {
          automaton.error(`Expected ${min}-${max} repetitions, got ${count}`);
          return;
        }
      }],
      onExit: [automaton => {
        delete automaton.data[key];
      }],
    });
    
    const subgraph = matcher.toSubGraph();
    root.next.push(subgraph.root);
    subgraph.tails.forEach(tail => {
      tail.onEnter.push(automaton => {
        automaton.data[key] = (automaton.data[key] ?? 0) + 1
      });
      tail.next.push(root, tail);
    });
    
    return {
      root,
      tails: [tail],
    }
  },
});
