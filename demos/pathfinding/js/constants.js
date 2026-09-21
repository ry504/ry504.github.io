// Ported verbatim from constants.py
export const RUN_SPEED = 3.0;
export const CELL_SIZE = 50;
export const MOVE_SPEED = 1.5;
export const JUMP_SPEED = 3;
export const GRAVITY = 2;
export const MAX_RAY_DIST = 20;

// Browser-only additions (documented differences, not in source)
export const WORLD_W = 1280;   // py5.size(1280, 720)
export const WORLD_H = 720;
export const FRAME_RATE = 60;  // source used py5.get_frame_rate(); browser fixes 60Hz
