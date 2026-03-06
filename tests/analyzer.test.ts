import { test, expect } from "vitest";
import { SemanticAnalyzer } from "../src/semantic.js";
import { Parser } from "../src/parser.js";
import { Lexer } from "../src/lexer.js";

function analyze(source: string, data: any = {}, isSync = true) {
  const tokens = new Lexer(source).tokenize();
  const ast = new Parser(tokens).parse();
  const analyzer = new SemanticAnalyzer(ast, data, isSync);
  return analyzer.analyze();
}

test("SemanticAnalyzer: interpolates variables", () => {
  const ast = analyze(`Total: {{ price }}`, { price: 100 });
  expect((ast[0] as any).value + (ast[1] as any).value).toBe("Total: 100");
});

test("SemanticAnalyzer: throws on deprecated tags", () => {
  expect(() => analyze(`<b>Hello</b>`)).toThrow(/Tag <b> is deprecated/);
  expect(() => analyze(`<center>Hello</center>`)).toThrow(
    /Tag <center> is deprecated/,
  );
});

test("SemanticAnalyzer: validates row cell widths (percentage)", () => {
  // 3 * 40% = 120%
  const source = `<row><cell width="40%"/><cell width="40%"/><cell width="40%"/></row>`;
  expect(() => analyze(source)).toThrow(/Row <cell> widths exceed 100%/);
});

test("SemanticAnalyzer: validates row cell widths (absolute)", () => {
  // Default receipt width is 48.
  const source = `<row><cell width="30"/><cell width="20"/></row>`;
  expect(() => analyze(source)).toThrow(
    /Row <cell> widths exceed receipt width/,
  );
});

test("SemanticAnalyzer: throws on <image> during sync compile", () => {
  expect(() => analyze(`<image>http://x.jpg</image>`, {}, true)).toThrow(
    /Sync compile\(\) cannot process <image> tags/,
  );
});

test("SemanticAnalyzer: allows <image> during async compile", () => {
  expect(() => analyze(`<image>http://x.jpg</image>`, {}, false)).not.toThrow();
});

test("SemanticAnalyzer: validates default schemas perfectly", () => {
  const source = `<text align="right" bold="true" size="2">Aligned!</text>`;
  const ast = analyze(source);
  const el = ast[0] as any;
  expect(el.attributes.align).toBe("right");
  expect(el.attributes.bold).toBe(true);
  expect(el.attributes.size).toBe(2);
});

test("SemanticAnalyzer: handles unrolled ForLoops", () => {
  const source = `<for item="x" in="list"><text>{{ x }}</text></for>`;
  const ast = analyze(source, { list: ["A", "B", "C"] });
  expect(ast.length).toBe(3);
  expect((ast[0] as any).children[0].value).toBe("A");
});

test("SemanticAnalyzer: throws on missing required attributes (nv-image)", () => {
  // nv-image requires "n"
  expect(() => analyze(`<nv-image />`)).toThrow(
    /Missing required attribute 'n'/,
  );
});

test("SemanticAnalyzer: aliases col to cell", () => {
  const ast = analyze(`<col />`);
  expect((ast[0] as any).name).toBe("cell");
});
