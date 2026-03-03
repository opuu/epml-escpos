import { PrinterProfile } from "./types";

export const StandardEpsonProfile: PrinterProfile = {
  commands: {
    initialization: [0x1b, 0x40], // ESC @
    text: {
      bold: {
        on: [0x1b, 0x45, 0x01], // ESC E n
        off: [0x1b, 0x45, 0x00],
      },
      underline: {
        on: [0x1b, 0x2d, 0x01], // ESC - n
        off: [0x1b, 0x2d, 0x00],
      },
      invert: {
        on: [0x1d, 0x42, 0x01], // GS B n
        off: [0x1d, 0x42, 0x00],
      },
      family: {
        a: [0x1b, 0x4d, 0x00], // ESC M 0
        b: [0x1b, 0x4d, 0x01], // ESC M 1
      },
      size: (width: number, height: number) => {
        // epson uses a single n for both width & height where format is (width-1)*16 + (height-1)
        const w = Math.max(1, Math.min(8, width)) - 1;
        const h = Math.max(1, Math.min(8, height)) - 1;
        const n = w * 16 + h;
        return [0x1d, 0x21, n]; // GS ! n
      },
      strike: {
        on: [0x1b, 0x47, 0x01], // ESC G n
        off: [0x1b, 0x47, 0x00],
      },
      color: {
        black: [0x1b, 0x72, 0x00], // ESC r 0
        red: [0x1b, 0x72, 0x01], // ESC r 1
      },
      rotate: {
        on: [0x1b, 0x56, 0x01], // ESC V 1
        off: [0x1b, 0x56, 0x00],
      },
      upsideDown: {
        on: [0x1b, 0x7b, 0x01], // ESC { 1
        off: [0x1b, 0x7b, 0x00],
      },
    },
    align: {
      left: [0x1b, 0x61, 0x00],
      center: [0x1b, 0x61, 0x01],
      right: [0x1b, 0x61, 0x02],
    },
    layout: {
      newline: [0x0a], // LF
      feed: (lines: number) => [0x1b, 0x64, lines], // ESC d n
      spacing: {
        default: [0x1b, 0x32], // ESC 2
        set: (dots: number) => [0x1b, 0x33, Math.max(0, Math.min(255, dots))], // ESC 3 n
      },
    },
    hardware: {
      cut: {
        full: [0x1d, 0x56, 0x00], // GS V 0
        partial: [0x1d, 0x56, 0x01], // GS V 1
      },
      drawer: {
        pin2: [0x1b, 0x70, 0x00, 0x32, 0x32], // ESC p 0
        pin5: [0x1b, 0x70, 0x01, 0x32, 0x32], // ESC p 1
      },
      beep: (count: number, durationMS: number) => {
        const durVal = Math.max(1, Math.floor(durationMS / 50));
        return [0x1b, 0x42, count, durVal]; // ESC B n t
      },
      barcode: (
        type: string,
        data: string,
        width: number,
        height: number,
        textPosition: string,
        textFont: string,
      ) => {
        let typeCode = 73; // CODE128 default
        const upperType = type.toUpperCase();
        if (upperType === "UPCA") typeCode = 65;
        if (upperType === "UPCE") typeCode = 66;
        if (upperType === "EAN13") typeCode = 67;
        if (upperType === "EAN8") typeCode = 68;
        if (upperType === "CODE39") typeCode = 69;
        if (upperType === "ITF") typeCode = 70;
        if (upperType === "CODABAR") typeCode = 71;
        if (upperType === "CODE93") typeCode = 72;
        if (upperType === "CODE128") typeCode = 73;

        const bytes: number[] = [];

        // HRI Position (0: None, 1: Above, 2: Below, 3: Both)
        let pos = 0;
        if (textPosition === "above") pos = 1;
        if (textPosition === "below") pos = 2;
        if (textPosition === "both") pos = 3;
        bytes.push(0x1d, 0x48, pos); // GS H n

        // HRI Font (0: Font A, 1: Font B)
        const fontCode = textFont === "b" ? 1 : 0;
        bytes.push(0x1d, 0x66, fontCode); // GS f n

        bytes.push(0x1d, 0x77, Math.max(2, Math.min(6, width))); // GS w n
        bytes.push(0x1d, 0x68, Math.max(1, Math.min(255, height))); // GS h n

        if (typeCode === 73) {
          // CODE128 requires character set select '{B' (123, 66)
          bytes.push(0x1d, 0x6b, typeCode, data.length + 2);
          bytes.push(123, 66);
          for (let i = 0; i < data.length; i++) {
            bytes.push(data.charCodeAt(i));
          }
        } else {
          bytes.push(0x1d, 0x6b, typeCode, data.length); // GS k m n
          for (let i = 0; i < data.length; i++) {
            bytes.push(data.charCodeAt(i));
          }
        }

        return bytes;
      },
      qr: (data: string, size: number, errorCorrection: string) => {
        const bytes: number[] = [];
        let errLvl = 48; // 'L'
        const upperErr = errorCorrection.toUpperCase();
        if (upperErr === "M") errLvl = 49;
        if (upperErr === "Q") errLvl = 50;
        if (upperErr === "H") errLvl = 51;

        const sz = Math.max(1, Math.min(16, size));
        const len = data.length + 3;
        const pL = len & 0xff;
        const pH = (len >> 8) & 0xff;

        // Model 2
        bytes.push(0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00);
        // Size
        bytes.push(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, sz);
        // Error Correction
        bytes.push(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, errLvl);
        // Store Data
        bytes.push(0x1d, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30);
        for (let i = 0; i < data.length; i++) {
          bytes.push(data.charCodeAt(i));
        }
        // Print
        bytes.push(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30);

        return bytes;
      },
      density: (level: number) => {
        // level: 0–15 (70%–130%). GS ( E pL pH fn m
        // Function 10: set print density
        const n = Math.max(0, Math.min(15, level));
        return [0x1d, 0x28, 0x45, 0x02, 0x00, 0x0a, n];
      },
      image: (width: number, height: number, data: Uint8Array) => {
        const bytes: number[] = [];
        const widthInBytes = Math.ceil(width / 8);
        const expectedLen = widthInBytes * height;
        const xL = widthInBytes & 0xff;
        const xH = (widthInBytes >> 8) & 0xff;
        const yL = height & 0xff;
        const yH = (height >> 8) & 0xff;

        // GS v 0 m xL xH yL yH d1...dk
        // m=0: normal mode
        bytes.push(0x1d, 0x76, 0x30, 0x00, xL, xH, yL, yH);

        // Ensure data length matches exactly what the command header declares
        for (let i = 0; i < expectedLen; i++) {
          bytes.push(i < data.length ? data[i] : 0x00);
        }
        return bytes;
      },
    },
  },
};
