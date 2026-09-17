"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { getContrastColor } from "@/lib/branding";

// World space mirrors the field's real proportions (100 yards + two 10-yard
// end zones) at a small, three.js-friendly scale — 1 world unit per yard.
const WORLD_WIDTH = 120; // 100 playing yards + 2x10 end zones
const WORLD_DEPTH = 30; // sideline to sideline
const END_ZONE_WORLD = 10;

interface TeamVisual {
  abbreviation: string;
  name: string;
  primaryColor: string;
  secondaryColor: string;
}

export interface PlayerMotion {
  key: string;
  startX: number; // 0-1000 field space, same convention as the rest of LiveGamePlayer
  startY: number; // 0-300
  endX: number;
  endY: number;
  color: string;
  ring: string;
  isTackler?: boolean;
  isCarrier?: boolean;
  // True for whichever player is actually holding the ball when the play
  // dies — the ball carrier on a run/return, or the QB on a sack — so they
  // (not just the tackler) go down when the play ends in a tackle.
  isBallHandler?: boolean;
  // Plays a kicking-leg swing instead of a running stride (field goal/XP
  // kicker, punter).
  isKicker?: boolean;
  // Plays a throwing motion instead of a running stride (the QB on a pass).
  isPasser?: boolean;
  // Extends the ball forward for the exchange instead of a running stride
  // (the QB on a run/touchdown, handing off to the RB).
  isHandingOff?: boolean;
  // Reaches up to make the catch late in the play (the pass's actual target).
  isReceiver?: boolean;
  // A route break: the player runs straight toward (viaX, viaY) first, then
  // cuts to (endX, endY) — an L-shaped route instead of a straight lerp.
  viaX?: number;
  viaY?: number;
}

export type MotionKind = "pass" | "run" | "sack" | "kick" | "straight";

export interface Field3DProps {
  home: TeamVisual;
  away: TeamVisual;
  playIndex: number;
  kind: MotionKind;
  isKickAttempt: boolean;
  scoredThisPlay: boolean;
  kickMissed: boolean;
  motionDurationMs: number;
  ballFromX: number; // 0-1000
  ballToX: number;
  ballToY: number; // 0-300, usually 150 except a missed kick's lateral miss
  lineOfScrimmageX: number | null;
  firstDownX: number | null;
  players: PlayerMotion[];
  ballCarrierRides: boolean; // true for run/return plays — a runner mesh rides the ball's own path
}

function toWorldX(x: number) {
  return (x / 1000) * WORLD_WIDTH - WORLD_WIDTH / 2;
}
function toWorldZ(y: number) {
  return (y / 300) * WORLD_DEPTH - WORLD_DEPTH / 2;
}

// Builds the static turf — mow stripes, yard lines/numbers, hash marks — as a
// single canvas texture. Cheap to render (one plane) and redrawn only when a
// team's colors change, unlike per-line 3D geometry.
function useFieldTexture(home: TeamVisual, away: TeamVisual) {
  const homeLabel = home.abbreviation;
  const awayLabel = away.abbreviation;
  return useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 2048;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    if (!ctx) return new THREE.CanvasTexture(canvas);
    const w = canvas.width;
    const h = canvas.height;
    const endZoneW = (END_ZONE_WORLD / WORLD_WIDTH) * w;
    const fieldW = w - endZoneW * 2;

    const turf = ctx.createLinearGradient(0, 0, 0, h);
    turf.addColorStop(0, "#0f3d21");
    turf.addColorStop(0.55, "#166534");
    turf.addColorStop(1, "#1d7a3d");
    ctx.fillStyle = turf;
    ctx.fillRect(0, 0, w, h);

    for (let i = 0; i < 10; i++) {
      if (i % 2 !== 0) continue;
      ctx.fillStyle = "rgba(255,255,255,0.045)";
      ctx.fillRect(endZoneW + (i * fieldW) / 10, 0, fieldW / 10, h);
    }

    ctx.fillStyle = home.secondaryColor;
    ctx.globalAlpha = 0.9;
    ctx.fillRect(0, 0, endZoneW, h);
    ctx.fillStyle = away.secondaryColor;
    ctx.fillRect(w - endZoneW, 0, endZoneW, h);
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.translate(endZoneW / 2, h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.font = `900 ${endZoneW * 0.34}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = getContrastColor(home.secondaryColor);
    ctx.globalAlpha = 0.45;
    ctx.fillText(homeLabel, 0, 0);
    ctx.restore();

    ctx.save();
    ctx.translate(w - endZoneW / 2, h / 2);
    ctx.rotate(Math.PI / 2);
    ctx.font = `900 ${endZoneW * 0.34}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = getContrastColor(away.secondaryColor);
    ctx.globalAlpha = 0.45;
    ctx.fillText(awayLabel, 0, 0);
    ctx.restore();
    ctx.globalAlpha = 1;

    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 3;
    ctx.font = `bold ${h * 0.09}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    for (let yard = 10; yard < 100; yard += 10) {
      const x = endZoneW + (yard / 100) * fieldW;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
      const label = String(yard <= 50 ? yard : 100 - yard);
      ctx.fillText(label, x, h * 0.17);
      ctx.fillText(label, x, h * 0.98);
    }

    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 2;
    for (let yard = 5; yard < 100; yard += 5) {
      if (yard % 10 === 0) continue;
      const x = endZoneW + (yard / 100) * fieldW;
      ctx.beginPath();
      ctx.moveTo(x, h * 0.32);
      ctx.lineTo(x, h * 0.36);
      ctx.moveTo(x, h * 0.64);
      ctx.lineTo(x, h * 0.68);
      ctx.stroke();
    }

    return new THREE.CanvasTexture(canvas);
  }, [home.secondaryColor, away.secondaryColor, homeLabel, awayLabel]);
}

function FieldGround({ home, away }: { home: TeamVisual; away: TeamVisual }) {
  const texture = useFieldTexture(home, away);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[WORLD_WIDTH, WORLD_DEPTH]} />
      <meshStandardMaterial map={texture} roughness={0.95} />
    </mesh>
  );
}

function FieldLine({ x, color }: { x: number; color: string }) {
  return (
    <mesh position={[toWorldX(x), 0.06, 0]}>
      <boxGeometry args={[0.15, 0.02, WORLD_DEPTH]} />
      <meshBasicMaterial color={color} transparent opacity={0.85} />
    </mesh>
  );
}

function Goalpost({ x }: { x: number }) {
  const worldX = toWorldX(x);
  const poleColor = "#facc15";
  return (
    <group position={[worldX, 0, 0]}>
      <mesh position={[0, 1.5, 0]}>
        <cylinderGeometry args={[0.09, 0.09, 3, 10]} />
        <meshStandardMaterial color={poleColor} metalness={0.4} roughness={0.4} />
      </mesh>
      <mesh position={[0, 3, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 3.6, 8]} />
        <meshStandardMaterial color={poleColor} metalness={0.4} roughness={0.4} />
      </mesh>
      <mesh position={[0, 3.8, -3.5]}>
        <cylinderGeometry args={[0.06, 0.06, 3.4, 8]} />
        <meshStandardMaterial color={poleColor} metalness={0.4} roughness={0.4} />
      </mesh>
      <mesh position={[0, 3.8, 3.5]}>
        <cylinderGeometry args={[0.06, 0.06, 3.4, 8]} />
        <meshStandardMaterial color={poleColor} metalness={0.4} roughness={0.4} />
      </mesh>
    </group>
  );
}

// A stylized player: a jersey-colored capsule body with a helmet, animated
// every frame from its pre-snap spot toward wherever the play leaves it. Runs
// don't use React state for motion — a per-mesh progress ref driven by
// useFrame keeps 22 moving players cheap.
function PlayerMesh({
  motion,
  durationMs,
  playIndex,
  fallOnImpact,
}: {
  motion: PlayerMotion;
  durationMs: number;
  playIndex: number;
  fallOnImpact: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);
  const startedAt = useRef(0);
  const fallen = useRef(false);

  const start = useMemo(
    () => new THREE.Vector3(toWorldX(motion.startX), 0, toWorldZ(motion.startY)),
    [motion.startX, motion.startY]
  );
  const end = useMemo(
    () => new THREE.Vector3(toWorldX(motion.endX), 0, toWorldZ(motion.endY)),
    [motion.endX, motion.endY]
  );
  const via = useMemo(
    () =>
      motion.viaX !== undefined && motion.viaY !== undefined
        ? new THREE.Vector3(toWorldX(motion.viaX), 0, toWorldZ(motion.viaY))
        : null,
    [motion.viaX, motion.viaY]
  );

  const posAt = (t: number) => {
    if (!via) return new THREE.Vector3().lerpVectors(start, end, t);
    // Quadratic Bezier through the route's break point — a rounded cut
    // rather than a straight lerp or a sharp corner.
    const a = new THREE.Vector3().lerpVectors(start, via, t);
    const b = new THREE.Vector3().lerpVectors(via, end, t);
    return a.lerp(b, t);
  };

  useFrame((state) => {
    if (startedAt.current === 0) startedAt.current = state.clock.elapsedTime;
    const elapsedMs = (state.clock.elapsedTime - startedAt.current) * 1000;
    const progress = Math.max(0, Math.min(1, elapsedMs / durationMs));
    const eased = 1 - Math.pow(1 - progress, 2);
    const g = groupRef.current;
    if (!g) return;
    const pos = posAt(eased);
    g.position.x = pos.x;
    g.position.z = pos.z;

    const moving = progress < 1;
    if (moving && motion.isCarrier) {
      const nextPos = posAt(Math.min(1, eased + 0.02));
      const dx = nextPos.x - pos.x;
      const dz = nextPos.z - pos.z;
      const len = Math.hypot(dx, dz) || 1;
      const juke = Math.sin(state.clock.elapsedTime * 6) * 0.5;
      g.position.x += (-dz / len) * juke;
      g.position.z += (dx / len) * juke;
    }
    const bob = moving ? Math.abs(Math.sin(state.clock.elapsedTime * 9)) * 0.12 : 0;
    g.position.y = bob;

    const strideSpeed = motion.isCarrier ? 11 : 9;
    const stride = Math.sin(state.clock.elapsedTime * strideSpeed);
    const body = bodyRef.current;
    if (body) {
      if (moving) {
        if (motion.isKicker) {
          // Plant leg holds steady; the kicking leg swings back-to-front as
          // the ball leaves, with the arms countering for balance.
          const kickT = Math.min(1, eased / 0.35);
          const swing = THREE.MathUtils.lerp(-0.5, 1.3, 1 - Math.pow(1 - kickT, 3));
          if (rightLegRef.current) rightLegRef.current.rotation.x = swing;
          if (leftLegRef.current) leftLegRef.current.rotation.x = -0.15;
          if (leftArmRef.current) leftArmRef.current.rotation.x = THREE.MathUtils.lerp(0, -0.4, kickT);
          if (rightArmRef.current) rightArmRef.current.rotation.x = THREE.MathUtils.lerp(0, 0.3, kickT);
        } else if (motion.isPasser) {
          // Cock the arm back, then release forward early in the snap.
          const throwT = Math.min(1, eased / 0.4);
          const arm = THREE.MathUtils.lerp(-1.1, 0.9, 1 - Math.pow(1 - throwT, 3));
          if (rightArmRef.current) rightArmRef.current.rotation.x = arm;
          if (leftArmRef.current) leftArmRef.current.rotation.x = -0.2;
          if (leftLegRef.current) leftLegRef.current.rotation.x = stride * 0.25;
          if (rightLegRef.current) rightLegRef.current.rotation.x = -stride * 0.25;
        } else if (motion.isReceiver) {
          // Reach both arms up to make the catch as the ball arrives late.
          const catchT = Math.max(0, Math.min(1, (eased - 0.6) / 0.4));
          const reach = THREE.MathUtils.lerp(0, -1.3, catchT);
          if (leftArmRef.current) leftArmRef.current.rotation.x = reach;
          if (rightArmRef.current) rightArmRef.current.rotation.x = reach;
          if (leftLegRef.current) leftLegRef.current.rotation.x = stride * 0.6;
          if (rightLegRef.current) rightLegRef.current.rotation.x = -stride * 0.6;
        } else if (motion.isHandingOff) {
          // Turn and extend the ball forward for the exchange early in the
          // snap, then stay put watching the play develop — a real handoff
          // stands still afterward rather than continuing to run downfield.
          const handoffT = Math.min(1, eased / 0.3);
          const extend = THREE.MathUtils.lerp(0, -0.7, 1 - Math.pow(1 - handoffT, 3));
          if (leftArmRef.current) leftArmRef.current.rotation.x = extend;
          if (rightArmRef.current) rightArmRef.current.rotation.x = extend;
          if (leftLegRef.current) leftLegRef.current.rotation.x = stride * 0.15;
          if (rightLegRef.current) rightLegRef.current.rotation.x = -stride * 0.15;
        } else {
          if (leftLegRef.current) leftLegRef.current.rotation.x = stride * 0.6;
          if (rightLegRef.current) rightLegRef.current.rotation.x = -stride * 0.6;
          if (leftArmRef.current) leftArmRef.current.rotation.x = -stride * 0.5;
          if (rightArmRef.current) rightArmRef.current.rotation.x = stride * 0.5;
        }
        body.rotation.z = stride * 0.05;
        const nextPos = posAt(Math.min(1, eased + 0.05));
        body.rotation.y = Math.atan2(nextPos.x - pos.x, nextPos.z - pos.z);
      } else if (fallOnImpact && !fallen.current) {
        fallen.current = true;
      }
      if (!moving && !fallen.current) {
        // Settle the stride back to a neutral standing pose once the play ends.
        for (const limb of [leftLegRef, rightLegRef, leftArmRef, rightArmRef]) {
          if (limb.current) limb.current.rotation.x = THREE.MathUtils.lerp(limb.current.rotation.x, 0, 0.3);
        }
      }
      if (fallen.current) {
        body.rotation.x = THREE.MathUtils.lerp(body.rotation.x, Math.PI / 2.1, 0.25);
        g.position.y = THREE.MathUtils.lerp(g.position.y, 0.3, 0.25);
      }
    }
  });

  return (
    <group ref={groupRef} position={start} key={`${motion.key}-${playIndex}`}>
      <group ref={bodyRef}>
        {/* hips/pants */}
        <mesh position={[0, 0.5, 0]} castShadow>
          <boxGeometry args={[0.46, 0.24, 0.28]} />
          <meshStandardMaterial color="#1f2937" roughness={0.8} />
        </mesh>
        {/* torso/jersey */}
        <mesh position={[0, 0.94, 0]} castShadow>
          <capsuleGeometry args={[0.3, 0.42, 4, 8]} />
          <meshStandardMaterial color={motion.color} roughness={0.6} />
        </mesh>
        {/* helmet */}
        <mesh position={[0, 1.55, 0]} castShadow>
          <sphereGeometry args={[0.27, 14, 14]} />
          <meshStandardMaterial color={motion.ring} roughness={0.25} metalness={0.15} />
        </mesh>
        {/* facemask */}
        <mesh position={[0, 1.49, 0.25]} castShadow>
          <boxGeometry args={[0.16, 0.1, 0.06]} />
          <meshStandardMaterial color="#1f2937" roughness={0.4} metalness={0.3} />
        </mesh>

        {/* arms, pivoted at the shoulder so they swing with the stride */}
        <group ref={leftArmRef} position={[-0.4, 1.3, 0]}>
          <mesh position={[0, -0.24, 0]} castShadow>
            <capsuleGeometry args={[0.1, 0.36, 4, 8]} />
            <meshStandardMaterial color={motion.color} roughness={0.6} />
          </mesh>
        </group>
        <group ref={rightArmRef} position={[0.4, 1.3, 0]}>
          <mesh position={[0, -0.24, 0]} castShadow>
            <capsuleGeometry args={[0.1, 0.36, 4, 8]} />
            <meshStandardMaterial color={motion.color} roughness={0.6} />
          </mesh>
        </group>

        {/* legs, pivoted at the hip so they swing with the stride */}
        <group ref={leftLegRef} position={[-0.16, 0.5, 0]}>
          <mesh position={[0, -0.28, 0]} castShadow>
            <capsuleGeometry args={[0.14, 0.42, 4, 8]} />
            <meshStandardMaterial color="#1f2937" roughness={0.8} />
          </mesh>
          <mesh position={[0, -0.56, 0.06]} castShadow>
            <boxGeometry args={[0.16, 0.1, 0.24]} />
            <meshStandardMaterial color="#111827" roughness={0.6} />
          </mesh>
        </group>
        <group ref={rightLegRef} position={[0.16, 0.5, 0]}>
          <mesh position={[0, -0.28, 0]} castShadow>
            <capsuleGeometry args={[0.14, 0.42, 4, 8]} />
            <meshStandardMaterial color="#1f2937" roughness={0.8} />
          </mesh>
          <mesh position={[0, -0.56, 0.06]} castShadow>
            <boxGeometry args={[0.16, 0.1, 0.24]} />
            <meshStandardMaterial color="#111827" roughness={0.6} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

// The ball: airborne with a real parabolic arc for passes/kicks, or carried
// near hand-height for runs/returns (where a separate runner mesh also rides
// this same path).
function Ball({
  from,
  to,
  toY,
  durationMs,
  kind,
  playIndex,
}: {
  from: { x: number; y: number };
  to: { x: number; y: number };
  toY: number;
  durationMs: number;
  kind: MotionKind;
  playIndex: number;
}) {
  const ref = useRef<THREE.Group>(null);
  const startedAt = useRef(0);
  const start = useMemo(() => new THREE.Vector3(toWorldX(from.x), 1.1, toWorldZ(from.y)), [from.x, from.y]);
  const end = useMemo(() => new THREE.Vector3(toWorldX(to.x), 1.1, toWorldZ(toY)), [to.x, toY]);
  const airborne = kind === "pass" || kind === "kick";
  const peakHeight = airborne ? Math.min(14, 3 + start.distanceTo(end) * 0.35) : 1.4;
  // A real spiral: the ball's long axis points along its actual direction of
  // travel (not just an arbitrary spin), tilted flat so it "spins" nose-first
  // like a real thrown football rather than tumbling end over end.
  const yawQuat = useMemo(() => {
    const yaw = Math.atan2(end.x - start.x, end.z - start.z);
    return new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  }, [start, end]);
  const tiltQuat = useMemo(() => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2), []);
  const spinAxis = useMemo(() => new THREE.Vector3(1, 0, 0), []);
  const spinQuat = useMemo(() => new THREE.Quaternion(), []);
  const orientation = useMemo(() => new THREE.Quaternion(), []);

  useFrame((state) => {
    if (startedAt.current === 0) startedAt.current = state.clock.elapsedTime;
    const elapsedMs = (state.clock.elapsedTime - startedAt.current) * 1000;
    const progress = Math.max(0, Math.min(1, elapsedMs / durationMs));
    const g = ref.current;
    if (!g) return;
    g.position.lerpVectors(start, end, progress);
    const arc = Math.sin(progress * Math.PI) * peakHeight;
    g.position.y = start.y + arc;

    if (airborne) {
      const spinSpeed = kind === "pass" ? 16 : 10;
      spinQuat.setFromAxisAngle(spinAxis, state.clock.elapsedTime * spinSpeed);
      orientation.copy(yawQuat).multiply(tiltQuat).multiply(spinQuat);
      g.quaternion.copy(orientation);
    } else {
      g.rotation.x += kind === "sack" ? 0 : 0.25;
      g.rotation.z = progress * 3;
    }
  });

  return (
    <group ref={ref} position={start} key={`ball-${playIndex}`}>
      <mesh castShadow>
        <capsuleGeometry args={[0.24, 0.34, 4, 8]} />
        <meshStandardMaterial color="#8B4513" roughness={0.5} />
      </mesh>
    </group>
  );
}

// Camera pans along the length of the field to track the play, broadcast
// sideline-cam style, and — critically — zooms in tight for a short gain and
// pulls back for a long pass or kick, instead of sitting at one fixed wide
// distance the whole game. A static wide shot makes a 5-yard run register as
// a couple of pixels of movement; a dynamic distance keeps every play legible.
function CameraRig({ fromX, toX }: { fromX: number; toX: number }) {
  const worldFrom = toWorldX(fromX);
  const worldTo = toWorldX(toX);
  const worldMidX = (worldFrom + worldTo) / 2;
  const spanWorld = Math.abs(worldTo - worldFrom);
  useFrame((state) => {
    const desiredX = THREE.MathUtils.clamp(worldMidX, -WORLD_WIDTH / 2 + 20, WORLD_WIDTH / 2 - 20);
    state.camera.position.x = THREE.MathUtils.lerp(state.camera.position.x, desiredX * 0.6, 0.06);

    const desiredDistance = THREE.MathUtils.clamp(spanWorld * 0.55 + 10, 12, 32);
    state.camera.position.z = THREE.MathUtils.lerp(state.camera.position.z, desiredDistance, 0.06);
    state.camera.position.y = THREE.MathUtils.lerp(state.camera.position.y, desiredDistance * 0.85, 0.06);

    state.camera.lookAt(desiredX * 0.6, 0, 0);
  });
  return null;
}

export function Field3D({
  home,
  away,
  playIndex,
  kind,
  isKickAttempt,
  scoredThisPlay,
  kickMissed,
  motionDurationMs,
  ballFromX,
  ballToX,
  ballToY,
  lineOfScrimmageX,
  firstDownX,
  players,
  ballCarrierRides,
}: Field3DProps) {
  return (
    <div className="relative aspect-[10/4] w-full overflow-hidden rounded-lg border border-border-line bg-black shadow-[0_35px_60px_-15px_rgba(0,0,0,0.75)]">
      <Canvas shadows camera={{ position: [0, 12, 14], fov: 42 }} dpr={[1, 1.75]}>
        <color attach="background" args={["#03130a"]} />
          <fog attach="fog" args={["#03130a", 60, 130]} />
          <ambientLight intensity={0.55} />
          <directionalLight position={[20, 30, 10]} intensity={1.1} castShadow shadow-mapSize={[1024, 1024]} />
          <pointLight position={[-30, 20, 0]} intensity={0.4} color="#bcd7ff" />
          <pointLight position={[30, 20, 0]} intensity={0.4} color="#bcd7ff" />

          <FieldGround home={home} away={away} />
          <Goalpost x={-2} />
          <Goalpost x={1002} />

          {lineOfScrimmageX !== null && <FieldLine x={lineOfScrimmageX} color="#60a5fa" />}
          {firstDownX !== null && <FieldLine x={firstDownX} color="#facc15" />}

          {players.map((p) => {
            // Tacklers go down on any run/sack; the man who actually had the
            // ball (runner or sacked QB) goes down too — unless he just
            // scored, in which case he stays on his feet in the end zone.
            const fallOnImpact =
              kind === "sack"
                ? Boolean(p.isTackler) || Boolean(p.isBallHandler)
                : kind === "run"
                  ? Boolean(p.isTackler) || (Boolean(p.isBallHandler) && !scoredThisPlay)
                  : false;
            return (
              <PlayerMesh
                key={`${p.key}-${playIndex}`}
                motion={p}
                durationMs={motionDurationMs}
                playIndex={playIndex}
                fallOnImpact={fallOnImpact}
              />
            );
          })}

          <Ball
            from={{ x: ballFromX, y: 150 }}
            to={{ x: isKickAttempt ? ballToX : ballToX, y: ballToY }}
            toY={ballToY}
            durationMs={motionDurationMs}
            kind={kind}
            playIndex={playIndex}
          />
          {ballCarrierRides && (
            <PlayerMesh
              key={`carrier-${playIndex}`}
              motion={{
                key: "carrier",
                startX: ballFromX,
                startY: 150,
                endX: ballToX,
                endY: ballToY,
                color: "#eab308",
                ring: "#1f2937",
                isCarrier: true,
                isBallHandler: true,
              }}
              durationMs={motionDurationMs}
              playIndex={playIndex}
              fallOnImpact={!scoredThisPlay}
            />
          )}

          {scoredThisPlay && <pointLight position={[toWorldX(ballToX), 8, 0]} intensity={2.2} color="#f5a623" distance={30} />}
          {kickMissed && <pointLight position={[toWorldX(ballToX), 4, toWorldZ(ballToY)]} intensity={1.4} color="#f87171" distance={20} />}

        <CameraRig fromX={ballFromX} toX={ballToX} />
      </Canvas>
    </div>
  );
}
