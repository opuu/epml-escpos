export const ESC = 0x1b;
export const GS = 0x1d;
export const FS = 0x1c;
export const LF = 0x0a;
export const CR = 0x0d;
export const DLE = 0x10;
export const EOT = 0x04;
export const DC2 = 0x12;

export const INIT = [ESC, 0x40];

export const TEXT = {
  BOLD: {
    on: [ESC, 0x45, 1],
    off: [ESC, 0x45, 0],
  },
  UNDERLINE: {
    on: [ESC, 0x2d, 1],
    off: [ESC, 0x2d, 0],
  },
  STRIKE: {
    on: [ESC, 0x24, 1],
    off: [ESC, 0x24, 0],
  },
  INVERT: {
    on: [GS, 0x42, 1],
    off: [GS, 0x42, 0],
  },
  ROTATE: {
    on: [ESC, 0x56, 1],
    off: [ESC, 0x56, 0],
  },
  UPSIDE_DOWN: {
    on: [ESC, 0x7b, 1],
    off: [ESC, 0x7b, 0],
  },
  COLOR: {
    PRIMARY: [ESC, 0x72, 0],
    SECONDARY: [ESC, 0x72, 1],
  },
  SMOOTHING: {
    on: [GS, 0x62, 1],
    off: [GS, 0x62, 0],
  },
  ALIGN: {
    left: [ESC, 0x61, 0],
    center: [ESC, 0x61, 1],
    right: [ESC, 0x61, 2],
  },
  FONT: {
    a: [ESC, 0x4d, 0],
    b: [ESC, 0x4d, 1],
  },
  SIZE: (widthMultiplier: number, heightMultiplier: number) => {
    const w = Math.max(1, Math.min(8, widthMultiplier)) - 1;
    const h = Math.max(1, Math.min(8, heightMultiplier)) - 1;
    return [GS, 0x21, (w << 4) | h];
  },
};
