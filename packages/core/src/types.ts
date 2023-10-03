import type Source from './source.js'

export type TypeGuard<In, Out extends In = In> = (value: In) => value is Out;
export type GuardedType<TG> = TG extends TypeGuard<any, infer Out> ? Out : boolean;
export type Ever<T1, T2> = T1 extends never ? T2 : T1;

export type Result<T, E = Error> = Ok<T> | Err<E>;

export type Ok<T> = T extends void ? { ok: true, value?: undefined } : { ok: true, value: T };
export function Ok(): Ok<void>;
export function Ok<T>(value: T): Ok<T>;
export function Ok(value?: any) {
  return { ok: true as const, value }
}

export type Err<E> = E extends void ? { ok: false, error?: undefined } : { ok: false, error: E };
export function Err(): Err<void>;
export function Err<E>(error: E): Err<E>;
export function Err(error?: any) {
  return { ok: false as const, error }
}

export interface SourceLocation {
  source: string | null;
  start: Position;
  end: Position;
}
export interface Position {
  offset: number;
  line: number;
  column: number;
}
export function Position(offset: number, line: number, column: number): Position;
export function Position(src: Source): Position;
export function Position(offset: number | Source = 0, line: number = 1, column: number = 0): Position {
  function toString(this: Position) { return `:${this.line}:${this.column}` }
  if (typeof offset !== 'number') {
    column = offset.col;
    line = offset.line;
    offset = offset.offset;
  }
  const result = { offset, line, column, toString };
  return result;
}

export class ParseError extends Error {
  constructor(message: string, public loc?: SourceLocation) {
    super(ParseError.getMessage(message, loc));
    this.name = 'ParseError';
  }

  static getMessage(message: string, loc?: SourceLocation) {
    if (loc) {
      message += ` at ${loc.start.line}:${loc.start.column}`;
      if (loc.source && loc.end.offset !== loc.start.offset) {
        message += ` in ${loc.source.slice(loc.start.offset, loc.end.offset)}`;
      }
    }
    return message;
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
