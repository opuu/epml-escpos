import { EPMLSyntaxError } from "./errors";

export enum TokenType {
  TagOpen = "TagOpen", // <name
  TagClose = "TagClose", // </name>
  TagEnd = "TagEnd", // >
  SelfClosingTag = "SelfClosingTag", // />
  AttributeName = "AttributeName",
  AttributeValue = "AttributeValue",
  Text = "Text",
  Variable = "Variable", // {{ var }}
  EOF = "EOF",
}

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}

export class Lexer {
  private pos = 0;
  private line = 1;
  private col = 1;

  constructor(private input: string) {}

  private peek(offset = 0): string {
    return this.pos + offset < this.input.length
      ? this.input[this.pos + offset]
      : "";
  }

  private advance(): string {
    if (this.pos >= this.input.length) return "";
    const char = this.input[this.pos++];
    if (char === "\n") {
      this.line++;
      this.col = 1;
    } else {
      this.col++;
    }
    return char;
  }

  private skipWhitespace() {
    while (/\s/.test(this.peek())) {
      this.advance();
    }
  }

  public tokenize(): Token[] {
    const tokens: Token[] = [];
    let inTag = false;

    while (this.pos < this.input.length) {
      if (!inTag) {
        if (
          this.peek() === "<" &&
          this.peek(1) === "!" &&
          this.peek(2) === "-" &&
          this.peek(3) === "-"
        ) {
          // Consume HTML comment <!-- ... -->
          this.advance();
          this.advance();
          this.advance();
          this.advance();
          while (
            this.pos < this.input.length &&
            !(
              this.peek() === "-" &&
              this.peek(1) === "-" &&
              this.peek(2) === ">"
            )
          ) {
            this.advance();
          }
          if (this.pos < this.input.length) {
            this.advance();
            this.advance();
            this.advance();
          }
          continue;
        } else if (this.peek() === "<") {
          const startLine = this.line;
          const startCol = this.col;
          this.advance(); // consume '<'

          if (this.peek() === "/") {
            this.advance(); // consume '/'
            let name = "";
            while (
              this.pos < this.input.length &&
              /[a-zA-Z0-9_\-]/.test(this.peek())
            ) {
              name += this.advance();
            }
            tokens.push({
              type: TokenType.TagClose,
              value: name,
              line: startLine,
              column: startCol,
            });
            inTag = true;
          } else {
            let name = "";
            while (
              this.pos < this.input.length &&
              /[a-zA-Z0-9_\-]/.test(this.peek())
            ) {
              name += this.advance();
            }
            if (name) {
              tokens.push({
                type: TokenType.TagOpen,
                value: name,
                line: startLine,
                column: startCol,
              });
              inTag = true;
            } else {
              tokens.push({
                type: TokenType.Text,
                value: "<",
                line: startLine,
                column: startCol,
              });
            }
          }
        } else if (this.peek() === "{" && this.peek(1) === "{") {
          const startLine = this.line;
          const startCol = this.col;
          this.advance();
          this.advance(); // consume '{{'

          let v = "";
          while (
            this.pos < this.input.length &&
            !(this.peek() === "}" && this.peek(1) === "}")
          ) {
            v += this.advance();
          }
          if (this.peek() === "}" && this.peek(1) === "}") {
            this.advance();
            this.advance(); // consume '}}'
          } else {
            throw new EPMLSyntaxError(
              "Unclosed variable expression '{{'",
              startLine,
              startCol,
            );
          }
          tokens.push({
            type: TokenType.Variable,
            value: v.trim(),
            line: startLine,
            column: startCol,
          });
        } else {
          const startLine = this.line;
          const startCol = this.col;
          let text = "";
          while (
            this.pos < this.input.length &&
            this.peek() !== "<" &&
            !(this.peek() === "{" && this.peek(1) === "{")
          ) {
            text += this.advance();
          }
          if (text.length > 0) {
            tokens.push({
              type: TokenType.Text,
              value: text,
              line: startLine,
              column: startCol,
            });
          }
        }
      } else {
        this.skipWhitespace();

        if (this.pos >= this.input.length) break;

        const startLine = this.line;
        const startCol = this.col;

        if (this.peek() === "/" && this.peek(1) === ">") {
          this.advance();
          this.advance();
          tokens.push({
            type: TokenType.SelfClosingTag,
            value: "/>",
            line: startLine,
            column: startCol,
          });
          inTag = false;
        } else if (this.peek() === ">") {
          this.advance();
          tokens.push({
            type: TokenType.TagEnd,
            value: ">",
            line: startLine,
            column: startCol,
          });
          inTag = false;
        } else if (/[a-zA-Z0-9_\-]/.test(this.peek())) {
          let attrName = "";
          while (
            this.pos < this.input.length &&
            /[a-zA-Z0-9_\-]/.test(this.peek())
          ) {
            attrName += this.advance();
          }
          tokens.push({
            type: TokenType.AttributeName,
            value: attrName,
            line: startLine,
            column: startCol,
          });

          this.skipWhitespace();

          if (this.peek() === "=") {
            this.advance();
            this.skipWhitespace();

            const quote =
              this.peek() === '"' || this.peek() === "'" ? this.advance() : "";
            const valLine = this.line;
            const valCol = this.col;
            let attrVal = "";

            if (quote) {
              while (this.pos < this.input.length && this.peek() !== quote) {
                attrVal += this.advance();
              }
              if (this.pos < this.input.length) this.advance();
            } else {
              while (
                this.pos < this.input.length &&
                !/[\s>/]/.test(this.peek())
              ) {
                attrVal += this.advance();
              }
            }
            tokens.push({
              type: TokenType.AttributeValue,
              value: attrVal,
              line: valLine,
              column: valCol,
            });
          }
        } else {
          this.advance(); // skip unexpected char inside tag to prevent loop
        }
      }
    }

    tokens.push({
      type: TokenType.EOF,
      value: "",
      line: this.line,
      column: this.col,
    });
    return tokens;
  }
}
