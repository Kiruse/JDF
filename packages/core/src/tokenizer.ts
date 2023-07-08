import Source from './source.js'
import { Err, Ok, Result } from './types.js';

export interface Punctuation {
  /** The text resembling this punctuation. */
  value: string;
}

export type TokenConsumer<T extends string = string> =
  | string
  | RegExp
  | TokenConsumerCallback<T>;
type TokenConsumerCallback<T extends string> = (api: TokenConsumerAPI<T>) => Result<string, void | string | ParseError>;

type PairType<T extends string> =
  T extends string
    ? string
    : T extends `${infer P}.${'open' | 'close'}` ? P : never;

interface TokenOptions<T extends string> {
  /** Whether this token, when consumed, is silently removed from the token stream. */
  skip?: boolean;
  /** Whether to disable this token for consumption in this scope. Nested scopes can then re-enable it. */
  disable?: boolean;
  /** Create a nested tokenizer which can parse different tokens. You will need to call
   * `tokenizer.eject()` once the exit token has been encountered.
   */
  nest?(tokenizer: Tokenizer<T>): void;
}

export class Tokenizer<Types extends string = string> {
  #parent: Tokenizer<Types> | null = null;
  #defs: TokenDefinition<Types>[] = [];
  #disabled: Record<Types, boolean> = {} as any;
  #skipped: Record<Types, boolean> = {} as any;
  #map: Record<Types, TokenDefinition<Types>> = {} as any;
  #isolate = false;
  
  constructor(parent: Tokenizer<Types> | null = null) {
    this.#parent = parent;
  }
  
  consume(src: string | Source): Token<Types>[] {
    this.#defs.forEach(def => {
      if (def.nest && !def.nested) {
        def.nested = new Tokenizer(this);
        def.nest(def.nested);
      }
    });
    
    const tokens: Token<Types>[] = [];
    const source = typeof src === 'string' ? new Source(src) : src;
    const defs = this.getEnabledDefinitions();
    
    let eject = false;
    const api = new TokenConsumerAPI(this, source, () => {eject = true});
    
    while (!source.isEOF && !eject) {
      const res = this.#consumeNext(api, defs);
      if (!res.ok)
        throw new TokenizeError(`Failed to parse token at ${Position(source)}`, res.error, Position(source));
      if (!this.#skipped[res.value.type])
        tokens.push(res.value);
      
      const def = this.getDefinition(res.value.type, true);
      if (def.nested) {
        tokens.push(...def.nested.consume(source));
      }
    }
    
    if (source.isEOF) {
      tokens.push({
        type: 'EOF' as any,
        loc: makeloc(source, source),
      });
    }
    
    return tokens;
  }
  
  #consumeNext(api: TokenConsumerAPI<Types>, defs: TokenDefinition<Types>[]): Result<Token<Types>, ParseError[]> {
    const errors: ParseError[] = [];
    const srcRollback = api.src.clone();
    
    // rolls back the source at the end of each iteration UNLESS the iteration successfully
    // consumed a token and returns
    for (const def of defs) {
      const res = api.consumeDef(def);
      
      if (res.ok) {
        const token: Token<Types> = {
          type: def.type,
          value: res.value,
          loc: makeloc(srcRollback, api.src),
        };
        return Ok(token);
      } else {
        errors.push(res.error);
      }
      
      api.src.copy(srcRollback);
    }
    
    // failed to consume any token
    return Err(errors);
  }
  
  /** Enable a token for consumption in this scope. */
  enable(...types: Types[]) {
    for (const type of types)
      this.#disabled[type] = false;
    return this;
  }
  /** Disable a token for consumption in this scope. */
  disable(...types: Types[]) {
    for (const type of types)
      this.#disabled[type] = true;
    return this;
  }
  
  /** (Re)define a token in this scope. A token which is not defined in this scope is instead looked
   * up in the parent scope, if any. Throws if the token is already defined in this scope.
   */
  token(type: Types, consume: TokenConsumer<Types>, { skip, disable, nest }: TokenOptions<Types> = {}): this {
    if (this.#map[type])
      throw Error(`Token ${JSON.stringify(type)} is already defined in this scope`);
    const def: TokenDefinition<Types> = {
      type,
      consume,
      nest,
    };
    this.#map[type] = def;
    this.#defs.push(def);
    this.#disabled[type] = !!disable;
    this.#skipped[type] = !!skip;
    return this;
  }
  
  /** Bump a token definition from the parent scope to this scope. This bumps its priority in the
   * token processing order, so that it is consumed before any tokens so far defined in this scope,
   * as well as any tokens defined in the parent scope.
   */
  bump(...types: Types[]) {
    for (const type of types) {
      if (this.#map[type])
        throw Error(`Token ${JSON.stringify(type)} is already defined in this scope`);
      if (!this.#parent)
        throw Error(`No parent scope to bump token ${type} from`);
      const def = this.#map[type] = this.#parent!.getDefinition(type, true);
      this.#defs.push(def);
    }
    return this;
  }
  
  /** Omit a token from the token stream when encountered. */
  skip(type: Types, value?: boolean): this;
  /** Define a token that is 'skipped', i.e. will not be added to the token stream. */
  skip(type: Types, consume: TokenConsumer<Types>, flags?: Omit<TokenOptions<Types>, 'skip'>): this;
  skip(type: Types, consume?: boolean | TokenConsumer<Types>, opts: Omit<TokenOptions<Types>, 'skip'> = {}) {
    if (consume === undefined)
      consume = true;
    
    if (typeof consume === 'boolean') {
      this.#skipped[type] = consume;
    } else {
      this.token(type, consume, { ...opts, skip: true });
    }
    return this;
  }
  skipAll(...types: Types[]): this {
    for (const type of types)
      this.skip(type, true);
    return this;
  }
  
  /** Define a pair of tokens with types `${type}.open` and `${type}.close`, such as parentheses,
   * braces, or brackets.
   */
  pair(type: PairType<Types>, open: string, close: string) {
    this.token(`${type}.open` as any, open);
    this.token(`${type}.close` as any, close);
    return this;
  }
  
  getDefinition(type: Types, throws: true): TokenDefinition<Types>;
  getDefinition(type: Types, throws?: boolean): TokenDefinition<Types> | undefined;
  getDefinition(type: Types, throws = false): TokenDefinition<Types> | undefined {
    const def = this.#map[type] ?? this.#parent?.getDefinition(type);
    if (throws && !def) throw Error(`Token ${JSON.stringify(type)} is not defined`);
    return def;
  }
  
  getEnabledDefinitions(): TokenDefinition<Types>[] {
    if (this.#isolate) {
      return this.#defs.filter(def => !this.#disabled[def.type]);
    } else {
      return this.#defs
        .filter(def => !this.#disabled[def.type])
        .concat(this.#parent?.getEnabledDefinitions() ?? []);
    }
  }
  collectDefinitions(): TokenDefinition<Types>[] {
    const collected = new Set<Types>();
    const defs = this.#defs.slice();
    if (this.#parent) {
      for (const def of this.#parent.collectDefinitions()) {
        if (!collected.has(def.type)) {
          defs.push(def);
          collected.add(def.type);
        }
      }
    }
    return defs;
  }
  
  /** Whether to isolate this tokenizer from its ancestry. An isolated tokenizer will ignore the
   * enabled tokens of its ancestors.
   */
  isolate(value = true) {
    this.#isolate = value;
    return this;
  }
}

class TokenConsumerAPI<Types extends string> {
  constructor(
    public readonly tokenizer: Tokenizer<Types>,
    public readonly source: Source,
    public readonly eject: () => void,
  ) {}
  
  /** Consume a token from the source. */
  consume(type: Types) {
    return this.consumeDef(this.tokenizer.getDefinition(type, true));
  }
  
  consumeAny(...types: Types[]) {
    const defs = types.map(type => this.tokenizer.getDefinition(type, true));
    for (const def of defs) {
      const res = this.consumeDef(def);
      if (res.ok) return res;
    }
    return Err(new ParseError(`Expected one of ${types.map(t => JSON.stringify(t)).join(', ')}`, Position(this.source)));
  }
  
  consumeDef(def: TokenDefinition<Types>) {
    const { type, consume } = def;
    const { src } = this;
    
    if (typeof consume === 'string') {
      if (src.consume(consume)) {
        return Ok(consume);
      } else {
        return Err(new ParseError(`Token '${def.type}' expected literal '${consume}'`, Position(src)));
      }
    }
    
    if (consume instanceof RegExp) {
      const consumed = src.consume(consume);
      if (consumed) {
        return Ok(consumed);
      } else {
        return Err(new ParseError(`Token '${def.type}' expected to match ${consume}`, Position(src)));
      }
    }
    
    if (typeof consume === 'function') {
      const srcStart = src.clone();
      const res = consume(this);
      
      if (res.ok) {
        return Ok(res.value);
      }
      
      if (res.error) {
        if (typeof res.error === 'string')
          return Err(new ParseError(res.error, Position(srcStart)));
        else
          return Err(res.error);
      } else {
        return Err(new ParseError(`Token '${def.type}' failed to parse`, Position(srcStart)));
      }
    }
    return Err(new ParseError(`Invalid token definition for '${type}'`));
  }
  
  get tok() { return this.tokenizer }
  get src() { return this.source }
}

//#region Token Defs
export type TokenStream<Tokens extends string = string> = Token<Tokens>[];

/** A token, concrete or abstract. */
export interface Token<T extends string = string> {
  type: T;
  value?: any;
  loc: SourceLocation | null;
}

/** The commons of a token, both abstract and concrete. */
export interface TokenDefinition<T extends string = string> {
  /** The type of this token. */
  type: T;
  /** The consumer to apply. When a `string` is provided, the exact string must be matched. When a
   * `RegExp` is provided, the regex must match the current location in the source. When a function
   * is provided, it is called with the current source and must return a string or `undefined` if
   * no match is found.
   */
  consume: TokenConsumer<T>;
  nested?: Tokenizer<T>;
  nest?: TokenOptions<T>['nest'];
}

export interface SourceLocation {
  source: string | null;
  start: Position;
  end: Position;
}
export interface Position {
  line: number;
  column: number;
}
export function Position(line: number, column: number): Position;
export function Position(src: Source): Position;
export function Position(line: number | Source, column: number = 0): Position {
  function toString(this: Position) { return `:${this.line}:${this.column}` }
  if (typeof line !== 'number') {
    column = line.col;
    line = line.line;
  }
  const result = { line, column, toString };
  return result;
}
//#endregion

function makeloc(src1: Source, src2: Source): SourceLocation {
  const result = {
    source: src1.text,
    start: Position(src1),
    end: Position(src2),
    toString() {
      return `${this.start}-${this.end}`;
    },
  };
  return result;
}

export class ParseError extends Error {
  constructor(message: string, public pos?: Position) {
    super(message);
    this.name = 'ParseError';
  }
}

export class TokenizeError extends Error {
  constructor(message: string, public errors: ParseError[], public pos?: Position) {
    super(message);
    this.name = 'TokenizeError';
  }
}