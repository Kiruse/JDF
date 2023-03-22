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
