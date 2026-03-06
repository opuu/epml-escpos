import { test, expect } from "vitest";
import { Parser } from "../src/parser.js";
import { Lexer } from "../src/lexer.js";

function parseAST(source: string) {
  const tokens = new Lexer(source).tokenize();
  return new Parser(tokens).parse();
}

test("Parser: constructs elements with attributes", () => {
  const ast = parseAST(`<text align="center" size="2">Header</text>`);
  expect(ast.length).toBe(1);
  const root = ast[0] as any;
  expect(root.type).toBe("Element");
  expect(root.name).toBe("text");
  expect(root.rawAttributes["align"]).toBe("center");
  expect(root.rawAttributes["size"]).toBe("2");
  expect(root.children.length).toBe(1);
  expect(root.children[0].type).toBe("Text");
  expect(root.children[0].value).toBe("Header");
});

test("Parser: parses self-closing tags", () => {
  const ast = parseAST(`<hr/>`);
  expect(ast.length).toBe(1);
  expect((ast[0] as any).type).toBe("Element");
  expect((ast[0] as any).name).toBe("hr");
  expect((ast[0] as any).children.length).toBe(0);
});

test("Parser: catches mismatched tags", () => {
  expect(() => parseAST(`<text></row>`)).toThrow(/Expected closing tag/);
});

test("Parser: parses ForLoops", () => {
  const ast = parseAST(`<for item="x" in="items"><text>{{ x }}</text></for>`);
  expect(ast.length).toBe(1);
  const loop = ast[0] as any;
  expect(loop.type).toBe("ForLoop");
  expect(loop.itemName).toBe("x");
  expect(loop.listName).toBe("items");
  expect(loop.children[0].type).toBe("Element");
});

test("Parser: parses If conditions", () => {
  const ast = parseAST(
    `<if condition="show"><text>Yes</text><else/><text>No</text></if>`,
  );
  expect(ast.length).toBe(1);
  const ifNode = ast[0] as any;
  expect(ifNode.type).toBe("If");
  expect(ifNode.condition).toBe("show");
  expect(ifNode.trueBranch[0].type).toBe("Element");
  expect(ifNode.falseBranch[0].type).toBe("Element");
});

test("Parser: respects MAX_DEPTH", () => {
  const deeplyNested = `<text>`.repeat(65) + `A` + `</text>`.repeat(65);
  expect(() => parseAST(deeplyNested)).toThrow(/Maximum recursion depth/);
});
