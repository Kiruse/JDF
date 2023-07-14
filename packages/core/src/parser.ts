import type { Token } from './tokenizer.js'
import { SourceLocation } from './types.js';

type ASTBase = {
  type: string;
  children?: ASTBase[];
  loc?: SourceLocation;
}
type TokenNode = {
  type: 'token';
  token: Token;
}
type Pass<AST extends ASTBase> = (ast: AST[]) => boolean;
type NodePred<AST extends ASTBase> = AST['type'] | NodePredFn<AST>;
type NodePredFn<AST extends ASTBase> = (node: AST) => boolean;

type TokenType<ASTNode extends ASTBase> =
  ExtractNode<ASTNode, 'token'> extends TokenNode ? ExtractNode<ASTNode, 'token'>['token']['type'] : string;
type ExtractNode<ASTNode extends ASTBase, T extends ASTNode['type']> = ASTNode & { type: T };

export class Parser<ASTNode extends ASTBase> {
  #phases: Phase<ASTNode>[] = [];
  
  parse(tokens: Token<TokenType<ASTNode>>[]) {
    const ast: ASTNode[] = tokens.map(t => ({
      type: 'token' as const,
      token: t,
      loc: t.loc,
    }) as any);
    
    this.#phases.forEach(phase => {
      const passes = phase.getPasses();
      const parsepass = () => !!passes.find(pass => pass(ast));
      while (parsepass());
    });
    return ast;
  }
  
  phase(callback: (phase: Phase<ASTNode>) => void) {
    const phase = new Phase(this);
    this.#phases.push(phase);
    callback(phase);
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
  
  pass(callback: Pass<ASTNode>) {
    if (!this.#passes.includes(callback))
      this.#passes.push(callback);
    return this;
  }
  
  getPasses() { return this.#passes }
}

export function ParseOps<ASTNode extends ASTBase>() {
  type GroupFactory = (fact: (left: ASTNode, nodes: ASTNode[], right: ASTNode) => ASTNode) => Pass<ASTNode>;
  type GroupArgs = {
    left: NodePred<ASTNode>;
    right: NodePred<ASTNode>;
    /** Whether to handle nested groups, or to consider them as parsing failure. Defaults to true. */
    recursive?: boolean;
    /** Whether certain conditions throw an error or simply fail the parsing, such as a matching
     * `left` without a matching `right`. Defaults to false.
     */
    throws?: boolean;
  }
  
  type ReplaceFactory = (fact: (node: ASTNode) => ASTNode) => Pass<ASTNode>;
  
  return new class {
    /** Dictates the default value of `throw` options in parse ops */
    debug = false;
    
    //#region group
    group(
      left: NodePred<ASTNode>,
      right: NodePred<ASTNode>,
      opts?: Omit<GroupArgs, 'left' | 'right'>,
    ): GroupFactory;
    group(opts: GroupArgs): GroupFactory;
    group(...args: any[]): GroupFactory {
      let left: NodePred<ASTNode>,
          right: NodePred<ASTNode>,
          recursive = true,
          throws = this.debug;
      const opthrow = (err: Error) => this.opthrow(throws, err, -1);
      
      if (args.length === 1) {
        ({ left, right, recursive = recursive, throws = throws } = args[0]);
      } else {
        [left, right, { recursive = recursive, throws = throws } = {}] = args;
      }
      
      return fact => nodes => {
        const process = (nodes: ASTNode[], offset = 0): number => {
          let lidx = this.findNode(nodes, left, offset), ridx = lidx + 1;
          if (lidx === -1) return -1;
          
          // find matching right
          let isNested: boolean;
          do {
            ridx = this.findNode(nodes, right, ridx);
            if (ridx === -1)
              return opthrow(Error(`No matching right found for left at index ${lidx}`));
            
            // handle nested groups
            let subidx = this.findNode(nodes, left, lidx + 1, ridx);
            isNested = subidx !== -1;
            if (isNested) {
              if (!recursive)
                return opthrow(Error(`Illegal nested group found`));
              if (process(nodes, subidx) === -1)
                return opthrow(Error(`Recursive group failed`));
              ridx = subidx;
            }
          } while (isNested);
          
          nodes.splice(lidx, ridx - lidx + 1, fact(nodes[lidx], nodes.slice(lidx + 1, ridx), nodes[ridx]));
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
    replace(pred: NodePred<ASTNode>): ReplaceFactory {
      return fact => nodes => {
        const idx = this.findNode(nodes, pred);
        if (idx === -1) return false;
        nodes[idx] = fact(nodes[idx]);
        return true;
      }
    }
    //#endregion replace
    
    //#region drop
    drop(pred: NodePred<ASTNode>): Pass<ASTNode> {
      return nodes => {
        const idx = this.findNode(nodes, pred);
        if (idx === -1) return false;
        nodes.splice(idx, 1);
        return true;
      }
    }
    //#endregion
    
    /** Creates a predicate to check if the node passed to the returned predicate is a token of given type. */
    isToken(token: TokenType<ASTNode>): NodePredFn<ASTNode> {
      return node => isTokenNode(node) && node.token.type === token;
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
      const recurse = (nodes: ASTNode[]): ASTNode | undefined => {
        for (const node of nodes)
          if ((pred as any)(node)) return node
        
        for (const node of nodes) {
          if ('children' in node) {
            const found = recurse(node.children as any);
            if (found) return found;
          }
        }
      }
      return recurse(nodes);
    }
    
    opthrow(throws: boolean, error: Error): false;
    opthrow<R>(throws: boolean, error: Error, ret: R): R;
    opthrow(throws: boolean, error: Error, ret = false) {
      if (throws) throw error;
      return ret;
    }
  }
}

const isTokenNode = (node: ASTBase): node is TokenNode => node.type === 'token' && typeof (node as any).token === 'object';
