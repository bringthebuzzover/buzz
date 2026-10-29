/**
 * Dot-matrix US map for the College network section, on a 16px grid in an
 * 880×550 viewBox. Stored as horizontal runs `[y, xStart, xEnd]` (inclusive)
 * and expanded to one `[x, y]` point per dot, left to right, top to bottom.
 */
const GRID = 16;

const RUNS: ReadonlyArray<readonly [number, number, number]> = [
  [56, 84, 468],
  [72, 52, 500],
  [88, 68, 580],
  [88, 852, 852],
  [104, 68, 644],
  [104, 852, 852],
  [120, 68, 644],
  [120, 836, 852],
  [136, 68, 644],
  [136, 708, 804],
  [136, 836, 836],
  [152, 68, 644],
  [152, 676, 836],
  [168, 68, 804],
  [184, 68, 772],
  [200, 68, 772],
  [216, 68, 756],
  [232, 84, 756],
  [248, 84, 756],
  [264, 100, 756],
  [280, 100, 756],
  [296, 116, 740],
  [312, 116, 740],
  [328, 132, 724],
  [344, 148, 708],
  [360, 164, 692],
  [376, 228, 676],
  [392, 244, 276],
  [392, 324, 660],
  [408, 340, 660],
  [424, 340, 548],
  [424, 612, 660],
  [440, 356, 548],
  [440, 628, 676],
  [456, 372, 468],
  [456, 548, 548],
  [456, 660, 676],
  [472, 388, 452],
  [472, 660, 676],
  [488, 420, 436],
  [488, 660, 676],
  [504, 420, 436],
  [504, 660, 676],
];

export const US_DOTS: ReadonlyArray<readonly [number, number]> = RUNS.flatMap(
  ([y, xStart, xEnd]) =>
    Array.from(
      { length: (xEnd - xStart) / GRID + 1 },
      (_, i) => [xStart + i * GRID, y] as const,
    ),
);
