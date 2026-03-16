import iconv from "iconv-lite";

const CharsetToEncoding: Record<string, string> = {
  PC437: "cp437",
  CP437: "cp437",
  KATAKANA: "cp932",
  PC850: "cp850",
  CP850: "cp850",
  PC858: "cp858",
  CP858: "cp858",
  PC860: "cp860",
  CP860: "cp860",
  PC863: "cp863",
  CP863: "cp863",
  PC865: "cp865",
  CP865: "cp865",
  WPC1252: "windows1252",
  WINDOWS1252: "windows1252",
  "WINDOWS-1252": "windows1252",
  CP1252: "windows1252",
  UTF8: "utf8",
};

export function normalizeCharset(charset: string): string {
  return charset.trim().toUpperCase();
}

export function encodeText(text: string, charset: string): Uint8Array {
  const normalized = normalizeCharset(charset);

  if (normalized === "UTF8") {
    return new TextEncoder().encode(text);
  }

  const encoding = CharsetToEncoding[normalized] || "cp437";

  try {
    return Uint8Array.from(iconv.encode(text, encoding));
  } catch {
    return new TextEncoder().encode(text);
  }
}
