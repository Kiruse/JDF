import { Parser } from '@kiruse/jdf-core/bun'
import type { ASTNode } from './ast';
import tokenize from './tokenize'

const parser = new Parser<ASTNode>();
const { group, isToken, replace } = parser.ops;

parser.phase(({ pass }) => {
  pass(replace(isToken('lit.str'))(
    (node) => ({
      type: 'lit.str',
      value: node.token.value,
      token: node.token,
    })
  ));
  pass(replace(isToken('tpl.str'))(
    (node) => ({
      type: 'lit.str',
      value: node.token.value,
      token: node.token,
    })
  ));
})
parser.phase(({ pass }) => {
  pass(
    group(
      isToken('tpl.intrp.open'),
      isToken('tpl.intrp.close'),
      { recursive: true },
    )((left, nodes, right) => ({
      type: 'intrp',
      left: left.token,
      right: right.token,
      children: nodes,
    }))
  );
  pass(
    group(
      isToken('tpl.open'),
      isToken('tpl.close'),
      { recursive: true },
    )((left, nodes, right) => ({
      type: 'lit.tpl',
      left: left.token,
      right: right.token,
      children: nodes,
    }))
  );
  pass(
    group(
      isToken('punct.paren.open'),
      isToken('punct.paren.close'),
      { recursive: true },
    )((left, nodes, right) => ({
      type: 'group',
      left: left.token,
      right: right.token,
      children: nodes,
    }))
  );
})

const parse = (source: string) => parser.parse(tokenize(source));
export default parse;
