import { TokenizeError } from '@kiruse/jdf-core'
import chalk from 'chalk'
import fs from 'node:fs/promises'
import parse from './dist/parse.js'

const source = await fs.readFile('./assets/sample01.txt', 'utf8');

try {
  console.log(
    ...parse(source)
    .filter(n => n.type === 'group')
    .map(n => n.children)
  )
} catch (e) {
  if (e instanceof TokenizeError) {
    console.error(`Error at ${e.pos}:`, e.message);
    if (e.errors.length) {
      for (const error of e.errors) {
        console.error(error.message);
      }
    } else {
      console.error('No parsing errors, presumably a bug in the tokenizer.');
    }
  } else {
    throw e;
  }
}
