export const ESC = 0x1b;
export const GS = 0x1d;

export const LAYOUT = {
  PAGE_MODE: {
    on: [ESC, 0x4c],
    off: [ESC, 0x53],
  },
  PRINT_AREA: {
    set: (x: number, y: number, w: number, h: number) => [
      ESC,
      0x57,
      x & 0xff,
      (x >> 8) & 0xff,
      y & 0xff,
      (y >> 8) & 0xff,
      w & 0xff,
      (w >> 8) & 0xff,
      h & 0xff,
      (h >> 8) & 0xff,
    ],
  },
  PRINT_DIRECTION: {
    set: (dir: number) => [ESC, 0x54, dir],
  },
  ABSOLUTE_POSITION: {
    set: (n: number) => [ESC, 0x24, n & 0xff, (n >> 8) & 0xff],
  },
  RELATIVE_POSITION: {
    set: (n: number) => {
      const val = n < 0 ? 0x10000 + n : n;
      return [ESC, 0x5c, val & 0xff, (val >> 8) & 0xff];
    },
  },
  LEFT_MARGIN: {
    set: (n: number) => [GS, 0x4c, n & 0xff, (n >> 8) & 0xff],
  },
  PRINT_WIDTH: {
    set: (n: number) => [GS, 0x57, n & 0xff, (n >> 8) & 0xff],
  },
  MOTION_UNITS: {
    set: (x: number, y: number) => [GS, 0x50, x, y],
  },
  LINE_SPACING: {
    set: (n: number) => [ESC, 0x33, n],
    default: [ESC, 0x32],
  },
  FEED: {
    LINES: (n: number) => [ESC, 0x64, n],
    DOTS: (n: number) => [GS, 0x4a, n],
    REVERSE: (n: number) => [ESC, 0x65, n],
  },
  MARK_FEED: {
    set: () => [GS, 0x0c],
  },
};
