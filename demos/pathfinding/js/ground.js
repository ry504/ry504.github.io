// Ported from ground_script.py (Ground.cells is insertion-ordered like the Python list).
export class Ground {
  constructor() {
    this.cells = [];
    this._set = new Set();
  }
  has(x, y) { return this._set.has(`${x},${y}`); }
  add(x, y) {
    const k = `${x},${y}`;
    if (!this._set.has(k)) { this._set.add(k); this.cells.push([x, y]); }
  }
  setCells(pos) { for (const [x, y] of pos) this.add(x, y); }
  remove(x, y) {
    const k = `${x},${y}`;
    if (this._set.has(k)) {
      this._set.delete(k);
      const i = this.cells.findIndex(([a, b]) => a === x && b === y);
      if (i >= 0) this.cells.splice(i, 1);
    }
  }
  clear() { this.cells = []; this._set.clear(); }
}
