import { Err, keyword, Ok, Source, Tokenizer } from '@kiruse/jdf-core'
import { UnicodeTools } from '@kiruse/jdf-core'
import { TokenType, TokenizerModes } from './tokens.js'

const { isMath, isPunctuation } = UnicodeTools;

const tokenizer = new Tokenizer<TokenType, TokenizerModes>();
const kw = keyword.pin<TokenType, TokenizerModes>();

tokenizer
.skip('comment.single', ({ src }) => {
  if (!src.consume('//')) return Err();
  return Ok(src.consumeUntil(/[\r\n]/));
})
.skip('comment.multi', ({ src }) => {
  if (!src.consume('/*')) return Err();
  const contents = src.consumeUntil('*/');
  src.consume('*/');
  return Ok(contents);
})

.token('kw.import', kw('kw.import'))
.token('kw.export', kw('kw.export'))

.token('lit.dec', api => {
  const res = api.consume('lit.float');
  if (!res.ok) return Err(`Token 'lit.decimal' expected 'lit.float'`);
  if (!api.src.consume(/^[dD]/)) return Err(`Token 'lit.decimal' expected 'd' suffix`);
  return Ok(res.value);
})
.token('lit.float', api => {
  const { src } = api;
  let int = '', decimal = '', exp = '';

  const resInt = api.consume('lit.int');
  if (!resInt.ok) return Err(`Token 'lit.float' expected integer part`);
  int = resInt.value;

  if (src.consume('.')) {
    const resDec = api.consume('lit.int');
    if (!resDec.ok) return Err(`Token 'lit.float' expected decimal part`);
    decimal = resDec.value;
  }

  if (src.consume(/^[eE]/)) {
    const resExp = api.consume('lit.int');
    if (!resExp.ok) return Err(`Token 'lit.float' expected exponent part`);
    exp = resExp.value;
  }

  if (!decimal && !exp)
    return Err(`Token 'lit.float' expected decimal or exponent part`);
  return Ok(`${int}|${decimal}|${exp}`);
})
.token('lit.bin', /^0b[01]+/)
.token('lit.oct', /^0o[0-7]+/)
.token('lit.int', /^[0-9]+/)
.token('lit.hex', /^0x[0-9a-fA-F]+/)
.token('lit.str', api => {
  const quote = api.src.consume(/^["']/);
  if (!quote)
    return Err(`Token 'lit.string' expected a quote ['"]`);

  let contents = '';
  while (api.src.peek() !== quote) {
    let char = api.src.consume();
    // simple escaping, no special escapes
    if (char === '\\') {
      char = api.src.consume();
    }
    contents += char;
  }
  if (!api.src.consume(quote))
    return Err('Unterminated string literal');
  return Ok(contents);
})
.token('lit.tpl.open', api => {
  const { src } = api;
  if (!src.consume('`'))
    return Err(`Token 'lit.template' expected a backtick '\`'`);
  api.pushMode('tpl');
  return Ok('`');
})
.pair('punct.paren', '(', ')')
.pair('punct.brace', '{', '}')
.pair('punct.bracket', '[', ']')
.token('punct', ({ src }) => {
  let result = '';
  while (isPunctuation(src.peek()) || isMath(src.peek()))
    result += src.consume();
  return result ? Ok(result) : Err();
})

.token('special.indent', ({ src }) => {
  if (src.prev !== '\n')
    return Err(`Token 'special.indent' expected preceeding newline`);

  const indent = src.consume();
  if (!indent?.match(/[ \t]/))
    return Err(`Token 'special.indent' expected horizontal whitespace`);

  let consumed = indent;
  while (src.peek() === indent)
    consumed += src.consume();
  return Ok(consumed);
})
.token('special.newline', ({ src }) => {
  let consumed = false;
  while (true) {
    const clone = src.clone();
    clone.consume(/^[ \t]*/);
    if (!clone.consume(/^\r\n|\n/)) break;
    src.copy(clone);
    consumed = true;
  }
  return consumed ? Ok('') : Err(String.raw`Token 'special.newline' expected /\r\n|\n/`);
})
.skip('special.whitespace', /^[ \t]+/) // don't care about interspersed horizontal whitespaces
.token('ident', /^[A-Za-z_][A-Za-z0-9_]*/)

.mode('tpl', tokenizer => {
  tokenizer
  .isolate()
  .token('lit.tpl.intrp.open', api => {
    if (!api.src.consume('${')) return Err(`Token 'lit.tpl.intrp' expected '$\{'`);
    api.pushMode('intrp');
    return Ok('${');
  })
  .token('lit.tpl.str', api => {
    let result = '';
    const { src } = api;
    while (!src.peek('`') && !src.peek('${')) {
      const consumed = src.consumeUntil(/[`\\]|\$\{/);
      if (consumed) {
        result += consumed;
      }

      // currently only supports simple escaping
      if (src.peek() === '\\') {
        result += src.consume(2);
      }
    }
    return result ? Ok(result) : Err();
  })
  .token('lit.tpl.close', api => {
    if (!api.src.consume('`'))
      return Err(`Token 'lit.tpl.close' expected a backtick '\`'`);
    api.popMode();
    return Ok('`');
  })
})
.mode('intrp', tokenizer => {
  tokenizer
  .token('lit.tpl.intrp.close', api => {
    if (!api.src.consume('}'))
      return Err(`Token 'lit.tpl.intrp.close' expected a closing brace '}'`);
    api.popMode();
    return Ok('}');
  })
})
;
const tokenize = (source: string) => tokenizer.consume(new Source(source));
export default tokenize;
