export class EPMLSyntaxError extends Error {
  constructor(
    message: string,
    public line: number,
    public column: number,
  ) {
    super(`Syntax Error at line ${line}, col ${column}: ${message}`);
    this.name = "EPMLSyntaxError";
  }
}

export class EPMLSemanticError extends Error {
  constructor(
    message: string,
    public line: number,
    public column: number,
  ) {
    super(`Semantic Error at line ${line}, col ${column}: ${message}`);
    this.name = "EPMLSemanticError";
  }
}
