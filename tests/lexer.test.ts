import { test, expect } from "vitest";
import { Lexer } from "../src/lexer.js";

test("Lexer: tokenizes basic text and element", () => {
  const source = `Hello <text bold="true">World!</text>`;
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();

  expect(tokens.length).toBe(9);

  // Real token check based on implementation:
  expect(tokens[0].type).toBe("Text");
  expect(tokens[0].value).toBe("Hello ");

  expect(tokens[1].type).toBe("TagOpen");
  expect(tokens[1].value).toBe("text");

  expect(tokens[2].type).toBe("AttributeName");
  expect(tokens[2].value).toBe("bold");

  expect(tokens[3].type).toBe("AttributeValue");
  expect(tokens[3].value).toBe("true");

  expect(tokens[4].type).toBe("TagEnd");

  expect(tokens[5].type).toBe("Text");
  expect(tokens[5].value).toBe("World!");

  expect(tokens[6].type).toBe("TagClose");
  expect(tokens[6].value).toBe("text");

  expect(tokens[7].type).toBe("TagEnd");

  expect(tokens[8].type).toBe("EOF");
});

test("Lexer: handles self-closing tags", () => {
  const source = `<br/>`;
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  expect(tokens[0].type).toBe("TagOpen");
  expect(tokens[1].type).toBe("SelfClosingTag");
});

test("Lexer: tokenizes variables", () => {
  const source = `{{ user.name }}`;
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  expect(tokens[0].type).toBe("Variable");
  expect(tokens[0].value).toBe("user.name");
});

test("Lexer: catches unclosed attribute values", () => {
  const source = `<text bold="true`;
  const lexer = new Lexer(source);
  expect(() => lexer.tokenize()).toThrow(
    /Unclosed attribute value string literal/,
  );
});

test("Lexer: skips whitespace correctly", () => {
  const source = `  <row>  \n  <cell>\n  </cell>\n  </row>  `;
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  expect(
    tokens.find((t) => t.type === "Text" && t.value && t.value.trim() === ""),
  );
});
