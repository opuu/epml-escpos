export const GS = 0x1d;

export const BARCODES = {
  HRI: {
    set: (n: number) => [GS, 0x48, n],
  },
  HRI_FONT: {
    set: (font: "a" | "b") => [GS, 0x66, font === "b" ? 1 : 0],
  },
  HEIGHT: {
    set: (n: number) => [GS, 0x68, Math.max(1, Math.min(255, n))],
  },
  WIDTH: {
    set: (n: number) => [GS, 0x77, Math.max(2, Math.min(6, n))],
  },
  PRINT: (type: string, data: string) => {
    let m = 73;
    switch (type.toUpperCase()) {
      case "UPCA":
        m = 65;
        break;
      case "UPCE":
        m = 66;
        break;
      case "EAN13":
        m = 67;
        break;
      case "EAN8":
        m = 68;
        break;
      case "CODE39":
        m = 69;
        break;
      case "ITF":
        m = 70;
        break;
      case "CODABAR":
        m = 71;
        break;
      case "CODE93":
        m = 72;
        break;
      case "CODE128":
        m = 73;
        break;
    }
    const encoder = new TextEncoder();
    const bytes = encoder.encode(data);
    let payload = Array.from(bytes);
    if (m === 73 && payload.length > 0 && payload[0] !== 123) {
      payload = [123, 66, ...payload];
    }
    return [GS, 0x6b, m, payload.length, ...payload];
  },
  QR: (size: number, errorLevel: "L" | "M" | "Q" | "H", data: string) => {
    const cn = 49;
    const s = Math.max(1, Math.min(16, size));
    let e = 48;
    if (errorLevel === "M") e = 49;
    if (errorLevel === "Q") e = 50;
    if (errorLevel === "H") e = 51;
    const encoder = new TextEncoder();
    const bytes = encoder.encode(data);
    const pL = (bytes.length + 3) & 0xff;
    const pH = (bytes.length + 3) >> 8;
    return [
      GS,
      0x28,
      0x6b,
      0x04,
      0x00,
      cn,
      0x41,
      0x02,
      0x00,
      GS,
      0x28,
      0x6b,
      0x03,
      0x00,
      cn,
      0x43,
      s,
      GS,
      0x28,
      0x6b,
      0x03,
      0x00,
      cn,
      0x44,
      e,
      GS,
      0x28,
      0x6b,
      pL,
      pH,
      cn,
      0x50,
      0x30,
      ...Array.from(bytes),
      GS,
      0x28,
      0x6b,
      0x03,
      0x00,
      cn,
      0x51,
      0x30,
    ];
  },
  PDF417: (
    cols: number,
    rows: number,
    error: number,
    truncated: boolean,
    data: string,
  ) => {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(data);
    const pL = (bytes.length + 3) & 0xff;
    const pH = (bytes.length + 3) >> 8;
    return [
      // 1. Set columns
      GS,
      0x28,
      0x6b,
      0x03,
      0x00,
      0x30,
      0x41,
      cols,
      // 2. Set rows
      GS,
      0x28,
      0x6b,
      0x03,
      0x00,
      0x30,
      0x42,
      rows,
      // 3. Set module width
      GS,
      0x28,
      0x6b,
      0x03,
      0x00,
      0x30,
      0x43,
      3,
      // 4. Set row height
      GS,
      0x28,
      0x6b,
      0x03,
      0x00,
      0x30,
      0x44,
      3,
      // 5. Set error correction level
      GS,
      0x28,
      0x6b,
      0x04,
      0x00,
      0x30,
      0x45,
      error > 8 ? 0x30 : 0x31,
      error,
      // 6. Set truncated/standard
      GS,
      0x28,
      0x6b,
      0x03,
      0x00,
      0x30,
      0x46,
      truncated ? 1 : 0,
      // 7. Store data
      GS,
      0x28,
      0x6b,
      pL,
      pH,
      0x30,
      0x50,
      0x30,
      ...Array.from(bytes),
      // 8. Print data
      GS,
      0x28,
      0x6b,
      0x03,
      0x00,
      0x30,
      0x51,
      0x30,
    ];
  },
  DATAMATRIX: (data: string) => {
    const cn = 50;
    const encoder = new TextEncoder();
    const bytes = encoder.encode(data);
    const pL = (bytes.length + 3) & 0xff;
    const pH = (bytes.length + 3) >> 8;
    return [
      GS,
      0x28,
      0x6b,
      pL,
      pH,
      cn,
      0x50,
      0x30,
      ...Array.from(bytes),
      GS,
      0x28,
      0x6b,
      0x03,
      0x00,
      cn,
      0x51,
      0x30,
    ];
  },
  MAXICODE: (data: string) => {
    const cn = 51;
    const encoder = new TextEncoder();
    const bytes = encoder.encode(data);
    const pL = (bytes.length + 3) & 0xff;
    const pH = (bytes.length + 3) >> 8;
    return [
      GS,
      0x28,
      0x6b,
      0x03,
      0x00,
      cn,
      0x41,
      0x32,
      GS,
      0x28,
      0x6b,
      pL,
      pH,
      cn,
      0x50,
      0x30,
      ...Array.from(bytes),
      GS,
      0x28,
      0x6b,
      0x03,
      0x00,
      cn,
      0x51,
      0x30,
    ];
  },
};
