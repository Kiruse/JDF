import type { Token, IdentToken as Ident, IndentToken as Indent } from './tokens.js'

export type ASTType = ASTNode['type']
export type ASTNode =
  | ExprNode
  | TokenNode

export type RootNode =
  | ImportNode
  | ExportNode
  | ExprNode

export interface ImportNode {
  type: 'import';
  // TODO
}

export interface ExportNode {
  type: 'export';
  // TODO
}

export type ExprNode =
  | BlockNode
  | GroupNode
  | BinOpNode
  | AssignNode
  | FnCallNode
  | TypeAssertNode

export interface BlockNode {
  type: 'block';
  stmts: ExprNode[];
}

export interface GroupNode {
  type: 'group';
  left: Token;
  right: Token;
  children: ASTNode[];
}

export interface BinOpNode {
  type: 'binop';
  op: Token<'punct'>;
  lhs: ExprNode;
  rhs: ExprNode;
}

export interface AssignNode {
  type: 'assign';
  op: Token<'punct'>;
  lhs: ExprNode;
  rhs: ExprNode;
}

export interface FnCallNode {
  type: 'fn-call';
  name: Ident;
  args: ExprNode[];
}

export interface TypeAssertNode {
  type: 'type-assert';
  lhs: ExprNode;
  rhs: ExprNode;
}

export interface TokenNode {
  type: 'token';
  token: Token;
}
