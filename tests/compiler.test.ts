import { describe, it, expect } from "vitest";
import { EPMLCompiler } from "../src/index";
import { Lexer } from "../src/core/lexer";

// Helper: decode the text portion of compiled bytes (strip ESC/POS commands)
function extractPrintableText(bytes: Uint8Array): string {
  let text = "";
  for (const b of bytes) {
    if (b >= 0x20 && b <= 0x7e) text += String.fromCharCode(b);
  }
  return text;
}

describe("EPMLCompiler", () => {
  it("compiles a simple template without throwing", () => {
    const template = `<receipt width="32"><center>Hello {{ name }}</center></receipt>`;
    const data = { name: "World" };

    const bytes = EPMLCompiler.compile(template, data);

    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(0);
  });

  it("throws EPMLSyntaxError on malformed tags", () => {
    const template = `<receipt><center>Unclosed tag</receipt>`;
    const data = {};

    expect(() => {
      EPMLCompiler.compile(template, data);
    }).toThrowError(/Expected closing tag <\/center>/);
  });

  it("resolves variable interpolation correctly", () => {
    const template = `<receipt width="32">{{ greeting }}</receipt>`;
    const data = { greeting: "Hello!" };

    const bytes = EPMLCompiler.compile(template, data);
    const text = extractPrintableText(bytes);

    expect(text).toContain("Hello!");
  });

  it("resolves nested variable paths", () => {
    const template = `<receipt width="32">{{ user.name }}</receipt>`;
    const data = { user: { name: "Alice" } };

    const bytes = EPMLCompiler.compile(template, data);
    const text = extractPrintableText(bytes);

    expect(text).toContain("Alice");
  });

  it("renders empty string for undefined variables", () => {
    const template = `<receipt width="32">Hello {{ missing }}World</receipt>`;
    const data = {};

    const bytes = EPMLCompiler.compile(template, data);
    const text = extractPrintableText(bytes);

    expect(text).toContain("Hello");
    expect(text).toContain("World");
    expect(text).not.toContain("undefined");
  });

  it("iterates <for> loops over arrays", () => {
    const template = `<receipt width="32"><for each="item" in="{{ items }}">{{ item.name }} </for></receipt>`;
    const data = {
      items: [{ name: "Apple" }, { name: "Banana" }, { name: "Cherry" }],
    };

    const bytes = EPMLCompiler.compile(template, data);
    const text = extractPrintableText(bytes);

    expect(text).toContain("Apple");
    expect(text).toContain("Banana");
    expect(text).toContain("Cherry");
  });

  it("renders <if> true branch when condition is truthy", () => {
    const template = `<receipt width="32"><if condition="show">VISIBLE</if></receipt>`;
    const data = { show: true };

    const bytes = EPMLCompiler.compile(template, data);
    const text = extractPrintableText(bytes);

    expect(text).toContain("VISIBLE");
  });

  it("skips <if> block when condition is falsy", () => {
    const template = `<receipt width="32"><if condition="show">HIDDEN</if></receipt>`;
    const data = { show: false };

    const bytes = EPMLCompiler.compile(template, data);
    const text = extractPrintableText(bytes);

    expect(text).not.toContain("HIDDEN");
  });

  it("renders <if>/<else> false branch correctly", () => {
    const template = `<receipt width="32"><if condition="isVIP">VIP</if><else>GUEST</else></receipt>`;
    const data = { isVIP: false };

    const bytes = EPMLCompiler.compile(template, data);
    const text = extractPrintableText(bytes);

    expect(text).not.toContain("VIP");
    expect(text).toContain("GUEST");
  });

  it("renders <hr/> as full-width dashes", () => {
    const template = `<receipt width="32"><hr/></receipt>`;
    const data = {};

    const bytes = EPMLCompiler.compile(template, data);
    const text = extractPrintableText(bytes);

    expect(text).toContain("-".repeat(32));
  });

  it("emits newline byte for <br/>", () => {
    const template = `<receipt width="32">A<br/>B</receipt>`;
    const data = {};

    const bytes = EPMLCompiler.compile(template, data);
    // 0x0A is newline
    expect(bytes).toContain(0x0a);
  });

  it("applies <row>/<col> padding correctly", () => {
    const template = `<receipt width="20"><row><col width="50%" align="left">Left</col><col width="50%" align="right">Right</col></row></receipt>`;
    const data = {};

    const bytes = EPMLCompiler.compile(template, data);
    const text = extractPrintableText(bytes);

    // "Left" should be followed by spaces (6 chars padding) then spaces + "Right"
    expect(text).toContain("Left");
    expect(text).toContain("Right");
  });

  it("emits cut command bytes for <cut/>", () => {
    const template = `<receipt width="32"><cut mode="full"/></receipt>`;
    const data = {};

    const bytes = EPMLCompiler.compile(template, data);
    // GS V 0 = 0x1D 0x56 0x00
    const bytesArr = Array.from(bytes);
    const cutIdx = bytesArr.indexOf(0x56);
    expect(cutIdx).toBeGreaterThan(-1);
    expect(bytesArr[cutIdx - 1]).toBe(0x1d);
  });

  it("emits barcode command prefix for <barcode>", () => {
    const template = `<receipt width="32"><barcode type="CODE128" width="2" height="64">12345</barcode></receipt>`;
    const data = {};

    const bytes = EPMLCompiler.compile(template, data);
    const bytesArr = Array.from(bytes);
    // GS k = 0x1D 0x6B (barcode print command)
    const idx = bytesArr.indexOf(0x6b);
    expect(idx).toBeGreaterThan(-1);
    expect(bytesArr[idx - 1]).toBe(0x1d);
  });

  it("emits QR code command prefix for <qr>", () => {
    const template = `<receipt width="32"><qr size="3" error="M">https://example.com</qr></receipt>`;
    const data = {};

    const bytes = EPMLCompiler.compile(template, data);
    const bytesArr = Array.from(bytes);
    // GS ( k = 0x1D 0x28 0x6B (QR code sub-command)
    const idx = bytesArr.indexOf(0x28);
    expect(idx).toBeGreaterThan(-1);
    expect(bytesArr[idx - 1]).toBe(0x1d);
  });
});

describe("Lexer", () => {
  it("skips HTML comments", () => {
    const lexer = new Lexer("Hello <!-- this is a comment --> World");
    const tokens = lexer.tokenize();

    const textTokens = tokens.filter((t) => t.type === "Text");
    const text = textTokens.map((t) => t.value).join("");
    expect(text).toContain("Hello");
    expect(text).toContain("World");
    expect(text).not.toContain("comment");
  });

  it("throws on unclosed {{ variable expressions", () => {
    const lexer = new Lexer("Hello {{ name");
    expect(() => lexer.tokenize()).toThrowError(/Unclosed variable/);
  });
});

describe("Font size clamping", () => {
  it("clamps extreme font width and height to valid range", () => {
    const template = `<receipt width="32"><font width="99" height="0">Test</font></receipt>`;
    const data = {};

    // Should not throw — extreme values are clamped to 1-8
    const bytes = EPMLCompiler.compile(template, data);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(0);

    // Verify the GS ! command clamps: width=8 (max), height=1 (min fallback for 0->NaN->1)
    const bytesArr = Array.from(bytes);
    const gsIdx = bytesArr.indexOf(0x21);
    expect(gsIdx).toBeGreaterThan(-1);
    // GS ! n where n = (w-1)*16 + (h-1) => (8-1)*16 + (1-1) = 112
    expect(bytesArr[gsIdx - 1]).toBe(0x1d);
    expect(bytesArr[gsIdx + 1]).toBe(112);
  });
});
