import { AnyMatcher, CharsetMatcher, ChoiceMatcher, EpsilonMatcher, GroupMatcher, IGrammarMatcher, LiteralMatcher, MultipleMatcher, NegativeMatcher, RuleMatcher, SequenceMatcher } from './matchers';

const punctuation = '(){}[]<>/\\=-+*?,;:!@#$%^&~\'"`';
const identifierChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_';

/** Tagged template function for parsing rules & injecting custom grammar matchers with interpolations. */
export default function match(strings: TemplateStringsArray, ...args: IGrammarMatcher[]): IGrammarMatcher {
  const strs = strings.raw.map(s => s.trim().replace(/\s+/g, ' '));
  const mixed = zip(strs, args).flat(1).filter(Boolean);
  return new RuleParser(mixed as any[]).parse();
}

/** The result of a parsing step. */
enum ParsingResult {
  /** Indicates nothing was parsed, and that additional attempts should be made. */
  NotParsed = 0,
  /** Indicates a word was successfully parsed. */
  Parsed,
  /** Indicates we should immediately terminate further parsing. Used e.g. to terminate group parsing. */
  Terminate,
  /** Indicates that whatever was parsed affects the *next* word */
  SideEffect,
}

class RuleParser {
  #piece = 0;
  #offset = 0;
  #groupDepth = 0;
  #negate = false;
  options = {
    caseSensitive: true,
  }
  constructor(private pieces: (string | IGrammarMatcher)[]) {}
  
  parse(): IGrammarMatcher {
    // reset state
    this.#piece = 0;
    this.#offset = 0;
    this.#groupDepth = 0;
    this._normalizePieces();
    return this._parse();
  }
  
  /** Continue parsing at current piece/offset */
  protected _parse(choices = new Choices()) {
    let result = ParsingResult.NotParsed;
    while (result !== ParsingResult.Terminate && this.#piece < this.pieces.length) {
      // cannot use `this._getStringPiece()` b/c we're also trying to handle `IGrammarMatcher`s
      const piece = this.pieces[this.#piece];
      
      if (typeof piece === 'string') {
        result = this._parsePiece(choices);
      } else {
        if (this._nomNegate()) {
          choices.push(new NegativeMatcher(piece));
        } else {
          choices.push(piece);
        }
        this._nextPiece();
      }
    }
    
    return choices.build();
  }
  
  /** Parse the current piece indicated by `this.pieces[this.#piece]` */
  protected _parsePiece(choices: Choices) {
    let result = ParsingResult.NotParsed;
    while (result !== ParsingResult.Terminate && this.#offset < this._getStringPiece().length) {
      const negate = this._nomNegate();
      const c = this.char();
      if (c === ' ') {
        this.nom();
        continue;
      }
      
      result = this._parseWord(choices);
      if (result === ParsingResult.NotParsed) {
        choices.push(this._parseLiteral());
        this._parseSuffix(choices);
      }
      
      if (negate)
        choices.swapTail(tail => new NegativeMatcher(tail));
    }
    
    if (result !== ParsingResult.Terminate) {
      if (this.#offset < this._getStringPiece().length) throw Error('Expected end of piece');
      this._nextPiece();
    }
    
    return result;
  }
  
  /** Parse a thing between two whitespace breakers */
  protected _parseWord(choices: Choices): ParsingResult {
    const result = this._parsePunctuation(choices);
    if (result === ParsingResult.Parsed)
      this._parseSuffix(choices);
    return result;
  }
  
  /** Parse word-level punctuations */
  protected _parsePunctuation(choices: Choices): ParsingResult {
    const c = this.char();
    switch (c) {
      case '(':
        ++this.#groupDepth;
        this.nom();
        choices.push(new GroupMatcher(this._parse()));
        return ParsingResult.Parsed;
      case ')':
        if (!this.#groupDepth) throw Error('Unmatched closing parenthesis');
        --this.#groupDepth;
        this.nom();
        return ParsingResult.Terminate;
      case '|':
        this.nom();
        choices.pushChoice();
        return ParsingResult.Parsed;
      case "'":
      case '"':
        choices.push(this._parseLiteral(c));
        return ParsingResult.Parsed;
      case '<':
        choices.push(this._parseReference());
        return ParsingResult.Parsed;
      case '>':
        throw Error('Unmatched closing angle bracket');
      case '[':
        choices.push(this._parseCharset());
        return ParsingResult.Parsed;
      case ']':
        throw Error('Unmatched closing bracket');
      case '.':
        this.nom();
        choices.push(new AnyMatcher());
        return ParsingResult.Parsed;
      case '~':
        this.nom();
        this.#negate = true;
        return ParsingResult.SideEffect;
    }
    if (punctuation.includes(c))
      throw Error('Unexpected punctuation: ' + c);
    return ParsingResult.NotParsed;
  }
  
  protected _parseLiteral(quote?: string): LiteralMatcher {
    const piece = this._getStringPiece();
    if (quote && this.nom() !== quote)
      throw Error('Unexpected non-quote character: ' + this.prevChar());
    
    let literal = '';
    // quoted literal
    if (quote) {
      while (this.#offset < piece.length && this.char() !== quote) {
        const c = this.nom();
        
        if (c === '\\') {
          if (++this.#offset >= piece.length)
            throw Error('Unexpected end of string in literal escape');
          literal += this.char();
        }
        else {
          literal += c;
        }
      }
      
      if (this.nom() !== quote)
        throw Error(`Expected closing quote: ${quote}, got ${this.prevChar()}`);
    }
    // word literal
    else {
      while (this.#offset < piece.length && identifierChars.includes(this.char())) {
        literal += this.nom();
      }
    }
    
    return new LiteralMatcher(literal);
  }
  
  /** Parse charset (`[...]`) */
  protected _parseCharset(): CharsetMatcher {
    if (this.nom() !== '[')
      throw Error('Unexpected non-bracket character: ' + this.prevChar());
    
    const piece = this._getStringPiece();
    const start = this.#offset;
    while (this.#offset < piece.length && this.char() !== ']') {
      if (this.char() === '\\')
        ++this.#offset;
      ++this.#offset;
    }
    const end = this.#offset;
    if (this.nom() !== ']')
      throw Error('Unexpected non-bracket character: ' + this.prevChar());
    return new CharsetMatcher(piece.slice(start, end));
  }
  
  protected _parseReference(): RuleMatcher {
    const piece = this._getStringPiece();
    if (this.nom() !== '<')
      throw Error('Unexpected non-angle bracket character: ' + this.prevChar());
    
    const start = this.#offset;
    while (this.#offset < piece.length && identifierChars.includes(this.char()))
      ++this.#offset;
    const end = this.#offset;
    
    if (this.nom() !== '>')
      throw Error('Unexpected non-angle bracket character: ' + this.prevChar());
    
    return new RuleMatcher(piece.slice(start, end));
  }
  
  /** Parse suffix operators, such as multiplicities ('*', '+', '?', '{...}') */
  protected _parseSuffix(choices: Choices) {
    const c = this.char();
    switch (c) {
      case '*':
      case '+': {
        this.nom();
        let lazy = false;
        if (this.char() === '?') {
          this.nom();
          lazy = true;
        }
        choices.swapTail(tail => new MultipleMatcher(tail, c, lazy));
        return ParsingResult.Parsed;
      }
      case '?':
        this.nom();
        choices.swapTail(tail => new MultipleMatcher(tail, '?'));
        return ParsingResult.Parsed;
      case '{':
        this._parseCurlySuffix(choices);
        return ParsingResult.Parsed;
    }
    return ParsingResult.NotParsed;
  }
  
  /** Parse curly braces suffix. Currently only `{min}`, `{min, max}`, and `{,max}` */
  protected _parseCurlySuffix(choices: Choices) {
    const matches = this.match(/\{\s*(\d+,?|\d*\s*,\s*\d+)\s*?\}/);
    if (!matches) throw Error('Invalid curly brace multiplicity syntax');
    
    let min: number, max: number;
    if (matches[1].includes(',')) {
      [min = 0, max = Infinity] = matches[1].split(',').map(s => s.trim()).map(s => s ? parseInt(s) : undefined);
    } else {
      min = max = parseInt(matches[1]);
    }
    if (isNaN(min) || isNaN(max))
      throw Error('Invalid multiplicity min/max');
    
    choices.swapTail(tail => new MultipleMatcher(tail, {min, max}));
    this.#offset += matches[0].length;
  }
  
  /** Advance to the `n`th next piece & reset internal offset */
  protected _nextPiece() {
    ++this.#piece;
    this.#offset = 0;
    return this;
  }
  
  startsWith(s: string) {
    if (this.options.caseSensitive)
      s = s.toLowerCase();
    return this._getStringPiece().startsWith(s, this.#offset);
  }
  
  match(pattern: RegExp) {
    pattern = normalizeRegex(this.options.caseSensitive, pattern);
    return pattern.exec(this._getStringPiece().slice(this.#offset));
  }
  
  protected _normalizePieces() {
    this.pieces = this.pieces.map(p => {
      if (typeof p !== 'string') return p;
      p = p.trim().replace(/\s+/g, ' ');
      if (!this.options.caseSensitive)
        p = p.toLowerCase();
      return p;
    });
  }
  
  protected _getStringPiece(): string {
    const piece = this.pieces[this.#piece];
    if (typeof piece !== 'string') throw Error('Not a string piece');
    return piece;
  }
  
  protected char() { return this._getStringPiece()[this.#offset] }
  protected prevChar() { return this._getStringPiece()[this.#offset-1] }
  protected nom() { return this._getStringPiece()[this.#offset++] }
  protected _nomNegate() {
    const neg = this.#negate;
    this.#negate = false;
    return neg;
  }
}

/** Helper class for building a ChoiceMatcher from string rep */
class Choices {
  constructor(public matchers: IGrammarMatcher[][] = [[]]) {}
  
  /** Pushes the given `items` to the last  */
  push(...items: IGrammarMatcher[]) {
    this.matchers[this.matchers.length-1].push(...items);
    return this;
  }
  
  pushChoice() {
    this.matchers.push([]);
    return this;
  }
  
  swapTail(cb: (tail: IGrammarMatcher) => IGrammarMatcher) {
    const group = this.matchers[this.matchers.length-1];
    group[group.length-1] = cb(group[group.length-1]);
    return this;
  }
  
  build() {
    return deflateMatcher(
      new ChoiceMatcher(
        this.matchers
          .filter(m => Boolean(m.length))
          .map(m => deflateMatcher(new SequenceMatcher(m)))
      )
    );
  }
}

const zip = <L, R>(lhs: L[], rhs: R[]): [L | undefined, R | undefined][] => lhs.map((l, i) => [l, rhs[i]]);
function normalizeRegex(caseSensitive: boolean, pattern: RegExp): RegExp {
  let source = pattern.source;
  if (!source.startsWith('^')) source = '^' + source;
  return new RegExp(source, caseSensitive ? '' : 'i');
}

/** For `ChoiceMatcher`s & `SequenceMatcher`s, returns their first child if it's their only.
 * If they have no children, return the EpsilonMatcher.
 * For all other matchers, returns the matcher itself.
 */
function deflateMatcher(matcher: IGrammarMatcher): IGrammarMatcher {
  if (matcher instanceof SequenceMatcher || matcher instanceof ChoiceMatcher) {
    if (matcher.matchers.length === 0)
      return EpsilonMatcher.instance;
    if (matcher.matchers.length === 1)
      return deflateMatcher(matcher.matchers[0]);
  }
  return matcher;
}