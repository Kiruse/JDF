import { Parser } from '@kiruse/jdf-core'
import type { ASTNode, TokenNode } from './ast.js'
import tokenize from './tokenize.js'

const parser = new Parser<ASTNode>();
const ops = parser.ops;

parser.phase(phase => {
  phase.pass(
    ops.replace(ops.isToken('lit.str'))(node => ({
      type: 'lit.str',
      value: (node as any).token.value,
      token: (node as any).token,
    }))
  )
})
parser.phase(phase => {
  phase.pass(
    ops.group(ops.isToken('lit.tpl.intrp.open'), ops.isToken('lit.tpl.intrp.close'))(
      (left, nodes, right) => ({
        type: 'intrp',
        left: (left as any).token,
        right: (right as any).token,
        children: nodes,
      })
    )
  )
  phase.pass(
    ops.group(ops.isToken('lit.tpl.open'), ops.isToken('lit.tpl.close'))(
      (left, nodes, right) => ({
        type: 'lit.tpl',
        left: (left as any).token,
        right: (right as any).token,
        children: nodes as any,
      })
    )
  )
  phase.pass(
    ops.group(ops.isToken('punct.paren.open'), ops.isToken('punct.paren.close'))(
      (left, nodes, right) => ({
        type: 'group',
        left: (left as any).token,
        right: (right as any).token,
        children: nodes,
      })
    )
  )
})

const parse = (source: string) => parser.parse(tokenize(source));
export default parse;
