import { test, expect, describe, vi } from "vitest";
import { EPMLCompiler } from "../src/compiler.js";
import { EPMLPlugin } from "../src/plugin.js";
import {
  EPMLSemanticError,
  EPMLPluginError,
  EPMLCodegenError,
} from "../src/errors.js";
import { StandardEpsonProfile, StarMicronicsProfile } from "../src/index.js";

async function createTinyPngBuffer(): Promise<Buffer> {
  const jimpModule = await import("jimp");
  const JimpCtor = (jimpModule as any).Jimp || (jimpModule as any).default;
  const image = new JimpCtor({ width: 2, height: 2, color: 0xffffffff });
  return image.getBuffer("image/png");
}

describe("EPMLCompiler Integration", () => {
  const basicTemplate = `<receipt width="48" init="true">
    <text align="center" bold="true" size="2">STORE NAME</text>
    <br/>
    <hr/>
    <row>
      <cell width="50%">Item 1</cell>
      <cell width="50%" align="right">$10.00</cell>
    </row>
    <hr/>
    <barcode type="CODE128" hri="below" align="center">123456789</barcode>
    <cut mode="partial"/>
  </receipt>`;

  test("compiles standard template to Uint8Array safely", () => {
    const result = EPMLCompiler.compile(basicTemplate, {});
    expect(result.bytes).toBeInstanceOf(Uint8Array);
    expect(result.bytes.length).toBeGreaterThan(10);
    expect(result.warnings.length).toBe(0); // Valid template
  });

  test("compiles with Star Micronics Profile", () => {
    const result = EPMLCompiler.compile(
      basicTemplate,
      {},
      StarMicronicsProfile,
    );
    expect(result.bytes).toBeInstanceOf(Uint8Array);
    expect(result.bytes.length).toBeGreaterThan(10);
  });

  test("handles formatting attributes directly", () => {
    const tmpl = `<text bold="true" underline="true" invert="true">Hello</text>`;
    const r = EPMLCompiler.compile(tmpl, {});
    expect(r.bytes.length).toBeGreaterThan(5); // ESC cmds + Hello
  });

  test("encodes accented letters with selected WPC1252 charset", () => {
    const tmpl = `<text charset="WPC1252">áéíóúñçü</text>`;
    const res = EPMLCompiler.compile(tmpl, {});

    expect(Array.from(res.bytes)).toEqual([
      0x1b, 0x74, 16, 0xe1, 0xe9, 0xed, 0xf3, 0xfa, 0xf1, 0xe7, 0xfc, 0x0a,
      0x1b, 0x74, 0x00,
    ]);
  });

  test("restores previous charset after scoped charset element", () => {
    const tmpl = `<receipt width="48" init="false"><text charset="WPC1252">é</text><text>é</text></receipt>`;
    const res = EPMLCompiler.compile(tmpl, {});

    expect(Array.from(res.bytes)).toEqual([
      0x1b, 0x74, 16, 0xe9, 0x0a, 0x1b, 0x74, 0x00, 0x82, 0x0a,
    ]);
  });

  test("handles unrolled conditional rendering", () => {
    const tmpl = `<if condition="show">YES<else/>NO</if>`;
    const resA = EPMLCompiler.compile(tmpl, { show: true });
    expect(new TextDecoder().decode(resA.bytes)).toContain("YES");
    expect(new TextDecoder().decode(resA.bytes)).not.toContain("NO");

    const resB = EPMLCompiler.compile(tmpl, { show: false });
    expect(new TextDecoder().decode(resB.bytes)).not.toContain("YES");
    expect(new TextDecoder().decode(resB.bytes)).toContain("NO");
  });

  test("handles unrolled loops", () => {
    const tmpl = `<for item="i" in="list"><text>{{ i }}</text></for>`;
    const res = EPMLCompiler.compile(tmpl, { list: ["A", "B"] });
    const str = new TextDecoder().decode(res.bytes);
    expect(str).toContain("A");
    expect(str).toContain("B");
  });

  test("catches unknown tag without plugin", () => {
    // Default UniversalTextSchema is applied with rawAttributes if tag is unknown
    const res = EPMLCompiler.compile(
      `<custom-tag foo="bar">Hi</custom-tag>`,
      {},
    );
    expect(new TextDecoder().decode(res.bytes)).toContain("Hi");
  });

  test("Plugin System Integration", () => {
    const CustomFormatPlugin: EPMLPlugin = {
      name: "test-plugin",
      version: 1,
      commands: {
        text: {
          boldOn: new Uint8Array([0x99, 0x88]),
        },
      },
    };

    EPMLCompiler.use(CustomFormatPlugin);
    const tmpl = `<text bold="true">Text</text>`;
    const res = EPMLCompiler.compile(tmpl, {});

    // The sequence 0x99 0x88 should be in the byte array
    let found = false;
    for (let i = 0; i < res.bytes.length - 1; i++) {
      if (res.bytes[i] === 0x99 && res.bytes[i + 1] === 0x88) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);

    EPMLCompiler.unuse("test-plugin");
  });

  test("Plugin API null override warning", () => {
    const HookPlugin: EPMLPlugin = {
      name: "hook-test",
      version: 1,
      commands: {
        text: {
          underlineOn: null,
        },
      },
    };

    EPMLCompiler.use(HookPlugin);
    const res = EPMLCompiler.compile(`<text underline="true">A</text>`, {});
    expect(res.warnings.length).toBeGreaterThan(0);
    expect(
      res.warnings.some((w) => w.message.includes("explicitly null")),
    ).toBe(true);
    EPMLCompiler.unuse("hook-test");
  });

  test("Code generation properly ignores undefined attributes", () => {
    const tmpl = `<text color="red">WARN</text>`;
    const res = EPMLCompiler.compile(tmpl, {});
    expect(res.bytes).toBeInstanceOf(Uint8Array);
  });

  test("padding-top and padding-bottom use padding-char with no extra gap", () => {
    const tmpl = `<text padding="true" padding-top="1" padding-bottom="1" padding-char="-">X</text>`;
    const res = EPMLCompiler.compile(tmpl, {});
    const out = new TextDecoder().decode(res.bytes);
    const lines = out.split("\n");

    expect(lines[0]).toMatch(/^-+$/);
    expect(lines[1]).toContain("X");
    expect(lines[2]).toMatch(/^-+$/);
  });

  test("compileAsync passes HTTP image URLs to custom renderers", async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn();

    (globalThis as any).fetch = fetchMock;

    try {
      let rendererInput = "";
      const result = await EPMLCompiler.compileAsync(
        `<receipt width="48"><image width="8">https://example.com/logo.png</image></receipt>`,
        {},
        async (source) => {
          rendererInput = source;
          return { data: new Uint8Array([0xff]), width: 8, height: 1 };
        },
      );

      expect(fetchMock).not.toHaveBeenCalled();
      expect(rendererInput).toBe("https://example.com/logo.png");
      expect(result.bytes.length).toBeGreaterThan(0);
    } finally {
      (globalThis as any).fetch = originalFetch;
    }
  });

  test("compileAsync accepts data URLs with surrounding whitespace", async () => {
    let rendererInput = "";
    await EPMLCompiler.compileAsync(
      `<receipt width="48"><image width="8">\n  data:image/png;base64,QUJD  \n</image></receipt>`,
      {},
      async (source) => {
        rendererInput = source;
        return { data: new Uint8Array([0xff]), width: 8, height: 1 };
      },
    );

    expect(rendererInput).toBe("data:image/png;base64,QUJD");
  });

  test("compileAsync supports image src attribute", async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: {
        get: (k: string) =>
          k.toLowerCase() === "content-type" ? "image/jpeg" : null,
      },
      arrayBuffer: async () => Uint8Array.from([9, 8, 7]).buffer,
    }));
    (globalThis as any).fetch = fetchMock;

    try {
      let rendererInput = "";
      await EPMLCompiler.compileAsync(
        `<receipt width="48"><image src="https://example.com/photo.jpg" width="8"/></receipt>`,
        {},
        async (source) => {
          rendererInput = source;
          return { data: new Uint8Array([0xff]), width: 8, height: 1 };
        },
      );

      expect(fetchMock).not.toHaveBeenCalled();
      expect(rendererInput).toBe("https://example.com/photo.jpg");
    } finally {
      (globalThis as any).fetch = originalFetch;
    }
  });

  test("compileAsync works without custom renderer for data URLs", async () => {
    const tinyPng = await createTinyPngBuffer();
    const tinyPngBase64 = tinyPng.toString("base64");

    const result = await EPMLCompiler.compileAsync(
      `<receipt width="48"><image width="8" dither="threshold">data:image/png;base64,${tinyPngBase64}</image></receipt>`,
      {},
    );

    expect(result.bytes).toBeInstanceOf(Uint8Array);
    expect(result.bytes.length).toBeGreaterThan(0);
  });

  test("compileAsync built-in renderer downloads HTTP image URLs", async () => {
    const tinyPng = await createTinyPngBuffer();

    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: {
        get: (k: string) =>
          k.toLowerCase() === "content-type" ? "image/png" : null,
      },
      arrayBuffer: async () =>
        tinyPng.buffer.slice(
          tinyPng.byteOffset,
          tinyPng.byteOffset + tinyPng.byteLength,
        ),
    }));

    (globalThis as any).fetch = fetchMock;

    try {
      const result = await EPMLCompiler.compileAsync(
        `<receipt width="48"><image width="8">https://example.com/logo.png</image></receipt>`,
        {},
      );

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith("https://example.com/logo.png");
      expect(result.bytes.length).toBeGreaterThan(0);
    } finally {
      (globalThis as any).fetch = originalFetch;
    }
  });
});
