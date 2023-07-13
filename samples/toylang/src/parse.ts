import { Parser } from '@kiruse/jdf-core'
import type { ASTNode, TokenNode } from './ast.js'
import tokenize from './tokenize.js'

const parser = new Parser<ASTNode>();
const ops = parser.ops;

parser.phase(phase => {
  phase.pass(
    ops.group(ops.isToken('punct.paren.open'), ops.isToken('punct.paren.close'))(
      (left, nodes, right) => ({
        type: 'group',
        left: (left as TokenNode).token,
        right: (right as TokenNode).token,
        children: nodes,
      })
    )
  )
})

const parse = (source: string) => parser.parse(tokenize(source));
export default parse;
