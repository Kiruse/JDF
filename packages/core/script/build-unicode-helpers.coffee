fs = require 'fs/promises'

rxWS = require '@unicode/unicode-15.1.0/Binary_Property/White_Space/regex'
rxPunctuation = require '@unicode/unicode-15.1.0/General_Category/Punctuation/regex'
rxMathSymbol = require '@unicode/unicode-15.1.0/General_Category/Math_Symbol/regex'
rxNumbers = require '@unicode/unicode-15.1.0/General_Category/Number/regex'
rxLetters = require '@unicode/unicode-15.1.0/General_Category/Letter/regex'

(->
  await fs.mkdir 'src/generated', { recursive: true }
  
  await fs.writeFile 'src/generated/unicode-helpers.ts', [
    "// DO NOT EDIT THIS FILE. IT IS GENERATED IN script/build-unicode-helpers.coffee",
    "export const isWhitespace = (c: string) => /^#{rxWS.source}$/.test(c);",
    "export const isws = isWhitespace;",
    "",
    "export const isPunctuation = (c: string) => /^#{rxPunctuation.source}$/.test(c);",
    "export const isMath = (c: string) => /^#{rxMathSymbol.source}$/.test(c);",
    "export const isNumeric = (c: string) => /^#{rxNumbers.source}$/.test(c);",
    "export const isLetter = (c: string) => /^#{rxLetters.source}$/.test(c);",
  ].join '\n'
)()
