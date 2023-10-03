import { Token, TokenNode } from './tokens'

export type ASTMap = {
  'token': TokenNode;
  'lit.str': {
    type: 'lit.str';
    value: string;
    token: Token;
  };
  'lit.tpl': {
    type: 'lit.tpl';
    left: Token;
    right: Token;
    children: ASTNode[];
  };
  'group': {
    type: 'group';
  };
}
export type ASTNode =
  | TokenNode
  | {
      type: 'lit.str';
      value: string;
      token: Token;
    }
  | {
      type: 'lit.tpl';
      left: Token;
      right: Token;
      children: ASTNode[];
    }
  | {
      type: 'intrp';
      left: Token;
      right: Token;
      children: ASTNode[];
    }
  | {
      type: 'group';
      left: Token;
      right: Token;
      children: ASTNode[];
    }
