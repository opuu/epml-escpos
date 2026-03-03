export type ASTNode =
  | ElementNode
  | TextNode
  | VariableNode
  | ForLoopNode
  | IfNode
  | RawNode;

export interface ElementNode {
  type: "Element";
  name: string;
  attributes: Record<string, string>;
  children: ASTNode[];
  line: number;
  column: number;
}

export interface TextNode {
  type: "Text";
  value: string;
  line: number;
  column: number;
}

export interface VariableNode {
  type: "Variable";
  path: string;
  line: number;
  column: number;
}

export interface ForLoopNode {
  type: "ForLoop";
  itemName: string;
  collectionPath: string;
  children: ASTNode[];
  line: number;
  column: number;
}

export interface IfNode {
  type: "If";
  conditionPath: string;
  trueBranch: ASTNode[];
  falseBranch?: ASTNode[];
  line: number;
  column: number;
}

export interface RawNode {
  type: "Raw";
  data: Uint8Array;
  line: number;
  column: number;
}
