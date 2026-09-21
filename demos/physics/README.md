# Physics demos

Three vanilla JS Canvas physics modes on one responsive page. No dependencies,
no build step.

Serve the repo and visit `/demos/physics/` (ES modules are blocked over `file://`).

## Modes

- **Soft body** (default) — an 8-point linked ring with area restoration.
  Drag any point to stretch it; gravity, damping and inflation pull it back.
- **Ball** — a Verlet ball rolling on seeded rolling terrain.
  Drag the ball to reposition it, then release to let it fall.
- **Car** — two wheels held at a fixed 100 px distance, driven along the terrain
  tangent with `A` / `D`, arrow keys, or the on-screen hold buttons.

Controls: `Space` pause/play, `R` reset, `T` new terrain (ball/car). Shortcuts
apply only while the canvas is focused; buttons are keyboard accessible and touch
drag / hold is supported. Input clears on blur, tab hide and pointer cancel.

## Source mapping

| Browser file | Original |
| --- | --- |
| `js/engine.js` `SoftBody`, `polygon`, `area`, `linkPoint`, `inflatePoint` | `softbody.py` |
| `js/engine.js` `Ball`, `collision` | `ball_physics/physics.py` |
| `js/engine.js` `Car` | `car/physics.py` |
| Mode setup, gravity/detail/damp constants | `ball_physics/ball_physics.pyde`, `car/car.pyde` |
| `js/app.js` | Rendering + input from both `.pyde` sketches (py5 → Canvas) |

The original Python / py5 experiments were designed and hand-coded entirely by
Ryan Fong. This JavaScript / Canvas version is an AI-assisted browser adaptation
of that work.

## Intentional changes

- **Terrain noise**: Processing's `noise()` is replaced with seeded value noise.
  Hills are deterministic per seed but intentionally not identical. Reset keeps
  the same seed; "New terrain" picks a new one.
- **Uninitialized mouse state** in the original sketches is initialized to
  `null` (they read `mouse_drag` / `mouse_targ` before assignment).
- **Negative terrain indices**: the original `int(x1 / detail)` lookups could go
  negative at the left edge; the port clamps to `[0, length - 1]`.
- **Position history**: the port stores explicit coordinate copies for Verlet integration.
- **Stable browser dragging** follows the pointer immediately without a speed cap, synchronizes Verlet position history, and releases gently. Dragging a car wheel translates both wheels together to preserve its linkage. Soft-body points remain individually draggable. The original mouse-event velocity injection is not retained.
- `world` size is 1280×720 for the soft body (its original height) and 1280×800
  for ball/car, matching the original sketches.
- Loop uses a fixed 1/120 s step with an accumulator, a bounded frame delta
  (0.05 s), pauses when the tab is hidden, and skips stepping while the canvas is
  offscreen.

## Checks

```sh
node --check demos/physics/js/engine.js
node --check demos/physics/js/app.js
node --test demos/physics/tests/*.test.mjs
```

## Browser verification

Verified soft-body and ball dragging, paused reset/mode switching, and conditional car controls. Homepage artwork links to this playground. The renderer uses curved soft-body outlines and straight terrain segments matching collision geometry. Exact-on-segment circle collisions have a defined upward push-out, covered by a regression test. Original source files are unchanged.

The initial terrain uses seed 15, chosen so the original car motor can drive in both directions. Steeper regenerated slopes can exceed its climbing force. Keyboard-accessible drive buttons support holding Space/Enter as well as pointer/touch input. Mobile layout checked at 390px with no horizontal overflow. Seven engine tests and one added exact-contact regression pass.
