"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { WORLD_WIDTH, toWorldX, toWorldZ } from "./coordinates";

// What happens at the end of the play, in purely visual terms — this is the
// only "outcome" data the camera consumes. It's computed by the caller from
// real play-resolution data (pass complete/incomplete, scoring, tackled),
// but CameraRig itself has no idea what a pass or a tackle *is*: it just
// reacts to one of these four labels (or none) arriving late in the play's
// timeline with a tighter, quicker cut instead of the smooth chase framing
// used for the rest of the play.
export type CameraEvent = "catch" | "tackle" | "score" | "miss" | null;

interface CameraRigProps {
  fromX: number; // 0-1000 field space
  toX: number;
  toY: number; // 0-300 field space, lateral position the play ends at
  durationMs: number;
  playIndex: number;
  event: CameraEvent;
}

// Camera pans along the length of the field to track the play, broadcast
// sideline-cam style, zooming in tight for a short gain and pulling back for
// a long pass or kick instead of sitting at one fixed wide distance the
// whole game. It also tilts down toward field level rather than sitting
// purely overhead, and snaps to a tighter, lower "quick cut" framing in the
// last stretch of a play that ends in a catch/tackle/score/miss — the way a
// broadcast director punches to a tighter camera the instant the ball is
// caught rather than easing into it.
export function CameraRig({ fromX, toX, toY, durationMs, playIndex, event }: CameraRigProps) {
  const worldFrom = toWorldX(fromX);
  const worldTo = toWorldX(toX);
  const worldToZ = toWorldZ(toY);
  const worldMidX = (worldFrom + worldTo) / 2;
  const spanWorld = Math.abs(worldTo - worldFrom);
  const startedAt = useRef(0);

  useEffect(() => {
    startedAt.current = 0;
  }, [playIndex]);

  useFrame((state) => {
    if (startedAt.current === 0) startedAt.current = state.clock.elapsedTime;
    const elapsedMs = (state.clock.elapsedTime - startedAt.current) * 1000;
    const progress = THREE.MathUtils.clamp(durationMs > 0 ? elapsedMs / durationMs : 1, 0, 1);

    const desiredX = THREE.MathUtils.clamp(worldMidX, -WORLD_WIDTH / 2 + 20, WORLD_WIDTH / 2 - 20);
    const chaseDistance = THREE.MathUtils.clamp(spanWorld * 0.55 + 10, 12, 32);

    // The last ~18% of a play that has a real outcome event gets the quick
    // cut; plain in-between motion (or a play with no event, like a punt in
    // flight) keeps the smooth chase the whole way.
    const inQuickCut = event !== null && progress > 0.82;
    const targetDistance = inQuickCut ? Math.max(8, chaseDistance * 0.55) : chaseDistance;
    // A quick cut snaps fast (broadcast-style hard cut); the chase camera
    // trails with a slight lag the rest of the time.
    const lerpSpeed = inQuickCut ? 0.35 : 0.06;

    state.camera.position.x = THREE.MathUtils.lerp(state.camera.position.x, desiredX * 0.6, lerpSpeed);
    state.camera.position.z = THREE.MathUtils.lerp(state.camera.position.z, targetDistance, lerpSpeed);
    // Lower height-to-distance ratio than a pure overhead shot, plus a fixed
    // height offset, so the camera reads as a raised sideline boom tilted
    // down at the field rather than a drone hovering straight above it.
    const heightRatio = inQuickCut ? 0.45 : 0.62;
    state.camera.position.y = THREE.MathUtils.lerp(state.camera.position.y, targetDistance * heightRatio + 2.2, lerpSpeed);

    // The look-at point drifts slightly toward the play's actual lateral
    // (sideline-to-sideline) end position and sits a bit above the turf —
    // eye-level on the field rather than staring straight down at the grass.
    const lateralBias = THREE.MathUtils.clamp(worldToZ * 0.35, -6, 6);
    state.camera.lookAt(desiredX * 0.6, inQuickCut ? 1.4 : 0.6, lateralBias);
  });

  return null;
}
