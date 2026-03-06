export const ESC = 0x1b;
export const GS = 0x1d;
export const FS = 0x1c;
export const DLE = 0x10;
export const EOT = 0x04;
export const DC2 = 0x12;

export const HARDWARE = {
  CUT: {
    FULL: (feed: number = 0) => [GS, 0x56, 0x41, feed],
    PARTIAL: (feed: number = 0) => [GS, 0x56, 0x42, feed],
  },
  EJECT: {
    set: () => [FS, 0x1c],
  },
  DENSITY: {
    set: (level: number) => [DC2, 0x23, level],
  },
  DRAWER: {
    PIN2: (onTime: number, offTime: number) => [
      ESC,
      0x70,
      0,
      Math.min(255, Math.ceil(onTime / 2)),
      Math.min(255, Math.ceil(offTime / 2)),
    ],
    PIN5: (onTime: number, offTime: number) => [
      ESC,
      0x70,
      1,
      Math.min(255, Math.ceil(onTime / 2)),
      Math.min(255, Math.ceil(offTime / 2)),
    ],
  },
  BEEP: {
    STAR: (pattern: number) => [ESC, 0x1e, 0x07, pattern, 0x00],
    EPSON: (pattern: number) => [
      ESC,
      0x28,
      0x41,
      0x04,
      0x00,
      0x30,
      Math.min(10, pattern),
      Math.min(50, pattern),
      Math.min(50, pattern),
    ],
  },
  REALTIME_STATUS: {
    set: (n: number) => [DLE, EOT, n],
  },
};
