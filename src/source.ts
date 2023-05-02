export default class Source {
  #idx = 0;
  #row = 1;
  #col = 0;
  #textlc: string;
  
  constructor(public readonly text: string, public readonly file = '') {
    this.#textlc = text.toLowerCase();
  }
  
  /** Consume `n` characters from the underlying source code. If not possible, i.e. if `<n`
   * characters are available, return `undefined`.
   */
  consume(n?: number): string | undefined;
  /** Attempt to consume the given string from the underlying source code, optionally ignoring case.
   * Returns `true` if successful, otherwise false.
   */
  consume(s: string, caseInsensitive?: boolean): boolean;
  consume(n: number | string = 1, caseInsensitive = false) {
    if (typeof n === 'number') {
      if (this.#idx + n > this.text.length) return undefined;
      return this._bumpCursor(this.text.slice(this.#idx, this.#idx += n));
    } else {
      const s = caseInsensitive ? n.toLowerCase() : n;
      
      const text = caseInsensitive ? this.#textlc : this.text;
      if (!text.startsWith(s, this.#idx)) return false;
      this.#idx += s.length;
      this._bumpCursor(s);
      return true;
    }
  }
  
  consumeUntil(s: string, withEOF: true): string;
  consumeUntil(s: string, withEOF?: false): string | undefined;
  consumeUntil(s: string, withEOF = false) {
    const idx = this.text.indexOf(s, this.#idx);
    if (idx === -1) {
      if (withEOF) return undefined;
      return this.consume(this.text.length - this.#idx);
    }
    return this.consume(idx - this.#idx);
  }
  
  /** Returns the next `n` characters from the underlying source without altering the internal
   * cursor. May return less if the end of the source is reached.
   */
  peek(n = 1): string {
    return this.text.slice(this.#idx, this.#idx + n);
  }
  
  /** Bump the cursor along `consumed`, tracking line & column numbers appropriately. */
  protected _bumpCursor(consumed: string): string {
    const lines = consumed.split('\n');
    this.#row += lines.length - 1;
    if (lines.length > 1) {
      this.#col = lines[lines.length - 1].length;
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
  
  get line() { return this.#row }
  get row() { return this.#row }
  get col() { return this.#col }
  get isEOF() { return this.#idx >= this.text.length }
}
