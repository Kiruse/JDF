import { TokenizeError } from '@kiruse/jdf-core'
import fs from 'node:fs/promises'
import * as YAML from 'yaml'
import parse from './dist/parse.js'

const source = await fs.readFile('./assets/sample01.txt', 'utf8');

try {
  const ast = parse(source);
  await fs.writeFile('ast.yml', YAML.stringify(ast, replacer, 2));
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

function replacer(key, value) {
  if (key === 'loc') return undefined;
  if (typeof value === 'function') return undefined;
  return value;
}
