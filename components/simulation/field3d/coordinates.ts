// Shared field <-> world-space conversion, used by both the field/player
// rendering (Field3D) and the camera (CameraRig) — kept here so the camera
// can consume plain position data without importing anything from the
// field-rendering module itself.

// World space mirrors the field's real proportions (100 yards + two 10-yard
// end zones) at a small, three.js-friendly scale — 1 world unit per yard.
export const WORLD_WIDTH = 120; // 100 playing yards + 2x10 end zones
export const WORLD_DEPTH = 30; // sideline to sideline
export const END_ZONE_WORLD = 10;

export function toWorldX(x: number) {
  return (x / 1000) * WORLD_WIDTH - WORLD_WIDTH / 2;
}
export function toWorldZ(y: number) {
  return (y / 300) * WORLD_DEPTH - WORLD_DEPTH / 2;
}
