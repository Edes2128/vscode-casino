/** Tiny mutable pixel grid used to compose sprites. `.` is transparent. */
export type Grid = string[][];

export function createGrid(width: number, height: number, fill = '.'): Grid {
  return Array.from({ length: height }, () => Array<string>(width).fill(fill));
}

export function setCell(grid: Grid, x: number, y: number, char: string): void {
  const row = grid[y];
  if (row !== undefined && x >= 0 && x < row.length) row[x] = char;
}

/** Copies `rows` onto the grid at (x, y). Transparent (`.`) cells in the stamp leave the grid untouched. */
export function stamp(grid: Grid, x: number, y: number, rows: readonly string[]): void {
  rows.forEach((row, dy) => {
    [...row].forEach((char, dx) => {
      if (char !== '.') setCell(grid, x + dx, y + dy, char);
    });
  });
}

export function fillRect(grid: Grid, x: number, y: number, width: number, height: number, char: string): void {
  for (let dy = 0; dy < height; dy += 1) {
    for (let dx = 0; dx < width; dx += 1) setCell(grid, x + dx, y + dy, char);
  }
}

export function outlineRect(grid: Grid, x: number, y: number, width: number, height: number, char: string): void {
  fillRect(grid, x, y, width, 1, char);
  fillRect(grid, x, y + height - 1, width, 1, char);
  fillRect(grid, x, y, 1, height, char);
  fillRect(grid, x + width - 1, y, 1, height, char);
}

export const gridRows = (grid: Grid): string[] => grid.map((row) => row.join(''));
