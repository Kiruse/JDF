import type Source from './source.js'

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
