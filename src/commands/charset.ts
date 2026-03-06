export const ESC = 0x1b;

export const CharsetMap: Record<string, number> = {
  PC437: 0,
  KATAKANA: 1,
  PC850: 2,
  PC860: 3,
  PC863: 4,
  PC865: 5,
  WPC1252: 16,
  UTF8: 255,
};

export const CHARSET = {
  setPage: (n: number) => [ESC, 0x74, n],
};
