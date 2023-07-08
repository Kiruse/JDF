# JavaScript Dialect Framework

**Framework for the development of JavaScript dialects in pure TypeScript.**

**This framework is still an early Work in Progress.**

JDF is a biased framework/toolkit for the development of new JavaScript dialects directly in JavaScript, i.e. JavaScript-like languages which transpile to native JavaScript. While it is designed for JavaScript dialects, it could be used to develop entirely unrelated programming languages, albeit with some additional work.

**Why JDF?**
- JDF is built purely in JS. Other parser generators like ANTLR or TreeSitter require additional external dependencies; ANTLR requires a Java Runtime and TreeSitter produces OS-specific binaries.
- Your JavaScript dialect benefits of the performance of Google's V8 JavaScript engine. This saves you tremendous amounts of development time and simplifies writing e.g. a company-intern proprietary DSL.

**Why NOT JDF?**
- JavaScript is single-threaded by design, making it less efficient than parsers built in other languages like C/C++.
- JavaScript is interpreted, meaning the parser code itself also needs to be parsed by the JS runtime every time it is run. If you're looking to build an interpreted language, JavaScript is likely not your primary choice.

## Components
JDF is split into various components:

- [x] Tokenizer
- [ ] Parser
- [ ] Grammar
- [ ] AST Transformation
- [ ] Type System + Inferrencer
- [ ] Transpiler

### Tokenizer
The *Tokenizer* is currently the only technically ready feature and in field testing. Its design will change and simplifications for common tasks will be added.

*JDF* is **not a parser generator.** *JDF* is a **JavaScript framework** exposing an API to grant you extremely high control over how code is tokenized, parsed, interpreted, retargeted & transpiled. The **Tokenizer class** is thus designed to help you build *your own Tokenizer*. Like most tokenizers, *JDF's Tokenizer* is declarative - more or less.

Unlike most tokenizers, *JDF's Tokenizer* grants you the ability to directly control the source code reader, consuming characters automatically or manually based on context. For this it has 2 special features: the `TokenConsumerCallback` and the *Nested Tokenizer*. The token consumer callback receives the API object, which grants you access to the underlying source code reader directly, or to consume additional tokens as part of the current token, or to eject from the current nested tokenizer. You can specify a `nest` option when defining a token to enter a *Nested Tokenizer* when the corresponding token is consumed, effectively allowing you to completely redefine the tokenizer's behavior, similar to ANTLR's tokenizer modes.

**Example:**
```typescript
import { Err, Ok, Tokenizer } from '@kiruse/jdf-core';

const tokenizer = new Tokenizer();
tokenizer
.token('special.whitespace', /^[\t ]/)
.token('special.newline', api => {
  let consumedOne = false;
  const src = api.src.clone();
  while (true) {
    src.copy(api.src);
    api.src.consume(/^[\t ]/);
    if (!api.src.consume(/^\r\n|\n)) break;
    api.src.copy(src);
    consumedOne = true;
  }
  return consumedOne ? Ok('') : Err();
})
```

Apparently, defining a `TokenConsumerCallback` is much more verbose, but also allows you to strictly define the tokenizer's behavior for a given token, and even rollback when needed.

**Note** that by default the tokenizer rolls back when a token failed to consume. In the above example, I make use of the opposite: advancing the original underlying source reader when an iteration succeeds, because I don't want it to consume whitespaces after a newline unless those are subsequent blank lines.

# License
LGPL-3.0
