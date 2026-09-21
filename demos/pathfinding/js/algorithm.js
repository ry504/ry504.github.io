// Ported from _algorithm.py (Network). Graph = Map(nodeKey -> Map(nodeKey -> [weight, linkType]))
// linkType is "dir" or "jmp".
import { key } from './nodekey.js';
import { pyRound, dist } from './math.js';
import { MOVE_SPEED, JUMP_SPEED, GRAVITY, MAX_RAY_DIST } from './constants.js';

export class Network {
  constructor() { this.graph = new Map(); }

  nodeAt(x, y) { return this.graph.has(key(x, y)); }
  placeNode(x, y) { const k = key(x, y); if (!this.graph.has(k)) this.graph.set(k, new Map()); }
  linkNodes(x, y, nx, ny, w, type) {
    if (this.nodeAt(x, y) && this.nodeAt(nx, ny)) {
      this.graph.get(key(x, y)).set(key(nx, ny), [w, type]);
    }
  }

  // container is either a Ground (has(x,y)) or the graph Map (has(nodeKey)).
  raycastDown(x, y, container, maxDist, dirY = 1) {
    for (let dy = 0; dy <= maxDist; dy++) {
      const ty = y + dy * dirY;
      const hit = (container instanceof Map)
        ? container.has(key(x, ty))
        : container.has(x, ty);
      if (hit) return [x, ty];
    }
    return null;
  }

  hasLink(x, y, dirX, mutl = true) {
    if (!this.nodeAt(x, y)) return false;
    const nodeDict = this.graph.get(key(x, y));
    for (const nbr of nodeDict.keys()) {
      const [nx, ny] = nbr.split(',').map(Number);
      const back = this.graph.get(key(nx, ny));
      if ((back && back.has(key(x, y))) || !mutl) {
        if (nx * dirX > x * dirX) return true;
      }
    }
    return false;
  }

  linkVerticalNode(x, y, ground, dirX) {
    let tx = x, ty = y, pTx = x, pTy = y;
    let t = 0;
    while (ty <= y + MAX_RAY_DIST) {
      t += 1.0 / MOVE_SPEED;
      tx = x + pyRound(MOVE_SPEED * t) * dirX;
      ty = y + pyRound(0.5 * GRAVITY * t * t);

      if (tx !== pTx) {
        if (ground.has(tx, ty)) return;
        if (ty > pTy) {
          const rangeY = ty - pTy;
          if (this.raycastDown(pTx, ty, ground, rangeY) !== null) return;
        }
        const hit = this.raycastDown(tx, ty, this.graph, MAX_RAY_DIST);
        if (hit !== null) {
          const delta = dist(x, y, hit[0], hit[1]);
          this.linkNodes(x, y, hit[0], hit[1], delta, 'dir');
          const jmpHeight = JUMP_SPEED ** 2 / (2.0 * GRAVITY);
          if (delta <= jmpHeight) this.linkNodes(hit[0], hit[1], x, y, delta, 'dir');
        }
      }
      pTx = tx; pTy = ty;
    }
  }

  linkJumpNode(x, y, ground, dirX) {
    if (ground.has(x, y - 1)) return;

    let pHitX = null, pHitY = null;
    let tx = x, ty = y, pTx = x, pTy = y;
    let t = 0;
    while (ty <= y + MAX_RAY_DIST) {
      t += 1.0 / MOVE_SPEED;
      tx = x + pyRound(MOVE_SPEED * t) * dirX;
      ty = y + pyRound(-JUMP_SPEED * t + 0.5 * GRAVITY * t * t);

      if (tx !== pTx) {
        if (ground.has(tx, ty)) return;
        if (ty !== pTy) {
          const rngY = Math.abs(ty - pTy);
          const dirY = ty > pTy ? 1 : -1;
          if (this.raycastDown(tx, pTy, ground, rngY, dirY) !== null) return;
        }
        const hit = this.raycastDown(tx, ty, this.graph, MAX_RAY_DIST);
        if (hit !== null) {
          const nodeDict = this.graph.get(key(x, y));
          if (!nodeDict.has(key(hit[0], hit[1]))) {
            const delta = dist(x, y, hit[0], hit[1]) + 2;
            if (hit[1] <= y || !this.hasLink(x, y, dirX)) {
              this.linkNodes(x, y, hit[0], hit[1], delta, 'jmp');
              if (pHitX !== null) {
                // Mirror Python: only drop the previous furthest landing if the new
                // landing is reachable from it, then delete (x,y)->(pHitX,pHitY).
                const prevDict = this.graph.get(key(pHitX, pHitY));
                if (prevDict && prevDict.has(key(hit[0], hit[1]))) {
                  nodeDict.delete(key(pHitX, pHitY));
                }
              }
              pHitX = hit[0]; pHitY = hit[1];
            }
          }
        }
      }
      pTx = tx; pTy = ty;
    }
  }

  fPlaceGroundNodes(ground) {
    for (const [gx, gy] of ground.cells) {
      const nx = gx, ny = gy - 1;
      if (!ground.has(nx, ny)) this.placeNode(nx, ny);
    }
  }
  fLinkAdjacentNodes() {
    for (const k of this.graph.keys()) {
      const [x, y] = k.split(',').map(Number);
      this.linkNodes(x, y, x - 1, y, 1, 'dir');
      this.linkNodes(x, y, x + 1, y, 1, 'dir');
    }
  }
  fLinkVerticalNodes(ground) {
    for (const k of this.graph.keys()) {
      const [x, y] = k.split(',').map(Number);
      if (!ground.has(x - 1, y + 1)) this.linkVerticalNode(x, y, ground, -1);
      if (!ground.has(x + 1, y + 1)) this.linkVerticalNode(x, y, ground, 1);
    }
  }
  fLinkJumpNodes(ground) {
    for (const k of this.graph.keys()) {
      const [x, y] = k.split(',').map(Number);
      if (!ground.has(x - 1, y + 1)) this.linkJumpNode(x, y, ground, -1);
      if (!ground.has(x + 1, y + 1)) this.linkJumpNode(x, y, ground, 1);
    }
  }

  // main.py convenience: full rebuild
  build(ground) {
    this.fPlaceGroundNodes(ground);
    this.fLinkAdjacentNodes();
    this.fLinkVerticalNodes(ground);
    this.fLinkJumpNodes(ground);
  }
}
