import { Token, TokenType } from "./lexer.js";
import { ASTNode } from "./types.js";
import { EPMLSyntaxError } from "./errors.js";

const MAX_DEPTH = 64;

export class Parser {
  private pos = 0;

  constructor(private readonly tokens: Token[]) {}

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
    while (this.peek().type !== "EOF") {
      // The old parser had some edge cases where it didn't consume a token.
      // We start depth at 1.
      const node = this.parseNode(1);
      if (node) {
        nodes.push(node);
      } else {
        // if parseNode returns null, we should break to avoid infinite loop
        break;
      }
    }
    return nodes;
  }

  private parseNode(depth: number): ASTNode | null {
    if (depth > MAX_DEPTH) {
      const token = this.peek();
      throw new EPMLSyntaxError(
        `Maximum recursion depth (${MAX_DEPTH}) exceeded in template parsing.`,
        token.line,
        token.column,
      );
    }

    const token = this.peek();

    if (token.type === "Text") {
      this.advance();
      return {
        type: "Text",
        value: token.value,
        line: token.line,
        column: token.column,
      };
    } else if (token.type === "Variable") {
      this.advance();
      return {
        type: "Text", // Treat variables as text nodes structurally right now, or maybe interpolate them in semantic analyzer. Wait, old codebase has type Object?
        value: `{{${token.value}}}`, // we reconstruct it for the semantic analyzer
        line: token.line,
        column: token.column,
      };
    } else if (token.type === "TagOpen") {
      return this.parseElement(depth);
    } else if (token.type === "EOF") {
      return null;
    } else {
      throw new EPMLSyntaxError(
        `Unexpected token ${token.type} (${token.value})`,
        token.line,
        token.column,
      );
    }
  }

  private parseElement(depth: number): ASTNode {
    const openToken = this.expect("TagOpen");
    const name = openToken.value;
    const rawAttributes: Record<string, string> = {};

    // Parse attributes
    while (this.peek().type === "AttributeName") {
      const attr = this.advance();
      let value = ""; // Presence defaults to empty string, later treated as "true" for booleans based on schema
      if (this.peek().type === "AttributeValue") {
        value = this.advance().value;
      }
      rawAttributes[attr.value] = value;
    }

    const isForLoop = name.toLowerCase() === "for";
    const isIf = name.toLowerCase() === "if";
    let children: ASTNode[] = [];

    const closeType = this.peek().type;
    if (closeType === "SelfClosingTag") {
      this.advance();
    } else if (closeType === "TagEnd") {
      this.advance();
      // Parse children until we see </name>
      while (this.peek().type !== "TagClose" && this.peek().type !== "EOF") {
        const child = this.parseNode(depth + 1);
        if (child) children.push(child);
      }

      const closeToken = this.expect("TagClose");
      if (closeToken.value !== name) {
        throw new EPMLSyntaxError(
          `Expected closing tag </${name}> but got </${closeToken.value}>`,
          closeToken.line,
          closeToken.column,
        );
      }
      this.expect("TagEnd"); // consume trailing >
    } else {
      throw new EPMLSyntaxError(
        `Expected > or /> after attributes for <${name}>`,
        this.peek().line,
        this.peek().column,
      );
    }

    if (isForLoop) {
      if (!rawAttributes["item"] && rawAttributes["each"]) {
        rawAttributes["item"] = rawAttributes["each"]; // migrate on the fly
      }
      return {
        type: "ForLoop",
        itemName: rawAttributes["item"] || "item",
        listName: rawAttributes["in"] || "",
        children: children,
        line: openToken.line,
        column: openToken.column,
      };
    }

    if (isIf) {
      const trueBranch: ASTNode[] = [];
      const falseBranch: ASTNode[] = [];
      let inElse = false;
      for (const c of children) {
        if (c.type === "Element" && c.name.toLowerCase() === "else") {
          inElse = true;
        } else {
          if (inElse) falseBranch.push(c);
          else trueBranch.push(c);
        }
      }
      return {
        type: "If",
        condition: rawAttributes["condition"] || "",
        trueBranch,
        falseBranch,
        line: openToken.line,
        column: openToken.column,
      };
    }

    return {
      type: "Element",
      name: name,
      rawAttributes: rawAttributes,
      attributes: {}, // Will be populated by SemanticAnalyzer
      children: children,
      line: openToken.line,
      column: openToken.column,
    };
  }
}
