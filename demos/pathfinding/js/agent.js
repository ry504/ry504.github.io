// Ported from agent_script.py (Agent). Rendering lives in renderer.js.
// Difference: physics uses a fixed FRAME_RATE (60Hz) instead of py5.get_frame_rate(),
// so headless simulation is deterministic. Delta_time formula is unchanged.
import { snapToGrid, sign, dist } from './math.js';
import { CELL_SIZE, MOVE_SPEED, JUMP_SPEED, GRAVITY, RUN_SPEED, FRAME_RATE } from './constants.js';
import { key } from './nodekey.js';

const pathHas = (path, x, y) => path.some(([px, py]) => px === x && py === y);

export class Agent {
  constructor(gridPos, relW) {
    [this.grid_x, this.grid_y] = gridPos;
    this.x = (this.grid_x + 0.5) * CELL_SIZE;
    this.y = (this.grid_y + 0.5) * CELL_SIZE;
    this.default_pos = [this.x, this.y];
    this.xv = 0; this.yv = 0;
    this.active = false;
    this.on_grnd = false;

    this.curr_x = gridPos[0]; this.curr_y = gridPos[1];
    this.targ_x = gridPos[0]; this.targ_y = gridPos[1];

    this.w = relW * CELL_SIZE;
    this.h = this.w * 1.4;
    this.move_speed = MOVE_SPEED * CELL_SIZE;
    this.jmp_speed = JUMP_SPEED * CELL_SIZE;
    this.gravity = GRAVITY * CELL_SIZE;
  }

  updateGridPos() {
    const [sx, sy] = snapToGrid(this.x, this.y, CELL_SIZE);
    this.grid_x = sx / CELL_SIZE;
    this.grid_y = sy / CELL_SIZE;
  }
  updateCurrPos() { this.curr_x = this.grid_x; this.curr_y = this.grid_y; }

  reset() {
    [this.x, this.y] = this.default_pos;
    this.updateGridPos();
    this.updateCurrPos();
    this.xv = 0; this.yv = 0;
    this.active = false;
  }

  getCollision(gx, gy) {
    const minX = this.x - this.w / 2, minY = this.y - this.h / 2;
    const maxX = this.x + this.w / 2, maxY = this.y + this.h / 2;
    const gMinX = gx * CELL_SIZE, gMinY = gy * CELL_SIZE;
    const gMaxX = (gx + 1) * CELL_SIZE, gMaxY = (gy + 1) * CELL_SIZE;

    const overlapX = Math.min(maxX, gMaxX) - Math.max(minX, gMinX);
    const overlapY = Math.min(maxY, gMaxY) - Math.max(minY, gMinY);

    if (overlapX > 0 && overlapY > 0) {
      const dx = this.x - (gx + 0.5) * CELL_SIZE;
      const dy = this.y - (gy + 0.5) * CELL_SIZE;
      if (overlapX < overlapY) return [overlapX * sign(dx, 1), 0];
      return [0, overlapY * sign(dy, 1)];
    }
    return [0, 0];
  }

  resolveCollisions(cells) {
    let maxDx = 0, maxDy = 0, maxMag = 0;
    for (const [x, y] of cells) {
      if (Math.abs(x - this.grid_x) <= 1 && Math.abs(y - this.grid_y) <= 1) {
        const [dx, dy] = this.getCollision(x, y);
        const mag = dist(0, 0, dx, dy);
        if (mag > maxMag) { maxMag = mag; maxDx = dx; maxDy = dy; }
      }
    }
    this.x += maxDx;
    this.y += maxDy;
    if (sign(this.xv) === -sign(maxDx)) this.xv = 0;
    if (sign(this.yv) === -sign(maxDy)) this.yv = 0;
  }

  grndCheck(cells, extrusion = 3) {
    const pxMin = this.x - this.w / 2, pxMax = this.x + this.w / 2, py = this.y + this.h / 2 + extrusion;
    for (const [gx, gy] of cells) {
      const gMinX = gx * CELL_SIZE, gMinY = gy * CELL_SIZE;
      const gMaxX = (gx + 1) * CELL_SIZE, gMaxY = (gy + 1) * CELL_SIZE;
      if (!(pxMax <= gMinX || pxMin >= gMaxX) && gMinY < py && py < gMaxY) return true;
    }
    return false;
  }

  physics(cells, height) {
    const dt = (1 / FRAME_RATE) * RUN_SPEED;
    this.yv += this.gravity * dt;
    this.x += this.xv * dt;
    this.y += this.yv * dt;
    for (let i = 0; i < 2; i++) this.resolveCollisions(cells);
    this.updateGridPos();
    this.on_grnd = this.grndCheck(cells);
    if (this.y > height) this.reset();
  }

  AI(path, graph) {
    const gk = key(this.grid_x, this.grid_y);
    if (graph.has(gk) && !pathHas(path, this.grid_x, this.grid_y)) {
      const [dx0, dy0] = this.default_pos;
      if (!(this.grid_x === Math.floor(dx0 / CELL_SIZE) && this.grid_y === Math.floor(dy0 / CELL_SIZE))) {
        this.updateCurrPos();
      }
    }
    if (!pathHas(path, this.curr_x, this.curr_y)) this.updateCurrPos();

    this.targ_x = this.curr_x; this.targ_y = this.curr_y;
    let targType = 'dir';
    if (path.length > 1 && graph.has(key(this.curr_x, this.curr_y))) {
      this.targ_x = path[1][0]; this.targ_y = path[1][1];
      const nodeDict = graph.get(key(this.curr_x, this.curr_y));
      if (nodeDict.has(key(this.targ_x, this.targ_y))) {
        targType = nodeDict.get(key(this.targ_x, this.targ_y))[1];
      }
    }

    const dx = (this.targ_x + 0.5) * CELL_SIZE - this.x;
    const dt = (1 / FRAME_RATE) * RUN_SPEED;
    const xThres = (this.move_speed * dt) / 2.0;

    if (dx > xThres) this.xv = this.move_speed;
    else if (dx < -xThres) this.xv = -this.move_speed;
    else {
      this.xv = 0;
      if (this.targ_y - this.grid_y < 2) {
        if (path.length > 2) {
          const [prevPathX] = path[0];
          const [currPathX, currPathY] = path[1];
          const [nextPathX, nextPathY] = path[2];
          const s1 = sign(this.targ_x - prevPathX);
          const s2 = sign(nextPathX - this.targ_x);
          if (s1 === s2 && s2 !== 0) {
            const nd = graph.get(key(currPathX, currPathY));
            if (nd && nd.has(key(nextPathX, nextPathY)) && nd.get(key(nextPathX, nextPathY))[1] === 'dir') {
              this.curr_x = this.targ_x; this.curr_y = this.targ_y;
            }
          }
        }
      }
      if (this.grid_y === this.targ_y) this.updateCurrPos();
    }

    if (targType === 'dir' && this.grid_y - this.targ_y > 1) this.xv = 0;

    if ((this.targ_y < this.grid_y || (targType === 'jmp' && Math.abs(this.targ_x - this.grid_x) > 1)) && this.on_grnd) {
      this.yv = -this.jmp_speed;
    }
  }
}
