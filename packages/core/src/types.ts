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
