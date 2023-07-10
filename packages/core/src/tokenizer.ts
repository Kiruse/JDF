import Source from './source.js'
import { Err, Ok, Result } from './types.js';

export type TokenConsumer<T extends string, M extends string> =
  | string
  | RegExp
  | TokenConsumerCallback<T, M>;
type TokenConsumerCallback<T extends string, M extends string> =
  (api: TokenConsumerAPI<T, M>) => Result<string, void | string | ParseError>;

type PairType<T extends string> =
  T extends string
    ? string
    : T extends `${infer P}.${'open' | 'close'}` ? P : never;

interface TokenOptions<T extends string> {
  /** Whether this token, when consumed, is silently removed from the token stream. */
  skip?: boolean;
  /** Whether to disable this token for consumption in this scope. Nested scopes can then re-enable it. */
  disable?: boolean;
}

export class Tokenizer<Types extends string = string, Modes extends string = string, State = any> {
  #parent: Tokenizer<Types, Modes, State> | null = null;
  #defs: TokenDefinition<Types, Modes>[] = [];
  #disabled: Record<Types, boolean> = {} as any;
  #skipped: Record<Types, boolean> = {} as any;
  #map: Record<Types, TokenDefinition<Types, Modes>> = {} as any;
  #modes: Record<Modes, Tokenizer<Types, Modes, State>> = {} as any;
  #isolate = false;
  state: State = undefined as any;
  
  constructor(parent: Tokenizer<Types, Modes, State> | null = null) {
    this.#parent = parent;
  }
  
  init(state: State): this {
    this.state = state;
    return this;
  }
  
  consume(src: string | Source): Token<Types>[] {
    const tokens: Token<Types>[] = [];
    const source = typeof src === 'string' ? new Source(src) : src;
    const defs = this.getEnabledDefinitions();
    
    let pop = false, _mode: Modes | null = null;
    const pushMode = (mode: Modes) => {
      if (!this.getMode(mode))
        throw Error(`Mode '${mode}' does not exist`);
      _mode = mode;
    };
    const popMode = () => { pop = true };
    const api = new TokenConsumerAPI(this, source, pushMode, popMode);
    
    while (!source.isEOF && !pop) {
      const res = this.#consumeNext(api, defs);
      if (!res.ok)
        throw new TokenizeError(source, res.error);
      if (!this.#skipped[res.value.type])
        tokens.push(res.value);
      
      if (_mode !== null) {
        tokens.push(...this.getMode(_mode).consume(source));
        _mode = null;
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
  
  #consumeNext(api: TokenConsumerAPI<Types, Modes>, defs: TokenDefinition<Types, Modes>[]): Result<Token<Types>, ParseError[]> {
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
  token(type: Types, consume: TokenConsumer<Types, Modes>, { skip, disable }: TokenOptions<Types> = {}): this {
    if (this.#map[type])
      throw Error(`Token ${JSON.stringify(type)} is already defined in this scope`);
    const def: TokenDefinition<Types, Modes> = {
      type,
      consume,
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
  skip(type: Types, consume: TokenConsumer<Types, Modes>, flags?: Omit<TokenOptions<Types>, 'skip'>): this;
  skip(type: Types, consume?: boolean | TokenConsumer<Types, Modes>, opts: Omit<TokenOptions<Types>, 'skip'> = {}) {
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
  
  getDefinition(type: Types, throws: true): TokenDefinition<Types, Modes>;
  getDefinition(type: Types, throws?: boolean): TokenDefinition<Types, Modes> | undefined;
  getDefinition(type: Types, throws = false): TokenDefinition<Types, Modes> | undefined {
    const def = this.#map[type] ?? this.#parent?.getDefinition(type);
    if (throws && !def) throw Error(`Token ${JSON.stringify(type)} is not defined`);
    return def;
  }
  
  getEnabledDefinitions(): TokenDefinition<Types, Modes>[] {
    if (this.#isolate) {
      return this.#defs.filter(def => !this.#disabled[def.type]);
    } else {
      return this.#defs
        .filter(def => !this.#disabled[def.type])
        .concat(this.#parent?.getEnabledDefinitions() ?? []);
    }
  }
  collectDefinitions(): TokenDefinition<Types, Modes>[] {
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
  
  getMode(mode: Modes): Tokenizer<Types, Modes, State> {
    if (mode as string === 'root') {
      if (!this.#parent) throw Error('Already in root mode');
      let tmp: Tokenizer<Types, Modes, State> = this;
      while (tmp.#parent) tmp = tmp.#parent;
      return tmp;
    }
    
    if (this.#modes[mode])
      return this.#modes[mode];
    if (this.#parent) {
      const tmp = this.#parent.getMode(mode);
      if (tmp) return tmp;
    }
    throw Error(`Mode '${mode}' is not defined in this scope`);
  }
  
  /** Whether to isolate this tokenizer from its ancestry. An isolated tokenizer will ignore the
   * enabled tokens of its ancestors.
   */
  isolate(value = true) {
    this.#isolate = value;
    return this;
  }
  
  /** Create a new tokenizer mode which can be entered from the root or any other tokenizer mode. */
  mode(name: Modes, initializer: (child: Tokenizer<Types, Modes>) => void): this {
    const child = this.#modes[name] = new Tokenizer<Types, Modes, State>(this);
    initializer(child);
    return this;
  }
}

class TokenConsumerAPI<Types extends string, Modes extends string> {
  constructor(
    public readonly tokenizer: Tokenizer<Types, Modes>,
    public readonly source: Source,
    public readonly pushMode: (mode: Modes) => void,
    public readonly popMode: () => void,
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
  
  consumeDef(def: TokenDefinition<Types, Modes>) {
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
  get state() { return this.tokenizer.state }
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
export interface TokenDefinition<T extends string = string, M extends string = string> {
  /** The type of this token. */
  type: T;
  /** The consumer to apply. When a `string` is provided, the exact string must be matched. When a
   * `RegExp` is provided, the regex must match the current location in the source. When a function
   * is provided, it is called with the current source and must return a string or `undefined` if
   * no match is found.
   */
  consume: TokenConsumer<T, M>;
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
  public readonly pos?: Position;
  
  constructor(src: Source, public errors: ParseError[]) {
    super(TokenizeError.getMessage(src));
    this.name = 'TokenizeError';
  }
  
  static getMessage(src: Source) {
    let sub = src.peek(10);
    let idx = sub.indexOf('\n');
    if (idx >= 0) sub = sub.slice(0, idx);
    if (sub) return `Failed to process token near '${sub}' at ${Position(src)}`;
    return `Failed to process token at ${Position(src)}`;
  }
}

export function keyword<T extends string = string, M extends string = string>(match: string): TokenConsumerCallback<T, M> {
  return ({ src }) => {
    if (src.consumeWord(match))
      return Ok(match);
    return Err();
  }
}
keyword.pin = <T extends string, M extends string>() => (match: T) => keyword<T, M>(match);
