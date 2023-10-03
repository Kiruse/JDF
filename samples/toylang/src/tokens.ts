import type { Token as JDFToken, PairTokenType } from '@kiruse/jdf-core'

export type Token<T extends TokenType = TokenType> = JDFToken<T>;
export type IdentToken = Token<'ident'>;
export type IndentToken = Token<'special.indent'>;

export type TokenNode = {
  type: 'token';
  token: Token;
}

export type TokenizerModes =
  | 'root' // default tokenizer mode
  | 'tpl' // string template literal mode
  | 'intrp'

export type TokenType =
  | `comment.${'single' | 'multi' | 'doc'}`
  | `kw.${'import' | 'export'}`
  | 'punct'
  | PairTokenType<`punct.${'paren' | 'brace' | 'bracket'}`>
  | 'lit.frac'
  | `lit.${'bin' | 'oct' | 'int' | 'hex'}`
  | `lit.${'float' | 'dec'}`
  | 'lit.str'
  | `lit.tpl.${'open' | 'close' | `intrp.${'open' | 'close'}` | 'str'}`
  | `special.${'indent' | 'newline' | 'whitespace'}`
  | 'ident'
  | 'ws'
  | 'EOF'
