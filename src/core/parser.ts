import { Token, TokenType } from "./lexer";
import { ASTNode } from "./ast";
import { EPMLSyntaxError } from "./errors";

export class Parser {
  private pos = 0;

  constructor(private tokens: Token[]) {}

  private peek(offset = 0): Token {
    if (this.pos + offset >= this.tokens.length) {
      return this.tokens[this.tokens.length - 1];
    }
    return this.tokens[this.pos + offset];
  }

  private advance(): Token {
    if (this.pos < this.tokens.length) {
      return this.tokens[this.pos++];
    }
    return this.tokens[this.tokens.length - 1];
  }

  private match(type: TokenType): Token | null {
    if (this.peek().type === type) {
      return this.advance();
    }
    return null;
  }

  private expect(type: TokenType): Token {
    const token = this.match(type);
    if (!token) {
      const current = this.peek();
      throw new EPMLSyntaxError(
        `Expected ${type} but got ${current.type} (${current.value})`,
        current.line,
        current.column,
      );
    }
    return token;
  }

  public parse(): ASTNode[] {
    const nodes: ASTNode[] = [];
    while (this.peek().type !== TokenType.EOF) {
      const node = this.parseNode();
      if (node) {
        nodes.push(node);
      }
    }
    return nodes;
  }

  private parseNode(): ASTNode | null {
    const token = this.peek();

    if (token.type === TokenType.Text) {
      this.advance();
      return {
        type: "Text",
        value: token.value,
        line: token.line,
        column: token.column,
      };
    } else if (token.type === TokenType.Variable) {
      this.advance();
      return {
        type: "Variable",
        path: token.value,
        line: token.line,
        column: token.column,
      };
    } else if (token.type === TokenType.TagOpen) {
      return this.parseElement();
    } else {
      throw new EPMLSyntaxError(
        `Unexpected token ${token.type} (${token.value})`,
        token.line,
        token.column,
      );
    }
  }

  private parseElement(): ASTNode {
    const openToken = this.expect(TokenType.TagOpen);
    const name = openToken.value;
    const attributes: Record<string, string> = {};

    // Parse attributes
    while (this.peek().type === TokenType.AttributeName) {
      const attr = this.advance();
      let value = "";
      if (this.peek().type === TokenType.AttributeValue) {
        value = this.advance().value;
      }
      attributes[attr.value] = value;
    }

    const isForLoop = name.toLowerCase() === "for";
    const isIf = name.toLowerCase() === "if";
    let children: ASTNode[] = [];

    const closeType = this.peek().type;
    if (closeType === TokenType.SelfClosingTag) {
      this.advance();
    } else if (closeType === TokenType.TagEnd) {
      this.advance();
      // Parse children until we see </name>
      while (
        this.peek().type !== TokenType.TagClose &&
        this.peek().type !== TokenType.EOF
      ) {
        const child = this.parseNode();
        if (child) children.push(child);
      }

      const closeToken = this.expect(TokenType.TagClose);
      if (closeToken.value !== name) {
        throw new EPMLSyntaxError(
          `Expected closing tag </${name}> but got </${closeToken.value}>`,
          closeToken.line,
          closeToken.column,
        );
      }
      this.expect(TokenType.TagEnd); // consume trailing >
    } else {
      throw new EPMLSyntaxError(
        `Expected > or /> after attributes for <${name}>`,
        this.peek().line,
        this.peek().column,
      );
    }

    if (isForLoop) {
      return {
        type: "ForLoop",
        itemName: attributes["each"] || "item",
        collectionPath: attributes["in"] || "",
        children: children,
        line: openToken.line,
        column: openToken.column,
      };
    }

    if (isIf) {
      return {
        type: "If",
        conditionPath: attributes["condition"] || "",
        trueBranch: children,
        line: openToken.line,
        column: openToken.column,
      };
    }

    return {
      type: "Element",
      name: name,
      attributes: attributes,
      children: children,
      line: openToken.line,
      column: openToken.column,
    };
  }
}
