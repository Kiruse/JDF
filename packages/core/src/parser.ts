import type { Token } from './tokenizer.js'
import { Ever, GuardedType, SourceLocation, TypeGuard } from './types.js';

export type ASTBase = {
  type: string;
  children?: ASTBase[];
  loc?: SourceLocation | null;
}
export type ExcludeIntermittentNodes<AST extends ASTBase> =
  AST extends { type: `_${string}` }
  ? never
  : AST;

export type TokenNode = {
  type: 'token';
  token: Token;
}
export type Pass<AST extends ASTBase> = (this: Phase<AST>, ast: AST[]) => boolean;
export type PassFactory<AST extends ASTBase, LP extends NodePredFn<AST>, RP extends NodePredFn<AST>> =
  (left: Ever<GuardedType<LP>, AST>,
   nodes: AST[],
   right: Ever<GuardedType<RP>, AST>,
  ) => AST;
type NodePred<AST extends ASTBase> = AST['type'] | NodePredFn<AST>;
type NodePredFn<AST extends ASTBase> = (node: AST) => boolean;

type TokenType<ASTNode extends ASTBase> =
  ExtractNode<ASTNode, 'token'> extends TokenNode ? ExtractNode<ASTNode, 'token'>['token']['type'] : string;
type ExtractNode<ASTNode extends ASTBase, T extends ASTNode['type']> = ASTNode & { type: T };

type DeepNode<AST extends ASTBase> = {
  node: AST;
  siblings: AST[];
  index: number;
}

export class Parser<ASTNode extends ASTBase> {
  #phases: Phase<ASTNode>[] = [];

  parse(tokens: Token<TokenType<ASTNode>>[]): ExcludeIntermittentNodes<ASTNode>[] {
    const ast: ASTNode[] = tokens.map(t => ({
      type: 'token' as const,
      token: t,
      loc: t.loc,
    }) as any);

    this.#phases.forEach(phase => {
      const passes = phase.getPasses();
      const parsepass = () => !!passes.find(pass => pass.call(phase, ast));
      while (parsepass());
    });

    for (const node of ast) {
      if (node.type.startsWith('_')) {
        console.warn(`Found intermittent type after parsing: ${node.type}. This is likely a bug in the parser.`);
        break;
      }
    }

    return ast as any;
  }

  phase(callback: (this: Phase<ASTNode>, phase: Phase<ASTNode>) => void) {
    const phase = new Phase(this);
    this.#phases.push(phase);
    callback.call(phase, phase);
    return this;
  }

  getSnippet(node: ASTNode) {
    if (!node.loc) return '';
    const { source, start, end } = node.loc;
    if (!source) return '';
    return source.slice(start.offset, end.offset);
  }

  readonly ops = ParseOps<ASTNode>();
}

class Phase<ASTNode extends ASTBase> {
  #passes: Pass<ASTNode>[] = [];

  constructor(public readonly parser: Parser<ASTNode>) {}

  pass = (callback: Pass<ASTNode>) => {
    if (!this.#passes.includes(callback))
      this.#passes.push(callback);
    return this;
  }

  getPasses = () => this.#passes;
}

export function ParseOps<ASTNode extends ASTBase>() {
  type _NodePred = NodePredFn<ASTNode> | TypeGuard<ASTNode>;

  type GroupFactory<LP extends _NodePred, RP extends _NodePred> =
    (factory: (left: Ever<GuardedType<LP>, ASTNode>, nodes: ASTNode[], right: Ever<GuardedType<RP>, ASTNode>) => ASTNode) => Pass<ASTNode>;
  type GroupArgs<LP extends _NodePred, RP extends _NodePred> = {
    left: LP;
    right: RP;
    /** Whether to handle nested groups, or to consider them as parsing failure. Defaults to true. */
    recursive?: boolean;
    /** Whether certain conditions throw an error or simply fail the parsing, such as a matching
     * `left` without a matching `right`. Defaults to false.
     */
    throws?: boolean;
  }

  type ReplaceFactory<P extends _NodePred> =
    (factory: (node: Ever<GuardedType<P>, ASTNode>) => ASTNode) => Pass<ASTNode>;

  const that = new class {
    /** Dictates the default value of `throw` options in parse ops */
    debug = false;

    //#region group
    group<LP extends _NodePred, RP extends _NodePred>(
      left: GroupArgs<LP, RP>['left'],
      right: GroupArgs<LP, RP>['right'],
      opts?: Omit<GroupArgs<LP, RP>, 'left' | 'right'>,
    ): GroupFactory<LP, RP>;
    group<LP extends _NodePred, RP extends _NodePred>(opts: GroupArgs<LP, RP>): GroupFactory<LP, RP>;
    group<LP extends _NodePred, RP extends _NodePred>(...args: any[]): GroupFactory<LP, RP> {
      let left: LP,
          right: RP,
          recursive = true,
          throws = that.debug;
      const opthrow = (err: Error) => that.opthrow(throws, err, -1);

      if (args.length === 1) {
        ({ left, right, recursive = recursive, throws = throws } = args[0]);
      } else {
        [left, right, { recursive = recursive, throws = throws } = {}] = args;
      }

      return fact => nodes => {
        const process = (nodes: ASTNode[], offset = 0): number => {
          let lidx = that.findNode(nodes, left, offset), ridx = lidx + 1;
          if (lidx === -1) return -1;

          // find matching right
          let isNested: boolean;
          do {
            ridx = that.findNode(nodes, right, ridx);
            if (ridx === -1)
              return opthrow(Error(`No matching right found for left at index ${lidx}`));

            // handle nested groups
            let subidx = that.findNode(nodes, left, lidx + 1, ridx);
            isNested = subidx !== -1;
            if (isNested) {
              if (!recursive)
                return opthrow(Error(`Illegal nested group found`));
              if (process(nodes, subidx) === -1)
                return opthrow(Error(`Recursive group failed`));
              ridx = subidx;
            }
          } while (isNested);

          const pass = fact(
            nodes[lidx] as any,
            nodes.slice(lidx + 1, ridx),
            nodes[ridx] as any,
          );
          nodes.splice(lidx, ridx - lidx + 1, pass);
          return ridx + 1;
        }

        const recurse = (nodes: ASTNode[], level = 0): boolean => {
          // attempt to match
          if (process(nodes) !== -1) return true;

          // no match, recurse
          let matched = false;
          for (const node of nodes) {
            if ('children' in node) {
              matched ||= recurse(node.children as any, level + 1);
            }
          }
          return false;
        }

        return recurse(nodes);
      }
    }
    //#endregion group

    //#region replace
    replace<P extends _NodePred>(pred: P): ReplaceFactory<P> {
      return fact => nodes => {
        const idx = that.findNode(nodes, pred);
        if (idx === -1) return false;
        nodes[idx] = fact(nodes[idx] as any);
        return true;
      }
    }
    //#endregion replace

    //#region drop
    drop(pred: NodePred<ASTNode>): Pass<ASTNode> {
      return nodes => {
        const idx = that.findNode(nodes, pred);
        if (idx === -1) return false;
        nodes.splice(idx, 1);
        return true;
      }
    }
    //#endregion

    /** Creates a predicate to check if the node passed to the returned predicate is a token of given type. */
    isToken(token: TokenType<ASTNode>) {
      return (node: ASTNode): node is ExtractNode<ASTNode, 'token'> => isTokenNode(node) && node.token.type === token;
    }

    findNode(nodes: ASTNode[], pred: NodePred<ASTNode>, offset = 0, limit = nodes.length) {
      const _type = pred;
      if (typeof pred === 'string')
        pred = (node: ASTNode) => node.type === _type;
      return nodes.findIndex((node, i) => i >= offset && i < limit && (pred as any)(node));
    }

    /** Breadth-first recursive search for a node that matches the given predicate */
    findDeepNode(nodes: ASTNode[], pred: NodePred<ASTNode>) {
      const _type = pred;
      if (typeof pred === 'string')
        pred = (node: ASTNode) => node.type === _type;
      const recurse = (nodes: ASTNode[]): DeepNode<ASTNode> | undefined => {
        for (let i = 0; i < nodes.length; ++i) {
          const node = nodes[i];
          if ((pred as any)(node)) {
            return {
              node,
              siblings: nodes,
              index: i,
            };
          }
        }

        for (const node of nodes) {
          if ('children' in node) {
            const found = recurse(node.children as any);
            if (found) return found;
          }
        }
      }
      return recurse(nodes);
    }

    splitNodes(nodes: ASTNode[], pred: NodePred<ASTNode>) {
      const type = pred;
      if (typeof pred === 'string')
        pred = node => node.type === type;

      const result: ASTNode[][] = [];
      let curr: ASTNode[] = result[0] = [];
      for (const node of nodes) {
        if (pred(node)) {
          curr = result[result.length] = [];
        } else {
          curr.push(node);
        }
      }
      return result;
    }

    opthrow(throws: boolean, error: Error): false;
    opthrow<R>(throws: boolean, error: Error, ret: R): R;
    opthrow(throws: boolean, error: Error, ret = false) {
      if (throws) throw error;
      return ret;
    }
  };
  return that;
}

const isTokenNode = (node: ASTBase): node is TokenNode => node.type === 'token' && typeof (node as any).token === 'object';
