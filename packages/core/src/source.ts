import { isPunctuation, isWhitespace } from "./generated/unicode-helpers.js";

export default class Source {
  #idx = 0;
  #row = 1;
  #col = 0;
  caseSensitive = true;
  
  constructor(public readonly text: string, public readonly file = '') {}
  
  /** Consume `n` characters from the underlying source code. If not possible, i.e. if less than `n`
   * characters are available, return `undefined`.
   */
  consume(n?: number): string | undefined;
  /** Attempt to consume the given string from the underlying source code. Considers
   * `Source.caseSensitive`. Returns `true` if successful, otherwise `false`.
   */
  consume(s: string): boolean;
  /** Attempt to consume a regular expression. The underlying engine will only consume code if the
   * current location starts with the matched string. Returns the matched string if successful, or
   * `undefined` if not.
   */
  consume(rx: RegExp): string | undefined;
  consume(x: number | string | RegExp = 1) {
    if (typeof x === 'number') {
      if (this.#idx + x > this.text.length) return undefined;
      return this._bumpCursor(this.text.slice(this.#idx, this.#idx + x));
    }
    if (typeof x === 'string') {
      const s = this.caseSensitive ? x : x.toLowerCase();
      
      let subtext = this.text.slice(this.#idx, this.#idx + s.length);
      if (!this.caseSensitive) subtext = subtext.toLowerCase();
      
      if (subtext !== s) {
        return false;
      } else {
        this._bumpCursor(s);
        return true;
      }
    }
    if (x instanceof RegExp) {
      const rx = normalizeRegex(x, this.caseSensitive);
      const subtext = this.text.slice(this.#idx);
      
      const [match] = subtext.match(rx) ?? [];
      if (!match || !subtext.startsWith(match)) return;
      this._bumpCursor(match);
      return match;
    }
    throw Error('Invalid argument');
  }
  consumeWS(): string | undefined {
    let result = '';
    while (!this.isEOF && isWhitespace(this.peek())) {
      result += this.consume();
    }
    if (result) return result;
  }
  /** Consume a word between two punctuations and/or whitespaces */
  consumeWord(): string | undefined;
  consumeWord(word: string): boolean;
  consumeWord(word?: string) {
    if (this.#idx > 0 && !isWhitespace(this.prev) && !isPunctuation(this.prev))
      return word ? false : undefined;
    const read = this.consumeUntil(s => isWhitespace(s.peek()) || isPunctuation(s.peek()));
    if (read) {
      return read === word;
    } else {
      return read;
    }
  }
  
  /** Consume all source until the first occurrence of `s`. */
  consumeUntil(s: string): string;
  /** Consume all source until the first match of the given `rx`. */
  consumeUntil(rx: RegExp): string;
  /** Consume all source until the predicate returns true. */
  consumeUntil(pred: (s: Source) => boolean): string;
  consumeUntil(s: string | RegExp | ((s: Source) => boolean)): string {
    if (typeof s === 'string') {
      const idx = this.text.indexOf(s, this.#idx);
      if (idx === -1) {
        return this.consume(this.text.length - this.#idx)!;
      }
      return this.consume(idx - this.#idx)!;
    }
    if (s instanceof RegExp) {
      const idx = this.text.slice(this.#idx).search(s);
      if (idx === -1) {
        return this.consume(this.text.length - this.#idx)!;
      }
      return this.consume(idx)!;
    }
    if (typeof s === 'function') {
      const clone = this.clone();
      let result = '';
      while (!this.isEOF && !s(clone.copy(this))) {
        result += this.consume()!;
      }
      return result;
    }
    throw Error('should not reach');
  }
  
  /** Returns the next `n` characters from the underlying source without altering the internal
   * cursor. May return less if the end of the source is reached.
   */
  peek(n?: number): string;
  /** Checks if the string ahead is equals to the given string. Considers `Source.caseSensitive`. */
  peek(s: string): boolean;
  peek(x: string | number = 1) {
    if (typeof x === 'string') {
      return this.text.slice(this.#idx, this.#idx + x.length) === x;
    } else {
      return this.text.slice(this.#idx, this.#idx + x);
    }
  }
  /** Peek if the string ahead is a whitespace. If `withNewlines` is true (default), it includes
   * '[\n\r]' in its consideration, otherwise only horizontal whitespaces.
   */
  peekws(withNewlines = true): boolean {
    const curr = this.peek(1);
    if (withNewlines) {
      return !!curr.match(/\s/);
    } else {
      return !!curr.match(/[ \t]/);
    }
  }
  
  /** Bump the cursor along `consumed`, tracking line & column numbers appropriately. */
  protected _bumpCursor(consumed: string): string {
    const idxLastNL = consumed.lastIndexOf('\n');
    const newlines = consumed.match(/\n/g)?.length ?? 0;
    
    this.#idx += consumed.length;
    this.#row += newlines;
    
    if (newlines) {
      this.#col = consumed.length - idxLastNL - 1;
    } else {
      this.#col += consumed.length;
    }
    
    return consumed;
  }
  
  /** Create a clone of this `Source` which can be used e.g. to backtrack. */
  clone() {
    const clone = new Source(this.text);
    clone.#idx = this.#idx;
    clone.#row = this.#row;
    clone.#col = this.#col;
    return clone;
  }
  copy(other: Source) {
    this.#idx = other.#idx;
    this.#row = other.#row;
    this.#col = other.#col;
    this.caseSensitive = other.caseSensitive;
    return this;
  }
  
  slice(start: number, end?: number) {
    if (start >= 0) {
      start += this.#idx;
    }
    if (end !== undefined && end >= 0) {
      end += this.#idx;
    }
    return this.text.slice(start, end);
  }
  
  get curr() { return this.peek() }
  get prev() { return this.text[this.#idx - 1] }
  get offset() { return this.#idx }
  get line() { return this.#row }
  get row() { return this.#row }
  get col() { return this.#col }
  get column() { return this.#col }
  get isEOF() { return this.#idx >= this.text.length }
  get isWS() { return !!this.prev.match(/\s/) }
  get isHWS() { return !!this.prev.match(/[ \t]/) }
  get isVWS() { return this.prev === '\n' }
  get remain() { return this.text.substring(this.#idx) }
  get length() { return this.text.length - this.#idx }
}

function normalizeRegex(rx: RegExp, caseSensitive: boolean) {
  let flags = rx.flags;
  flags = flags.replace(/[gi]/g, '');
  if (!caseSensitive) flags += 'i';
  return new RegExp(rx.source, flags);
}
