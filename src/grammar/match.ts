import { isPunctuation, isWhitespace } from '../generated/unicode-helpers';
import Source from '../source'
import * as Matchers from './matchers';
import { Matcher } from './matchers';
import { CharCodeRange } from './ranges';

export default function match(strings: TemplateStringsArray, ...values: any[]) {
  return parseOptions(new TaggedSource(strings, values));
}

match.raw = (strings: TemplateStringsArray, ...values: any[]) => parseOptions(new TaggedSource(strings.raw, values))

class TaggedSource {
  #strings: string[] = [];
  #values: object[] = [];
  // even = strings, odd = values
  #idx = 0;
  // if curr is string, it's wrapped in a `Source`, otherwise it's stored directly
  #curr: any = undefined;
  constructor(strings: readonly string[], values: any[]) {
    [this.#strings, this.#values] = this._normalize(strings.slice(), values.slice());
    this.#curr = this._getCurr();
  }
  
  protected _normalize(strings: string[], values: any[]): [string[], object[]] {
    if (strings.length !== values.length + 1)
      throw Error('Invalid array sizes');
    
    for (let i = 0; i < strings.length-1; ++i) {
      if (typeof values[i] !== 'object') {
        strings[i] += values[i] + strings[i+1];
        strings.splice(i+1, 1);
        values.splice(i, 1);
        --i;
      }
    }
    
    if (strings.length !== values.length + 1)
      throw Error('Invalid array sizes');
    return [strings, values];
  }
  
  next() {
    ++this.#idx;
    this.#curr = this._getCurr();
    return this;
  }
  reset() {
    this.#idx = 0;
    this.#curr = undefined;
    return this;
  }
  protected _getCurr = () => this.#idx % 2 === 0 ? new Source(this.strings[this.#idx / 2]) : this.values[(this.#idx-1) / 2];
  get curr() { return this.#curr }
  get done() {
    return this.#idx === this.strings.length;
  }
  get strings() { return this.#strings.slice() }
  get values() { return this.#values.slice() }
  get cursor() { return this.#idx }
}

function parseOptions(src: TaggedSource, nested = false): Matcher {
  let options: Matcher[][] = [];
  let sequence: Matcher[] = [];
  let cap = '';
  let closenested = false;
  
  const pushCap = () => {
    if (cap.length) sequence.push(Matchers.literal(cap));
    cap = '';
  }
  const pushSeq = () => {
    if (sequence.length) options.push(sequence);
    sequence = [];
  }
  
  while (!src.done && !closenested) {
    const curr = src.curr;
    if (curr instanceof Source) {
      if (curr.isEOF) {
        pushCap();
        src.next();
        continue;
      }
      
      let char = curr.peek();
      switch (char) {
        case '(':
          pushCap();
          curr.consume();
          sequence.push(parseOptions(src, true));
          if (curr.consume() !== ')')
            throw Error('Expected group close ")"');
          break;
        case ')':
          pushCap();
          if (nested) closenested = true;
          else throw Error('Unexpected group close ")"');
          break;
        case '*':
        case '+':
        case '?':
        case '{': {
          pushCap();
          const [min, max] = parseRepeat(curr);
          const last = sequence.pop();
          if (!last) throw Error('Nothing to repeat');
          sequence.push(Matchers.repeat(last, min, max));
          break;
        }
        case '|':
          curr.consume();
          pushCap();
          pushSeq();
          break;
        case '\\':
          const escaped = parseEscape(curr);
          cap += escaped;
          break;
        case '"':
        case "'":
          pushCap();
          sequence.push(parseLiteral(curr, char));
          break;
        case '`':
          throw Error('Backtick literals not yet implemented');
        case '<':
          throw Error('Captures not yet implemented');
        case '[':
          pushCap();
          sequence.push(parseRange(curr));
          break;
        case '.':
          pushCap();
          curr.consume();
          sequence.push(Matchers.any());
          break;
        default:
          if (isPunctuation(char)) {
            throw Error(`Unexpected punctuation "${char}"`);
          } else if (isWhitespace(char)) {
            pushCap();
            curr.consume();
          } else {
            cap += curr.consume();
          }
      }
    } else {
      if (isMatcher(curr))
        sequence.push(curr);
      else
        throw Error(`Unsupported argument ${curr}`);
      src.next();
    }
  }
  
  pushCap();
  pushSeq();
  
  switch (options.length) {
    case 0: throw Error('Empty match string');
    case 1: return Matchers.chain(options[0]);
    default: return Matchers.options(options.map(opt => Matchers.chain(opt)));
  }
}

function parseLiteral(src: Source, quote: string): Matcher {
  if (!quote) throw Error('Missing quote');
  if (!src.consume(quote)) throw Error(`Expected quote begin "${quote}"`);
  
  let cap = '';
  while (!src.isEOF && src.peek(quote.length) !== quote) {
    if (src.peek() === '\\') cap += parseEscape(src);
    else cap += src.consume();
  }
  
  if (!src.consume(quote)) throw Error(`Expected quote end "${quote}"`);
  return Matchers.literal(cap);
}

function parseRepeat(src: Source): [number, number] {
  let char = src.consume();
  switch (char) {
    case '*': return [0, Infinity];
    case '+': return [1, Infinity];
    case '?': return [0, 1];
    case '{': {
      const range = src.consumeUntil('}', false);
      if (!range) throw Error('Expected repeat range');
      if (src.consume() !== '}') throw Error('Expected repeat close "}"');
      if (!range.trim()) throw Error('Empty repeat range');
      
      const matches = range.match(/^(\d+)?\w*(,\w*(\d+))?$/);
      if (!matches) throw Error('Invalid repeat range');
      
      const min = matches[1] ? parseInt(matches[1]) : 0;
      const max = matches[3] ? parseInt(matches[3]) : Infinity;
      if (isNaN(min) || isNaN(max)) throw Error(`Invalid repeat range ${range}`);
      return [min, max];
    }
    default: throw Error("Expected repeat character");
  }
}

function parseEscape(src: Source): string {
  if (!src.consume('\\')) throw Error('Expected escape character "\\"');
  
  let char = src.consume();
  if (!char) throw Error('Unexpected end of string');
  
  const consumeHex = (n: number) => {
    const hex = parseInt(src.consume(n)!, 16);
    if (isNaN(hex)) throw Error('Invalid hex escape');
    return hex;
  }
  
  switch (char) {
    case '0': return '\0';
    case 'a': return '\a';
    case 'b': return '\b';
    case 'f': return '\f';
    case 'n': return '\n';
    case 'r': return '\r';
    case 't': return '\t';
    case 'v': return '\v';
    case 'x': return String.fromCharCode(consumeHex(2));
    case 'X': return String.fromCharCode(consumeHex(4));
    case 'u': return String.fromCharCode(consumeHex(4));
    case 'U': {
      const hex = consumeHex(8);
      if (hex > 0x10FFFF) throw Error('Unicode escape out of range');
      return String.fromCharCode(hex);
    }
    default:  return char;
  }
}

function parseRange(src: Source): Matcher {
  if (!src.consume('[')) throw Error('Expected range open "["');
  
  const ranges: CharCodeRange[] = [];
  
  const consumeChar = (src: Source) => {
    const char = src.peek();
    switch (char) {
      case '\\': return parseEscape(src);
      case '-':
      case ']': return undefined;
      default: return src.consume()!;
    }
  }
  
  while (!src.isEOF && src.peek() !== ']') {
    // special case to include - in range, e.g. [a-z-]
    if (src.peek(2) === '-]') {
      ranges.push(CharCodeRange('-'))
      src.consume();
      break;
    }
    
    const char = consumeChar(src);
    if (!char) throw Error(`Unexpected range character "${char}"`);
    const lookahead = src.clone();
    
    if (lookahead.consume('-')) {
      const end = consumeChar(lookahead);
      // semi-special case, e.g. [a-z_-]
      if (end === undefined) {
        ranges.push(CharCodeRange(char));
        ranges.push(CharCodeRange('-'));
      } else {
        ranges.push(CharCodeRange(char, end));
      }
      
      src.consume();
      consumeChar(src);
    } else {
      ranges.push(CharCodeRange(char));
    }
  }
  
  ranges.sort((a, b) => a.begin - b.begin);
  for (let i = 0; i < ranges.length - 1; ++i) {
    if (ranges[i+1].begin <= ranges[i].end+1) {
      ranges[i].end = Math.max(ranges[i].end, ranges[i+1].end);
      ranges.splice(i+1, 1);
      --i;
    }
  }
  
  if (!src.consume(']')) throw Error('Expected range close "]"');
  if (!ranges.length) throw Error('Empty range');
  return Matchers.ranges(ranges);
}

const isMatcher = (v: any): v is Matcher => v && typeof v === 'object' && typeof v.toSubGraph === 'function';
