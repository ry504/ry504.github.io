import {createDrag, updateDrag, stepDrag, releaseDrag} from './drag.js';
import { SoftBody, Ball, Car, Terrain, FIXED_DT, BALL_GRAVITY, TERRAIN_DETAIL } from './engine.js';

const COLORS = { bg: '#090a0b', ivory: '#e8e6da', crimson: '#ff4655', ground: '#9a9c96', dim: '#2b2c2f' };
const WIDTH = 1280;
const HEIGHTS = { softbody: 720, ball: 800, car: 800 };
const MAX_FRAME = 0.05;
const MAX_STEPS = 8;

const canvas = document.getElementById('world');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const metricsEl = document.getElementById('metrics');
const pauseBtn = document.getElementById('pause');
const resetBtn = document.getElementById('reset');
const terrainBtn = document.getElementById('terrain');
const driveEl = document.querySelector('.drive');

let mode = 'softbody';
let running = true;
let visible = true;
let seed = 15;
let terrain = null;
let softbody = null;
let ball = null;
let car = null;
let accumulator = 0;
let lastTime = 0;
let stepsPerSecond = 0;
let stepCount = 0;

const input = { left: false, right: false };
const touch = { left: false, right: false };
const keys = new Set();
let drag = null;

function worldHeight() { return HEIGHTS[mode]; }

function makeTerrain(newSeed) {
  if (newSeed) seed = Math.floor(Math.random() * 1e9);
  terrain = new Terrain(seed, { worldWidth: WIDTH, center: worldHeight() / 2, detail: TERRAIN_DETAIL, amplitude: 600 });
}

function resetSim() {
  if (mode === 'softbody') {
    softbody = new SoftBody({ x: WIDTH / 2, y: 220, segDist: 50, numPts: 8 });
    statusEl.textContent = 'Soft body running.';
  } else if (mode === 'ball') {
    ball = new Ball({ x: 50, y: 50, rad: 50, gravity: BALL_GRAVITY, detail: TERRAIN_DETAIL, terrain, initVel: { x: 4, y: 0 } });
    statusEl.textContent = 'Ball running.';
  } else {
    car = new Car({ x: 50, y: 50, terrain, gravity: BALL_GRAVITY, rad: 25, detail: TERRAIN_DETAIL });
    statusEl.textContent = 'Car running. Drive with A / D.';
  }
  accumulator = 0;
  endDrag();
  clearInput();
  render();
  statusEl.textContent = `${label()} ${running ? 'running' : 'paused'}.`;
}

function setMode(next) {
  mode = next;
  canvas.width = WIDTH;
  canvas.height = worldHeight();
  for (const btn of document.querySelectorAll('.mode')) {
    btn.setAttribute('aria-pressed', String(btn.dataset.mode === next));
  }
  terrainBtn.hidden = next === 'softbody';
  driveEl.hidden = next !== 'car';
  clearInput();
  makeTerrain(false);
  resetSim();
  updatePauseLabel();
  const hints = {
    softbody: 'Drag a red point to pull and stretch the soft body. The links and area restoration pull it back into shape.',
    ball: 'Drag the ball to move it, then release and watch it interact with the slopes. New terrain generates a different set of hills.',
    car: 'Click the canvas and hold A / D or the arrow keys to drive. You can also hold the Left / Right buttons, or drag either wheel.'
  };
  document.querySelector('#instructions').textContent = hints[mode] + ' Space pauses; R resets while the canvas is focused.';
}

function clearInput() {
  input.left = false;
  input.right = false;
  touch.left = false;
  touch.right = false;
  keys.clear();
  endDrag();
}

function updatePauseLabel() {
  pauseBtn.textContent = running ? 'Pause' : 'Play';
}

function setRunning(next) {
  running = next;
  clearInput();
  accumulator = 0;
  updatePauseLabel();
  statusEl.textContent = running ? `${label()} running.` : `${label()} paused.`;
}

function label() {
  return mode === 'softbody' ? 'Soft body' : mode === 'ball' ? 'Ball' : 'Car';
}

// ---------------------------------------------------------------------------
// Stepping
// ---------------------------------------------------------------------------

function step(dt) {
  const world = { width: WIDTH, height: worldHeight() };
  if (mode === 'softbody') softbody.update(dt, world);
  else if (mode === 'ball') ball.update(dt, world);
  else car.update(dt, world, input);
  if (drag) stepDrag(drag.control, dt);
  stepCount++;
}

function frame(now) {
  requestAnimationFrame(frame);
  const elapsed = lastTime ? Math.min((now - lastTime) / 1000, MAX_FRAME) : 0;
  lastTime = now;
  if (!running || !visible || document.hidden) return;
  accumulator += elapsed;
  let steps = 0;
  while (accumulator >= FIXED_DT && steps < MAX_STEPS) {
    input.left = keys.has('left') || touch.left;
    input.right = keys.has('right') || touch.right;
    step(FIXED_DT);
    accumulator -= FIXED_DT;
    steps++;
  }
  if (accumulator > FIXED_DT * MAX_STEPS) accumulator = 0;
  render();
  stepsPerSecond = elapsed > 0 ? Math.round(steps / elapsed) : 0;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function render() {
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (mode === 'softbody') {
    drawSoftBody();
  } else {
    drawTerrain();
    if (mode === 'ball') drawBall();
    else drawCar();
  }
  metricsEl.textContent = mode === 'softbody' ? '8 linked points' : mode === 'ball' ? 'Gravity + terrain collisions' : '2 wheels · 1 link';
}

function terrainPath() {
  ctx.beginPath();
  ctx.moveTo(0, terrain.heightAtX(0));
  terrain.height.forEach((y, i) => ctx.lineTo(i * terrain.detail, y));
  ctx.lineTo(canvas.width, terrain.heightAtX(canvas.width));
}

function drawTerrain() {
  terrainPath();
  ctx.lineTo(canvas.width, canvas.height);
  ctx.lineTo(0, canvas.height);
  ctx.closePath();
  ctx.fillStyle = 'rgba(154,156,150,.12)';
  ctx.fill();
  terrainPath();
  ctx.strokeStyle = COLORS.ground;
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawSoftBody() {
  const pts = softbody.points;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 0; i < pts.length; i++) {
    const a = pts[(i + pts.length - 1) % pts.length], b = pts[i];
    const c = pts[(i + 1) % pts.length], d = pts[(i + 2) % pts.length];
    ctx.bezierCurveTo(b.x + (c.x-a.x)/6, b.y + (c.y-a.y)/6,
      c.x - (d.x-b.x)/6, c.y - (d.y-b.y)/6, c.x, c.y);
  }
  ctx.closePath();
  ctx.fillStyle = 'rgba(232,230,218,.08)';
  ctx.fill();
  ctx.strokeStyle = COLORS.ivory;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = COLORS.crimson;
  for (const pt of pts) {
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.rad, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBall() {
  ctx.beginPath();
  ctx.arc(ball.pos.x, ball.pos.y, ball.rad, 0, Math.PI * 2);
  ctx.strokeStyle = COLORS.ivory;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = COLORS.crimson;
  ctx.beginPath();
  ctx.arc(ball.pos.x, ball.pos.y, 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawCar() {
  const [a, b] = car.bodies;
  ctx.strokeStyle = COLORS.ivory;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(a.pos.x, a.pos.y);
  ctx.lineTo(b.pos.x, b.pos.y);
  ctx.stroke();
  for (const body of car.bodies) {
    ctx.beginPath();
    ctx.arc(body.pos.x, body.pos.y, body.rad, 0, Math.PI * 2);
    ctx.strokeStyle = COLORS.crimson;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,70,85,.14)';
    ctx.fill();
  }
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * canvas.height,
  };
}

canvas.addEventListener('pointerdown', (event) => {
  if (event.button !== 0 || drag) return;
  canvas.focus({preventScroll:true});
  const p = canvasPoint(event);
  const radius = Math.max(15, 18 * WIDTH / canvas.getBoundingClientRect().width);
  const simulation = mode === 'softbody' ? softbody : mode === 'ball' ? ball : car;
  let grabbed = null;
  if (mode === 'softbody') grabbed = softbody.nearest(p.x, p.y, radius);
  else if (mode === 'ball') {
    if (Math.hypot(p.x-ball.pos.x, p.y-ball.pos.y) <= ball.rad) grabbed = ball;
  } else grabbed = car.nearest(p.x, p.y, Math.max(30, radius));
  if (!grabbed) return;
  const control = createDrag(mode, simulation, grabbed, p, {width:WIDTH, height:worldHeight()});
  if (!control) return;
  drag = {control, pointerId:event.pointerId};
  canvas.setPointerCapture(event.pointerId);
  canvas.classList.add('dragging');
  event.preventDefault();
});

canvas.addEventListener('pointermove', (event) => {
  if (!drag || event.pointerId !== drag.pointerId) return;
  updateDrag(drag.control, canvasPoint(event));
  stepDrag(drag.control, FIXED_DT);
  render();
  event.preventDefault();
});

function endDrag(event) {
  if (!drag || (event?.pointerId !== undefined && event.pointerId !== drag.pointerId)) return;
  const held = drag;
  drag = null;
  releaseDrag(held.control);
  if (canvas.hasPointerCapture(held.pointerId)) canvas.releasePointerCapture(held.pointerId);
  canvas.classList.remove('dragging');
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);
canvas.addEventListener('lostpointercapture', endDrag);

canvas.addEventListener('keydown', (event) => {
  const key = event.key;
  if ((key === ' ' || key === 'Spacebar') && !event.repeat) {
    event.preventDefault();
    setRunning(!running);
    return;
  }
  if (key === 'r' || key === 'R') { event.preventDefault(); resetSim(); return; }
  if ((key === 't' || key === 'T') && mode !== 'softbody') { event.preventDefault(); makeTerrain(true); resetSim(); return; }
  if (mode === 'car' && (key === 'a' || key === 'A' || key === 'ArrowLeft')) { keys.add('left'); event.preventDefault(); }
  if (mode === 'car' && (key === 'd' || key === 'D' || key === 'ArrowRight')) { keys.add('right'); event.preventDefault(); }
});

canvas.addEventListener('keyup', (event) => {
  const key = event.key;
  if (key === 'a' || key === 'A' || key === 'ArrowLeft') keys.delete('left');
  if (key === 'd' || key === 'D' || key === 'ArrowRight') keys.delete('right');
});

canvas.addEventListener('blur', clearInput);
window.addEventListener('blur', clearInput);
document.addEventListener('visibilitychange', () => { if (document.hidden) clearInput(); });

function bindHold(el, side) {
  const down = (event) => { el.focus({preventScroll:true}); el.setPointerCapture(event.pointerId); touch[side] = true; event.preventDefault(); };
  const up = () => { touch[side] = false; };
  el.addEventListener('pointerdown', down);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointerleave', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('lostpointercapture', up);
  el.addEventListener('blur', up);
  el.addEventListener('keydown', event => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); touch[side] = true; } });
  el.addEventListener('keyup', event => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); up(); } });
}
bindHold(document.getElementById('left'), 'left');
bindHold(document.getElementById('right'), 'right');

pauseBtn.addEventListener('click', () => setRunning(!running));
resetBtn.addEventListener('click', resetSim);
terrainBtn.addEventListener('click', () => { makeTerrain(true); resetSim(); });
for (const btn of document.querySelectorAll('.mode')) {
  btn.addEventListener('click', () => setMode(btn.dataset.mode));
}

if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries) => {
    visible = entries.some((entry) => entry.isIntersecting);
  }, { threshold: 0.01 });
  observer.observe(canvas);
}

setMode('softbody');
lastTime = performance.now();
requestAnimationFrame(frame);
