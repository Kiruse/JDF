import type { Token as JDFToken } from '@kiruse/jdf-core'

export type Token<T extends TokenType = TokenType> = JDFToken<T>;
export type IdentToken = Token<'ident'>;
export type IndentToken = Token<'special.indent'>;

export type TokenizerModes =
  | 'root' // default tokenizer mode
  | 'tpl' // string template literal mode
  | 'intrp'

export type TokenType =
  | CommentTokenType
  | KeywordTokenType
  | PunctuationTokenType
  | LiteralTokenType
  | SpecialTokenType
  | 'ident'
  | 'ws'
  | 'EOF'

export type CommentTokenType = 'comment.single' | 'comment.multi' | 'comment.doc';

export type KeywordTokenType =
  | `kw.${'import' | 'export'}`

export type PunctuationTokenType =
  | 'punct'
  | `punct.${'paren' | 'brace' | 'bracket'}.${'open' | 'close'}`

export type LiteralTokenType =
  | 'lit.frac'
  | `lit.${'bin' | 'oct' | 'int' | 'hex'}`
  | `lit.${'float' | 'dec'}`
  | `lit.str`
  | `lit.tpl.${'open' | 'close' | `intrp.${'open' | 'close'}` | 'str'}`

export type SpecialTokenType =
  | 'special.indent'
  | 'special.newline'
  | 'special.whitespace'
