import type { Token as JDFToken, PairTokenType } from '@kiruse/jdf-core/bun'

export type Token<T extends TokenType = TokenType> = JDFToken<T>;
export type IdentToken = Token<'ident'>;
export type IndentToken = Token<'special.indent'>;

export type TokenNode = {
  type: 'token';
  token: Token;
}

export type TokenType =
  | `comment.${'single' | 'multi' | 'doc'}`
  | `kw.${'import' | 'export'}`
  | 'punct'
  | PairTokenType<`punct.${'paren' | 'brace' | 'bracket'}`>
  | 'lit.frac'
  | `lit.${'bin' | 'oct' | 'int' | 'hex'}`
  | `lit.${'float' | 'dec'}`
  | 'lit.str'
  | `tpl.${'open' | 'close' | 'str'}`
  | `tpl.intrp.${'open' | 'close'}`
  | `special.${'indent' | 'newline' | 'whitespace'}`
  | 'ident'
  | 'ws'
  | 'EOF'
