import { CELL_SIZE } from './constants.js';

// Python's round() uses banker's rounding (ties-to-even). JS Math.round does not,
// so `pyRound` reproduces CPython semantics for exact .5 ties. This matters because
// _algorithm.py and utils.py both round trajectory values.
export function pyRound(x) {
  const frac = Math.abs(x % 1);
  if (frac === 0.5) {
    const lo = Math.floor(x);
    const hi = Math.ceil(x);
    const r = lo % 2 === 0 ? lo : hi;
    return r === 0 ? 0 : r; // normalise -0 to 0 to match CPython round()
  }
  const r = Math.round(x);
  return r === 0 ? 0 : r; // CPython round(-0.4) == 0, JS Math.round gives -0
}

// utils.sign: sign(x, zero=0)
export function sign(x, zero = 0) {
  if (x === 0) return zero;
  return Math.abs(x) / x;
}

// utils.snap_to_grid
export function snapToGrid(x, y, cell = CELL_SIZE) {
  const sx = pyRound(x / cell - 0.5) * cell;
  const sy = pyRound(y / cell - 0.5) * cell;
  return [sx, sy];
}

// py5.dist
export function dist(x1, y1, x2, y2) {
  return Math.hypot(x1 - x2, y1 - y2);
}
